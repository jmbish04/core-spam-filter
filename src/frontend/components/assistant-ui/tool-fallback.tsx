"use client";

import { WrenchIcon, Loader2Icon, CheckCircle2Icon } from "lucide-react";

/**
 * ToolFallback — generic fallback UI for unregistered tool calls.
 * Shows tool name, args, and status.
 */
export function ToolFallback({
  toolName,
  args,
  result,
}: {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}) {
  const isDone = result !== undefined;

  return (
    <div className="flex items-start gap-2 p-3 my-1 rounded-lg bg-muted/30 border border-border/50">
      <div className="mt-0.5">
        {isDone ? (
          <CheckCircle2Icon className="size-4 text-emerald-400" />
        ) : (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <WrenchIcon className="size-3" />
          <span>{toolName}</span>
        </div>
        {Object.keys(args).length > 0 && (
          <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto max-w-full">
            {JSON.stringify(args, null, 2)}
          </pre>
        )}
        {isDone && result && <div className="mt-1.5 text-xs text-muted-foreground">✓ Complete</div>}
      </div>
    </div>
  );
}
