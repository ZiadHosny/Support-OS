// Prisma config for CLI operations (`db pull`, `generate`) — introspection
// only. This file is NOT how the running service gets its database URL;
// `src/core/config/config.module.ts` does that at boot via
// `composeDatabaseUrl`. This file exists only so `npx prisma db pull` and
// `npx prisma generate` have a URL to work with from the command line.
//
// There is exactly one `.env` for the whole port — CONVENTIONS-NODE.md § 8
// — so this reads `backend/.env` directly rather than a second file, and
// composes DATABASE_URL from the same POSTGRES_* variables Django reads
// (there is no DATABASE_URL anywhere in this project; see
// src/core/config/database-url.ts for why).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, '../backend/.env');

function readBackendEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function composeDatabaseUrl(env: Record<string, string>): string {
  const user = encodeURIComponent(env.POSTGRES_USER ?? '');
  const password = encodeURIComponent(env.POSTGRES_PASSWORD ?? '');
  const host = env.POSTGRES_HOST || 'localhost';
  const port = env.POSTGRES_PORT || '5432';
  const db = env.POSTGRES_DB ?? '';
  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

const backendEnv = readBackendEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: composeDatabaseUrl(backendEnv),
  },
});
