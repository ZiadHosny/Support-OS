# SupportOS — Node backend (EPIC 18 port target)

A NestJS port of `../backend/`'s Django API, behind the **same, unchanged contract**:
`../docs/api-contract.django.yaml`. See `../CONVENTIONS-NODE.md` (`CONV-NODE`) for the
architecture — module layout, the envelope interceptor, the exception filter, guards, config.

**Introspect-only.** The Prisma schema (`prisma/schema.prisma`) is generated from the live
PostgreSQL database with `prisma db pull` and committed as-is. **No migration command ever
runs from this service** — Django's migrations under `../backend/apps/*/migrations/` remain
the single source of schema truth until `NODE-12` retires the Django implementation.
`npm run check:no-migrations` enforces this structurally.

**Known parity gaps**, each deliberate and tracked rather than discovered later:

- **Error messages are English-only.** Django localizes them via `gettext`
  (`../backend/locale/ar/`); this service has no translation layer yet. Expect an
  `Accept-Language: ar` message diff in the harness — it is not a new failure.
- **Password verification costs ~180 ms** and is capped at 4 concurrent checks. Django stores
  PBKDF2-SHA256 at **1,000,000 iterations**, so every login pays that. The verifier uses the
  ASYNC `crypto.pbkdf2` (never `pbkdf2Sync`, which would block the event loop and serialise the
  whole service behind one login); the async form runs on the libuv threadpool, whose default
  size is **4**. That cap is recorded here rather than tuned away with `UV_THREADPOOL_SIZE`.
- **The throttle store is in-process, not Redis.** Django backs its throttle with Redis
  (PROD-2), so a multi-instance deployment shares one budget there and would not here. The
  parts a parity run observes — fail-open posture, the shared `auth_credentials` budget, the
  per-IP key — are faithful. Moving to Redis belongs with `NODE-7`'s job runner, which brings
  the Redis client in anyway.
- **Password-reset email is not sent.** `POST /api/auth/password-reset/request/` mints and
  discards the token: delivery is SLA-4's mechanism, which `NODE-7` ports. The endpoint's
  observable contract (always 200, never leaks whether an address is registered) is faithful.

## Run it

Both services share one `.env`: `../backend/.env`. From this directory:

```bash
npm install
npm run dev          # http://localhost:8002/api/health/
```

With Django also running, `npm run contract:diff` measures port progress against the frozen
contract — see `../CONVENTIONS-NODE.md` § 1.
