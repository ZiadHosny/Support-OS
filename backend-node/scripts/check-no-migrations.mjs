#!/usr/bin/env node
/**
 * The structural gate CONVENTIONS-NODE.md § 2 requires: the Node service
 * must never gain a migration path, because the 91 Django migrations
 * under each Django app's own migrations directory remain the single
 * source of schema truth for the whole epic. A rule nobody can run is a
 * comment — this is the Node counterpart of Django's own
 * "makemigrations --check --dry-run" gate.
 *
 * Two checks, either one failing is a hard failure:
 *  1. No `prisma/migrations/` directory exists.
 *  2. No script in package.json invokes `prisma migrate`.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let failed = false;

const migrationsDir = path.join(root, 'prisma', 'migrations');
if (existsSync(migrationsDir)) {
  console.error(
    `FAIL: ${path.relative(root, migrationsDir)} exists. This service is introspect-only — ` +
      'no migration may ever be created here. See CONVENTIONS-NODE.md § 2.',
  );
  failed = true;
}

const packageJsonPath = path.join(root, 'package.json');
const packageJsonRaw = await readFile(packageJsonPath, 'utf-8');
const packageJson = JSON.parse(packageJsonRaw);
const scripts = packageJson.scripts ?? {};
for (const [name, command] of Object.entries(scripts)) {
  if (typeof command === 'string' && command.includes('prisma migrate')) {
    console.error(
      `FAIL: package.json script "${name}" invokes "prisma migrate": ${command}. ` +
        'This service must never run a migration. See CONVENTIONS-NODE.md § 2.',
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('OK: no prisma/migrations/ directory, no "prisma migrate" script.');
