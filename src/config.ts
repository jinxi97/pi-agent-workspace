import { existsSync, statSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

const workspaceDir = resolve(requireEnv("WORKSPACE_DIR"));
if (!existsSync(workspaceDir) || !statSync(workspaceDir).isDirectory()) {
  throw new Error(`WORKSPACE_DIR does not exist or is not a directory: ${workspaceDir}`);
}

const dataDir = resolve(process.env.DATA_DIR ?? "./data");
ensureDir(dataDir);

export const config = {
  workspaceDir,
  dataDir,
  apiKeysPath: resolve(dataDir, "api-keys.json"),
  port: Number(process.env.PORT ?? 3000),
} as const;
