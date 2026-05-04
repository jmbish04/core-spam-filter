/**
 * @fileoverview Extraction Fidelity Health Check
 *
 * Validates the multi-pass extraction pipeline by scraping a real Greenhouse
 * job posting and comparing the AI-extracted bullet points against the raw HTML
 * DOM content to ensure verbatim extraction fidelity.
 *
 * Three extraction passes are tested:
 * 1. **Workers AI structured output** — `generateStructuredOutput` (extract.ts)
 * 2. **Browser Rendering /json** — `extractJson` with custom model cascade
 * 3. **HTML sidecar** — `scrapeElements` → `classifyScrapedElements`
 *
 * Verification: Random 2–3 bullet samples from each AI pass are matched
 * against the DOM `<li>` elements. A bullet passes if its text exists
 * verbatim inside a `<li>` element.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { HealthStepResult, GreenhouseJob } from "@/backend/health";

import { generateStructuredOutput } from "@/backend/ai/providers";
import { DEFAULT_EXTRACT_PROMPT } from "@/backend/ai/tasks/extract";
import {
  BrowserRendering,
  type ScrapeResult,
  type ScrapeResultItem,
} from "@/backend/ai/tools/browser-rendering";
import {
  classifyScrapedElements,
  groupedBulletsByType,
} from "@/backend/ai/tools/html-bullet-parser";
import { enforceTokenLimit } from "@/backend/ai/utils/token-estimator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GREENHOUSE_BOARD_TOKEN = "anthropic";
const GREENHOUSE_JOBS_URL = `https://boards-api.greenhouse.io/v1/boards/${GREENHOUSE_BOARD_TOKEN}/jobs`;
const SAMPLES_PER_ARRAY = 3;

/**
 * Minimal schema matching the bullet arrays from JobPosting —
 * we only need the array fields for fidelity testing.
 */
const BulletExtractionSchema = z
  .object({
    companyName: z.string().nullable().optional().default("Unknown Company"),
    jobTitle: z.string().nullable().optional().default("Unknown Title"),
    responsibilities: z
      .array(z.string().describe("VERBATIM full text of each responsibility bullet"))
      .nullable()
      .optional(),
    requiredQualifications: z
      .array(z.string().describe("VERBATIM full text of each required qualification"))
      .nullable()
      .optional(),
    preferredQualifications: z
      .array(z.string().describe("VERBATIM full text of each preferred qualification"))
      .nullable()
      .optional(),
    benefits: z
      .array(z.string().describe("VERBATIM full text of each benefit"))
      .nullable()
      .optional(),
  })
  .transform((data) => ({
    ...data,
    companyName: data.companyName ?? "Unknown Company",
    jobTitle: data.jobTitle ?? "Unknown Title",
    // Normalize null arrays → undefined for downstream collectBullets()
    responsibilities: data.responsibilities ?? undefined,
    requiredQualifications: data.requiredQualifications ?? undefined,
    preferredQualifications: data.preferredQualifications ?? undefined,
    benefits: data.benefits ?? undefined,
  }));

type BulletExtraction = z.infer<typeof BulletExtractionSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick up to `n` random items from an array. */
function randomSample<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

/**
 * Check if a bullet string exists verbatim inside any `<li>` element's text.
 * Returns the matching `<li>` text if found, or null.
 */
function findBulletInLiElements(
  bullet: string,
  liElements: ScrapeResultItem[],
): { found: boolean; liText?: string; matchType: "exact" | "contains" | "missing" } {
  const bulletNormalized = bullet.trim().toLowerCase();

  // First try exact match
  for (const li of liElements) {
    const liText = li.text.trim();
    if (liText.toLowerCase() === bulletNormalized) {
      return { found: true, liText, matchType: "exact" };
    }
  }

  // Then try contains (the AI bullet is a substring of a <li>)
  for (const li of liElements) {
    const liText = li.text.trim();
    if (liText.toLowerCase().includes(bulletNormalized)) {
      return { found: true, liText, matchType: "contains" };
    }
  }

  // Try reverse: <li> text is a substring of the AI bullet (AI expanded)
  for (const li of liElements) {
    const liText = li.text.trim().toLowerCase();
    if (liText.length > 20 && bulletNormalized.includes(liText)) {
      return { found: true, liText: li.text.trim(), matchType: "contains" };
    }
  }

  return { found: false, matchType: "missing" };
}

/** Collect all non-empty bullet arrays from extraction result. */
function collectBullets(extraction: BulletExtraction): { field: string; bullets: string[] }[] {
  const groups: { field: string; bullets: string[] }[] = [];

  if (extraction.responsibilities?.length) {
    groups.push({ field: "responsibilities", bullets: extraction.responsibilities });
  }
  if (extraction.requiredQualifications?.length) {
    groups.push({ field: "requiredQualifications", bullets: extraction.requiredQualifications });
  }
  if (extraction.preferredQualifications?.length) {
    groups.push({ field: "preferredQualifications", bullets: extraction.preferredQualifications });
  }
  if (extraction.benefits?.length) {
    groups.push({ field: "benefits", bullets: extraction.benefits });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Main health check
// ---------------------------------------------------------------------------

export async function checkExtractionFidelity(env: Env): Promise<HealthStepResult> {
  const start = Date.now();
  const issues: string[] = [];
  const details: Record<string, unknown> = {};

  // -------------------------------------------------------------------------
  // Step 1: Pick a random Greenhouse job
  // -------------------------------------------------------------------------
  let jobUrl = "";
  let jobTitle = "";
  try {
    const ghRes = await fetch(GREENHOUSE_JOBS_URL);
    if (!ghRes.ok) throw new Error(`Greenhouse API returned ${ghRes.status}`);
    const ghData = (await ghRes.json()) as { jobs: GreenhouseJob[] };
    if (!ghData.jobs?.length) throw new Error("Greenhouse returned 0 jobs");

    const randomJob = ghData.jobs[Math.floor(Math.random() * ghData.jobs.length)];
    jobUrl = randomJob.absolute_url;
    jobTitle = randomJob.title;
    details.selectedJob = { id: randomJob.id, title: jobTitle, url: jobUrl };
  } catch (error) {
    return {
      status: "fail",
      latencyMs: Date.now() - start,
      error: `Greenhouse API failed: ${error instanceof Error ? error.message : String(error)}`,
      details,
    };
  }

  // -------------------------------------------------------------------------
  // Step 2: Run all 3 extraction passes in parallel
  // -------------------------------------------------------------------------
  const browser = new BrowserRendering(env);

  // Build JSON schema for /json pass
  const jsonSchemaRaw = zodToJsonSchema(BulletExtractionSchema as any, "BulletExtraction") as {
    definitions?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
  };
  const responseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: "BulletExtraction",
      schema: (jsonSchemaRaw.definitions?.BulletExtraction || jsonSchemaRaw) as Record<
        string,
        unknown
      >,
    },
  };

  // Execute extraction passes SEQUENTIALLY to avoid exceeding Cloudflare
  // Browser Rendering launch rate (1 new browser per second). Running these
  // concurrently caused queue contention and 60s health check timeouts.

  // Pass 1: Markdown → Workers AI structured output
  let workersAiExtraction: BulletExtraction | null = null;
  let jsonExtraction: BulletExtraction | null = null;
  let sidecarElements: ScrapeResult | null = null;
  let allLiElements: ScrapeResultItem[] = [];

  try {
    const markdown = await browser.extractMarkdown(jobUrl);
    if (markdown.length < 100) throw new Error(`Markdown too short: ${markdown.length} chars`);
    enforceTokenLimit(markdown, 120000, "Markdown Job Description");
    const extracted = await generateStructuredOutput(env, {
      messages: [
        { role: "system", content: DEFAULT_EXTRACT_PROMPT },
        { role: "user", content: markdown },
      ],
      schema: BulletExtractionSchema,
      schemaName: "BulletExtraction",
      temperature: 0,
      max_tokens: 8192,
    });
    workersAiExtraction = extracted;
    const groups = collectBullets(workersAiExtraction);
    details.pass1_workersAi = {
      status: "ok",
      bulletGroups: groups.map((g) => ({ field: g.field, count: g.bullets.length })),
      companyName: workersAiExtraction.companyName,
      jobTitle: workersAiExtraction.jobTitle,
      markdownBytes: markdown.length,
    };
  } catch (err) {
    issues.push(`Pass 1 (Workers AI) failed: ${err}`);
    details.pass1_workersAi = {
      status: "fail",
      error: String(err).slice(0, 300),
    };
  }

  // Pass 2: Browser Rendering /json with custom model cascade
  try {
    jsonExtraction = await browser.extractJson<BulletExtraction>(jobUrl, {
      prompt: DEFAULT_EXTRACT_PROMPT,
      responseFormat,
    });
    const groups = collectBullets(jsonExtraction);
    details.pass2_browserJson = {
      status: "ok",
      bulletGroups: groups.map((g) => ({ field: g.field, count: g.bullets.length })),
      companyName: jsonExtraction.companyName,
      jobTitle: jsonExtraction.jobTitle,
    };
  } catch (err) {
    issues.push(`Pass 2 (Browser /json) failed: ${err}`);
    details.pass2_browserJson = {
      status: "fail",
      error: String(err).slice(0, 300),
    };
  }

  // Pass 3: DOM element scrape (headings + list items)
  try {
    sidecarElements = await browser.scrapeElements(jobUrl, [{ selector: "h1, h2, h3" }, { selector: "ul > li" }]);
    const classified = classifyScrapedElements(sidecarElements);
    const grouped = groupedBulletsByType(classified);

    // Collect all <li> elements for verification
    const liGroup = sidecarElements.find((g) => g.selector.includes("li"));
    allLiElements = liGroup?.results ?? [];

    details.pass3_htmlSidecar = {
      status: "ok",
      totalLiElements: allLiElements.length,
      classifiedGroups: classified.map((g) => ({
        heading: g.heading,
        type: g.type,
        itemCount: g.items.length,
      })),
      groupedByType: Object.fromEntries(
        Object.entries(grouped).map(([type, items]) => [type, items.length]),
      ),
    };
  } catch (err) {
    issues.push(`Pass 3 (HTML sidecar) failed: ${err}`);
    details.pass3_htmlSidecar = {
      status: "fail",
      error: String(err).slice(0, 300),
    };
  }

  // -------------------------------------------------------------------------
  // Step 4: Fidelity verification — compare AI bullets against DOM <li> items
  // -------------------------------------------------------------------------
  if (allLiElements.length === 0 && sidecarElements) {
    issues.push("No <li> elements found in DOM scrape — cannot verify extraction fidelity");
    details.fidelityCheck = { status: "skipped", reason: "no_li_elements" };
  } else if (allLiElements.length > 0) {
    const fidelityResults: Record<string, unknown> = {};

    // Verify Pass 1 (Workers AI) against DOM
    if (workersAiExtraction) {
      const pass1Results = verifyExtraction(
        "workersAi",
        workersAiExtraction,
        allLiElements,
        SAMPLES_PER_ARRAY,
      );
      fidelityResults.pass1_workersAi = pass1Results;
      if (pass1Results.failedSamples > 0) {
        issues.push(
          `Pass 1 fidelity: ${pass1Results.failedSamples}/${pass1Results.totalSamples} bullets not found in DOM`,
        );
      }
    }

    // Verify Pass 2 (Browser /json) against DOM
    if (jsonExtraction) {
      const pass2Results = verifyExtraction(
        "browserJson",
        jsonExtraction,
        allLiElements,
        SAMPLES_PER_ARRAY,
      );
      fidelityResults.pass2_browserJson = pass2Results;
      if (pass2Results.failedSamples > 0) {
        issues.push(
          `Pass 2 fidelity: ${pass2Results.failedSamples}/${pass2Results.totalSamples} bullets not found in DOM`,
        );
      }
    }

    details.fidelityCheck = fidelityResults;
  }

  // -------------------------------------------------------------------------
  // Step 5: Cross-compare pass outputs
  // -------------------------------------------------------------------------
  if (workersAiExtraction && jsonExtraction) {
    const pass1Total = collectBullets(workersAiExtraction).reduce(
      (acc, g) => acc + g.bullets.length,
      0,
    );
    const pass2Total = collectBullets(jsonExtraction).reduce((acc, g) => acc + g.bullets.length, 0);
    const diff = Math.abs(pass1Total - pass2Total);
    details.crossComparison = {
      pass1TotalBullets: pass1Total,
      pass2TotalBullets: pass2Total,
      bulletCountDelta: diff,
      agreement: diff <= 3 ? "high" : diff <= 8 ? "moderate" : "low",
    };
    if (diff > 8) {
      issues.push(`Large bullet count discrepancy between passes: ${pass1Total} vs ${pass2Total}`);
    }
  }

  // -------------------------------------------------------------------------
  // Result
  // -------------------------------------------------------------------------
  const failCount = issues.filter(
    (i) => i.includes("failed") || i.includes("not found in DOM"),
  ).length;

  return {
    status: failCount > 0 ? "fail" : issues.length > 0 ? "warn" : "ok",
    latencyMs: Date.now() - start,
    error: issues.length > 0 ? issues.join("; ") : undefined,
    details,
  };
}

// ---------------------------------------------------------------------------
// Verification helper
// ---------------------------------------------------------------------------

function verifyExtraction(
  passName: string,
  extraction: BulletExtraction,
  liElements: ScrapeResultItem[],
  samplesPerArray: number,
): {
  totalSamples: number;
  passedSamples: number;
  failedSamples: number;
  samples: Array<{
    field: string;
    bullet: string;
    found: boolean;
    matchType: "exact" | "contains" | "missing";
    liText?: string;
  }>;
} {
  const bulletGroups = collectBullets(extraction);
  const samples: Array<{
    field: string;
    bullet: string;
    found: boolean;
    matchType: "exact" | "contains" | "missing";
    liText?: string;
  }> = [];

  for (const group of bulletGroups) {
    const sampled = randomSample(group.bullets, samplesPerArray);

    for (const bullet of sampled) {
      const result = findBulletInLiElements(bullet, liElements);
      samples.push({
        field: group.field,
        bullet: bullet.slice(0, 120) + (bullet.length > 120 ? "…" : ""),
        found: result.found,
        matchType: result.matchType,
        liText: result.liText?.slice(0, 120),
      });
    }
  }

  const passed = samples.filter((s) => s.found).length;

  return {
    totalSamples: samples.length,
    passedSamples: passed,
    failedSamples: samples.length - passed,
    samples,
  };
}
