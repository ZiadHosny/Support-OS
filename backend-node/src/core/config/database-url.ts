/**
 * `DATABASE_URL` does not exist anywhere in this project — Django reads
 * discrete `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_HOST`/
 * `POSTGRES_PORT` (`backend/config/settings/base.py`), and Prisma requires a
 * URL. Composing it here, from the same variables Django already reads, is
 * the only option that does not create a second source of truth for the
 * same credentials — adding `DATABASE_URL` to `backend/.env` would mean two
 * places to change a password and one of them silently stale.
 *
 * `DATABASE_URL` is therefore never read from `.env`, and never written to
 * `process.env` either: `PrismaService` calls this directly with its
 * injected, validated config and hands the result straight to the `pg`
 * driver adapter's constructor (Prisma 7's `prisma-client` generator reads
 * its connection string from an adapter, not from an environment variable
 * at runtime).
 */

import type { Env } from './env.schema.js';

export function composeDatabaseUrl(
  env: Pick<
    Env,
    | 'POSTGRES_USER'
    | 'POSTGRES_PASSWORD'
    | 'POSTGRES_HOST'
    | 'POSTGRES_PORT'
    | 'POSTGRES_DB'
  >,
): string {
  const user = encodeURIComponent(env.POSTGRES_USER);
  const password = encodeURIComponent(env.POSTGRES_PASSWORD);
  return `postgresql://${user}:${password}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}?schema=public`;
}
