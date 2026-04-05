# pi-agent-workspace

An **agent-in-workspace** pattern: an HTTP server that wraps [`pi-coding-agent`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) and exposes endpoints for managing sessions and sending chat messages to a coding agent scoped to a single workspace directory.

Built with [Elysia](https://elysiajs.com/) on the [Bun](https://bun.sh/) runtime.

## What it does

- **One workspace, many sessions** — the agent can read and write files inside a configured workspace directory. Every session shares the same workspace.
- **Session management** — create, list, and retrieve sessions. Message history is persisted to JSONL by pi-coding-agent.
- **Streaming chat** — send a user message and receive the agent's response (including tool calls for `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`) as Server-Sent Events.
- **Bring-your-own API key** — configure provider keys (Anthropic, OpenAI, Google, OpenRouter, etc.) via a JSON file; no need to edit dotfiles.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sessions` | Create a session. Body: `{ "model": "provider/modelId" }` |
| `GET` | `/sessions` | List all sessions |
| `GET` | `/sessions/:id` | Get session state and message history |
| `POST` | `/sessions/:id/messages` | Send a message. SSE stream of agent events. |
| `GET` | `/api-keys` | List configured providers (masked) |
| `PUT` | `/api-keys/:provider` | Set API key for a provider |
| `DELETE` | `/api-keys/:provider` | Remove an API key |

Interactive API docs available at **http://localhost:3000/swagger** once the server is running.

## Getting Started

Install dependencies:
```bash
bun install
```

Set the workspace directory and run:
```bash
WORKSPACE_DIR=/path/to/your/workspace bun run dev
```

The server listens on port `3000` by default. Override with `PORT=8080`.

## Example

```bash
# 1. Configure a provider key
curl -X PUT http://localhost:3000/api-keys/anthropic \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"sk-ant-..."}'

# 2. Create a session
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic/claude-opus-4-5"}'
# → { "sessionId": "abc-123", "model": "anthropic/claude-opus-4-5" }

# 3. Send a message (streams over SSE)
curl -N -X POST http://localhost:3000/sessions/abc-123/messages \
  -H "Content-Type: application/json" \
  -d '{"text":"list the files in this workspace"}'
```

## Supported providers

`anthropic`, `openai`, `google` (Gemini), `openrouter`, `xai`, `groq`, `cerebras`, `mistral`, `google-vertex`, and more — any provider supported by [`pi-ai`](https://www.npmjs.com/package/@mariozechner/pi-ai).

## Configuration

| Env var | Default | Description |
|---|---|---|
| `WORKSPACE_DIR` | *(required)* | Absolute path to the workspace the agent can read/write |
| `DATA_DIR` | `./data` | Where `api-keys.json` is stored |
| `PORT` | `3000` | HTTP port |

Session JSONL files are written to `~/.pi/agent/sessions/` by pi-coding-agent.
