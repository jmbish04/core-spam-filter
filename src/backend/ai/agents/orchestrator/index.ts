import { Agent, callable, type Connection } from "agents";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { TemplateType } from "@/ai/tools/google/templates/template-engine";

import { getDb } from "@/db";
import { threads, messages, roles } from "@/db/schema";

import type { OrchestratorState, OrchestratorTask } from "./types";

import { checkHealth as healthProbeImpl } from "./health";
import {
  handleEnqueueTask,
  handleProcessPendingTasks,
  handleScrapeJob,
  handleExtractJobDetails,
  handleConsultNotebook,
  handleCreateDocFromTemplate,
  handleCreateDocFromHtml,
  handleCreateDocFromHtmlTemplate,
  handleCreateBrandedDocFromTemplate,
  handleExtractBrandColors,
  handleReadDoc,
  handleWriteDoc,
  handleCommentOnDoc,
  handleReplyToThread,
  handleReplyToDocComment,
  handleListDocCommentsTagged,
  handleListRoles,
  handleUpdateRole,
  handleDraftEmailReply,
} from "./methods";

const IncomingMessage = z.object({
  type: z.literal("chat"),
  content: z.string().min(1),
  roleId: z.string().optional(),
});

export class OrchestratorAgent extends Agent<Env, OrchestratorState> {
  static docsMetadata() {
    return {
      name: "Colby",
      className: "OrchestratorAgent",
      description:
        "The primary Project Management orchestrator agent. Colby tracks task state (e.g., job analysis, resume drafts), manages global & role-specific threads, and interfaces with specialized backend tools like Jules, NotebookLM, and Google Docs.",
      docsPath: "/docs/agents/orchestrator",
      methods: [
        {
          name: "enqueueTask",
          description: "Adds a task to the queue and broadcasts progress",
          params: "task: OrchestratorTask",
          returns: "OrchestratorTask",
        },
        {
          name: "scrape_job",
          description: "Scrape a job URL and extract raw text",
          params: "url: string",
          returns: "ScrapedContent",
        },
        {
          name: "extract_job_details",
          description: "Extract structured job details from raw text",
          params: "text: string",
          returns: "JobPosting",
        },
      ],
      tools: ["Google Docs", "NotebookLM SDK", "Cloudflare Browser Rendering"],
    };
  }

  initialState: OrchestratorState = {
    roleId: "global",
    pendingTasks: [],
  };

  async onStart() {
    // If we're a role-specific agent, bind our role ID from our instance name.
    if (this.name !== "global" && this.state.roleId === "global") {
      this.setState({ ...this.state, roleId: this.name });
    }
  }

  async onMessage(connection: Connection, message: unknown) {
    try {
      const parsed = IncomingMessage.parse(
        typeof message === "string" ? JSON.parse(message) : message,
      );
      const roleId = parsed.roleId ?? (this.state.roleId !== "global" ? this.state.roleId : null);
      const thread = await this.ensureThread(roleId);

      await this.addMessage(thread.id, roleId, "user", parsed.content);

      this.broadcast(
        JSON.stringify({
          type: "message_ack",
          threadId: thread.id,
        }),
      );

      // Simple echo/acknowledgment reply for now (until full orchestration is hooked up here)
      await this.reply_to_thread(
        roleId ?? "global",
        "I've received your message and added it to the thread context.",
      );
    } catch (e) {
      connection.send(JSON.stringify({ type: "error", message: "Invalid chat payload" }));
    }
  }

  @callable()
  async enqueueTask(task: Omit<OrchestratorTask, "id" | "status">) {
    const nextTask = await handleEnqueueTask(this, task);
    // Background execution
    this.ctx.waitUntil(this.processPendingTasks());
    return nextTask;
  }

  @callable()
  async processPendingTasks() {
    return handleProcessPendingTasks(this, this.env);
  }

  @callable()
  async scrape_job(url: string) {
    return handleScrapeJob(this.env, url);
  }

  @callable()
  async extract_job_details(text: string) {
    return handleExtractJobDetails(this.env, text);
  }

  @callable()
  async consult_notebook(query: string) {
    return handleConsultNotebook(this.env, query);
  }

  @callable()
  async create_doc_from_template(
    templateId: string,
    vars: Record<string, string>,
    folderId: string,
  ) {
    return handleCreateDocFromTemplate(this.env, templateId, vars, folderId);
  }

  @callable()
  async create_doc_from_html(name: string, htmlContent: string, folderId: string) {
    return handleCreateDocFromHtml(this.env, name, htmlContent, folderId);
  }

  @callable()
  async create_doc_from_html_template(
    templateType: TemplateType,
    variables: Record<string, unknown>,
    folderId: string,
    name?: string,
  ) {
    return handleCreateDocFromHtmlTemplate(this.env, templateType, variables, folderId, name);
  }

  @callable()
  async create_branded_doc(
    templateType: TemplateType,
    variables: Record<string, unknown>,
    companyName: string,
    folderId: string,
    name?: string,
  ) {
    return handleCreateBrandedDocFromTemplate(
      this.env,
      templateType,
      variables,
      companyName,
      folderId,
      name,
    );
  }

  @callable()
  async extract_brand_colors(companyId: string) {
    return handleExtractBrandColors(this.env, companyId);
  }

  @callable()
  async read_doc(docId: string) {
    return handleReadDoc(this.env, docId);
  }

  @callable()
  async write_doc(docId: string, text: string) {
    return handleWriteDoc(this.env, docId, text);
  }

  @callable()
  async comment_on_doc(docId: string, anchor: string, text: string) {
    return handleCommentOnDoc(this.env, docId, anchor, text);
  }

  @callable()
  async reply_to_thread(roleId: string, text: string) {
    return handleReplyToThread(this, roleId, text);
  }

  @callable()
  async reply_to_doc_comment(docId: string, commentId: string, text: string) {
    return handleReplyToDocComment(this.env, docId, commentId, text);
  }

  @callable()
  async list_doc_comments_tagged(docId: string, tag = "#colby") {
    return handleListDocCommentsTagged(this.env, docId, tag);
  }

  @callable()
  async list_roles(status?: string) {
    return handleListRoles(this, this.env, status);
  }

  @callable()
  async update_role(id: string, patch: Partial<typeof roles.$inferInsert>) {
    return handleUpdateRole(this, this.env, id, patch);
  }

  @callable()
  async draft_email_reply(emailId: string) {
    return handleDraftEmailReply(this, this.env, emailId);
  }

  /**
   * Draft a resume or cover letter for a role using the NotebookLM-backed
   * multi-phase pipeline. Broadcasts progress via WebSocket.
   */
  @callable()
  async draft_resume(roleId: string, docType: "resume" | "cover_letter" = "resume") {
    const { draftWithNotebook } = await import("@/ai/tasks/draft-with-notebook");
    return draftWithNotebook({
      env: this.env,
      roleId,
      docType,
      onProgress: (progress) =>
        this.broadcast(JSON.stringify({ type: "draft_progress", roleId, progress })),
    });
  }

  /**
   * Respond to all @colby / #colby tagged comments on a Google Doc.
   * Consults NotebookLM for career evidence and posts replies.
   */
  @callable()
  async respond_to_comments(roleId: string, gdocId: string) {
    const { respondToComments } = await import("@/ai/tasks/respond-to-comments");
    return respondToComments(this.env, roleId, gdocId, (progress) => {
      this.broadcast(JSON.stringify({ type: "comment_progress", roleId, gdocId, progress }));
    });
  }

  @callable()
  async healthProbe() {
    return healthProbeImpl(this, this.env);
  }

  public updateTask(id: string, patch: Partial<OrchestratorTask>) {
    this.setState({
      ...this.state,
      pendingTasks: this.state.pendingTasks.map((task) =>
        task.id === id ? { ...task, ...patch } : task,
      ),
    });
  }

  public broadcastProgress(stage: string, task: OrchestratorTask) {
    this.broadcast(JSON.stringify({ type: "task", stage, task }));
  }

  public async ensureThread(roleId: string | null) {
    const db = getDb(this.env);
    const whereClause = roleId ? eq(threads.roleId, roleId) : eq(threads.title, "Global");
    const [existing] = await db
      .select()
      .from(threads)
      .where(whereClause)
      .orderBy(desc(threads.createdAt))
      .limit(1);

    if (existing) return existing;

    const [created] = await db
      .insert(threads)
      .values({
        id: crypto.randomUUID(),
        title: roleId ? "Role thread" : "Global",
        roleId,
      })
      .returning();

    return created;
  }

  public async addMessage(
    threadId: string,
    roleId: string | null,
    author: "user" | "agent" | "system",
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    const db = getDb(this.env);
    const [message] = await db
      .insert(messages)
      .values({
        id: crypto.randomUUID(),
        threadId,
        roleId,
        author,
        content,
        metadata,
      })
      .returning();

    return message;
  }
}

export async function enqueueOrchestratorTask(
  env: Env,
  roleId: string | "global",
  task: Omit<OrchestratorTask, "id" | "status">,
) {
  const id = env.ORCHESTRATOR_AGENT.idFromName(roleId);
  const stub = env.ORCHESTRATOR_AGENT.get(id) as DurableObjectStub<OrchestratorAgent>;

  return stub.enqueueTask(task);
}
