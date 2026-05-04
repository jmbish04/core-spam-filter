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
  roleId: string | "global";
  pendingTasks: SpamTask[];
  processedCount: number;
};


