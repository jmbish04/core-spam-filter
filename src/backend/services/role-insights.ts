/**
 * @fileoverview Service for generating, caching, and versioning role insights
 * across dimensions (location, compensation, combined).
 *
 * Uses SHA-256 input hashing for change detection — if a new analysis request
 * matches any prior hash for the same role+type, the existing result is returned
 * rather than re-running the AI analysis.
 */

import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";

import type { RoleInsightType, RoleInsight } from "@/backend/db/schemas/role-insights";

import { generateStructuredOutput } from "@/backend/ai/providers";
import { getDb } from "@/backend/db";
import {
  globalConfig,
  roleInsights,
  roles,
  roleBullets,
  scoringRubrics,
} from "@/backend/db/schema";
import { OpenRouteService } from "@/backend/services/openroute";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LocationAnalysisPayload = {
  /** Role location from metadata */
  location: string | null;
  /** Workplace type: remote, hybrid, onsite */
  workplaceType: string | null;
  /** RTO policy details */
  rtoPolicy: string | null;
  /** Commute details per mode/schedule */
  commuteTable: Array<{
    schedule: string;
    mode: string;
    durationMinutes: number | null;
    monthlyCost: number | null;
  }>;
  /** Justin's home address used in analysis */
  homeAddress: string;
};

export type CompensationAnalysisPayload = {
  /** Advertised salary range */
  advertisedMin: number | null;
  advertisedMax: number | null;
  currency: string;
  /** Google TC baseline for comparison */
  googleBaseline: Record<string, unknown>;
  /** Negotiation analysis */
  negotiationTarget: number | null;
  negotiationRationale: string | null;
  /** Delta vs Google */
  deltaVsGoogle: number | null;
};

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RoleInsightsService {
  /**
   * Compute the input hash for a given role + insight type.
   * Used for change detection — if the hash matches a prior version, skip re-analysis.
   */
  async computeInputHash(
    env: Env,
    roleId: string,
    type: RoleInsightType,
  ): Promise<{ hash: string; inputs: Record<string, unknown> }> {
    const db = getDb(env);

    const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);

    if (!role) throw new Error(`Role not found: ${roleId}`);

    const bullets = await db.select().from(roleBullets).where(eq(roleBullets.roleId, roleId));

    const bulletsSorted = bullets
      .map((b) => `${b.type}:${b.content}`)
      .sort()
      .join("|");

    const meta = (role.metadata ?? {}) as Record<string, unknown>;

    if (type === "location") {
      const inputs = {
        location: meta.location ?? meta.city ?? null,
        workplaceType: meta.workplaceType ?? meta.workplace_type ?? null,
        rtoPolicy: meta.rtoPolicy ?? meta.rto_policy ?? null,
        bullets: bulletsSorted,
      };
      return { hash: await sha256(JSON.stringify(inputs)), inputs };
    }

    if (type === "compensation") {
      const inputs = {
        salaryMin: role.salaryMin,
        salaryMax: role.salaryMax,
        salaryCurrency: role.salaryCurrency,
        bullets: bulletsSorted,
      };
      return { hash: await sha256(JSON.stringify(inputs)), inputs };
    }

    // combined = location hash + compensation hash
    const locResult = await this.computeInputHash(env, roleId, "location");
    const compResult = await this.computeInputHash(env, roleId, "compensation");
    const inputs = { locationHash: locResult.hash, compensationHash: compResult.hash };
    return { hash: await sha256(JSON.stringify(inputs)), inputs };
  }

  /**
   * Get the latest insight for a role + type. Returns null if none exists.
   */
  async getLatestInsight(
    env: Env,
    roleId: string,
    type: RoleInsightType,
  ): Promise<RoleInsight | null> {
    const db = getDb(env);

    const [row] = await db
      .select()
      .from(roleInsights)
      .where(and(eq(roleInsights.roleId, roleId), eq(roleInsights.type, type)))
      .orderBy(desc(roleInsights.version))
      .limit(1);

    return row ?? null;
  }

  /**
   * Get all insight versions for a role + type.
   */
  async getInsightHistory(env: Env, roleId: string, type: RoleInsightType): Promise<RoleInsight[]> {
    const db = getDb(env);

    return db
      .select()
      .from(roleInsights)
      .where(and(eq(roleInsights.roleId, roleId), eq(roleInsights.type, type)))
      .orderBy(desc(roleInsights.version));
  }

  /**
   * Check if any dimension has changed inputs since the last analysis.
   */
  async checkForChanges(env: Env, roleId: string): Promise<Record<RoleInsightType, boolean>> {
    const types: RoleInsightType[] = ["location", "compensation", "combined"];
    const result: Record<string, boolean> = {};

    for (const type of types) {
      const { hash } = await this.computeInputHash(env, roleId, type);
      const latest = await this.getLatestInsight(env, roleId, type);
      result[type] = !latest || latest.inputHash !== hash;
    }

    return result as Record<RoleInsightType, boolean>;
  }

  /**
   * Generate a location insight for a role.
   * Returns cached result if input hash matches any prior version.
   */
  async generateLocationInsight(env: Env, roleId: string): Promise<RoleInsight> {
    const db = getDb(env);
    const { hash, inputs } = await this.computeInputHash(env, roleId, "location");

    // Check ALL versions for hash match (handles rollbacks)
    const [cached] = await db
      .select()
      .from(roleInsights)
      .where(
        and(
          eq(roleInsights.roleId, roleId),
          eq(roleInsights.type, "location"),
          eq(roleInsights.inputHash, hash),
        ),
      )
      .limit(1);

    if (cached) return cached;

    // Get role + metadata
    const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!role) throw new Error(`Role not found: ${roleId}`);

    // Get scoring rubrics
    const rubrics = await db
      .select()
      .from(scoringRubrics)
      .where(and(eq(scoringRubrics.type, "location"), eq(scoringRubrics.isActive, true)));

    const meta = (role.metadata ?? {}) as Record<string, unknown>;
    const location = (inputs.location as string) ?? "Unknown";
    const workplaceType = (inputs.workplaceType as string) ?? "Unknown";
    const rtoPolicy = (inputs.rtoPolicy as string) ?? "Unknown";
    const homeAddress = "126 Colby St, San Francisco, CA 94134";

    // 1. Fetch real commute data from OpenRoute API
    let commuteFactualData = "Not available. Estimate using your geographic knowledge.";
    if (location !== "Unknown" && location.trim().length > 0) {
      try {
        const openRoute = new OpenRouteService(env);
        const summary = await openRoute.getCommuteSummary(homeAddress, location);
        if (summary.success) {
          commuteFactualData = `OpenRoute API Driving Data: ${summary.distanceMiles.toFixed(1)} miles, ${summary.durationMinutes} minutes each way.`;
        } else {
          console.warn("OpenRoute commute summary failed:", summary.error);
        }
      } catch (e) {
        console.warn("Failed to invoke OpenRouteService:", e);
      }
    }

    const result = await this.executeLocationAI(
      env,
      { jobTitle: role.jobTitle, companyName: role.companyName },
      { location, workplaceType, rtoPolicy },
      commuteFactualData,
      rubrics,
    );

    // Compute next version
    const latest = await this.getLatestInsight(env, roleId, "location");
    const nextVersion = (latest?.version ?? 0) + 1;

    const payload: LocationAnalysisPayload = {
      location,
      workplaceType,
      rtoPolicy,
      commuteTable: result.commute_table.map((row: any) => ({
        schedule: row.schedule,
        mode: row.mode,
        durationMinutes: row.duration_minutes,
        monthlyCost: row.monthly_cost,
      })),
      homeAddress,
    };

    const id = crypto.randomUUID();
    const [inserted] = await db
      .insert(roleInsights)
      .values({
        id,
        roleId,
        version: nextVersion,
        type: "location",
        inputHash: hash,
        score: result.score,
        rationale: result.rationale,
        analysisPayload: payload as unknown as Record<string, unknown>,
        configSnapshot: { rubrics, workplaceAssessment: result.workplace_assessment },
      })
      .returning();

    return inserted;
  }

  /**
   * Generate a compensation insight for a role.
   * Returns cached result if input hash matches any prior version.
   */
  async generateCompensationInsight(env: Env, roleId: string): Promise<RoleInsight> {
    const db = getDb(env);
    const { hash } = await this.computeInputHash(env, roleId, "compensation");

    // Check ALL versions for hash match
    const [cached] = await db
      .select()
      .from(roleInsights)
      .where(
        and(
          eq(roleInsights.roleId, roleId),
          eq(roleInsights.type, "compensation"),
          eq(roleInsights.inputHash, hash),
        ),
      )
      .limit(1);

    if (cached) return cached;

    const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!role) throw new Error(`Role not found: ${roleId}`);

    // Get scoring rubrics
    const rubrics = await db
      .select()
      .from(scoringRubrics)
      .where(and(eq(scoringRubrics.type, "compensation"), eq(scoringRubrics.isActive, true)));

    // Get compensation baseline from global config
    const [configRow] = await db
      .select()
      .from(globalConfig)
      .where(eq(globalConfig.key, "compensation_baseline"))
      .limit(1);

    const compensationBaseline = configRow?.value as Record<string, unknown> | null;

    const rubricText = rubrics
      .map((r) => `- ${r.criteria}: ${r.scoreRangeMin}–${r.scoreRangeMax}`)
      .join("\n");

    const CompensationInsightSchema = z.object({
      score: z.number().int().min(0).max(100).describe("Compensation score 0–100"),
      rationale: z.string().describe("Detailed rationale for the compensation score"),
      negotiation_target: z.number().nullable().describe("Recommended negotiation target salary"),
      negotiation_rationale: z.string().describe("Strategy for negotiation"),
      delta_vs_google: z
        .number()
        .nullable()
        .describe("Difference vs Google TC (positive = role pays more)"),
      advertised_assessment: z.string().describe("Assessment of the advertised range"),
    });

    const baselineText = compensationBaseline
      ? JSON.stringify(compensationBaseline, null, 2)
      : "No compensation baseline configured.";

    const systemPrompt = `You are an expert career compensation analyst for Justin, evaluating a role's compensation against his historical Google compensation.

Justin's Google Compensation Baseline:
${baselineText}

Scoring rubrics:
${rubricText}

Analyze the role's compensation and provide:
1. A score (0–100) based on the rubrics
2. Where Justin could negotiate within the advertised range
3. How the compensation compares to his Google TC (~$260,672)
4. Net delta vs Google (positive means role pays more)

You must respond with a valid JSON object matching the requested schema. DO NOT wrap your response in markdown fences.`;

    const userPrompt = `Role: ${role.jobTitle} at ${role.companyName}
Salary Range: ${role.salaryMin ? `$${role.salaryMin.toLocaleString()}` : "Not disclosed"} – ${role.salaryMax ? `$${role.salaryMax.toLocaleString()}` : "Not disclosed"}
Currency: ${role.salaryCurrency ?? "USD"}`;

    const result = await generateStructuredOutput(env, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema: CompensationInsightSchema,
      schemaName: "CompensationInsight",
      temperature: 0,
      max_tokens: 8096,
    });

    const latest = await this.getLatestInsight(env, roleId, "compensation");
    const nextVersion = (latest?.version ?? 0) + 1;

    const payload: CompensationAnalysisPayload = {
      advertisedMin: role.salaryMin,
      advertisedMax: role.salaryMax,
      currency: role.salaryCurrency ?? "USD",
      googleBaseline: compensationBaseline ?? {},
      negotiationTarget: result.negotiation_target,
      negotiationRationale: result.negotiation_rationale,
      deltaVsGoogle: result.delta_vs_google,
    };

    const id = crypto.randomUUID();
    const [inserted] = await db
      .insert(roleInsights)
      .values({
        id,
        roleId,
        version: nextVersion,
        type: "compensation",
        inputHash: hash,
        score: result.score,
        rationale: result.rationale,
        analysisPayload: payload as unknown as Record<string, unknown>,
        configSnapshot: {
          compensationBaseline,
          rubrics,
          advertisedAssessment: result.advertised_assessment,
        },
      })
      .returning();

    return inserted;
  }

  /**
   * Generate a combined insight synthesizing location + compensation.
   */
  async generateCombinedInsight(env: Env, roleId: string): Promise<RoleInsight> {
    const db = getDb(env);
    const { hash } = await this.computeInputHash(env, roleId, "combined");

    const [cached] = await db
      .select()
      .from(roleInsights)
      .where(
        and(
          eq(roleInsights.roleId, roleId),
          eq(roleInsights.type, "combined"),
          eq(roleInsights.inputHash, hash),
        ),
      )
      .limit(1);

    if (cached) return cached;

    // Ensure both sub-insights exist
    const locationInsight = await this.generateLocationInsight(env, roleId);
    const compensationInsight = await this.generateCompensationInsight(env, roleId);

    const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!role) throw new Error(`Role not found: ${roleId}`);

    const rubrics = await db
      .select()
      .from(scoringRubrics)
      .where(and(eq(scoringRubrics.type, "combined"), eq(scoringRubrics.isActive, true)));

    const rubricText = rubrics
      .map((r) => `- ${r.criteria}: ${r.scoreRangeMin}–${r.scoreRangeMax}`)
      .join("\n");

    const CombinedInsightSchema = z.object({
      score: z.number().int().min(0).max(100).describe("Combined value score 0–100"),
      rationale: z.string().describe("Synthesis of location and compensation analysis"),
    });

    const systemPrompt = `You are an expert career analyst synthesizing location and compensation dimensions into a single value score.

Location Score: ${locationInsight.score}/100
Location Rationale: ${locationInsight.rationale}

Compensation Score: ${compensationInsight.score}/100
Compensation Rationale: ${compensationInsight.rationale}

Scoring rubrics:
${rubricText}

Provide a combined score (0–100) that holistically weighs both dimensions. Consider trade-offs — e.g. a great salary might offset a moderate commute.

You must respond with a valid JSON object matching the requested schema. DO NOT wrap your response in markdown fences.`;

    const userPrompt = `Role: ${role.jobTitle} at ${role.companyName}
Synthesize the location and compensation analyses into a single value assessment.`;

    const result = await generateStructuredOutput(env, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema: CombinedInsightSchema,
      schemaName: "CombinedInsight",
      temperature: 0,
      max_tokens: 4096,
    });

    const latest = await this.getLatestInsight(env, roleId, "combined");
    const nextVersion = (latest?.version ?? 0) + 1;

    const id = crypto.randomUUID();
    const [inserted] = await db
      .insert(roleInsights)
      .values({
        id,
        roleId,
        version: nextVersion,
        type: "combined",
        inputHash: hash,
        score: result.score,
        rationale: result.rationale,
        analysisPayload: {
          locationScore: locationInsight.score,
          compensationScore: compensationInsight.score,
          locationId: locationInsight.id,
          compensationId: compensationInsight.id,
        },
        configSnapshot: { rubrics },
      })
      .returning();

    return inserted;
  }

  /**
   * Executes the AI location analysis. Exposed publicly for health check and testing.
   */
  public async executeLocationAI(
    env: Env,
    roleData: { jobTitle: string; companyName: string },
    locationData: { location: string; workplaceType: string; rtoPolicy: string },
    commuteFactualData: string,
    rubrics: any[],
  ) {
    const rubricText = rubrics
      .map((r) => `- ${r.criteria}: ${r.scoreRangeMin}–${r.scoreRangeMax}`)
      .join("\n");

    const LocationInsightSchema = z.object({
      score: z.number().int().min(0).max(100).describe("Location score 0–100"),
      rationale: z.string().describe("Detailed rationale for the location score"),
      commute_table: z.array(
        z.object({
          schedule: z.string(),
          mode: z.string(),
          duration_minutes: z.number().nullable(),
          monthly_cost: z.number().nullable(),
        }),
      ),
      workplace_assessment: z.string().describe("Assessment of WFH/hybrid/onsite fit"),
    });

    const systemPrompt = `You are an expert career location analyst for Justin, a tech professional based in San Francisco (94134).

Justin's commute preferences:
- Strongly prefers WFH (work from home)
- Acceptable: hybrid 2 days/week with short commute
- Benchmark: 7 years commuting SF→Mountain View via Google Bus (free transit)
- Currently drives a Tesla Model 3
- Has access to BART and Muni for public transit

Scoring rubrics:
${rubricText}

Analyze the role's location and provide a score (0–100) based on the rubrics above.
Consider: commute time, cost, frequency, and quality of life impact.
Estimate commute times for both driving and public transit.

You must respond with a valid JSON object matching the requested schema. DO NOT wrap your response in markdown fences.`;

    const userPrompt = `Role: ${roleData.jobTitle} at ${roleData.companyName}
Location: ${locationData.location}
Workplace Type: ${locationData.workplaceType}
RTO Policy: ${locationData.rtoPolicy}

Factual Commute Data: ${commuteFactualData}

Provide a location analysis with commute estimates for 2, 3, and 5 days per week schedules via both driving (Tesla Model 3) and public transit (BART/Muni). Use the factual data provided as the primary source of truth for driving time and distance.`;

    return await generateStructuredOutput(env, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema: LocationInsightSchema,
      schemaName: "LocationInsight",
      temperature: 0,
      max_tokens: 8096,
    });
  }
}
