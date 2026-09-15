# SupportOS — Node backend (EPIC 18 port target)

A NestJS port of `../backend/`'s Django API, behind the **same, unchanged contract**:
`../docs/api-contract.django.yaml`. See `../CONVENTIONS-NODE.md` (`CONV-NODE`) for the
architecture — module layout, the envelope interceptor, the exception filter, guards, config.

**Introspect-only.** The Prisma schema (`prisma/schema.prisma`) is generated from the live
PostgreSQL database with `prisma db pull` and committed as-is. **No migration command ever
runs from this service** — Django's migrations under `../backend/apps/*/migrations/` remain
the single source of schema truth until `NODE-12` retires the Django implementation.
`npm run check:no-migrations` enforces this structurally.

**Known parity gap:** error messages are English-only. Django localizes them via `gettext`
(`../backend/locale/ar/`); this service does not yet build a translation layer. Track this as
an expected `Accept-Language: ar` diff in `NODE-2`'s contract-diff harness, not a new failure.

## Run it

Both services share one `.env`: `../backend/.env`. From this directory:

```bash
npm install
npm run dev          # http://localhost:8002/api/health/
```
