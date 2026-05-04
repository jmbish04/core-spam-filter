"use client";

import { parseMarkdownToHtml } from "@/lib/utils";

/**
 * MarkdownText — renders assistant message text with basic markdown formatting.
 * Used as the Text component in MessagePrimitive.Content.
 */
export function MarkdownText({ text }: { text: string }) {
  return (
    <div
      className="text-sm leading-relaxed whitespace-pre-wrap prose prose-sm prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(text) }}
    />
  );
}
