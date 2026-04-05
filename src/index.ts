import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { config } from "./config.js";
import { sessionsRoutes } from "./routes/sessions.js";

const app = new Elysia()
  .get("/", () => ({ ok: true, workspaceDir: config.workspaceDir }))
  .use(
    swagger({
      documentation: {
        info: {
          title: "pi-agent API",
          version: "0.1.0",
          description:
            "HTTP API wrapping pi-coding-agent with Gemini. Manage sessions scoped to a workspace directory and stream responses over SSE.",
        },
        tags: [{ name: "Sessions", description: "Agent sessions and messaging" }],
      },
    }),
  )
  .use(sessionsRoutes)
  .listen(config.port);

console.log(
  `pi-agent server running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(`   workspace: ${config.workspaceDir}`);
