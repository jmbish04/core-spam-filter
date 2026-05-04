"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  AuiIf,
} from "@assistant-ui/react";
import {
  SendIcon,
  MicIcon,
  SquareIcon,
  Volume2Icon,
  VolumeXIcon,
  CopyIcon,
  CheckIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { useState } from "react";

import { MarkdownText } from "./markdown-text";

// ---------------------------------------------------------------------------
// Thread — the main chat container
// ---------------------------------------------------------------------------

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
        <ThreadWelcome />
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>
      <Composer />
    </ThreadPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Welcome screen with suggestions
// ---------------------------------------------------------------------------

function ThreadWelcome() {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">Career Assistant</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          I can help you draft resumes, cover letters, prepare for interviews, and analyze job
          requirements. Ask me anything about this role.
        </p>
        <ThreadPrimitive.Suggestion
          prompt="Help me tailor my resume for this role"
          method="replace"
          autoSend
        >
          <SuggestionButton text="Tailor my resume" />
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion
          prompt="What are my strongest qualifications for this position?"
          method="replace"
          autoSend
        >
          <SuggestionButton text="Analyze my fit" />
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion
          prompt="Draft a cover letter for this role"
          method="replace"
          autoSend
        >
          <SuggestionButton text="Draft cover letter" />
        </ThreadPrimitive.Suggestion>
      </div>
    </ThreadPrimitive.Empty>
  );
}

function SuggestionButton({ text }: { text: string }) {
  return (
    <button className="px-4 py-2 mb-2 text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors w-64">
      {text}
    </button>
  );
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-4 py-2">
      <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
        <MessagePrimitive.Content
          components={{
            Text: ({ text }) => <p className="text-sm whitespace-pre-wrap">{text}</p>,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Assistant message
// ---------------------------------------------------------------------------

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex px-4 py-2">
      <div className="bg-muted/50 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%]">
        <MessagePrimitive.Content
          components={{
            Text: MarkdownText,
          }}
        />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Assistant action bar (copy, speak, retry)
// ---------------------------------------------------------------------------

function AssistantActionBar() {
  const [copied, setCopied] = useState(false);

  return (
    <ActionBarPrimitive.Root className="flex items-center gap-1 mt-2 -mb-1">
      <ActionBarPrimitive.Copy
        onClick={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="p-1.5 rounded-md hover:bg-background/60 transition-colors text-muted-foreground"
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </ActionBarPrimitive.Copy>

      <ActionBarPrimitive.Speak className="p-1.5 rounded-md hover:bg-background/60 transition-colors text-muted-foreground">
        <Volume2Icon className="size-3.5" />
      </ActionBarPrimitive.Speak>

      <ActionBarPrimitive.StopSpeaking className="p-1.5 rounded-md hover:bg-background/60 transition-colors text-muted-foreground">
        <VolumeXIcon className="size-3.5" />
      </ActionBarPrimitive.StopSpeaking>

      <ActionBarPrimitive.Reload className="p-1.5 rounded-md hover:bg-background/60 transition-colors text-muted-foreground">
        <RefreshCcwIcon className="size-3.5" />
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Composer — input area with dictation
// ---------------------------------------------------------------------------

function Composer() {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-border p-3 bg-background">
      <ComposerPrimitive.Input
        className="min-h-[40px] flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        placeholder="Type a message or use voice..."
        autoFocus
      />

      <div className="flex gap-1.5">
        {/* Show Dictate button when not dictating */}
        <AuiIf condition={(s) => s.composer.dictation == null}>
          <ComposerPrimitive.Dictate className="inline-flex items-center justify-center rounded-md text-sm hover:bg-muted h-9 w-9 text-muted-foreground transition-colors">
            <MicIcon className="h-4 w-4" />
          </ComposerPrimitive.Dictate>
        </AuiIf>

        {/* Show Stop button when dictating */}
        <AuiIf condition={(s) => s.composer.dictation != null}>
          <ComposerPrimitive.StopDictation className="inline-flex items-center justify-center rounded-md text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 w-9 transition-colors">
            <SquareIcon className="h-4 w-4 animate-pulse fill-current" />
          </ComposerPrimitive.StopDictation>
        </AuiIf>

        <ComposerPrimitive.Send className="inline-flex items-center justify-center rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 h-9 w-9 transition-colors disabled:opacity-50">
          <SendIcon className="h-4 w-4" />
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}
