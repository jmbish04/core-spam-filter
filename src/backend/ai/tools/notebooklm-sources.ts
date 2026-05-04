/**
 * @fileoverview NotebookLM source and artifact helpers for role intake assets.
 *
 * These helpers intentionally reuse the same cookie-based client construction
 * as chat consultation while avoiding agent-rule injection. The role podcast
 * prompt must be sent verbatim so NotebookLM can interpret it as an artifact
 * creation request tied to the uploaded role source.
 */

import type { Artifact, NotebookLMClient } from "notebooklm-sdk";

import { Buffer } from "node:buffer";

import { createNotebookClient, isAuthError, SessionExpiredError } from "./notebooklm";

/** Callback executed with an authenticated NotebookLM client and notebook ID. */
export type NotebookClientCallback<T> = (
  client: NotebookLMClient,
  notebookId: string,
) => Promise<T>;

/**
 * Execute NotebookLM SDK work with shared auth and auth-error normalization.
 *
 * This is intentionally small: callers decide whether to use chat, sources, or
 * artifacts APIs, while this wrapper keeps cookie handling and recovery errors
 * consistent with `consultNotebook`.
 */
export async function withNotebookClient<T>(
  env: Env,
  callback: NotebookClientCallback<T>,
): Promise<T> {
  try {
    const client = await createNotebookClient(env);
    return await callback(client, env.CAREER_NOTEBOOKLM_ID);
  } catch (error) {
    if (isAuthError(error)) {
      throw new SessionExpiredError(error);
    }
    throw error;
  }
}

/** Options for uploading a role markdown file as a NotebookLM source. */
export type UploadMarkdownSourceOptions = {
  /** Filename visible inside NotebookLM, e.g. `role-<uuid>.md`. */
  fileName: string;
  /** Markdown content generated from scrape output or user-entered role fields. */
  markdown: string;
  /** SDK wait timeout in seconds. Defaults to five minutes. */
  waitTimeoutSecs?: number;
};

/**
 * Upload a role markdown document to NotebookLM and wait for indexing to finish.
 *
 * NotebookLM does not expose a markdown-specific helper, so we upload bytes as
 * a `text/markdown` file via `addFileBuffer` and explicitly poll source status.
 */
export async function uploadMarkdownSource(
  env: Env,
  opts: UploadMarkdownSourceOptions,
): Promise<{ sourceId: string; title: string | null; status: string }> {
  return withNotebookClient(env, async (client, notebookId) => {
    const uploaded = await client.sources.addFileBuffer(
      notebookId,
      Buffer.from(opts.markdown, "utf8"),
      opts.fileName,
      "text/markdown",
      { waitUntilReady: false },
    );

    const ready = await client.sources.waitUntilReady(
      notebookId,
      uploaded.id,
      opts.waitTimeoutSecs ?? 300,
      2,
    );

    return { sourceId: ready.id, title: ready.title, status: ready.status };
  });
}

/**
 * Capture the set of audio artifacts that already exist before a podcast prompt.
 */
export async function snapshotAudioArtifactIds(env: Env): Promise<string[]> {
  return withNotebookClient(env, async (client, notebookId) => {
    const artifacts = await client.artifacts.listAudio(notebookId);
    return artifacts.map((artifact) => artifact.id);
  });
}

/**
 * Find a newly-created audio artifact by diffing against a pre-prompt baseline.
 */
export async function findNewAudioArtifact(
  env: Env,
  baselineArtifactIds: string[],
): Promise<Artifact | null> {
  const baseline = new Set(baselineArtifactIds);
  return withNotebookClient(env, async (client, notebookId) => {
    const artifacts = await client.artifacts.listAudio(notebookId);
    return artifacts.find((artifact) => !baseline.has(artifact.id)) ?? null;
  });
}

/**
 * Download a completed NotebookLM audio artifact as Worker-compatible bytes.
 */
export async function downloadAudioArtifactBytes(
  env: Env,
  artifactId: string,
): Promise<ArrayBuffer> {
  return withNotebookClient(env, async (client, notebookId) => {
    const buffer = await client.artifacts.downloadAudio(notebookId, artifactId);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
  });
}

/**
 * Send the custom podcast creation prompt through NotebookLM chat.
 *
 * The SDK currently returns only chat conversation data here; the generated
 * podcast artifact is discovered later by polling audio artifacts.
 */
export async function sendPodcastChatPrompt(
  env: Env,
  prompt: string,
): Promise<{ answer: string; conversationId: string; turnNumber: number }> {
  return withNotebookClient(env, async (client, notebookId) => {
    const result = await client.chat.ask(notebookId, prompt);
    return {
      answer: result.answer,
      conversationId: result.conversationId,
      turnNumber: result.turnNumber,
    };
  });
}
