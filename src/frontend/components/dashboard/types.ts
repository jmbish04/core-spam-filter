export type DashboardSummary = {
  total: number;
  preparing: number;
  applied: number;
  interviewing: number;
  offer: number;
};

export type CompanyChartRow = {
  name: string;
  value: number;
};

export type SalaryChartRow = {
  name: string;
  min: number | null;
  max: number | null;
};

export type RoleRow = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string | null;
  jobPostingPdfUrl: string | null;
  status: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailRow = {
  id: string;
  roleId: string | null;
  subject: string;
  sender: string;
  processedStatus: string;
  receivedAt: string;
};

export type PendingTask = {
  id: string;
  type: string;
  status: string;
  roleId?: string;
};

export type DocumentRow = {
  id: string;
  gdocId: string;
  roleId: string;
  type: string;
  version: number;
  name: string;
  createdAt: string;
};

export type MessageRow = {
  id: string;
  threadId: string;
  roleId: string | null;
  author: "user" | "agent" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export type ThreadRow = {
  id: string;
  title: string;
  roleId: string | null;
  createdAt: string;
};

export type InterviewNoteRow = {
  id: string;
  roleId: string;
  title: string;
  content: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
};

export type InterviewRecordingRow = {
  id: string;
  roleId: string;
  r2Key: string;
  originalFilename: string;
  durationSeconds: number | null;
  transcription: string | null;
  transcriptionStatus: "pending" | "processing" | "complete" | "failed";
  noteId: string | null;
  createdAt: string;
};

export type TranscriptionJobRow = {
  id: string;
  recordingId: string;
  roleId: string;
  status: "pending" | "chunking" | "transcribing" | "complete" | "error";
  phase: string | null;
  progress: number;
  totalChunks: number | null;
  completedChunks: number;
  fullText: string | null;
  error: string | null;
  r2Key: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  recordingFilename?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
};

export type TranscriptionChunkRow = {
  id: string;
  jobId: string;
  chunkIndex: number;
  r2Key: string;
  status: "pending" | "processing" | "complete" | "failed";
  transcription: string | null;
  durationSeconds: number | null;
  createdAt: string;
  completedAt: string | null;
};
