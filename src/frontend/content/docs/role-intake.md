# Role Intake Pipeline

The role intake pipeline is the entry point for adding new job opportunities to the Career Orchestrator. It transforms a raw job posting URL into structured, actionable data through a multi-stage process.

## Pipeline Overview

1. **URL Submission** — User pastes a job posting URL into the intake form.
2. **Multi-Pass Scrape** — The system extracts content from the page using three parallel methods.
3. **AI Extraction** — Workers AI parses the scraped content into a structured `JobPosting` schema.
4. **DOM Sidecar** — An HTML bullet parser independently classifies scraped list items for cross-validation.
5. **Reconciliation** — The three extraction passes are merged, preferring longer and more detailed content.
6. **Confirmation** — The user reviews the extracted data in a confirmation modal before committing.
7. **Batch Persist** — On confirmation, the role, bullets, company, and Google Drive folder are created.

## Multi-Pass Scrape (3 Methods)

The `handleScrapeJob()` function in `src/backend/ai/agents/orchestrator/methods/jobs/scrape.ts` executes three concurrent extraction methods to maximize data fidelity:

### Pass 1: Markdown via `extractMarkdown()`

The Browser Rendering API extracts the full page as clean markdown. This is the primary content source for AI extraction and is used as the `text` field on the role.

### Pass 2: JSON Extract via `extractJson()`

A structured extraction pass that uses the `JobPosting` Zod schema directly. This is sent to the browser as a `response_format` parameter, producing JSON that maps directly to the expected schema.

### Pass 3: DOM Element Scrape via `scrapeElements()`

A raw DOM scrape targeting `h1, h2, h3` headings and `ul > li` list items. These elements are fed to the **HTML Sidecar Bullet Parser** for independent classification.

### PDF Capture

In parallel, a PDF snapshot of the page is captured via `generatePdf()` and uploaded to R2 for archival.

### Greenhouse Fallback

If the markdown pass fails and the URL matches a Greenhouse job board pattern, the system falls back to the **Greenhouse Public API** for structured data retrieval.

## HTML Sidecar Bullet Parser

The `classifyScrapedElements()` function in `src/backend/ai/tools/html-bullet-parser.ts` provides a ground-truth cross-reference for AI-extracted bullets:

- Takes scraped headings and list items from the DOM scrape.
- Correlates each `li` to its nearest preceding heading by **vertical position** (DOM bounding rect `top` value).
- Classifies each heading into a `RoleBulletType` using keyword pattern matching:

### Classification Map

- **KEY_RESPONSIBILITY** — "responsibilities", "what you'll do", "the role", "day-to-day"
- **REQUIRED_QUALIFICATION** — "minimum qualifications", "requirements", "must have"
- **PREFERRED_QUALIFICATION** — "preferred qualifications", "nice to have", "bonus"
- **EDUCATION_REQUIREMENT** — "education", "degree", "academic"
- **REQUIRED_SKILL** — "required skills", "technical skills", "core competencies"
- **PREFERRED_SKILL** — "preferred skills", "additional skills"
- **BENEFIT** — "benefits", "perks", "compensation", "what we offer"

## Reconciliation

The `reconcileJobExtractions()` function merges the three passes:

- **Markdown Extract** (AI-parsed) is the base layer — it produces the most structured output.
- **JSON Extract** augments any fields that the markdown pass missed or truncated.
- **DOM Sidecar** provides bullet-level ground truth — if the AI shortened a bullet, the DOM version is longer and more accurate.

The reconciliation logic prefers the **longer** version of each bullet point, which helps prevent the common issue of AI models summarizing or abbreviating responsibilities from job postings.

## AI Extraction

The `extractStructuredRolePosting()` function in `src/backend/ai/tasks/extract.ts` processes the scraped text through Workers AI to produce a structured `JobPosting` object:

- Uses the model configured via `MODEL_EXTRACT` environment variable.
- Operates in **structured output mode** with a JSON schema response format.
- Extracts: job title, company name, location, salary range, workplace type, responsibilities, qualifications, and benefits.
- All bullets are extracted **verbatim** — the prompt uses strict XML boundaries (`STRICT_VERBATIM_EXTRACTION`) to prevent summarization.

## Confirmation Flow

After extraction, the user sees a **confirmation modal** with:

- Parsed role metadata (title, company, location, salary).
- Extracted bullet points grouped by type with counts.
- Ability to edit any field before confirming.

On confirmation, the `POST /api/intake/confirm` endpoint:

1. Creates the `roles` record with all metadata.
2. Inserts all `role_bullets` classified by type.
3. Creates or finds the `companies` record.
4. Triggers an `OrchestratorAgent` task to create a Google Drive folder and generate documents.

## Extraction Fidelity Health Check

The **extraction_fidelity** health check validates the multi-pass pipeline end-to-end:

1. Picks a random live Cloudflare job from Greenhouse.
2. Runs all 3 extraction passes in parallel:
   - **Pass 1:** `extractMarkdown()` → Workers AI `generateStructuredOutput`
   - **Pass 2:** Browser Rendering `/json` with custom model cascade + Zod schema
   - **Pass 3:** `scrapeElements()` → `classifyScrapedElements()` (HTML sidecar)
3. Randomly samples 2–3 bullets from each AI-extracted array (responsibilities, qualifications, benefits).
4. For each sample, searches the raw `<li>` DOM elements from Pass 3:
   - **Exact match:** `<li>` text === extracted bullet
   - **Contains match:** `<li>` text contains the extracted bullet (or vice versa)
5. Reports pass/fail per sample with match type, plus cross-pass bullet count agreement.

The check runs with a **60s timeout** (3 concurrent browser renders + AI inference). Results are persisted in the `health_results` table under the `api` category.

## File Reference

- `src/backend/ai/agents/orchestrator/methods/jobs/scrape.ts` — Multi-pass scrape orchestration
- `src/backend/ai/agents/orchestrator/methods/jobs/intake.ts` — Confirmation and batch persist
- `src/backend/ai/tasks/extract.ts` — AI extraction with structured output
- `src/backend/ai/tools/html-bullet-parser.ts` — DOM sidecar bullet classifier
- `src/backend/ai/tools/browser-rendering.ts` — Browser Rendering API wrapper
- `src/backend/api/routes/intake.ts` — Intake API endpoints
- `src/backend/health/checks/extraction-fidelity.ts` — Extraction fidelity health check
