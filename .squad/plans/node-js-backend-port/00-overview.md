# node-js-backend-port — plan overview

Entry point for the **node-js-backend-port** feature. Stories execute in order by their `NN` prefix.

This feature is `EPIC 18 — Node.js Backend Port` (`SupportOs backlog.MD:1131-1258`): replace the Django API with a Node/TypeScript one **behind an unchanged contract**. Two things stay fixed for the whole epic — the existing PostgreSQL schema (introspected, never re-generated) and the API surface (the same paths, the same `{success, data, error, meta}` envelope). Because the contract does not move, the React client is not touched and both backends can serve the same database while endpoints move over one module at a time.

**The epic's own rule (`SupportOs backlog.MD:1258`):** the port adds no product scope. A NODE story that introduces a new endpoint, a new response shape, a schema change or a frontend edit has stopped being a port — raise it as its own story in the owning epic instead.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 116 | [116-story-port-contract-node-conventions-SUPPORTOS-141.md](116-story-port-contract-node-conventions-SUPPORTOS-141.md) | (NODE-0) Port Contract & Node Conventions | SUPPORTOS-141 | All prior epics (the Django API is the thing being frozen); Story 80 (`INT-1`, `../integrations/`) and Story 104 (`../bugs/104-story-openapi-schema-completeness.md`), both implemented |
| 117 | [117-story-node-service-foundation-SUPPORTOS-142.md](117-story-node-service-foundation-SUPPORTOS-142.md) | (NODE-1) Node Service Foundation | SUPPORTOS-142 | Story 116 (`NODE-0`) — consumes both its artefacts: `docs/api-contract.django.yaml` and `CONVENTIONS-NODE.md` |
| 118 | [118-story-contract-diff-harness-SUPPORTOS-143.md](118-story-contract-diff-harness-SUPPORTOS-143.md) | (NODE-2) Contract-Diff Harness | SUPPORTOS-143 | Stories 116 and 117 — reads the frozen contract, and needs a running Node service to diff against |
| 119 | [119-story-auth-permissions-scoping-SUPPORTOS-144.md](119-story-auth-permissions-scoping-SUPPORTOS-144.md) | (NODE-3) Authentication, Permissions & Scoping | SUPPORTOS-144 | Stories 117 and 118 — the first story to move `implemented.json` off `[]`; every later NODE story depends on all five of its tasks |

## Dependency notes

**Story 116 is the epic's foundation and blocks every later NODE story.** Its two artefacts — the frozen contract `docs/api-contract.django.yaml` and the `CONV-NODE` spec (`CONVENTIONS-NODE.md`) — are what `SupportOs backlog.MD:1252` means by "the contract is the acceptance spec for every NODE story". Nothing in `NODE-1` onward can be verified without them.

**The tracker-id mapping is confirmed.** Story 116 was *planned* against an unfilled intake — the Jira auto-fetch had been skipped for missing credentials, so Title, Description and Acceptance criteria were all empty — and was therefore built from `SupportOs backlog.MD:1131-1140` directly, with `SUPPORTOS-141 = NODE-0` inferred from the id-gap pattern at every earlier epic boundary. Commit `30ea5a4` then filled the intake in and added `SUPPORTOS-142`–`146`: `SUPPORTOS-141`'s title is `(NODE-0) — Port Contract & Node Conventions` and its Description is the backlog's two tasks **word for word**, and `SUPPORTOS-142` is `(NODE-1)`. The inference was right and the plan needed no re-scoping. This is the same class of intake defect `../design-intelligence-ui-ux-system/` Story 112 worked around, and it resolved the same way.

**Story 116 (`NODE-0`) is implemented.** `docs/api-contract.django.yaml` is committed — **131 paths**, matching `docs/BACKEND-ARCHITECTURE.md`'s measured manifest exactly — written by the new `backend/apps/core/management/commands/freeze_api_contract.py` and reproducible byte-for-byte (regenerate to a scratch file, `git diff --no-index` is empty). `python manage.py spectacular` still emits **zero bytes on stderr**, so Story 104's zero-W001/W002 result holds and the frozen contract is a snapshot of a complete surface. `CONVENTIONS-NODE.md` (`CONV-NODE`) is written and linked from `README.md`, `CONVENTIONS.md` § 40 and `docs/BACKEND-ARCHITECTURE.md`. `manage.py check` → 0 issues; all **54** existing tests pass; Ruff lint and format clean.

Two deviations from the plan as written, both deliberate:

- **No new test file was added.** The plan's Test Plan asked for `backend/apps/core/tests/test_freeze_api_contract.py`. `CONVENTIONS.md` § 16 is categorical — *"no new test file is added anywhere in the repo"* — and the three cases it proposed are each covered by a Verification Step that was actually run (header present, output still parses as YAML with `openapi`/`paths` at the top level, default path resolves to `docs/`). The convention won; the plan's own Prerequisites demand respecting existing conventions.
- **`.gitattributes` was added** (one entry, `docs/api-contract.django.yaml text eol=lf`). This repository is cloned with `core.autocrlf=true`, which would check the contract out with CRLF while `freeze_api_contract` writes LF — making the "regenerates byte-identically" Done Criterion fail for the next developer and silently destroying the hand-edit check. The plan did not anticipate it; without it, one of its own acceptance criteria is unmeetable off this machine.

**`django-baseline` is tagged locally** at `30ea5a4`, the commit preceding this story's work. **It has not been pushed** — the plan requires confirmation first, and `git ls-remote --tags origin` shows the remote has no tags at all.

**Story 117 (`NODE-1`) is implemented.** `backend-node/` is a NestJS service (Nest 12, Express 5, Prisma 7, `type: "module"`/ESM throughout) listening on **8002**, with only `CoreModule` wired — no domain module. `GET /api/health/` is **byte-for-byte identical** to Django's on both the 200 and the simulated-503 path (both are `success: true` envelopes — the divergent case `test_health_reports_degraded_when_database_unreachable` pins). Every case in `apps/core/tests/test_health.py` was walked live against the running service: 405 on every non-GET method, 406 on `Accept: text/html`, `parse_error` on a malformed JSON body, an empty-bodied CORS preflight with no envelope, the `/api/` catch-all returning 404-not-405 on five methods, and non-`/api/` paths left untouched (HTML, not JSON). `backend-node/prisma/schema.prisma` is a committed introspection of the live database — **62 models**, comfortably over the ≥43 bar — and `npm run check:no-migrations` passes clean and fails correctly when a `prisma/migrations/` directory is introduced. Django's own suite (**54 tests**) and Ruff are unaffected; `backend-node`'s own `npm run lint`/`format:check` are clean.

Three findings from planning were confirmed, and four more surfaced only once the service actually ran — each is the kind of gap a plan's own prose can't catch, and each was fixed before verification passed:

- **`/api/health/` is not in the frozen contract** (`@extend_schema(exclude=True)`, `backend/apps/core/views.py:71`) — confirmed; verified by diffing against running Django instead, as planned.
- **No `DATABASE_URL` anywhere in this project** — confirmed, but Prisma 7 turned out to need more than the plan assumed: its new `prisma-client` generator requires an explicit **driver adapter** (`@prisma/adapter-pg`'s `PrismaPg`), not `env("DATABASE_URL")` inside `schema.prisma`. `PrismaService` composes the connection string from its injected, validated config and hands it straight to the adapter — `DATABASE_URL` is written to `process.env` nowhere at all, tighter than the plan's own design.
- **Port 8002** — confirmed and used.
- **Nest mounts `configure()`-registered middleware AT the global prefix.** Inside `RequestIdMiddleware`/`AccessLogMiddleware`, `req.path` for `/api/health/` reads as `/` (relative to the `/api` mount), not the full path — silently breaking the `SKIP_PATHS` access-log exemption and (via the exception filter's identical `request.path` read) every `http_path` structured-log field. Fixed with a `getRequestPath()` helper reading `req.originalUrl` (query-string sliced off), which Express never rewrites for a sub-mount; applied everywhere a path is read, including `paginate.ts` for `NODE-4`.
- **Nest's `ExpressAdapter.mapException` silently rewrites a raw body-parser `SyntaxError` into a `BadRequestException`** before any `@Catch()` filter ever sees it — so `exception instanceof SyntaxError` (what the plan specified) can never be true, and a malformed-body POST landed as `validation_error` instead of either Django-accepted outcome. Fixed by detecting the rewrap via its message text (V8's `JSON.parse()` errors always mention "JSON").
- **`debug` was being attached to every 4xx, not just 500s.** `apps/core/exceptions.py` only ever passes `debug=` to `error_envelope` from the unrecognised/500 path — every recognised exception (400/401/403/404/405/406…) never gets one, `DJANGO_DEBUG` or not. A 405/406 with a full stack trace embedded was a real divergence, caught by comparing live output against Django's actual response rather than trusting the code to be right.
- **Multiple HTTP-verb decorators stacked on one Nest controller method silently keep only the last one applied.** `@Post() @Put() @Patch() @Delete() @Options()` on a single `disallowed()` handler registered **POST only** — confirmed by reading Nest's own startup route log, not assumed correct. Each disallowed verb needed its own handler method.

None of this was visible from reading the plan or the Django source alone — Prisma 7's adapter requirement, Nest's prefix-relative middleware paths, and the body-parser exception rewrap are all framework behaviors the plan (written before any Node code existed) could not have anticipated. Verification Step 7's byte-for-byte diff is what caught the first pass being wrong, repeatedly, before the story was called done.

**Story 118 (`NODE-2`) is planned, not yet implemented.** It is the acceptance gate every later NODE story is measured by, so the plan is built on measured contract facts rather than assumptions — all verified this session against `docs/api-contract.django.yaml` and both running services:

- **131 paths, 239 operations** (95 GET, 65 POST, 30 PATCH, 26 DELETE, 23 PUT), **239 unique `operationId`s** — the stable key the harness and its manifest are built around — and **39 `tags`**, which are the per-module grouping the coverage report needs without inventing one.
- **The only path placeholder in the whole contract is `{id}`** (52 paths, 125 operations), and **all 31 collection parents derived by truncating at `/{id}/` exist as contract paths themselves** — verified, zero misses. That turns id substitution into one rule instead of a table of special cases, and runtime discovery is mandatory because `HOW_TO_USE.md` records that seeded ids are *not* stable across re-seeds.
- **The shared database is already the "same seeded database" the backlog asks for.** `NODE-1` pointed both services at one `backend/.env`, so there is nothing to synchronise — but it also means a mutating request writes twice. Hence read-only by default, `--mutating` opt-in with a loud warning, since `seed_demo_data` deletes *all* rows of the models it manages, not only seeded ones.
- **Node's catch-all `404 not_found` is shape-identical to a legitimate 404**, so classification keys on an explicit `implemented.json` manifest rather than on status codes — plus an **`UNDECLARED`** outcome that fails the run when Node answers a path the manifest does not claim, so the manifest cannot drift silently.
- Confirmed live: `POST /api/auth/token/` with `admin@supportos.local` / `Passw0rd!2026` returns the enveloped `{access, refresh}`; the same token against Django's `/api/customers/` returns real rows while Node returns its catch-all 404 — the exact "not yet implemented" signature the harness classifies on.

The plan ships the **0 % baseline** deliberately: with `NODE-1`'s service, 0 of 239 operations are implemented, so the first green run reports 0 % coverage and exits 0, and that run is recorded verbatim in `docs/VERIFICATION.md`. A coverage report that first appears at 40 % has no credible starting point.

**Story 119 (`NODE-3`) is planned, not yet implemented.** It is the largest story in the epic — five tasks, three 🔑 — and every later NODE story depends on all five. Planning verified the hard parts live rather than assuming them, and turned up **three places where the backlog's wording contradicts the shipped code**. In each, the plan keeps the shipped behaviour (this is a port) and says so explicitly:

- **"A route without a declared permission must fail closed."** `HasPermission` deliberately does the opposite — an action with no `permission_map` entry is authenticated-only, and the class docstring argues the case ("a missing entry is far more often an unfinished map… a silent 403 is the harder bug to find"). The plan ports the runtime behaviour unchanged and relocates the fail-closed guarantee to **startup**: the service refuses to boot if any route declares no permission decision. The constraint's real intent — no route slips through undeclared — is met without changing a single response.
- **"Reimplement department/branch scoping as a query layer that cannot be bypassed."** `CONVENTIONS.md` § 33 states in a table that `apps.core.scoping` is opt-in and **"authorizes nothing"**, while `CustomerScopedModelViewSet` is the actual un-bypassable security boundary. Making department/branch mandatory would return empty lists on every staff screen. The plan builds the un-bypassable layer for **portal owner-scoping** (which `NODE-9` explicitly depends on) and ports department/branch as the convenience filter it is.
- **"Matching the existing claims."** The `user_id` claim is the **string** `"150"`, not an integer — a mismatch that would still validate Node-side and fail Django-side, so a Node-only test would pass it.

Four things were proven live against the running services and the real database:

- **The PBKDF2 verifier works, exactly.** `crypto.pbkdf2(password, salt, 1000000, 32, 'sha256').toString('base64')` reproduces a real stored hash **byte for byte** (salt used raw, not base64-decoded), and fails for a wrong password. Measured cost: **~180 ms**, so the async form is mandatory — `pbkdf2Sync` would block the event loop and serialise the whole service behind one login, and the libuv threadpool default of 4 caps concurrent logins.
- **The frontend's silent refresh keys on one exact string.** Probed: no header → `not_authenticated`; present-but-invalid → `token_not_valid`; the interceptor (`client.ts:96-98`) retries **only** on the latter. Returning the wrong one hard-logs-out every user every 15 minutes, and nothing in this repo's tests would catch it — only a browser would.
- **The superuser short-circuit is live.** `permissions_for` returns all 25 permissions for `is_superuser`, and `ziad@email.com` is a real superuser in this database. Omitting it strips that one account's access while every role-based account keeps working.
- **`super_admin` holds 21 of 25 permissions** — missing `calendars.manage`, `calendars.view`, `customers.export_data`, `customers.erase_data`. Those endpoints 403 on **both** services, which the harness scores as a `MATCH`; it is a recorded product gap (`HOW_TO_USE.md` § 10), not something to "fix" by granting permissions.

**Remaining stories in this epic, not yet planned** (`SupportOs backlog.MD:1167-1237`), in their backlog dependency order. Intakes exist for NODE-4 and NODE-6:

| Backlog story | Title | Tracker id | Depends on |
|---|---|---|---|
| NODE-4 | Customer Management Port | SUPPORTOS-145 | NODE-3 |
| NODE-5 | Ticket Management Port | *(no intake yet)* | NODE-4 |
| NODE-6 | Communications & Agent Workspace Port | SUPPORTOS-146 | NODE-5 |
| NODE-7 | SLA, Background Jobs & Realtime | *(no intake yet)* | NODE-5 |
| NODE-8 | Reports Port | *(no intake yet)* | NODE-5, NODE-7 |
| NODE-9 | Portal & Knowledge Base Port | *(no intake yet)* | NODE-3, NODE-5 |
| NODE-10 | Integrations & AI Port | *(no intake yet)* | NODE-5, NODE-9 |
| NODE-11 | Admin Surface Replacement | *(no intake yet)* | NODE-4, NODE-5 |
| NODE-12 | Cutover & Django Retirement | *(no intake yet)* | all prior NODE stories |

**`NODE-5` has no intake although `NODE-6` does** — `SUPPORTOS-146` skips it. Ticket Management Port is `NODE-6`'s declared dependency, so that gap needs filling before `NODE-6` can be planned.

`NODE-12` is also where the introspect-only database rule that `NODE-0` writes into `CONV-NODE` is lifted — schema ownership moves to the Node service in that task and **not before**.
