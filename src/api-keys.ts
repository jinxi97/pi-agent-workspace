import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "./config.js";

type ApiKeyStore = Record<string, string>;

let cache: ApiKeyStore | null = null;

function load(): ApiKeyStore {
  if (cache) return cache;
  if (!existsSync(config.apiKeysPath)) {
    cache = {};
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(config.apiKeysPath, "utf-8"));
    cache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save(store: ApiKeyStore): void {
  writeFileSync(config.apiKeysPath, JSON.stringify(store, null, 2));
  cache = store;
}

export function getApiKey(provider: string): string | undefined {
  return load()[provider];
}

export function getAllApiKeys(): ApiKeyStore {
  return { ...load() };
}

export function setApiKey(provider: string, apiKey: string): void {
  const store = { ...load() };
  store[provider] = apiKey;
  save(store);
}

export function deleteApiKey(provider: string): boolean {
  const store = { ...load() };
  if (!(provider in store)) return false;
  delete store[provider];
  save(store);
  return true;
}

function mask(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function listApiKeys(): Array<{ provider: string; masked: string }> {
  const store = load();
  return Object.entries(store).map(([provider, key]) => ({
    provider,
    masked: mask(key),
  }));
}
