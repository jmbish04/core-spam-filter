/**
 * @fileoverview Extract structured data from text using AI.
 *
 * Uses `generateStructuredOutput` with `response_format: { type: "json_schema" }`
 * to get native structured JSON from the ai model — no regex stripping needed.
 */

import type { z } from "zod";

import { generateStructuredOutput } from "../providers";
import { enforceTokenLimit } from "../utils/token-estimator";

export const DEFAULT_EXTRACT_PROMPT = `You are a precision job posting parser. Extract the MAXIMUM structured data from the supplied text into the JSON schema.

<STRICT_VERBATIM_EXTRACTION>
CRITICAL REQUIREMENT: For all array fields (responsibilities, qualifications, skills, benefits, education), you MUST extract each bullet item VERBATIM. 
- Copy the EXACT full text from the posting.
- Do NOT summarize.
- Do NOT shorten.
- Do NOT paraphrase.
- Do NOT truncate.
- Every single word must perfectly match the original text.
- If an item spans multiple sentences in a single bullet, keep all sentences together as one entry.
- Do not lose any details, no matter how long the bullet point is.
</STRICT_VERBATIM_EXTRACTION>

<EXCLUSION_RULES>
CRITICAL: You MUST strictly ignore and EXCLUDE the following types of text from all fields:
- Company introductions, "About Us", or mission statements (e.g., "About Anthropic").
- Generic employment law, Equal Employment Opportunity (EEO), and disability boilerplate.
- Job application form fields, dropdown menus (e.g., country lists, phone codes), and logistical submission instructions.
- Disclaimers about recruiting scams, agency policies, or immigration boilerplate.
Focus strictly on the duties, requirements, and benefits of the SPECIFIC role.
</EXCLUSION_RULES>

Guidelines:
- Extract every field present in the posting. Leave optional fields as null/undefined only when the information is genuinely absent.
- Distinguish between REQUIRED qualifications (must-have, minimum) and PREFERRED qualifications (nice-to-have, ideal, strong).
- For salary, extract numeric values without currency symbols. Detect the currency code (USD, EUR, GBP, etc.).
- For location, include city, state/province, and country when available.
- For workplaceType, classify as 'remote', 'hybrid', or 'onsite' based on context clues.
- For yearsExperienceMin/Max, extract numeric values from phrases like '5+ years' (min=5) or '3-5 years' (min=3, max=5).
- Capture any RTO (return-to-office), schedule, or work arrangement details in rtoPolicy.
- Return JSON only — no markdown, no commentary.`;

export async function extractStructuredRolePosting<TSchema extends z.ZodTypeAny>(
  env: Env,
  opts: {
    text: string;
    schema: TSchema;
    systemPrompt?: string;
    cacheTtl?: number;
  },
): Promise<z.infer<TSchema>> {
  enforceTokenLimit(opts.text, 120000, "Extract Text");

  return generateStructuredOutput(env, {
    messages: [
      {
        role: "system",
        content: opts.systemPrompt ?? DEFAULT_EXTRACT_PROMPT,
      },
      { role: "user", content: opts.text },
    ],
    schema: opts.schema,
    schemaName: "ExtractionSchema",
    temperature: 0,
    max_tokens: 8192,
    cacheTtl: opts.cacheTtl,
  });
}
