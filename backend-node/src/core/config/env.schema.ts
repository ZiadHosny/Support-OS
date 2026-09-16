/**
 * Environment schema — validated once, at boot. The process refuses to
 * start on a missing or malformed required variable rather than failing at
 * the first request that needs it.
 *
 * Every name is Django's, deliberately (CONVENTIONS-NODE.md § 8): both
 * services load the same `backend/.env`, and a second naming scheme for the
 * same values is a drift source, not a tidier namespace. `DRF_PAGE_SIZE`
 * reads oddly in a Node service — that is the point.
 */

import { z } from 'zod';

export const envSchema = z.object({
  // --- Database (composed into DATABASE_URL for Prisma; see database-url.ts) ---
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB is required'),
  POSTGRES_USER: z.string().min(1, 'POSTGRES_USER is required'),
  POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD is required'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),

  // --- Pagination (DefaultPageNumberPagination parity) ---
  DRF_PAGE_SIZE: z.coerce.number().int().positive().default(25),
  DRF_MAX_PAGE_SIZE: z.coerce.number().int().positive().default(100),

  // --- CORS ---
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),

  // --- Debug / logging ---
  DJANGO_DEBUG: z
    .string()
    .default('False')
    .transform((value) => value.trim().toLowerCase() === 'true'),
  DJANGO_LOG_LEVEL: z.string().default('INFO'),
  DJANGO_LOG_FORMAT: z.enum(['text', 'json']).default('text'),

  // --- Auth (EPIC 18, NODE-3) ---
  // `DJANGO_SECRET_KEY` is required here, not optional: it is the fallback
  // JWT signing key AND the source `MFA_ENCRYPTION_KEY` derives from when
  // unset. Django itself fails to start without it.
  DJANGO_SECRET_KEY: z.string().min(1, 'DJANGO_SECRET_KEY is required'),
  // `base.py:196` — `env("JWT_SIGNING_KEY", default="").strip() or SECRET_KEY`.
  // Blank-but-present is the normal state in this project's .env, so the
  // fallback is the live path, not an edge case. Resolved in jwt.service.ts.
  JWT_SIGNING_KEY: z.string().default(''),
  JWT_ACCESS_TOKEN_LIFETIME_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(15),
  JWT_REFRESH_TOKEN_LIFETIME_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(7),
  // `base.py:220-225` — blank derives a validly-shaped Fernet key from
  // SECRET_KEY rather than reusing it directly. Derivation in mfa/fernet.ts.
  MFA_ENCRYPTION_KEY: z.string().default(''),

  // --- Throttling (PROD-3 parity) ---
  REDIS_CACHE_URL: z.string().default('redis://localhost:6379/1'),
  // Trusted proxies in front of the service. 0 = trust the socket address
  // and ignore X-Forwarded-For, which a client can otherwise forge to get a
  // fresh throttle bucket per request (CONVENTIONS.md § 36).
  DJANGO_NUM_PROXIES: z.coerce.number().int().min(0).default(0),

  // --- This service's own port (EPIC 18, NODE-1) ---
  NODE_PORT: z.coerce.number().int().positive().default(8002),
});

export type Env = z.infer<typeof envSchema>;

/** Passed to `@nestjs/config`'s `ConfigModule.forRoot({ validate })`. */
export function validate(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
