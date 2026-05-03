import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { emailsLog } from "../../../db/schemas/emails_log";
import { filterRules } from "../../../db/schemas/filter_rules";

export class EmailAnalyzerAgent extends DurableObject {
  constructor(state: any, env: any) {
    super(state, env);
  }

  async fetch(request: Request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload: any = await request.json();
    const env: any = this.env;

    const db = drizzle(env.DB);

    // 1. Check if email was already processed
    if (payload.message_id) {
      const existingLog = await db
        .select()
        .from(emailsLog)
        .where(eq(emailsLog.message_id, payload.message_id))
        .limit(1);

      if (existingLog.length > 0) {
        const log = existingLog[0];
        console.log(`Skipping AI, returning cached result for message_id: ${payload.message_id}`);
        return new Response(
          JSON.stringify({
            spam: log.is_spam,
            not_spam: !log.is_spam,
            high_alert: log.is_high_alert,
            likelihood_score_spam: log.spam_score,
            likelihood_score_not_spam: 100 - (log.spam_score || 0),
            rationale_spam: log.is_spam ? log.rationale : "",
            rationale_not_spam: !log.is_spam ? log.rationale : "",
            triggered_configurations: log.triggered_rules ? JSON.parse(log.triggered_rules) : [],
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // 2. Fetch Rules
    const rules = await db.select().from(filterRules);

    // Create system prompt based on rules
    const rulesStr = rules
      .map((r: any) => `${r.rule_type}: ${r.value} -> ${r.classification}`)
      .join("\n");
    const systemPrompt = `You are a core spam filter and triage system. Analyze the provided email and rules.
Determine if the email is spam, high_alert, etc. Give scores and rationale.
Return ONLY valid JSON matching this schema:
{
  "spam": boolean,
  "not_spam": boolean,
  "high_alert": boolean,
  "likelihood_score_spam": number,
  "likelihood_score_not_spam": number,
  "rationale_spam": string,
  "rationale_not_spam": string,
  "triggered_configurations": string[]
}

Rules:
${rulesStr}
`;

    const userPrompt = `
Sender: ${payload.sender}
Recipient: ${payload.recipient}
Subject: ${payload.subject}
Body: ${payload.body}
`;

    let aiResult;
    try {
      const result = await env.AI.run(env.DEFAULT_MODEL, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });
      aiResult = JSON.parse(result.response);
    } catch (e) {
      console.error("AI Error", e);
      return new Response("AI Error", { status: 500 });
    }

    // Embed the body
    try {
      const { data } = await env.AI.run(env.EMBEDDING_MODEL, {
        text: [payload.body],
      });
      const vector = data[0];

      const embedEmailId = payload.message_id || crypto.randomUUID();
      await env.VECTOR_INDEX.upsert([{ id: embedEmailId, values: vector }]);
    } catch (e) {
      console.error("Vectorize Error", e);
    }

    // Log to D1
    const isSpam = aiResult.spam;
    const isHighAlert = aiResult.high_alert;

    try {
      await db.insert(emailsLog).values({
        id: crypto.randomUUID(),
        message_id: payload.message_id || null,
        sender: payload.sender,
        recipient: payload.recipient,
        cc: payload.cc || null,
        bcc: payload.bcc || null,
        subject: payload.subject,
        body_snippet: payload.body.substring(0, 100),
        is_spam: isSpam,
        is_high_alert: isHighAlert,
        spam_score: aiResult.likelihood_score_spam,
        rationale: isSpam ? aiResult.rationale_spam : aiResult.rationale_not_spam,
        triggered_rules: JSON.stringify(aiResult.triggered_configurations),
        analyzed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("DB Log Error", e);
    }

    return new Response(JSON.stringify(aiResult), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
