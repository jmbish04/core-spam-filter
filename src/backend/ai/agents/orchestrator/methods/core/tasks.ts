import { eq } from "drizzle-orm";

import { draft, analyzeRole } from "@/ai/tasks";
import { classifyEmailStatus } from "@/ai/tasks";
import { enforceTokenLimit } from "@/ai/utils/token-estimator";
import { getDb } from "@/db";
import { emails, roles } from "@/db/schema";

import type { OrchestratorAgent } from "../../index";
import type { OrchestratorTask, OrchestratorTaskStatus } from "../../types";

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function handleEnqueueTask(
  agent: OrchestratorAgent,
  task: Omit<OrchestratorTask, "id" | "status"> & { id?: string; status?: OrchestratorTaskStatus },
) {
  const nextTask: OrchestratorTask = {
    id: task.id ?? crypto.randomUUID(),
    type: task.type,
    status: task.status ?? "pending",
    roleId: task.roleId ?? agent.state.roleId,
    payload: task.payload,
  };
  agent.setState({ ...agent.state, pendingTasks: [...agent.state.pendingTasks, nextTask] });
  agent.broadcastProgress("queued", nextTask);

  return nextTask;
}

export async function handleProcessPendingTasks(agent: OrchestratorAgent, env: Env) {
  const task = agent.state.pendingTasks.find((item) => item.status === "pending");

  if (!task) {
    return;
  }

  agent.updateTask(task.id, { status: "running", error: undefined });
  agent.broadcastProgress("running", task);

  try {
    await processTask(agent, env, task);
    agent.updateTask(task.id, { status: "complete" });
    agent.broadcastProgress("complete", task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown task failure";
    agent.updateTask(task.id, { status: "failed", error: message });
    agent.broadcastProgress("failed", { ...task, error: message });
  }
}

async function processTask(agent: OrchestratorAgent, env: Env, task: OrchestratorTask) {
  switch (task.type) {
    case "job_extract": {
      const url = readString(task.payload?.url);
      const preScrapedMarkdown = readString(task.payload?.markdown);

      if (!url && !preScrapedMarkdown) {
        throw new Error("job_extract task requires payload.url or payload.markdown");
      }

      // Use pre-scraped markdown when available; otherwise scrape fresh
      let textForExtraction: string;
      let pdfUrl: string | undefined;
      let extracted: any;

      if (preScrapedMarkdown) {
        textForExtraction = preScrapedMarkdown;
        extracted = await agent.extract_job_details(textForExtraction);
      } else {
        const scraped = await agent.scrape_job(url!);
        textForExtraction = scraped.markdown || scraped.text || scraped.html;
        pdfUrl = scraped.pdfUrl;

        // Structured extraction via gpt-oss-120b
        const markdownExtracted = await agent.extract_job_details(textForExtraction);

        // Reconcile with Browser Render JSON extraction and scraped HTML elements
        const { reconcileJobExtractions } = await import("../jobs/scrape");
        extracted = reconcileJobExtractions(
          markdownExtracted,
          scraped.jsonExtract,
          scraped.scrapedElements,
        );
      }

      // Persist extraction result + pdfUrl back to the role
      if (task.roleId && task.roleId !== "global") {
        const db = getDb(env);
        const [existing] = await db.select().from(roles).where(eq(roles.id, task.roleId)).limit(1);

        if (existing) {
          const existingMeta = (existing.metadata as Record<string, unknown>) ?? {};
          const patch: Record<string, unknown> = {
            metadata: {
              ...existingMeta,
              extractedPosting: extracted,
              extractedAt: new Date().toISOString(),
              // Backfill comprehensive fields into top-level metadata
              responsibilities: extracted.responsibilities ?? existingMeta.responsibilities,
              requiredQualifications:
                extracted.requiredQualifications ?? existingMeta.requiredQualifications,
              preferredQualifications:
                extracted.preferredQualifications ?? existingMeta.preferredQualifications,
              requiredSkills: extracted.requiredSkills ?? existingMeta.requiredSkills,
              preferredSkills: extracted.preferredSkills ?? existingMeta.preferredSkills,
              location: extracted.location ?? existingMeta.location,
              workplaceType: extracted.workplaceType ?? existingMeta.workplaceType,
              rtoPolicy: extracted.rtoPolicy ?? existingMeta.rtoPolicy,
              yearsExperienceMin: extracted.yearsExperienceMin ?? existingMeta.yearsExperienceMin,
              yearsExperienceMax: extracted.yearsExperienceMax ?? existingMeta.yearsExperienceMax,
              educationRequirements:
                extracted.educationRequirements ?? existingMeta.educationRequirements,
              department: extracted.department ?? existingMeta.department,
              reportingTo: extracted.reportingTo ?? existingMeta.reportingTo,
              travelRequirements: extracted.travelRequirements ?? existingMeta.travelRequirements,
              securityClearance: extracted.securityClearance ?? existingMeta.securityClearance,
              visaSponsorship: extracted.visaSponsorship ?? existingMeta.visaSponsorship,
              benefits: extracted.benefits ?? existingMeta.benefits,
              additionalNotes: extracted.additionalNotes ?? existingMeta.additionalNotes,
            },
          };

          // Backfill core columns only if they're still default/empty
          if (!existing.salaryMin && extracted.salaryMin) {
            patch.salaryMin = extracted.salaryMin;
          }
          if (!existing.salaryMax && extracted.salaryMax) {
            patch.salaryMax = extracted.salaryMax;
          }
          if (existing.companyName === "Unknown Company" && extracted.companyName) {
            patch.companyName = extracted.companyName;
          }
          if (existing.jobTitle === "Unknown Title" && extracted.jobTitle) {
            patch.jobTitle = extracted.jobTitle;
          }
          if (!existing.jobPostingPdfUrl && pdfUrl) {
            patch.jobPostingPdfUrl = pdfUrl;
          }

          await db.update(roles).set(patch).where(eq(roles.id, task.roleId));
        }
      }

      return extracted;
    }
    case "email_draft": {
      const emailId = readString(task.payload?.emailId);
      if (!emailId) {
        throw new Error("email_draft task requires payload.emailId");
      }
      return agent.draft_email_reply(emailId);
    }
    case "resume_review":
    case "cover_letter_draft": {
      const { draftWithNotebook } = await import("@/ai/tasks/draft-with-notebook");
      return draftWithNotebook({
        env,
        roleId: task.roleId ?? "global",
        docType: task.type === "resume_review" ? "resume" : "cover_letter",
        onProgress: (progress) => agent.broadcastProgress(progress.phase, task),
      });
    }
    case "resume_comment_response": {
      const gdocId = readString(task.payload?.gdocId);
      const targetRoleId = task.roleId ?? readString(task.payload?.roleId);
      if (!gdocId) throw new Error("resume_comment_response requires payload.gdocId");
      if (!targetRoleId || targetRoleId === "global")
        throw new Error("resume_comment_response requires a valid roleId");

      const { respondToComments } = await import("@/ai/tasks/respond-to-comments");
      return respondToComments(env, targetRoleId, gdocId, (progress) => {
        agent.broadcastProgress(progress.phase, task);
      });
    }
    case "role_analysis": {
      const targetRoleId = task.roleId ?? readString(task.payload?.roleId);
      if (!targetRoleId || targetRoleId === "global") {
        throw new Error("role_analysis task requires a valid roleId");
      }
      return analyzeRole(env, targetRoleId);
    }
    case "email_status_inference": {
      const emailId = readString(task.payload?.emailId);
      if (!emailId) {
        throw new Error("email_status_inference task requires payload.emailId");
      }
      const db = getDb(env);
      const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
      if (!email || !email.roleId) {
        throw new Error(`Email not found or not associated: ${emailId}`);
      }
      const [role] = await db.select().from(roles).where(eq(roles.id, email.roleId)).limit(1);
      if (!role) {
        throw new Error(`Role not found for email: ${emailId}`);
      }
      return classifyEmailStatus(env, email.subject, email.body, role.status);
    }
    case "interview_feedback": {
      const transcription = readString(task.payload?.transcription);
      const targetRoleId = task.roleId ?? readString(task.payload?.roleId);
      if (!transcription) {
        throw new Error("interview_feedback task requires payload.transcription");
      }
      enforceTokenLimit(transcription, 120000, "Interview Transcription");
      const query = `Analyze this interview transcription and provide specific, actionable feedback.
Focus on: (1) areas where the candidate could improve their answers,
(2) questions that were handled well, (3) suggestions for better responses.

Transcription:
${transcription}`;
      const feedback = await agent.consult_notebook(query);
      if (targetRoleId && targetRoleId !== "global") {
        const thread = await agent.ensureThread(targetRoleId);
        await agent.addMessage(
          thread.id,
          targetRoleId,
          "agent",
          `## Interview Feedback\n\n${typeof feedback === "string" ? feedback : JSON.stringify(feedback)}`,
          { source: "interview_feedback" },
        );
      }
      return feedback;
    }
    default: {
      throw new Error(`Unknown task type: ${(task as any).type}`);
    }
  }
}
