import { z } from "zod";

export type SpamTaskType =
  | "review_email"
  | "obtain_context_non_spam_email"
  | "draft_email_response";

export type SpamTaskStatus = "pending" | "running" | "complete" | "failed";

export type SpamTask = {
  id: string;
  type: SpamTaskType;
  status: SpamTaskStatus;
  roleId?: string;
  payload?: Record<string, unknown>;
  error?: string;
};

export type SpamAgentState = {
  roleId?: string | "global";
  pendingTasks?: SpamTask[];
  processedCount: number;
};

export type WritingStyle = {
  id: string;
  name: string;
  description: string | null;
  style_prompt: string;
  priority: number;
  is_enabled: boolean | null;
  created_at: string;
  updated_at: string;
};

export type StyleCondition = {
  id: string;
  style_id: string;
  condition_field: "from_address" | "from_domain" | "to_address" | "subject" | "body" | "cc";
  condition_operator:
    | "contains"
    | "equals"
    | "starts_with"
    | "ends_with"
    | "not_contains"
    | "matches_regex";
  condition_value: string;
  created_at: string;
};

export type EmailAnalysisResult = {
  spam: boolean;
  not_spam: boolean;
  high_alert: boolean;
  likelihood_score_spam: number;
  likelihood_score_not_spam: number;
  rationale_spam: string;
  rationale_not_spam: string;
  triggered_configurations: string[];
  is_answerable: boolean;
  no_reply_needed: boolean;
  draft_reply: string;
  action_reasoning: string;
  applied_writing_style_id: string | null;
  applied_writing_style_name: string | null;
};
