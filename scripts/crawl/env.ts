import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env.local before any module that reads process.env. Mirrors the
// pattern from the deleted update-saint-seiya.ts. Supports plain
// KEY=value, quoted values, and # comments. Idempotent.
let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function requireEnv(key: string): string {
  loadEnv();
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

export function optionalEnv(key: string): string | null {
  loadEnv();
  const v = process.env[key];
  return v && v.length > 0 ? v : null;
}
