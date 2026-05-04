import { eq } from "drizzle-orm";

import { draft } from "@/ai/tasks";
import { getDb } from "@/db";
import { emails } from "@/db/schema";

import type { OrchestratorAgent } from "../../index";

export async function handleReplyToThread(agent: OrchestratorAgent, roleId: string, text: string) {
  const thread = await agent.ensureThread(roleId);
  return agent.addMessage(thread.id, roleId, "agent", text);
}

export async function handleDraftEmailReply(agent: OrchestratorAgent, env: Env, emailId: string) {
  const db = getDb(env);
  const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);

  if (!email) {
    throw new Error(`Email not found: ${emailId}`);
  }

  const reply = await draft(env, {
    docType: "email_reply",
    context: {
      subject: email.subject,
      sender: email.sender,
      body: email.body,
      roleId: email.roleId,
    },
  });

  if (email.roleId) {
    const thread = await agent.ensureThread(email.roleId);
    await agent.addMessage(thread.id, email.roleId, "agent", reply, { emailId });
  }

  return reply;
}
