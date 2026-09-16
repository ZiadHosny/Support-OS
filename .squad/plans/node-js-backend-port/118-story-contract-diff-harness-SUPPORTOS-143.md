# Story 118 — (NODE-2) Contract-Diff Harness (Story: SUPPORTOS-143)

## Prerequisites

- **Story 116 (`NODE-0`) implemented** — [`116-story-port-contract-node-conventions-SUPPORTOS-141.md`](116-story-port-contract-node-conventions-SUPPORTOS-141.md). `docs/api-contract.django.yaml` is the input this harness reads; `CONVENTIONS-NODE.md` § 1 already names this harness as what enforces the contract.
- **Story 117 (`NODE-1`) implemented** — [`117-story-node-service-foundation-SUPPORTOS-142.md`](117-story-node-service-foundation-SUPPORTOS-142.md). The Node service runs on **8002**, shares `backend/.env` (and therefore **one database**) with Django on **8000**, and answers an enveloped `404 not_found` for every path it has not implemented — which is what makes "not yet implemented" mechanically detectable.
- **Both services must be running** for the harness to do anything. It is a black-box HTTP client, not an in-process test: `python manage.py runserver` from `backend/` and `npm run dev` (or `node dist/main.js`) from `backend-node/`. The harness must fail with a clear, actionable message — not a stack trace — when either is unreachable.
- **The database is shared, not mirrored.** `NODE-1` pointed both services at the same `POSTGRES_*` values. The backlog's phrase "against the same seeded database" is therefore already satisfied structurally — there is nothing to synchronise — but it also means **a mutating request writes once for Django and again for Node, into the same tables**. This is what drives the read-only default in Task 4.
- **`CONVENTIONS.md` § 16 governs this repo: "no new test file is added anywhere in the repo."** This harness is a **tool**, not a test file — it lives under `backend-node/scripts/`, is run by a person or by CI, and adds no `*.spec.ts`/`*.test.ts` anywhere. Do not restate it as a test suite.
- **`backend-node/scripts/check-no-migrations.mjs` is the precedent to follow**: a plain `.mjs` script under `scripts/`, run directly by Node with no build step, wired as an `npm run check:*` script. The harness follows that shape exactly — it is **not** TypeScript under `src/`, because it is not part of the service.
- **No change to `backend/` or `frontend/` source.** The only permitted edits outside `backend-node/` are documentation (`docs/VERIFICATION.md`, `CONVENTIONS-NODE.md`). `git diff --stat backend/ frontend/` must be empty at the end.

---

## Story Goal

Make "ported" a measured state instead of a judgement.

1. **One command — `npm run contract:diff`** — that reads the frozen contract, issues the same request to Django and to Node, and reports per-operation differences in **status code, envelope shape, error code and payload structure**.
2. **A comparison that ignores what must differ** — generated identifiers, timestamps, request ids, and host-bearing URLs — and fails on everything else.
3. **A per-module coverage report** over the contract's **39 tags**, showing matching / mismatching / not-yet-implemented, so the port's real completion percentage is visible on every run.
4. **A non-zero exit on any mismatch**, and only on a mismatch — "not yet implemented" is progress information, not a failure.

**Not in scope, and the executor must not start it:** porting any domain module, authentication in the Node service (`NODE-3`), request-body fixtures for operations nobody has ported yet, and CI wiring. This story ships the harness and its **honest baseline**: with `NODE-1`'s service, **0 of 239 operations are implemented**, so the first green run reports 0 % coverage and exits 0. That is the correct result, not a bug to engineer around.

---

## Context — Read These Files First

1. `docs/api-contract.django.yaml` (794 KB — **do not read end to end**). Structure, measured this session and exact:
   - **131 paths**, all ending in a trailing slash, at two-space indentation (`  /api/tickets/:`).
   - **239 operations** at four-space indentation — **95 `get`, 65 `post`, 30 `patch`, 26 `delete`, 23 `put`**.
   - **239 `operationId`s, one per operation** — unique, stable, and the key this harness is built around (`customers_retrieve`, `auth_token_create`, …).
   - **39 `tags`**, one per operation, which are the per-module grouping the coverage report requires: `tickets` (21), `webhooks` (13), `auth` (12), `customers` (11), `portal` (9), `tasks`/`reports` (8 each), … down to `branding`/`landing`/`live-chat`/`permissions`/`search` (1 each).
   - **115 operations carry a `requestBody`.**
   - Read one whole path block to see the shape — `awk '/^  \/api\/customers\/\{id\}\/:/,/^  \/api\/customers\/\{id\}\/erase/' docs/api-contract.django.yaml` — and the `securitySchemes` block at **line 24297** (`jwtAuth`, `ApiKeyAuth`).
2. **Path parameters are trivial here, and that is a verified fact, not an assumption.** The only placeholder in the entire contract is **`{id}`** — 52 paths, 125 operations, `- in: path` / `name: id` / `type: integer`. There is no second placeholder. Reproduce with:
   ```bash
   grep -E '^  /' docs/api-contract.django.yaml | grep -oE '\{[a-z_]+\}' | sort | uniq -c   # 52 {id}
   ```
   Every one of the **31 distinct collection parents** derived by truncating at `/{id}/` **exists as a contract path in its own right** — verified for all 31, zero misses (`/api/customers/`, `/api/erp/orders/`, `/api/webhooks/deliveries/`, `/api/portal/tickets/`, …). That is what makes Task 3's id discovery a single rule rather than a table of special cases.
3. `backend-node/scripts/check-no-migrations.mjs` (51 lines, whole file) — the structural precedent: plain `.mjs`, `#!/usr/bin/env node`, resolves paths from `import.meta.url`, prints `OK:`/`FAIL:` and exits non-zero. Match this shape. **Read its top comment and note what it does *not* contain** — see the `*/` hazard in Edge Cases.
4. `backend-node/package.json` — current scripts (`dev`, `build`, `start`, `lint`, `format`, `format:check`, `check:no-migrations`). Note two things the harness must fix: `lint` is `oxlint --type-aware src/` and `format:check` is `prettier --check "src/**/*.ts"` — **neither covers `scripts/`**, so the harness would ship unlinted and unformatted.
5. `backend-node/src/core/envelope/envelope.ts` — the four fixed top-level keys (`success`, `data`, `error`, `meta`) and `ErrorBody` (`code`, `message`, `fields`, optional `request_id`, optional `debug`). The harness compares against this shape.
6. `backend-node/src/core/filters/error-codes.ts` — `STATUS_TO_CODE`, the 12-code table. `error.code` is one of the four things the backlog names as compared **by value**, not by shape.
7. `backend/apps/core/pagination.py` **lines 104–120** — the six `meta.pagination` keys. **`next` and `previous` are absolute URLs built from the request host**, so they read `http://127.0.0.1:8000/…` on one side and `:8002` on the other. They must be normalised, not compared — this is the clearest instance of the backlog's "not generated identifiers".
8. `HOW_TO_USE.md` **lines 425–460** — the seeded accounts. **`admin@supportos.local` / `Passw0rd!2026`** is the harness's default identity. Two facts from this section shape the design:
   - *"Your IDs may differ"* — seeded row ids are **not stable across re-seeds**, which is why Task 3 discovers ids at runtime instead of hardcoding them.
   - The `super_admin` role has a **recorded permission gap** (it cannot call the customer export/erase endpoints or manage business calendars, § 10). Those operations will `403` on **both** sides — which is a **match**, not a failure. Do not "fix" it by granting permissions.
9. `backend/apps/core/management/commands/seed_demo_data.py` **lines 1–13 and 120–130** — *"Re-running this command is safe: it wipes its own previous output first"*, implemented as `Model.objects.all().delete()` across a dozen models. It is genuinely destructive to **all** rows of those models, not just seeded ones. This is the mutating mode's precondition and its warning.
10. `docs/VERIFICATION.md` **lines 124–150** — the `## Recorded run — <date>` format (`$ command` followed by its literal output). The first harness run is recorded there in the same shape.
11. [`117-story-node-service-foundation-SUPPORTOS-142.md`](117-story-node-service-foundation-SUPPORTOS-142.md) `## Edge Cases & Failure Modes` — four framework behaviours found only by running the service (Nest's prefix-relative middleware paths, `ExpressAdapter.mapException`, the 4xx `debug` leak, stacked verb decorators). The harness is the thing that would have caught the last two automatically; that is the point of building it.
12. `.squad/stories/node-js-backend-port/SUPPORTOS-143/intake.md` — two tasks, verbatim from `SupportOs backlog.MD:1150-1155`. No attachments, no acceptance criteria.

---

## Implementation tasks

### 1 — Scaffold the harness

**Create directory: `backend-node/scripts/contract-diff/`** — plain `.mjs` modules, no build step, matching `check-no-migrations.mjs`.

| File | Responsibility |
|---|---|
| `run.mjs` | Entry point: argument parsing, orchestration, exit code. |
| `contract.mjs` | Parse `docs/api-contract.django.yaml` into a flat operation list. |
| `client.mjs` | Token acquisition, request issuing, `fetch` wrapper with timeout. |
| `ids.mjs` | `{id}` discovery and substitution. |
| `compare.mjs` | Normalisation and the shape/semantic diff. |
| `report.mjs` | stdout table, per-tag coverage summary, `--json` output. |
| `implemented.json` | The manifest — which operations the Node service claims to serve. |
| `fixtures.json` | Request bodies for mutating operations, keyed by `operationId`. |

**Add the one dependency the harness needs:** `npm install --save-dev yaml` — there is no YAML parser in `backend-node/` today (verified). **No HTTP client dependency**: Node 24's global `fetch` is what this uses.

**File: `backend-node/package.json`** — add:

```json
"contract:diff": "node scripts/contract-diff/run.mjs"
```

and **widen the two globs that currently exclude `scripts/`**, so the harness is held to the same bar as the service:

```json
"lint": "oxlint --type-aware src/ scripts/",
"format": "prettier --write \"src/**/*.ts\" \"scripts/**/*.mjs\"",
"format:check": "prettier --check \"src/**/*.ts\" \"scripts/**/*.mjs\""
```

Run `npm run format` once after widening — `check-no-migrations.mjs` was written before these globs covered it and will need reformatting.

---

### 2 — Read the contract into an operation list

**File: `backend-node/scripts/contract-diff/contract.mjs`**

Parse `../../docs/api-contract.django.yaml` (resolved from `import.meta.url`, never the cwd) and flatten `paths` into an array of:

```js
{
  operationId,          // 'customers_retrieve' — the stable key, unique across all 239
  method,               // 'get' | 'post' | 'put' | 'patch' | 'delete'
  path,                 // '/api/customers/{id}/'
  tag,                  // 'customers' — first entry of `tags`, the coverage grouping
  hasPathId,            // path includes '{id}'
  requiresAuth,         // a `security` block naming jwtAuth is present
  hasRequestBody,       // `requestBody` present
  documentedStatuses,   // ['200','400','401','403','404','500']
}
```

**Assert the parse against known totals and fail loudly on drift** — this is the harness checking its own input, and it is cheap:

- **131** paths, **239** operations, **39** distinct tags.
- Method counts: **95 get, 65 post, 30 patch, 26 delete, 23 put**.
- Every `operationId` unique.
- The only path placeholder is `{id}`.

If any assertion fails, exit non-zero with a message naming the expected and actual number. A contract that changed shape is exactly when a diff run must stop rather than silently measure the wrong thing. Regenerating the contract (`python manage.py freeze_api_contract`) is a deliberate act; updating these constants in the same change is the intended workflow, and the failure message must say so.

---

### 3 — Authenticate once, discover ids once

**File: `backend-node/scripts/contract-diff/client.mjs`**

- **Token**: `POST http://127.0.0.1:8000/api/auth/token/` with `{"email": …, "password": …}` returns `{success, data: {access, refresh}, …}` — verified live this session. Read credentials from `DIFF_EMAIL`/`DIFF_PASSWORD`, defaulting to **`admin@supportos.local`** / **`Passw0rd!2026`** (`HOW_TO_USE.md`). Send the resulting `Authorization: Bearer <access>` header to **both** services, unchanged.
- The Node service has **no authentication until `NODE-3`**. Sending it the header is correct and harmless: it ignores it today and will honour it later, with no harness change.
- Base URLs from `DJANGO_BASE_URL` / `NODE_BASE_URL`, defaulting to `http://127.0.0.1:8000` and `http://127.0.0.1:8002`. Do **not** read `NODE_PORT` from `backend/.env` here — the harness targets whatever is running, which is not always what is configured.
- Give every request a timeout (10 s) and an explicit `Accept: application/json`. A hung service must fail the run, not hang it.
- **Preflight both services before issuing anything else**: `GET /api/health/` on each. If either is unreachable, print the two URLs and the start commands and exit non-zero. `/api/health/` is the right probe precisely because it is the one endpoint both services already answer identically, and it is not in the contract.

**File: `backend-node/scripts/contract-diff/ids.mjs`**

One rule, valid for all 52 `{id}` paths (verified — all 31 collection parents exist as contract paths):

1. Truncate the path at `/{id}/` → the collection path (`/api/customers/{id}/timeline/` → `/api/customers/`).
2. `GET` that collection **from Django**, with the token.
3. Take `data[0].id`.
4. Cache per collection — one request per collection, not per operation.

If a collection is empty (`data: []`), record the operation as **`SKIPPED (no seed row)`**, a fifth outcome that is reported but does not fail the run. **Do not invent an id**: a fabricated id produces a 404 on both sides, which would be scored as a spurious match and would hide a real difference. `/api/audit-logs/`, `/api/erp/sync-runs/` and `/api/webhooks/deliveries/` are the likely empties on a fresh seed; the report must name which ones were skipped so the number is never mistaken for coverage.

---

### 4 — Issue requests: read-only by default, mutating opt-in

**File: `backend-node/scripts/contract-diff/run.mjs`**

**Default: the 95 `get` operations only.** Safe, repeatable, and the everyday gate.

**`--mutating` adds the other 144** (65 post, 30 patch, 26 delete, 23 put). It is opt-in for a reason that must be stated in `--help` and in the warning it prints:

> Both services share one database (`backend/.env`). A mutating run issues each write **twice** — once against Django, once against Node — so it leaves two rows where a user would leave one, and it is not idempotent across runs. Re-seed with `python manage.py seed_demo_data` from `backend/` before and after. **That command deletes all rows of every model it manages, not only seeded ones.**

A mutating operation runs only when `fixtures.json` has a body for its `operationId`; otherwise it is reported as **`SKIPPED (no fixture)`**. **`fixtures.json` ships empty (`{}`)** — 115 operations take a request body, and inventing 115 valid payloads for endpoints nobody has ported yet would be guesswork with a 115-wide surface for being wrong. Each later NODE story adds the fixtures for the module it ports, in the same change. State that rule in `CONVENTIONS-NODE.md` (Task 7).

Both modes accept **`--only <tag>`** (repeatable) so `NODE-4` can run `npm run contract:diff -- --only customers` while porting, instead of the full sweep.

---

### 5 — Compare: shape and semantics, never generated values

**File: `backend-node/scripts/contract-diff/compare.mjs`**

Compare **four things by value**, exactly as the backlog names them, and everything else by shape:

| Compared | How |
|---|---|
| **HTTP status code** | Exact equality. |
| **Envelope shape** | Both bodies must have exactly the four keys `success`, `data`, `error`, `meta` — and `success` must be equal. |
| **`error.code`** | Exact equality when either side has an `error`. `error.message` is **not** compared — see the Arabic-localisation gap in Edge Cases. |
| **Payload structure** | Recursive **shape signature** of `data` and `meta`, deep-equal. |

**The shape signature** replaces every leaf with its type name and collapses arrays, so two responses over different rows still compare equal:

- primitive → `'string' | 'number' | 'boolean' | 'null'`
- object → `{key: signature}` for every key, **key sets must match exactly** (a missing or extra field is a mismatch — this is the check that catches a half-ported serializer)
- array → `[]` when empty, otherwise the signature of element `0` **plus** an assertion that every other element has the identical signature (a heterogeneous array on one side and a homogeneous one on the other is a real difference)

**Volatile values, stripped before comparison** — this is the backlog's "not generated identifiers or timestamps", made into a list:

- any key named `id`, or ending `_id`
- `created_at`, `updated_at`, and any string matching ISO-8601 (`^\d{4}-\d{2}-\d{2}T`)
- `error.request_id` and `error.debug`
- `meta.pagination.next` / `previous` — **host-bearing absolute URLs**, `:8000` vs `:8002` (`apps/core/pagination.py:104-120`)
- `access` / `refresh` (JWTs differ per issue)

Strip by replacing the value with its type name, **not** by deleting the key: a field present on one side and absent on the other must still fail. Deleting it would mask exactly the defect this harness exists to catch.

`meta.pagination.count` and `num_pages` **are** compared by value — both services read the same database, so a differing count is a real filtering or scoping difference, not noise.

---

### 6 — Classify, report, and exit

**File: `backend-node/scripts/contract-diff/implemented.json`**

The manifest: an array of `operationId`s the Node service claims to serve. **It ships empty (`[]`)** — `NODE-1` implemented no contract path (`/api/health/` is deliberately excluded from the contract). Each later NODE story adds its operation ids in the same change that ports them.

**File: `backend-node/scripts/contract-diff/report.mjs`** — five outcomes per operation:

| Outcome | Condition | Fails the run |
|---|---|---|
| **MATCH** | In the manifest, and all four comparisons agree. | no |
| **MISMATCH** | In the manifest, and any comparison differs. | **yes** |
| **NOT_IMPLEMENTED** | Not in the manifest, and Node answered the catch-all `404 not_found`. | no |
| **UNDECLARED** | Not in the manifest, but Node answered **anything other** than the catch-all 404. | **yes** |
| **SKIPPED** | No seed row, or no fixture. | no |

**`UNDECLARED` is the rule that keeps the manifest honest.** Without it, a route implemented but never added to the manifest would be silently skipped forever, and the coverage number would understate the port while the diff never checked the route. With it, the manifest cannot drift without the harness saying so.

**Output — three parts:**

1. **Per-operation lines** for everything that is not `NOT_IMPLEMENTED` (which would be 239 lines of noise on the first run), each naming `operationId`, `METHOD path`, outcome, and for a mismatch the **specific** difference (`status 200 vs 404`, `data[].branch_name missing on node`, `error.code validation_error vs parse_error`).
2. **Per-tag coverage table** over all **39 tags** — matched / mismatched / not implemented / skipped / total, sorted by tag.
3. **A totals line**: `X/239 operations matching (Y%) across 131 paths`, plus the mismatch and undeclared counts.

`--json <path>` writes the same data machine-readably for later consumption. **Gitignore the default output path** — it is a generated artefact, and `docs/BACKEND-ARCHITECTURE.md`'s "generated, not checked in" instinct applies to it just as it does to the schema.

**Exit code: non-zero if any `MISMATCH` or `UNDECLARED`; zero otherwise.** A 0 %-coverage run with no mismatches exits **0** — that is `NODE-1`'s honest state and the baseline this story ships.

---

### 7 — Document the harness as the gate it is

**File: `CONVENTIONS-NODE.md`** — extend **§ 1 (The port rule)**, which already names this harness as what enforces the contract. Add, in three or four sentences: the command (`npm run contract:diff` from `backend-node/`), that both services must be running, and the **two obligations every later NODE story now carries** — add your ported operation ids to `implemented.json`, and add request-body fixtures to `fixtures.json` for the mutating operations you ported, both in the same change as the port. Do not restate the design here; § 1 is a pointer, not a copy.

**File: `docs/VERIFICATION.md`** — add the first recorded run in the existing `## Recorded run` shape (`$ command` then its literal output): the harness's totals line and per-tag table on `NODE-1`'s service. **Record the 0 % baseline verbatim.** A coverage report that first appears at 40 % has no credible starting point; this is what makes every later number meaningful.

**File: `backend-node/README.md`** — one line under the run instructions pointing at `npm run contract:diff`.

---

### Frontend

**No frontend changes required.** `SupportOs backlog.MD:1132` fixes the client as untouched for the whole epic.

---

## Edge Cases & Failure Modes

- **The `*/` landmine in `.mjs` doc comments.** `Story 117` hit this for real: a block comment containing the path glob `backend/apps/*/migrations/` terminated the comment early, and the script died with `SyntaxError: Unexpected identifier 'manage'` — pointing at a line that looked fine. These files are **not** compiled by `nest build`, so nothing catches it before runtime. **Never write `*/` inside a block comment**; use `<app>` in place of a glob asterisk. Every new `.mjs` file must be executed once before the story is called done.
- **A 403 on both sides is a MATCH.** The seeded `super_admin` cannot call the customer export/erase endpoints or manage business calendars (`HOW_TO_USE.md` § 10, a recorded gap). Those operations will 403 identically on both services. Do not grant permissions to make them 200 — the harness compares behaviour, and identical 403s are exactly the behaviour being compared.
- **An empty collection produces a false match if you fabricate an id.** A made-up id 404s on both sides and scores as agreement. `SKIPPED (no seed row)` exists to stop that, and the skipped collections must be named in the report so the coverage number is never read as higher than it is.
- **Node's `404 not_found` is shape-identical to a legitimate 404.** `GET /api/customers/{id}/` with a deleted id legitimately 404s on both. This is why classification keys on the **manifest**, not on the status code — and why `UNDECLARED` exists to catch the inverse.
- **`error.message` is a known parity gap and must not be compared.** Django localises error strings through `gettext` (`backend/locale/ar/` has real translations); the Node service ships English only, recorded as a deliberate gap in `backend-node/README.md` by `NODE-1`. Comparing messages would fail every single error path for a reason already decided and documented.
- **`Content-Type` differs today**: Django sends `application/json`, Express sends `application/json; charset=utf-8` (found while verifying `NODE-1`). The harness compares **bodies and status**, not headers, so this does not fail a run — but it is a real divergence that nothing currently gates. Note it in the report's footer as a known header-level difference rather than leaving it undetected.
- **A mutating run against a shared database is not idempotent.** Two rows per create, accumulating across runs. The `--mutating` warning and the `seed_demo_data` precondition are the mitigation; there is no transaction that can span two HTTP services.
- **`seed_demo_data` deletes every row of the models it manages**, not only rows it created. Anyone running it against a database with real data loses that data. The warning must say this, not merely "re-seed first".
- **Token expiry mid-run.** `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` defaults to **15** (`backend/.env.example`). A full 239-operation sweep is well inside that, but `--mutating` with fixtures could approach it. Acquire the token once at start; if any request returns 401 from **Django** (which is authenticated today), re-acquire once and retry that operation before reporting a mismatch — a token expiry reported as a parity failure would be a lie.
- **The contract drifts under the harness.** If `freeze_api_contract` is re-run and the counts change, Task 2's assertions fail the run with the expected-vs-actual numbers. That is intended: the constants are updated in the same change that regenerates the contract.
- **Ordering differences are not shape differences.** Both services read the same database, so list order should match once a module is ported; the shape signature ignores element order by construction, so an ordering bug would pass this harness. That is a deliberate limit of shape comparison, and it belongs in the report's footer as a stated non-check rather than an assumed one.

---

## Test Plan

**No test file is added.** `CONVENTIONS.md` § 16 — *"no new test file is added anywhere in the repo"* — is repo-wide. The harness is itself a verification tool; it is verified by running it and by deliberately breaking each of its classifications.

1. **The harness's own classifications are exercised by hand** (Verification Steps 5–8): a known-good match, a forced mismatch, a forced `UNDECLARED`, and the `SKIPPED` path. Each is produced by a temporary, reverted edit — never by a committed fixture.
2. **Regression — the Django suite is unchanged.** `python manage.py test` from `backend/` → **54 tests, OK**. This story adds no Python file.
3. **Regression — the Node service is unchanged.** `git diff --stat backend-node/src/` must be **empty**. The harness reads the service over HTTP; it does not touch it.

---

## Verification Steps

1. **Both services running:** `python manage.py runserver` from `backend/` (8000) and `node dist/main.js` from `backend-node/` (8002). Confirm with `curl -s http://127.0.0.1:8000/api/health/` and `:8002` — both return the identical envelope.
2. **Preflight fails cleanly:** stop the Node service, run `npm run contract:diff` → a **named, actionable error** (which URL, which command to start it) and a non-zero exit, **not** a stack trace. Restart it.
3. **Contract parse asserts:** `npm run contract:diff` prints the parsed totals — **131 paths, 239 operations, 39 tags** — and the method split **95/65/30/26/23**. Temporarily change one expected constant in `contract.mjs`, re-run, confirm it fails with expected-vs-actual, revert.
4. **The baseline run:** `npm run contract:diff` → every operation classified **NOT_IMPLEMENTED** or **SKIPPED**, `0/239 operations matching (0%)`, zero mismatches, **exit 0**. Capture this output for Task 7.
   **Steps 5–7 all use the same trick**, because `NODE-1`'s service implements no contract path and there is otherwise nothing to compare: **temporarily** run with `NODE_BASE_URL=http://127.0.0.1:8000`, pointing the harness at Django for *both* targets. Every difference then observed is the harness's own, which is exactly what needs proving. Revert the variable after step 7.

5. **MATCH works:** with both targets on Django, add three read-only operation ids to `implemented.json` (`customers_list`, `tickets_list`, `roles_list`) → all three report **MATCH**, exit **0**. This proves the comparator agrees with itself over live data, volatile-value stripping included.
6. **MISMATCH works and fails the run:** same setup, temporarily make `compare.mjs` treat `id` as non-volatile → the same three report **MISMATCH**, naming the differing key, and the command **exits non-zero**. Revert the comparator change.
7. **UNDECLARED works:** same setup, empty `implemented.json` again → every operation Django answers with a 200 is by definition **not** the catch-all 404, so each reports **UNDECLARED** and the command **exits non-zero**. Revert. This is the proof the manifest cannot drift silently.
8. **SKIPPED works:** confirm the report names at least one collection skipped for having no seed row, and that it does not count toward coverage.
9. **`--only` filters:** `npm run contract:diff -- --only customers` reports only the **11** `customers` operations.
10. **`--json` output:** `npm run contract:diff -- --json out.json` writes valid JSON (`node -e "JSON.parse(require('fs').readFileSync('out.json'))"`) and `out.json` is gitignored.
11. **Lint/format now cover `scripts/`:** `npm run lint` and `npm run format:check` from `backend-node/` → clean, and confirm they actually inspect `scripts/` (temporarily mis-format a `.mjs`, see `format:check` fail, revert).
12. **Every `.mjs` file executes:** each new script runs without a `SyntaxError` — the `*/`-in-comment hazard is only caught at runtime.
13. **Regression:** `python manage.py test` from `backend/` → **54 tests, OK**; `python -m ruff check .` and `ruff format --check .` clean. `git diff --stat backend/ frontend/ backend-node/src/` → **empty**. `git status --short frontend/` → empty.

---

## Done Criteria

- [ ] `npm run contract:diff` from `backend-node/` runs the whole sweep as **one command** and needs no arguments.
- [ ] It reads `docs/api-contract.django.yaml` and asserts **131 paths / 239 operations / 39 tags** and the **95/65/30/26/23** method split, failing loudly on drift.
- [ ] It acquires a token from Django once and sends the **same** `Authorization` header to both services.
- [ ] `{id}` is resolved by **discovering a real id from the collection endpoint at runtime** — never hardcoded, because seeded ids are not stable across re-seeds.
- [ ] It compares **status code, envelope shape, `error.code`, and payload structure**, and ignores ids, timestamps, `request_id`, `debug`, JWTs and the host-bearing `meta.pagination.next`/`previous`.
- [ ] A volatile field is **replaced by its type name, not deleted** — a field present on one side and missing on the other still fails.
- [ ] `meta.pagination.count` and `num_pages` are compared **by value** (one shared database).
- [ ] `error.message` is **not** compared, with the Arabic-localisation gap named as the reason.
- [ ] Five outcomes exist — **MATCH / MISMATCH / NOT_IMPLEMENTED / UNDECLARED / SKIPPED** — and only **MISMATCH** and **UNDECLARED** produce a non-zero exit.
- [ ] `UNDECLARED` is proven to fire (Verification Step 7), so the manifest cannot drift silently.
- [ ] `SKIPPED` distinguishes "no seed row" from "no fixture", and skipped collections are **named** in the report.
- [ ] The coverage report groups by **all 39 contract tags** and prints `X/239 operations matching (Y%) across 131 paths`.
- [ ] Read-only is the **default**; `--mutating` is opt-in and prints the shared-database and `seed_demo_data`-is-destructive warning before writing anything.
- [ ] `implemented.json` and `fixtures.json` both ship **empty**, and `CONVENTIONS-NODE.md` § 1 states that every later NODE story updates both in the same change as its port.
- [ ] The **0 % baseline run is recorded verbatim** in `docs/VERIFICATION.md` in the existing `## Recorded run` format.
- [ ] `--only <tag>` and `--json <path>` both work; the JSON output path is gitignored.
- [ ] `lint`, `format` and `format:check` now cover `scripts/`, and all three pass.
- [ ] Every new `.mjs` file has been executed at least once (the `*/`-in-comment hazard is runtime-only).
- [ ] No test file added anywhere; `backend-node/src/`, `backend/` and `frontend/` are untouched; Django's **54** tests still pass.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 119 (NODE-3, Authentication, Permissions & Scoping).**
