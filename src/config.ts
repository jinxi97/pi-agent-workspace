import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const workspaceDir = resolve(requireEnv("WORKSPACE_DIR"));
if (!existsSync(workspaceDir) || !statSync(workspaceDir).isDirectory()) {
  throw new Error(`WORKSPACE_DIR does not exist or is not a directory: ${workspaceDir}`);
}

const geminiApiKey = requireEnv("GEMINI_API_KEY");

export const config = {
  workspaceDir,
  geminiApiKey,
  port: Number(process.env.PORT ?? 3000),
} as const;
