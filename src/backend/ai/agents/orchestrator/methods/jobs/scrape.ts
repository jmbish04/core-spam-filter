import type { z } from "zod";

import { zodToJsonSchema } from "zod-to-json-schema";

import type { ScrapeResult } from "@/ai/tools/browser-rendering";

import { extractStructuredRolePosting, DEFAULT_EXTRACT_PROMPT } from "@/ai/tasks";
import { BrowserRendering } from "@/ai/tools/browser-rendering";
import { parseGreenhouseUrl, scrapeGreenhouseJob } from "@/ai/tools/greenhouse";

import { JobPosting, type DetailedScrapeResult } from "../../types";

/**
 * Scrapes a job URL using BR /markdown (for AI extraction content) and
 * BR /pdf (for user-facing archival). Falls back to Greenhouse API
 * when BR methods fail for Greenhouse URLs.
 */
export async function handleScrapeJob(env: Env, url: string): Promise<DetailedScrapeResult> {
  const ghParsed = parseGreenhouseUrl(url);
  const browser = new BrowserRendering(env);

  // Convert schema for captureJSON
  const jsonSchemaRaw = zodToJsonSchema(JobPosting as any, "JobPosting") as {
    definitions?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
  };
  const responseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: "JobPosting",
      schema: (jsonSchemaRaw.definitions?.JobPosting || jsonSchemaRaw) as Record<string, unknown>,
    },
  };

  // Fire BR methods concurrently
  const [mdResult, pdfResult, jsonResult, scrapeResult] = await Promise.allSettled([
    browser.extractMarkdown(url),
    browser.capturePdf(url),
    browser.captureJSON(url, {
      prompt: DEFAULT_EXTRACT_PROMPT,
      responseFormat,
    }),
    browser.scrapeElements(url, [{ selector: "h1, h2, h3" }, { selector: "ul > li" }]),
  ]);

  const mdOk = mdResult.status === "fulfilled" && mdResult.value.length > 100;
  const pdfOk = pdfResult.status === "fulfilled";
  const jsonOk = jsonResult.status === "fulfilled";
  const scrapeOk = scrapeResult.status === "fulfilled";

  // Upload PDF to R2 if available
  let pdfUrl: string | undefined;
  if (pdfOk) {
    try {
      const key = `job-postings/${crypto.randomUUID()}.pdf`;
      pdfUrl = await browser.uploadPdfToR2(key, pdfResult.value as ArrayBuffer, {
        sourceUrl: url,
        capturedAt: new Date().toISOString(),
      });
    } catch {
      console.error("PDF R2 upload failed (non-fatal)");
    }
  }

  if (mdOk) {
    return {
      html: "",
      text: mdResult.value,
      markdown: mdResult.value,
      links: [{ href: url }],
      pdfUrl,
      jsonExtract: jsonOk ? (jsonResult.value as unknown as z.infer<typeof JobPosting>) : undefined,
      scrapedElements: scrapeOk ? scrapeResult.value : undefined,
    };
  }

  // Fallback to Greenhouse API for Greenhouse URLs
  if (ghParsed) {
    try {
      const ghResult = await scrapeGreenhouseJob(ghParsed.boardToken, ghParsed.jobId);
      return { ...ghResult, pdfUrl };
    } catch (error) {
      console.error(
        `Greenhouse API fallback also failed for ${url}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw new Error(`All scrape methods failed for ${url}`);
}

export async function handleExtractJobDetails(env: Env, text: string) {
  return extractStructuredRolePosting(env, { text, schema: JobPosting });
}

export function reconcileJobExtractions(
  markdownExtract: z.infer<typeof JobPosting>,
  jsonExtract?: z.infer<typeof JobPosting>,
  elements?: ScrapeResult,
): z.infer<typeof JobPosting> {
  if (!jsonExtract) return markdownExtract;

  // Gather all li and h tags from scrape
  const rawTextNodes = new Set<string>();
  if (elements) {
    for (const group of elements) {
      for (const res of group.results) {
        if (res.text) rawTextNodes.add(res.text.trim());
      }
    }
  }

  // Helper to count how many exact matches an array of bullets has in the raw DOM text
  function countExactMatches(bullets?: string[]) {
    if (!bullets) return 0;
    return bullets.filter((b) =>
      Array.from(rawTextNodes).some((n) => n.includes(b.trim()) || b.trim().includes(n)),
    ).length;
  }

  // Compare arrays, if jsonExtract has more verbatim matches or is longer and markdown is 0, prefer it.
  const fieldsToCompare: (keyof z.infer<typeof JobPosting>)[] = [
    "responsibilities",
    "requiredQualifications",
    "preferredQualifications",
    "requiredSkills",
    "preferredSkills",
    "benefits",
  ];

  const reconciled: any = { ...markdownExtract };

  for (const field of fieldsToCompare) {
    const mdBullets = markdownExtract[field] as string[] | undefined;
    const jsonBullets = jsonExtract[field] as string[] | undefined;

    const mdMatches = countExactMatches(mdBullets);
    const jsonMatches = countExactMatches(jsonBullets);

    // If json has more matches, or if neither matches but json has more bullets, prefer json
    if (jsonMatches > mdMatches) {
      reconciled[field] = jsonBullets;
    } else if (
      jsonMatches === mdMatches &&
      jsonBullets &&
      (!mdBullets || jsonBullets.length > mdBullets.length)
    ) {
      reconciled[field] = jsonBullets;
    }
  }

  // For top-level scalar fields, prefer json if markdown is missing it
  for (const key of Object.keys(JobPosting.shape)) {
    if (!reconciled[key] && jsonExtract[key as keyof typeof jsonExtract]) {
      reconciled[key] = jsonExtract[key as keyof typeof jsonExtract];
    }
  }

  return reconciled as z.infer<typeof JobPosting>;
}
