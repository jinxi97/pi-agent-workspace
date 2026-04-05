import {
  AgentSession,
  AuthStorage,
  createAgentSession,
  SessionManager,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import { readFileSync } from "node:fs";
import { config } from "./config.js";
import type { SessionSummary } from "./types.js";

const GEMINI_PROVIDER = "google";

/** Shared in-memory auth store seeded with the Gemini key from env. */
const authStorage = AuthStorage.inMemory();
authStorage.setRuntimeApiKey(GEMINI_PROVIDER, config.geminiApiKey);

/** Hot cache of live AgentSession instances. */
const liveSessions = new Map<string, AgentSession>();

/** Tracks which session IDs are currently streaming (for 409 guard). */
const streaming = new Set<string>();

export async function createSession(modelId: string): Promise<AgentSession> {
  const model = getModel(GEMINI_PROVIDER as any, modelId as any);
  if (!model) {
    throw new Error(`Unknown Gemini model: ${modelId}`);
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
    const content = readFileSync(jsonlPath, "utf-8");
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
