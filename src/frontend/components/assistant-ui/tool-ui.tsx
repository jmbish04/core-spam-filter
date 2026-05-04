"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { BookOpenIcon, GlobeIcon, FileTextIcon, Loader2Icon, CheckCircle2Icon } from "lucide-react";

/**
 * ConsultNotebookToolUI — shows NotebookLM query + result card.
 */
export const ConsultNotebookToolUI = makeAssistantToolUI({
  toolName: "consultNotebook",
  render: ({ args, result, status }) => (
    <div className="flex items-start gap-2 p-3 my-1 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
      <div className="mt-0.5">
        {status?.type === "running" ? (
          <Loader2Icon className="size-4 animate-spin text-indigo-400" />
        ) : (
          <BookOpenIcon className="size-4 text-indigo-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-indigo-400 mb-1">NotebookLM Query</div>
        <p className="text-xs text-muted-foreground">
          {(args as { query?: string })?.query ?? "Querying knowledge base…"}
        </p>
        {!!result && (
          <div className="mt-2 p-2 rounded bg-muted/30 text-xs leading-relaxed">
            <CheckCircle2Icon className="size-3 inline mr-1 text-emerald-400" />
            Response received
          </div>
        )}
      </div>
    </div>
  ),
});

/**
 * ScrapeJobToolUI — shows scraping progress + extracted role data.
 */
export const ScrapeJobToolUI = makeAssistantToolUI({
  toolName: "scrapeJob",
  render: ({ args, status }) => (
    <div className="flex items-start gap-2 p-3 my-1 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
      <div className="mt-0.5">
        {status?.type === "running" ? (
          <Loader2Icon className="size-4 animate-spin text-cyan-400" />
        ) : (
          <GlobeIcon className="size-4 text-cyan-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-cyan-400 mb-1">Scraping Job Posting</div>
        <p className="text-xs text-muted-foreground truncate">
          {(args as { url?: string })?.url ?? "Fetching…"}
        </p>
      </div>
    </div>
  ),
});

/**
 * DraftDocumentToolUI — shows draft generation status + preview.
 */
export const DraftDocumentToolUI = makeAssistantToolUI({
  toolName: "draftDocument",
  render: ({ args, status }) => (
    <div className="flex items-start gap-2 p-3 my-1 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <div className="mt-0.5">
        {status?.type === "running" ? (
          <Loader2Icon className="size-4 animate-spin text-amber-400" />
        ) : (
          <FileTextIcon className="size-4 text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-amber-400 mb-1">Drafting Document</div>
        <p className="text-xs text-muted-foreground">
          {(args as { docType?: string })?.docType ?? "Generating…"}
        </p>
      </div>
    </div>
  ),
});
