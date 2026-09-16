/**
 * `DATABASE_URL` does not exist in this project — Django reads discrete
 * `POSTGRES_*` vars and Prisma needs a URL. Composing it from those same
 * vars avoids a second source of truth for one set of credentials.
 *
 * It is never read from `.env` and never written to `process.env`:
 * `PrismaService` passes the result straight to the `pg` driver adapter,
 * which is where Prisma 7 reads its connection string.
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
