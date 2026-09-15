# Verification — the AI-assisted workflow, the prompts, and recorded outcomes

This document records **how** SupportOS is built and **what the verification commands actually
printed**, rather than summarizing that verification happened. It has four parts:

1. [The development loop](#the-development-loop) — the four stages and the artifact each produces
2. [The prompts](#the-prompts) — the actual prompt shapes used at each stage
3. [Recorded run](#recorded-run-2026-09-15) — commands and their verbatim outcomes
4. [Coverage gaps](#coverage-gaps) — what is *not* verified automatically, stated plainly

---

## The development loop

Work is spec-driven: nothing is implemented straight from a chat message. Every feature passes
through four stages, and each stage leaves a file in the repository that the next stage reads.

| Stage | Command / action | Artifact produced | Count in repo |
|---|---|---|---|
| 1. Intake | `squad new-story` (fetches the Jira work item) | `.squad/stories/<area>/<KEY>/intake.md` | 110 intakes, 20 areas |
| 2. Plan | `/squad-plan` on that intake | `.squad/plans/<area>/NN-story-<slug>-<KEY>.md` | 115 story plans + 20 area overviews |
| 3. Implement | Claude Code, given the plan file as the spec | code + the plan's own task checkboxes | 168 commits |
| 4. Verify | the command battery below | recorded outcomes (this file) | — |

Two properties of this loop are what make the artifacts reviewable:

- **The planner reads only files.** `.squad/config.yaml` points at Jira for *metadata only*; the
  planner cannot open a tracker URL. Anything that should influence a plan must be pasted into
  `intake.md` or dropped in its `attachments/`. There is no invisible context.
- **Plans are specs, not summaries.** A plan (e.g.
  [`08-story-authentication-jwt-SUPPORTOS-26.md`](../.squad/plans/authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md),
  1,198 lines) carries `Prerequisites`, `Story Goal`, `Explicitly out of scope`,
  `Context — Read These Files First`, numbered backend and frontend tasks, `Edge Cases & Failure
  Modes`, `Test Plan`, `Migration / Rollback`, `Verification Steps`, and `Done Criteria`.
  Implementation is a walk through the numbered tasks, so a review can diff the code against a
  written intent that existed beforehand.

Execution order is not left to chance: see the dependency-ordered build sequence and the
coverage matrix in [`.squad/plans/00-index.md`](../.squad/plans/00-index.md).

---

## The prompts

### Stage 1 — intake

`squad new-story` fetches the work item and writes the template; the human fills the blanks. The
prompt to the planner *is* the file. Example (verbatim excerpt from
[`SUPPORTOS-26/intake.md`](../.squad/stories/authentication-authorization/SUPPORTOS-26/intake.md)):

```
## Title
(AUTH-1) — Authentication (JWT)

## Description
As a user, I want to log in and stay authenticated securely, so that my access is
protected. JWT auth (login/refresh/logout) with the token wired into the shared Axios
layer and route guards on the frontend. Dependencies: FND-2, FND-3, UI-1, FORM-1.

  Task: Backend JWT auth endpoints
    Implement: djangorestframework-simplejwt login/refresh; a User model strategy
      (extend Django auth); auth using the standard API envelope.
    Constraints: reuse API error model; no custom response shapes.
    Depends on: FND-2.
    Outcome: working token issuance/refresh via standard API.

  Task: Frontend auth flow & guards
    Implement: login form (RHF+Zod, i18n), token storage + refresh in the Axios
      interceptor, protected route guards, and an auth context/hook.
    Constraints: reuse shared API layer + FORM + UI; single source of auth state.
    Depends on: backend JWT task, FND-3, FORM-1.
    Outcome: users log in and reach protected routes; tokens refresh transparently.
```

The three fields that do the real work are **Constraints** (what to reuse instead of inventing),
**Depends on** (ordering), and **Outcome** (the observable result). A task without an Outcome
line cannot be verified, so it does not get planned.

### Stage 2 — planning

```
/squad-plan .squad/stories/authentication-authorization/SUPPORTOS-26/intake.md
```

The skill applies squad-kit's `generate-plan.md` meta-prompt: read the intake, read the
conventions, read the code the story touches, then emit the plan sections listed above. Budget
is bounded in `.squad/config.yaml` (`maxFileReads: 25`, `maxContextBytes: 50000`,
`maxDurationSeconds: 180`), which is why plans cite specific files rather than describing the
codebase in general terms.

### Stage 3 — implementation

The implementation prompt is deliberately thin, because the plan carries the detail:

```
Implement Story 08 exactly as specified in
.squad/plans/authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md

Rules:
- CONVENTIONS.md is the source of truth; cite a section instead of re-deriving a standard.
- Do only the numbered tasks in the plan. If the plan is wrong, stop and say so — do not
  silently improvise a different design.
- Anything the plan lists under "Explicitly out of scope" stays out of scope.
- Finish with the plan's own Verification Steps and report their real output.
```

"Stop and say so" is the important clause: when implementation reveals the plan is wrong, the
plan is amended (and the finding recorded in it) rather than the code drifting away from the
spec. `.squad/plans/bugs/` exists for the same reason — QA findings become planned stories
(`99`–`105`, closing findings F-1…F-20) instead of ad-hoc patches.

### Stage 4 — verification

```
Run the full verification battery for the change and report the actual output:
backend — manage.py check, makemigrations --check --dry-run, ruff check, ruff format
--check, manage.py test; frontend — npm run build (tsc), lint, format:check, check:rtl,
check:contrast. Then exercise the affected workflow over HTTP and show the status codes.
Do not summarize counts — paste what the commands printed.
```

---

## Recorded run — 2026-09-15

Every block below is the actual output of the command above it, from a run on this repository
at commit `c9a2ae9` (branch `develop`). Reproduce with the same commands.

### Backend static and structural gates

```console
$ python manage.py check
System check identified no issues (0 silenced).

$ python manage.py makemigrations --check --dry-run
No changes detected

$ python -m ruff check .
All checks passed!

$ python -m ruff format --check .
188 files already formatted
```

`makemigrations --check --dry-run` is the schema-drift gate: it fails if any model changed
without a migration. "No changes detected" means the 91 migrations fully describe the 43 models.

### Backend test suite

```console
$ python manage.py test
Found 54 test(s).
System check identified no issues (0 silenced).
Ran 54 tests in 0.413s

OK
```

### API surface generation

```console
$ python manage.py spectacular --file openapi.yaml
$ grep -cE '^  /' openapi.yaml
131
```

Generated with **no warnings** across 131 paths — the schema is derived from the live URLConf
and serializers, so this doubles as a consistency check on routes and controllers.

### Runtime behaviour — unauthenticated surface

Real requests through the full middleware/routing/permission stack:

```console
GET   /api/health/                   -> 200  json=True  enveloped=True
GET   /api/permissions/              -> 401  json=True  enveloped=True
GET   /api/tickets/                  -> 401  json=True  enveloped=True
GET   /api/customers/                -> 401  json=True  enveloped=True
GET   /api/portal/tickets/           -> 401  json=True  enveloped=True
POST  /api/auth/token/  (bad creds)  -> 401  json=True  enveloped=True
GET   /api/definitely-not-a-route/   -> 404  json=True  enveloped=True
```

Three properties are evidenced here rather than asserted: every protected endpoint refuses an
anonymous caller, bad credentials get the same shape as any other error, and an unknown `/api/`
path returns **enveloped JSON 404** — not Django's HTML error page — because of the catch-all
`ApiNotFoundView` in `config/api_urls.py`.

### Runtime behaviour — authenticated end-to-end chain

Run against a **throwaway test database** (created and destroyed by the run; the dev database is
never touched), seeded with `seed_demo_data` + `sync_role_permissions`, then driven over HTTP as
two different real accounts.

```console
$ python manage.py sync_role_permissions
  admin         25/25
  agent          8/25
  customer       2/25
  manager       11/25
[1] OK   every role's permissions are known strings
[2] OK   administrative role(s) hold the full catalogue: admin
[3] OK   every permission is held by at least one role
All invariants pass.

step                                                        result  detail
------------------------------------------------------------------------------------------------
POST /api/auth/token/ (agent login)                         PASS    200, access token issued=True
GET  /api/auth/me/ (identity + permissions)                 PASS    200, role=agent, permissions=8
GET  /api/customers/ (list, scoped + paginated)             PASS    200, count=7
POST /api/customers/ (create)                               PASS    201, id=8
POST /api/tickets/ (create, customer FK)                    PASS    201, id=14
GET  /api/tickets/{id}/ (read back)                         PASS    200, status=open
POST /api/tickets/{id}/status/ (service-layer transition)    PASS    200, status=in_progress
GET  /api/tickets/{id}/history/ (activity written)           PASS    200, activity rows=1
GET  /api/tickets/{id}/sla/ (SLA policy applied)             PASS    200
GET  /api/reports/dashboard/kpis/ (agent, no reports.view)   PASS    403 (403 expected)
GET  /api/portal/tickets/ as staff (portal gate holds)       PASS    403 (403 expected)
GET  /api/portal/tickets/ as portal customer                 PASS    200, own tickets=6
GET  /api/tickets/ as portal customer (staff surface denied)  PASS    403 (403 expected)
test database destroyed; dev database untouched
```

What this run demonstrates, beyond "the endpoints answer":

- **Customer CRUD and ticket CRUD reach the database** — a created customer's id is used as the
  FK of a created ticket, which is then read back.
- **The service layer runs, not just the controller** — the status change went through
  `tickets/status.py` and left a row in `TicketActivity` (`activity rows=1`), which a pure
  field update would not.
- **Authorization is enforced in both directions** — an agent is refused the manager-only
  reports endpoint and the portal surface, and a portal customer is refused the staff surface.
  Permission gating is proven by the *denials*, which are the part that matters.
- **The seeded dataset is coherent** — 7 customers and a portal account that sees exactly its own
  6 tickets.

### Three setup defects this run found and fixed

The authenticated chain above could not run at first: the documented setup path
(`migrate` → `seed_demo_data`, [`HOW_TO_USE.md` § 16](../HOW_TO_USE.md)) crashed on any
freshly-created database. Three coupling bugs in `apps/core/management/commands/seed_demo_data.py`,
each fixed:

| Failure | Cause | Fix |
|---|---|---|
| `Department.DoesNotExist` | `Department`/`Branch` reference rows were fetched with `get`, but no migration creates them | `get_or_create` for the four rows |
| `KeyError: 'Billing'` | seeded tickets and SLA rules index ticket categories by name; nothing creates those categories | create the five named categories when absent |
| `Role.DoesNotExist: super_admin` | the command keyed on `super_admin`, which exists only in this project's hand-built local database — a fresh `migrate` seeds `admin` (migration `0003`) | accept either slug, mirroring `sync_role_permissions.ADMIN_SLUGS` and migration `0015` |

This is the concrete argument for runtime evidence over counted checks: static analysis, 54 unit
tests, and a clean schema generation all passed while the project's own documented first-run
path was broken on every machine except the author's.

### Frontend gates

```console
$ npm run build          # tsc -b (full typecheck) + vite build
✓ built in 1.27s

$ npm run lint           # oxlint
5 warnings, 0 errors

$ npm run check:rtl
check:rtl — no physical direction utilities in src/.

$ npm run check:contrast
check:contrast — every measured token pair clears its AA threshold.
```

The five lint warnings are real and unfixed, recorded here rather than rounded off:

| File | Warning |
|---|---|
| `features/live-chat/components/LiveChatWidget.tsx:195` | `react(refs)` — ref accessed during render |
| `features/tickets/components/TicketListPage.tsx:140,171,182` | `react(set-state-in-effect)` — `setState` called synchronously in an effect (×3) |
| `features/tickets/components/TicketListPage.tsx:171` | `react-hooks(exhaustive-deps)` — missing `applyFilters` dependency |

### Continuous integration

[`.github/workflows/lint.yml`](../.github/workflows/lint.yml) runs on every push and PR to
`main`/`develop`: backend `ruff format --check` + `ruff check`; frontend `oxlint`,
`prettier --check`, `check:rtl`, `check:contrast`, and `npm run build` (which typechecks).
`.githooks/pre-commit` runs the same style gates locally, check-only, and degrades gracefully
when an app is not set up yet.

CI deliberately does **not** run `manage.py check` or `manage.py test` — both need
`DJANGO_SECRET_KEY` and the `POSTGRES_*` variables, and the tests need a live PostgreSQL service
container. That is stated in a comment in the workflow rather than left to be discovered, and it
means the backend test suite is currently a local gate only. Wiring a Postgres service and CI
secrets is the obvious next step.

---

## Coverage gaps

The verification above is honest about its own limits. What is **not** covered automatically:

| Area | Automated coverage today | Gap |
|---|---|---|
| Response envelope, exception handling, pagination, health, settings | 54 tests in `apps/core/tests/`, `config/tests/` | — |
| Ticket workflow (create → assign → status → escalate → merge → history) | none in the suite; covered by the runtime chain above | no regression test per transition rule |
| Customer CRUD, contacts, timeline, erasure | none in the suite; partially covered above | erasure and export are unverified automatically |
| Auth, roles, permission gating | none in the suite; the `sync_role_permissions` invariants and the denials above are the current check | no test per permission boundary |
| SLA timers, escalation schedule, Celery tasks | none | time-dependent behaviour entirely manual |
| Communication channel adapters (email, SMS, WhatsApp, chat, web form) | none | outbound provider calls unverified |
| AI features (summaries, suggestions, categorization, chatbot) | none | provider-dependent |
| Frontend | `tsc`, `oxlint`, `prettier`, RTL and contrast gates | **no test runner and no test files** — no component or hook tests |
| End-to-end browser flows | none | manual, against [`HOW_TO_USE.md`](../HOW_TO_USE.md) § 9 scenarios |

A note on counting, because it is easy to overstate: a repository-wide search for test files
returns 19, but **14 of those belong to tooling under `.claude/skills/`** and are not this
project's code. The project's own suite is **5 files / 54 tests**, and its subject is the
cross-cutting infrastructure in `apps/core` — not the business workflows. Quoting the larger
number as project test coverage would be wrong.

Closing the gap in priority order, based on what the runtime chain exercised and what it could
not: (1) ticket status/assignment/escalation transitions, (2) permission boundaries per role,
(3) customer erasure and export, (4) SLA timing with a frozen clock, (5) a frontend test runner
plus the ticket and customer workflows, (6) a Postgres service in CI so the suite is not
local-only.

---

## Related documents

- [`ASSUMPTIONS.md`](ASSUMPTIONS.md) — assumptions and acceptance criteria per capability
- [`BACKEND-ARCHITECTURE.md`](BACKEND-ARCHITECTURE.md) — layer boundaries and the measured manifest
- [`FRONTEND-WORKFLOWS.md`](FRONTEND-WORKFLOWS.md) — screen inventory and frontend-to-database traces
- [`.squad/plans/00-index.md`](../.squad/plans/00-index.md) — dependency-ordered build sequence and coverage matrix
- [`HOW_TO_USE.md`](../HOW_TO_USE.md) — manual test scenarios, demo accounts, business rules
- [`QA-REPORT-1.md`](../QA-REPORT-1.md) — the QA pass that produced the `bugs/` stories
