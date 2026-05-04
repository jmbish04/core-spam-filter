import { z } from "zod";

import type { ScrapedPage, ScrapeResult } from "@/ai/tools/browser-rendering";

export type OrchestratorTaskType =
  | "resume_review"
  | "cover_letter_draft"
  | "email_draft"
  | "job_extract"
  | "role_analysis"
  | "email_status_inference"
  | "interview_feedback"
  | "resume_comment_response";

export type OrchestratorTaskStatus = "pending" | "running" | "complete" | "failed";

export type OrchestratorTask = {
  id: string;
  type: OrchestratorTaskType;
  status: OrchestratorTaskStatus;
  roleId?: string;
  payload?: Record<string, unknown>;
  error?: string;
};

export type OrchestratorState = {
  roleId: string | "global";
  pendingTasks: OrchestratorTask[];
};

export const JobPosting = z.object({
  // ── Core identifiers ────────────────────────────────────────────────────
  companyName: z.string().min(1),
  jobTitle: z.string().min(1),
  jobUrl: z.string().url().optional(),

  // ── Compensation ────────────────────────────────────────────────────────
  salaryMin: z.number().int().optional(),
  salaryMax: z.number().int().optional(),
  salaryCurrency: z.string().default("USD"),

  // ── Role details ────────────────────────────────────────────────────────
  responsibilities: z
    .array(
      z
        .string()
        .describe(
          "VERBATIM full text of each responsibility bullet from the posting — do NOT summarize or shorten",
        ),
    )
    .optional(),
  requiredQualifications: z
    .array(
      z
        .string()
        .describe(
          "VERBATIM full text of each required/must-have qualification — do NOT summarize or shorten",
        ),
    )
    .optional(),
  preferredQualifications: z
    .array(
      z
        .string()
        .describe(
          "VERBATIM full text of each preferred/nice-to-have qualification — do NOT summarize or shorten",
        ),
    )
    .optional(),
  requiredSkills: z
    .array(
      z
        .string()
        .describe("VERBATIM full text of each required skill — do NOT summarize or shorten"),
    )
    .optional(),
  preferredSkills: z
    .array(
      z
        .string()
        .describe("VERBATIM full text of each preferred skill — do NOT summarize or shorten"),
    )
    .optional(),

  // ── Location & work arrangement ─────────────────────────────────────────
  location: z.string().optional(),
  workplaceType: z.enum(["remote", "hybrid", "onsite"]).optional(),
  rtoPolicy: z.string().optional(),

  // ── Experience & education ──────────────────────────────────────────────
  yearsExperienceMin: z.number().optional(),
  yearsExperienceMax: z.number().optional(),
  educationRequirements: z
    .array(
      z
        .string()
        .describe("VERBATIM full text of each education requirement — do NOT summarize or shorten"),
    )
    .optional(),

  // ── Organization ────────────────────────────────────────────────────────
  department: z.string().optional(),
  reportingTo: z.string().optional(),

  // ── Logistics ───────────────────────────────────────────────────────────
  travelRequirements: z.string().optional(),
  securityClearance: z.string().optional(),
  visaSponsorship: z.string().optional(),

  // ── Benefits & extras ───────────────────────────────────────────────────
  benefits: z
    .array(
      z.string().describe("VERBATIM full text of each benefit item — do NOT summarize or shorten"),
    )
    .optional(),
  additionalNotes: z.string().optional(),

  // ── Legacy / catch-all ──────────────────────────────────────────────────
  roleInstructions: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DetailedScrapeResult = ScrapedPage & {
  jsonExtract?: z.infer<typeof JobPosting>;
  scrapedElements?: ScrapeResult;
};
