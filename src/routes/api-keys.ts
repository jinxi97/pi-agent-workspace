import { Elysia, t } from "elysia";
import { deleteApiKey, listApiKeys, setApiKey } from "../api-keys.js";

export const apiKeysRoutes = new Elysia({ prefix: "/api-keys" })
  .get("/", () => ({ apiKeys: listApiKeys() }), {
    detail: {
      tags: ["API Keys"],
      summary: "List configured providers",
      description: "Returns configured providers with masked key previews.",
    },
  })

  .put(
    "/:provider",
    ({ params, body }) => {
      setApiKey(params.provider, body.apiKey);
      return { ok: true };
    },
    {
      body: t.Object({
        apiKey: t.String({ description: "Provider API key" }),
      }),
      detail: {
        tags: ["API Keys"],
        summary: "Set API key for a provider",
        description:
          "Stores the API key in data/api-keys.json. Examples of provider: anthropic, openai, openrouter.",
      },
    },
  )

  .delete(
    "/:provider",
    ({ params }) => {
      const removed = deleteApiKey(params.provider);
      return { ok: removed };
    },
    {
      detail: {
        tags: ["API Keys"],
        summary: "Delete API key for a provider",
      },
    },
  );
