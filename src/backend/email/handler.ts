import { desc, eq, inArray } from "drizzle-orm";
import PostalMime, { type Address } from "postal-mime";

import { enqueueOrchestratorTask } from "../ai/agents/orchestrator";
import { classifyEmailStatus } from "../ai/tasks";
import { getDb } from "../db";
import { emails, messages, roles, threads, type Role } from "../db/schema";

type EmailMatch = {
  role: Role;
  score: number;
};

export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext,
) {
  const [parseStream, rawStream] = message.raw.tee();
  const [parsed, rawContent] = await Promise.all([
    PostalMime.parse(parseStream, { attachmentEncoding: "base64" }),
    new Response(rawStream).text(),
  ]);

  const db = getDb(env);
  const emailId = crypto.randomUUID();
  const subject = parsed.subject?.trim() || "(no subject)";
  const body = parsed.text?.trim() || parsed.html?.trim() || "";
  const sender = formatAddress(parsed.from, message.from);

  await db.insert(emails).values({
    id: emailId,
    subject,
    body,
    sender,
    rawContent,
    processedStatus: "pending",
  });

  const activeRoles = await db
    .select()
    .from(roles)
    .where(inArray(roles.status, ["applied", "interviewing"]));
  const match = findBestMatch(activeRoles, `${subject}\n${body}`);

  if (match) {
    await associateEmailWithRole(env, emailId, match.role, subject, sender);
    return;
  }

  await db.update(emails).set({ processedStatus: "unmatched" }).where(eq(emails.id, emailId));
  ctx.waitUntil(sendUnmatchedReply(env, message, emailId, activeRoles));
}

async function associateEmailWithRole(
  env: Env,
  emailId: string,
  role: Role,
  subject: string,
  sender: string,
) {
  const db = getDb(env);
  const [thread] = await ensureRoleThread(env, role);
  const content = [
    `Inbound email matched to ${role.companyName} / ${role.jobTitle}.`,
    `From: ${sender}`,
    `Subject: ${subject}`,
  ].join("\n");

  await db
    .update(emails)
    .set({ roleId: role.id, processedStatus: "associated" })
    .where(eq(emails.id, emailId));
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    threadId: thread.id,
    roleId: role.id,
    author: "system",
    content,
    metadata: { emailId, source: "email_handler" },
  });

  // --- AI-powered status inference ---
  const emailRecord = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
  const emailBody = emailRecord[0]?.body ?? "";

  try {
    const inference = await classifyEmailStatus(env, subject, emailBody, role.status);

    if (
      inference.suggestedStatus &&
      inference.confidence > 0.7 &&
      inference.suggestedStatus !== role.status
    ) {
      await db
        .update(roles)
        .set({ status: inference.suggestedStatus, updatedAt: new Date() })
        .where(eq(roles.id, role.id));

      await db.insert(messages).values({
        id: crypto.randomUUID(),
        threadId: thread.id,
        roleId: role.id,
        author: "system",
        content: `🤖 Status auto-updated: ${role.status} → ${inference.suggestedStatus} (confidence: ${(inference.confidence * 100).toFixed(0)}%)\n${inference.reasoning}`,
        metadata: { source: "email_status_inference", emailId, inference },
      });
    } else if (inference.suggestedStatus && inference.confidence > 0.4) {
      // Log low-confidence suggestion without auto-updating
      await db.insert(messages).values({
        id: crypto.randomUUID(),
        threadId: thread.id,
        roleId: role.id,
        author: "system",
        content: `🤖 Status suggestion (low confidence): ${inference.suggestedStatus} (${(inference.confidence * 100).toFixed(0)}%)\n${inference.reasoning}`,
        metadata: { source: "email_status_inference", emailId, inference },
      });
    }
  } catch (err) {
    console.error("Email status inference failed (non-fatal):", err);
  }

  await enqueueOrchestratorTask(env, role.id, {
    type: "email_draft",
    roleId: role.id,
    payload: { emailId },
  });
}

async function ensureRoleThread(env: Env, role: Role) {
  const db = getDb(env);
  const existing = await db
    .select()
    .from(threads)
    .where(eq(threads.roleId, role.id))
    .orderBy(desc(threads.createdAt))
    .limit(1);

  if (existing.length > 0) {
    return existing;
  }

  return db
    .insert(threads)
    .values({
      id: crypto.randomUUID(),
      title: `${role.companyName} / ${role.jobTitle}`,
      roleId: role.id,
    })
    .returning();
}

async function sendUnmatchedReply(
  env: Env,
  message: ForwardableEmailMessage,
  emailId: string,
  activeRoles: Role[],
) {
  const roleList =
    activeRoles.length > 0
      ? activeRoles
          .map((role) => `- ${role.companyName} / ${role.jobTitle} (${role.status})`)
          .join("\n")
      : "- No applied or interviewing roles are currently tracked.";
  const link = associationLink(message.to, emailId);
  const text = [
    "I could not confidently match this email to an active application.",
    "",
    "Open this link to associate it with a role:",
    link,
    "",
    "Active roles:",
    roleList,
  ].join("\n");

  await env.EMAIL_OUT.send({
    from: message.to,
    to: message.from,
    subject: "Action needed: associate this recruiting email",
    text,
  });
}

function findBestMatch(activeRoles: Role[], text: string): EmailMatch | null {
  const haystack = normalize(text);
  const matches = activeRoles
    .map((role) => ({ role, score: scoreRole(role, haystack) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.role.updatedAt.getTime() - a.role.updatedAt.getTime();
    });

  return matches[0] ?? null;
}

function scoreRole(role: Role, haystack: string) {
  const companyTokens = tokenize(role.companyName);
  const titleTokens = tokenize(role.jobTitle);
  let score = 0;

  if (containsPhrase(haystack, role.companyName)) {
    score += 5;
  }

  if (containsPhrase(haystack, role.jobTitle)) {
    score += 3;
  }

  for (const token of companyTokens) {
    if (haystack.includes(token)) {
      score += 2;
    }
  }

  for (const token of titleTokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function containsPhrase(haystack: string, phrase: string) {
  const normalized = normalize(phrase);
  return normalized.length > 0 && haystack.includes(normalized);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatAddress(address: Address | undefined, fallback: string) {
  if (!address) {
    return fallback;
  }

  if (Array.isArray(address.group)) {
    return address.group.map((item) => formatMailbox(item.name, item.address)).join(", ");
  }

  return formatMailbox(address.name, address.address);
}

function formatMailbox(name: string | undefined, address: string | undefined) {
  if (!address) {
    return name || "unknown";
  }

  return name ? `${name} <${address}>` : address;
}

function associationLink(to: string, emailId: string) {
  const [, domain] = to.split("@");

  if (!domain) {
    return `/email-associate/${emailId}`;
  }

  return `https://${domain}/email-associate/${emailId}`;
}
