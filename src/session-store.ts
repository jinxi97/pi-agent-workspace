import {
  AgentSession,
  AuthStorage,
  createAgentSession,
  SessionManager,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import { config } from "./config.js";
import { getAllApiKeys } from "./api-keys.js";
import type { SessionSummary } from "./types.js";

/** Shared in-memory auth store. Keys are populated from our JSON file on demand. */
const authStorage = AuthStorage.inMemory();

/** Sync current api-keys.json contents into authStorage as runtime overrides. */
export function syncApiKeysToAuthStorage(): void {
  const keys = getAllApiKeys();
  for (const [provider, apiKey] of Object.entries(keys)) {
    authStorage.setRuntimeApiKey(provider, apiKey);
  }
}

/** Hot cache of live AgentSession instances. */
const liveSessions = new Map<string, AgentSession>();

/** Tracks which session IDs are currently streaming (for 409 guard). */
const streaming = new Set<string>();

function parseModel(modelSpec: string): { provider: string; modelId: string } {
  const idx = modelSpec.indexOf("/");
  if (idx === -1) {
    throw new Error(
      `Invalid model format: "${modelSpec}". Expected "provider/modelId", e.g. "anthropic/claude-opus-4-5".`,
    );
  }
  return {
    provider: modelSpec.slice(0, idx),
    modelId: modelSpec.slice(idx + 1),
  };
}

export async function createSession(modelSpec: string): Promise<AgentSession> {
  syncApiKeysToAuthStorage();
  const { provider, modelId } = parseModel(modelSpec);

  // getModel is typed narrowly on the known provider/model set; cast through any
  // because we accept arbitrary strings from the client.
  let model: ReturnType<typeof getModel>;
  try {
    model = getModel(provider as any, modelId as any);
  } catch (err) {
    throw new Error(`Unknown model: ${provider}/${modelId}`);
  }

  const { session } = await createAgentSession({
    cwd: config.workspaceDir,
    model,
    authStorage,
  });

  liveSessions.set(session.sessionId, session);
  return session;
}

/** Get a live session, hydrating from disk if necessary. Returns null if not found. */
export async function getSession(sessionId: string): Promise<AgentSession | null> {
  const cached = liveSessions.get(sessionId);
  if (cached) return cached;

  // Try to hydrate from disk
  const all = await SessionManager.list(config.workspaceDir);
  const info = all.find((s) => s.id === sessionId);
  if (!info) return null;

  const sessionManager = SessionManager.create(config.workspaceDir);
  sessionManager.setSessionFile(info.path);

  const { session } = await createAgentSession({
    cwd: config.workspaceDir,
    sessionManager,
    authStorage,
  });

  liveSessions.set(session.sessionId, session);
  return session;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const diskSessions = await SessionManager.list(config.workspaceDir);

  const onDisk = new Set(diskSessions.map((s) => s.id));
  const summaries: SessionSummary[] = diskSessions.map((s) => ({
    id: s.id,
    model: extractModelFromSession(s.path) ?? "unknown",
    createdAt: s.created.getTime(),
    updatedAt: s.modified.getTime(),
    messageCount: s.messageCount,
    firstMessage: s.firstMessage,
  }));

  // Include in-memory-only sessions (created but no messages yet)
  for (const [id, session] of liveSessions) {
    if (onDisk.has(id)) continue;
    const model = session.model;
    summaries.push({
      id,
      model: model ? `${model.provider}/${model.id}` : "unknown",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      firstMessage: "",
    });
  }

  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Read the last model_change entry from a JSONL file. */
function extractModelFromSession(jsonlPath: string): string | undefined {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const content = fs.readFileSync(jsonlPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    let model: string | undefined;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "model_change") {
          model = `${entry.provider}/${entry.modelId}`;
        }
      } catch {}
    }
    return model;
  } catch {
    return undefined;
  }
}

export function isStreaming(sessionId: string): boolean {
  return streaming.has(sessionId);
}

export function markStreaming(sessionId: string): void {
  streaming.add(sessionId);
}

export function unmarkStreaming(sessionId: string): void {
  streaming.delete(sessionId);
}

export type { AgentSessionEvent };
