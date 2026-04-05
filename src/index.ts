import { Elysia } from "elysia";
import { config } from "./config.js";
import { sessionsRoutes } from "./routes/sessions.js";
import { apiKeysRoutes } from "./routes/api-keys.js";
import { swagger } from "@elysiajs/swagger";

const app = new Elysia()
  .get("/", () => ({ ok: true, workspaceDir: config.workspaceDir }))
  .use(
    swagger({
      documentation: {
        info: {
          title: "pi-agent API",
          version: "0.1.0",
          description:
            "HTTP API wrapping pi-coding-agent. Manage sessions scoped to a workspace directory, stream responses over SSE, and configure provider API keys.",
        },
        tags: [
          { name: "Sessions", description: "Agent sessions and messaging" },
          { name: "API Keys", description: "Provider credentials" },
        ],
      },
    }),
  )
  .use(sessionsRoutes)
  .use(apiKeysRoutes)
  .listen(config.port);

console.log(
  `pi-agent server running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(`   workspace: ${config.workspaceDir}`);
console.log(`   data dir:  ${config.dataDir}`);
