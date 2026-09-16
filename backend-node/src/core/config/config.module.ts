/**
 * Global config module. Everything reads config through
 * `ConfigService<Env, true>`; nothing calls `process.env` directly
 * (CONVENTIONS-NODE.md § 8).
 *
 * `envFilePath` resolves relative to this file, not the process cwd, so the
 * one `backend/.env` is found whatever directory the service starts from.
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
