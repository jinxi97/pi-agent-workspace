import { Elysia, t, sse, status } from "elysia";
import {
  createSession,
  getSession,
  isStreaming,
  listSessions,
  markStreaming,
  syncApiKeysToAuthStorage,
  unmarkStreaming,
  type AgentSessionEvent,
} from "../session-store.js";

export const sessionsRoutes = new Elysia({ prefix: "/sessions" })
  .post(
    "/",
    async ({ body }) => {
      try {
        const session = await createSession(body.model);
        return {
          sessionId: session.sessionId,
          model: session.model
            ? `${session.model.provider}/${session.model.id}`
            : null,
        };
      } catch (err) {
        return status(400, { error: (err as Error).message });
      }
    },
    {
      body: t.Object({
        model: t.String({
          description: "Model in 'provider/modelId' format",
          examples: ["anthropic/claude-opus-4-5"],
        }),
      }),
      detail: {
        tags: ["Sessions"],
        summary: "Create a new session",
        description:
          "Creates a new agent session scoped to the server's workspace directory. The session is held in memory until the first message is sent, then persisted to a JSONL file on disk.",
      },
    },
  )

  .get("/", async () => ({ sessions: await listSessions() }), {
    detail: {
      tags: ["Sessions"],
      summary: "List all sessions",
      description:
        "Returns sessions persisted to disk plus any in-memory sessions that haven't been messaged yet.",
    },
  })

  .get("/:id", async ({ params }) => {
    const session = await getSession(params.id);
    if (!session) return status(404, { error: "Session not found" });

    return {
      id: session.sessionId,
      model: session.model
        ? `${session.model.provider}/${session.model.id}`
        : null,
      messages: session.messages,
      isStreaming: session.isStreaming,
    };
  }, {
    detail: {
      tags: ["Sessions"],
      summary: "Get session state",
      description: "Returns the session's current model, full message history, and streaming state.",
    },
  })

  .post(
    "/:id/messages",
    async function* ({ params, body }) {
      const session = await getSession(params.id);
      if (!session) {
        yield sse({
          event: "error",
          data: { error: "Session not found" },
        });
        return;
      }

      if (isStreaming(params.id)) {
        yield sse({
          event: "error",
          data: { error: "Session is already streaming" },
        });
        return;
      }

      syncApiKeysToAuthStorage();
      markStreaming(params.id);

      // Bridge push-based subscribe callback into pull-based generator.
      const queue: AgentSessionEvent[] = [];
      let notify: (() => void) | null = null;
      let finished = false;

      const unsubscribe = session.subscribe((event) => {
        queue.push(event);
        if (event.type === "agent_end") finished = true;
        notify?.();
        notify = null;
      });

      const promptPromise = session.prompt(body.text).catch((err: unknown) => {
        // Surface prompt errors as an event
        queue.push({
          type: "error",
          error: (err as Error).message ?? String(err),
        } as any);
        finished = true;
        notify?.();
        notify = null;
      });

      try {
        while (!finished || queue.length > 0) {
          if (queue.length === 0) {
            await new Promise<void>((r) => {
              notify = r;
            });
          }
          while (queue.length > 0) {
            const event = queue.shift()!;
            yield sse({ event: event.type, data: event });
          }
        }
      } finally {
        unsubscribe();
        unmarkStreaming(params.id);
        await promptPromise;
      }
    },
    {
      body: t.Object({
        text: t.String({ description: "User message to send" }),
      }),
      detail: {
        tags: ["Sessions"],
        summary: "Send message (SSE stream)",
        description:
          "Sends a user message and streams agent events as Server-Sent Events. Event types: agent_start, turn_start, message_start, message_update, message_end, tool_execution_start, tool_execution_update, tool_execution_end, turn_end, agent_end. Returns an `error` event if the session does not exist or is already streaming.",
      },
    },
  );
