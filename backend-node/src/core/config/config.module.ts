/**
 * Global config module. Every other module reads config through
 * `ConfigService<Env, true>` — nothing anywhere else calls `process.env`
 * directly (CONVENTIONS-NODE.md § 8).
 *
 * `envFilePath` points at `backend/.env`, resolved relative to this file's
 * own location rather than the process cwd, so `npm run dev` from
 * `backend-node/` (or any other directory) always finds the same file.
 * There is exactly one `.env` for the whole port — see CONVENTIONS-NODE.md
 * § 8: reading a second file with the same POSTGRES_* values would
 * recreate the drift that rule exists to prevent.
 *
 * `DATABASE_URL` is never one of those values: it does not exist anywhere
 * in this project (Django reads discrete `POSTGRES_*` variables). Prisma 7
 * needs a connection string, but composes it via a driver adapter at the
 * point of use (`prisma.service.ts`) rather than through this module —
 * see `database-url.ts`.
 */

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate } from './env.schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// backend-node/src/core/config -> backend-node -> repo root -> backend/.env
const ENV_FILE_PATH = path.resolve(here, '../../../../backend/.env');

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATH,
      validate,
    }),
  ],
})
export class ConfigModule {}
