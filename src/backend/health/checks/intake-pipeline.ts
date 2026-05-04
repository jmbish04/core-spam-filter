import { z } from "zod";

import type { HealthStepResult } from "@/backend/health/types";

import { generateStructuredOutput } from "@/backend/ai/providers";
import { BrowserRendering } from "@/backend/ai/tools/browser-rendering";
import { enforceTokenLimit } from "@/backend/ai/utils/token-estimator";

/**
 * End-to-end intake pipeline health check.
 *
 * Validates the full role-scraping flow against a real Greenhouse job posting:
 * 1. Greenhouse API — fetch a random live Cloudflare job listing
 * 2. Browser Rendering `/markdown` — extract the page as clean markdown
 *    (same method used by the real intake pipeline in `routes/intake.ts`)
 * 3. AI Structured Extraction — gpt-oss-120b extracts JobPosting fields
 * 4. Zod Validation — extracted data passes the intake schema
 *
 * NOTE: This intentionally uses `extractMarkdown()` — NOT `scrapeUrl()` —
 * because the real intake route uses `/markdown` (plus `/pdf` and `/json`
 * concurrently). Using `/snapshot` here was giving 0-byte results while
 * the actual intake worked fine.
 */

const GREENHOUSE_BOARD_TOKEN = "cloudflare";
const GREENHOUSE_JOBS_URL = `https://boards-api.greenhouse.io/v1/boards/${GREENHOUSE_BOARD_TOKEN}/jobs`;

/** Minimal shape of a Greenhouse job list response item. */
interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
}

/** The same JobPosting schema used by the real intake route. */
const JobPostingSchema = z.object({
  companyName: z.string(),
  jobTitle: z.string(),
  jobUrl: z.string().url().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(),
  roleInstructions: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function checkIntakePipeline(env: Env): Promise<HealthStepResult> {
  const start = Date.now();
  const issues: string[] = [];
  const details: Record<string, unknown> = {};

  // -------------------------------------------------------------------------
  // Step 1: Greenhouse API — pick a random live job posting
  // -------------------------------------------------------------------------
  let jobUrl = "";
  let jobTitle = "";
  try {
    const ghRes = await fetch(GREENHOUSE_JOBS_URL);
    if (!ghRes.ok) {
      throw new Error(`Greenhouse API returned ${ghRes.status}`);
    }
    const ghData = (await ghRes.json()) as { jobs: GreenhouseJob[] };
    if (!ghData.jobs?.length) {
      throw new Error("Greenhouse returned 0 jobs");
    }

    // Pick a random job
    const randomJob = ghData.jobs[Math.floor(Math.random() * ghData.jobs.length)];
    jobUrl = randomJob.absolute_url;
    jobTitle = randomJob.title;
    details.greenhouseStatus = "ok";
    details.greenhouseJobCount = ghData.jobs.length;
    details.selectedJob = { id: randomJob.id, title: jobTitle, url: jobUrl };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    issues.push(`Greenhouse API failed: ${msg}`);
    details.greenhouseStatus = "fail";
    // Cannot proceed without a URL
    return {
      status: "fail",
      latencyMs: Date.now() - start,
      error: issues.join("; "),
      details,
    };
  }

  // -------------------------------------------------------------------------
  // Step 2: Browser Rendering /markdown — same method as the real intake
  // -------------------------------------------------------------------------
  let markdownContent = "";
  try {
    const browser = new BrowserRendering(env);
    markdownContent = await browser.extractMarkdown(jobUrl);
    details.scrapeBytes = markdownContent.length;
    details.scrapeMethod = "markdown";
    details.scrapeStatus = markdownContent.length > 200 ? "ok" : "too_short";

    if (markdownContent.length < 200) {
      issues.push(
        `Markdown extraction returned only ${markdownContent.length} chars for ${jobUrl}`,
      );
    }
  } catch (error) {
    issues.push(
      `Browser Rendering /markdown failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    details.scrapeStatus = "fail";
    details.scrapeMethod = "markdown";
  }

  // -------------------------------------------------------------------------
  // Step 3: AI Structured Extraction (only if scrape succeeded)
  // -------------------------------------------------------------------------
  if (markdownContent.length > 200) {
    try {
      enforceTokenLimit(markdownContent, 120000, "Job Intake Markdown");
      const extracted = await generateStructuredOutput(env, {
        messages: [
          {
            role: "system",
            content: `
              Extract structured job posting data from this page.
              Return JSON matching this schema: 

              \`\`\`json
              {
                companyName: string, 
                jobTitle: string,
                jobUrl?: string (URL),
                salaryMin?: number,
                salaryMax?: number,
                salaryCurrency?: string
              }
              \`\`\`

              Extract what is available.
              You must respond with a valid JSON object matching the requested schema.
              DO NOT wrap your response in markdown fences.
              `,
          },
          { role: "user", content: markdownContent },
        ],
        schema: JobPostingSchema,
        schemaName: "JobPosting",
        temperature: 0,
      });

      details.extractStatus = "ok";
      details.extractedCompany = extracted.companyName ?? "(missing)";
      details.extractedTitle = extracted.jobTitle ?? "(missing)";

      // Validate required fields are populated
      if (!extracted.companyName) {
        issues.push("AI extraction returned empty companyName");
      }
      if (!extracted.jobTitle) {
        issues.push("AI extraction returned empty jobTitle");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      issues.push(`AI structured extraction failed: ${msg}`);
      details.extractStatus = "fail";
      details.extractError = msg.slice(0, 300);
    }
  }

  // -------------------------------------------------------------------------
  // Result
  // -------------------------------------------------------------------------
  return {
    status: issues.length === 0 ? "ok" : issues.length === 1 ? "warn" : "fail",
    latencyMs: Date.now() - start,
    error: issues.length > 0 ? issues.join("; ") : undefined,
    details,
  };
}
