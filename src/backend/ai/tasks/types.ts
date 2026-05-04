import type { ChatMessage } from "../providers";

// Re-export shared AI provider types
export type { ChatMessage };

// ---------------------------------------------------------------------------
// Draft / Draft-with-Notebook Types
// ---------------------------------------------------------------------------

export type DraftDocType = "resume" | "cover_letter" | "email_reply";

export type DraftPhase =
  | "consulting"
  | "drafting"
  | "accuracy_review"
  | "strategic_review"
  | "creating_doc"
  | "complete"
  | "error";

export interface DraftProgress {
  phase: DraftPhase;
  message: string;
  docId?: string;
  gdocId?: string;
  webViewLink?: string;
}

export interface DraftWithNotebookOpts {
  env: Env;
  roleId: string;
  docType: DraftDocType;
  /** WebSocket/DO progress broadcaster */
  onProgress?: (progress: DraftProgress) => void;
}

export interface DraftResult {
  content: string;
  docId: string;
  gdocId: string;
  webViewLink?: string;
  memoryIds: string[];
}

// ---------------------------------------------------------------------------
// Comment Response Types
// ---------------------------------------------------------------------------

export interface CommentResponseProgress {
  phase: "reading" | "responding" | "complete" | "error";
  message: string;
  commentId?: string;
  totalComments?: number;
  currentComment?: number;
}

export interface CommentResponseResult {
  commentsProcessed: number;
  replies: Array<{
    commentId: string;
    commentContent: string;
    replyContent: string;
    memoryId: string;
  }>;
}

// ---------------------------------------------------------------------------
// Query Preparation Types
// ---------------------------------------------------------------------------

export interface PreparedQuery {
  /** The refined, evidence-seeking query for NotebookLM */
  refinedQuery: string;
  /** Additional follow-up queries to ask if the answer is incomplete */
  followUpQueries: string[];
}

export interface ResponseEvaluation {
  /** Whether the answer sufficiently addresses the query */
  sufficient: boolean;
  /** Identified gaps in the response */
  gaps: string[];
  /** Suggested follow-up query if gaps exist (max 1) */
  followUpQuery?: string;
}

// ---------------------------------------------------------------------------
// Email Status Classification Types
// ---------------------------------------------------------------------------

export const VALID_STATUSES = [
  "preparing",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "archived",
] as const;

export type StatusSuggestion = {
  suggestedStatus: (typeof VALID_STATUSES)[number] | null;
  confidence: number;
  reasoning: string;
};
