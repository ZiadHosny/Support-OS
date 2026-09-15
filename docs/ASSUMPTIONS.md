# Assumptions and acceptance criteria

Two things this project previously left implicit, written down:

- **[Assumptions](#assumptions)** — the decisions the implementation takes as given. Each one is
  a real constraint in the code, with the file that fixes it. If an assumption is wrong for your
  deployment, the listed file is where the change starts.
- **[Acceptance criteria](#acceptance-criteria)** — per capability, what "done" means, stated so
  it can be checked, plus how each criterion is verified today.

Verification status uses three values throughout, and nothing else:

| Status | Meaning |
|---|---|
| **automated** | a command fails if this breaks (unit test, static gate, or the recorded runtime chain) |
| **runtime-verified** | exercised over HTTP in the run recorded in [`VERIFICATION.md`](VERIFICATION.md), but no standing regression guard |
| **manual** | checked by a human against [`HOW_TO_USE.md`](../HOW_TO_USE.md); nothing catches a regression |

---

## Assumptions

### Deployment and platform

| # | Assumption | Fixed in | If wrong |
|---|---|---|---|
| A1 | **PostgreSQL only.** No other database is supported; JSON fields, constraints and query patterns assume it. | `config/settings/base.py` (`ENGINE: postgresql`) | not a config change — a porting exercise |
| A2 | **One organization per deployment.** `OrganizationSettings` is a singleton (`save()` forces `pk=1`, `delete()` is a no-op). Multi-*department* and multi-*branch* are supported **inside** that one organization; multi-tenant is not. | `apps/organization/models.py` | tenancy would need a scope key on every model and every queryset |
| A3 | **Timezone is UTC in storage**, configurable for display via `DJANGO_TIME_ZONE`; `USE_TZ=True` everywhere. | `config/settings/base.py` | — |
| A4 | **Two languages: English and Arabic**, with RTL as a first-class layout mode, not an afterthought. Physical-direction CSS utilities are a build failure. | `LANGUAGES`, `frontend/scripts/check-rtl.mjs` | adding a language is `LANGUAGES` + `locale/` + translation files |
| A5 | **Redis is required for SLA timers, scheduled jobs and caching** (Celery broker on db 0, cache on db 1). The API serves requests without it; anything scheduled silently does not run. | `CELERY_BROKER_URL`, `CACHES` | SLA breach detection, escalation and retention need the worker + beat running |
| A6 | **WebSockets use the in-memory channel layer.** That works for one process only — live chat and notification push do not fan out across multiple backend processes. This is why the Docker path says never to scale the backend service. | `CHANNEL_LAYERS`, `docker-compose.yml` | a Redis channel layer is the change; it is not wired yet |
| A7 | **Local PostgreSQL is the primary development path**; Docker Compose is an optional convenience, never required. | `README.md` § Docker | — |

### Domain model

| # | Assumption | Fixed in | Consequence |
|---|---|---|---|
| A8 | **A ticket always belongs to exactly one customer**, and that FK is `PROTECT` — a customer with tickets cannot be deleted. | `apps/tickets/models.py` | deletion order matters; GDPR erasure anonymizes rather than deletes |
| A9 | **A customer may exist without a portal login.** `Customer` is a CRM record; portal access is a separate `User` + `portal.access` grant, issued explicitly per customer. | `apps/customers`, `apps/accounts` | a customer record is not an account |
| A10 | **Permissions are data, not code.** A `Role` row holds a JSON list of permission strings, editable through the UI; the 25 valid strings are the code-side catalog. | `apps/core/permissions.py`, `apps/accounts/models.py` | roles drift, so `sync_role_permissions` exists to detect and repair it |
| A11 | **A superuser bypasses the permission system entirely.** `is_superuser=True` is not subject to role checks. | Django auth | never use a superuser to test permission behaviour |
| A12 | **Ticket status transitions go through the service layer**, never a bare field write, because each transition writes a `TicketActivity` row and may touch SLA timers. | `apps/tickets/status.py` | a direct `ticket.status = …` save is a bug, not a shortcut |
| A13 | **Channel adapters are outbound-capable but provider-dependent.** Email/SMS/WhatsApp send through DB-stored provider config; with no credentials configured, sends fail rather than queue. | `apps/communications/adapters.py` + provider config models | a fresh install has no channel credentials |
| A14 | **AI features degrade, not break.** Summaries, suggested replies, categorization and the chatbot call an external provider behind a rate throttle; without a key, the feature is unavailable while the ticket workflow continues. | `apps/ai/`, `apps/core/throttling.py` (`AiRateThrottle`) | AI is additive to every workflow, never a dependency of one |

### API contract

| # | Assumption | Fixed in |
|---|---|---|
| A15 | **Every response is enveloped** — success and error alike, `{ success, data, meta }` — produced by a renderer and an exception handler, never by a view. | `apps/core/renderers.py`, `apps/core/exceptions.py` |
| A16 | **The API is unversioned** (`/api/…`, no `/v1/`). Compatibility is managed by not breaking clients, since the only client ships from this repo. | `config/api_urls.py` |
| A17 | **JWT bearer tokens, refreshed silently by the client interceptor.** There is no session-cookie path for the SPA. | `apps/accounts`, `frontend/src/shared/lib/api/client.ts` |
| A18 | **Every request carries an `X-Request-ID`** (client-supplied or generated) and it appears in the backend log line, so one user action is traceable across both halves. | `apps/core/middleware.py`, `shared/lib/api/client.ts` |
| A19 | **The OpenAPI document is generated on demand, never committed** — a checked-in copy goes stale silently. | `drf-spectacular`, `SPECTACULAR_SETTINGS` |

### Development process

| # | Assumption |
|---|---|
| A20 | **No feature is implemented without a plan file.** The plan in `.squad/plans/` is the spec; the code follows it, and when the plan is wrong the plan is amended first. See [`VERIFICATION.md`](VERIFICATION.md#the-development-loop). |
| A21 | **`CONVENTIONS.md` outranks preference.** Disagreements cite a section rather than re-deriving a standard. |
| A22 | **QA findings become planned stories** (`.squad/plans/bugs/`), not ad-hoc patches. |
| A23 | **CI is a style and typecheck gate only.** The backend test suite needs a database and secrets, so it runs locally, not in CI — stated in `.github/workflows/lint.yml` rather than left to be discovered. |

### Explicitly out of scope

Not partially built, not planned-but-missing — deliberately absent, so their absence is not a
defect: multi-tenancy (A2); horizontal scaling of the WebSocket layer (A6); a mobile app; billing
or payments; a public developer API beyond the API-key surface in `integrations`; SSO/SAML;
automated deployment or infrastructure-as-code beyond the optional Compose stack.

---

## Acceptance criteria

Criteria are per capability and phrased so each one is checkable. "Evidence" names the artifact
that satisfies it; "Status" uses the three values defined above.

### C1 — Customer management (CRUD)

| # | Criterion | Evidence | Status |
|---|---|---|---|
| C1.1 | An authorized user can create a customer with name and contact data; the record is persisted and returned with an id | `POST /api/customers/` → `201, id=8` | runtime-verified |
| C1.2 | Customers can be listed with pagination and searched/filtered; results are scoped to what the caller may see | `GET /api/customers/` → `200, count=7`, `ScopedQuerysetMixin` | runtime-verified |
| C1.3 | A single customer can be read, updated, and deleted, subject to `customers.view` / `customers.manage` | `CustomerViewSet`, `/customers/:id` screens | runtime-verified (read/create), manual (update/delete) |
| C1.4 | Multiple contact details per customer are supported independently of the main record | `/api/contact-details/`, `ContactDetail` | manual |
| C1.5 | A customer profile shows a unified interaction history across tickets, messages and notes | `GET /api/customers/{id}/timeline/` → `customers/timeline.py` | manual |
| C1.6 | Notes and file attachments can be added to a customer and retrieved | `/api/notes/`, `/api/attachments/` | manual |
| C1.7 | A customer's personal data can be exported, and erased/anonymized without breaking ticket integrity (A8) | `customers/export.py`, `customers/erasure.py` | manual — **gap** |
| C1.8 | Portal access can be granted and revoked per customer | `POST /api/customers/{id}/portal-access/` | runtime-verified (portal login works) |

### C2 — Ticket management (CRUD + lifecycle)

| # | Criterion | Evidence | Status |
|---|---|---|---|
| C2.1 | A ticket can be created against an existing customer with subject, description, category and priority | `POST /api/tickets/` → `201, id=14` with the customer FK from C1.1 | runtime-verified |
| C2.2 | Tickets can be listed, filtered, sorted and paginated; an agent can see their own queue | `GET /api/tickets/`, `/tickets/my-tickets` | runtime-verified |
| C2.3 | A ticket can be read and updated | `GET /api/tickets/{id}/` → `200, status=open`; `PATCH` | runtime-verified (read), manual (update) |
| C2.4 | A status change is applied through the service layer and writes an activity record (A12) | `POST /api/tickets/{id}/status/` → `200, status=in_progress`; history → `activity rows=1` | runtime-verified |
| C2.5 | A ticket can be assigned to an eligible agent, and the assignable set excludes inactive users | `POST /api/tickets/{id}/assign/`, `GET /api/tickets/assignable-agents/` | manual |
| C2.6 | Escalation can be applied and follows the configured escalation rules | `POST /api/tickets/{id}/escalate/` → `tickets/escalation.py`, `sla/escalation_rules.py` | manual |
| C2.7 | The full activity history of a ticket is retrievable and ordered | `GET /api/tickets/{id}/history/` → `200` | runtime-verified |
| C2.8 | An SLA policy resolves for a ticket and its due/breach state is reported | `GET /api/tickets/{id}/sla/` → `200` | runtime-verified (resolution), manual (breach timing) |
| C2.9 | Duplicate candidates are detectable and two tickets can be merged without data loss | `/duplicate-candidates/`, `POST /api/tickets/{id}/merge/` | manual |
| C2.10 | Bulk status, priority and assignment changes apply to a selection | `/api/tickets/bulk-*` → `tickets/bulk.py` | manual |
| C2.11 | Filter presets can be saved, reused, and one set as default | `/api/saved-views/`, `…/set-default/` | manual |

### C3 — Authentication and authorization

| # | Criterion | Evidence | Status |
|---|---|---|---|
| C3.1 | Valid credentials return a usable access token; invalid ones are refused with the standard error envelope | login → `200, token issued`; bad creds → `401, enveloped` | runtime-verified |
| C3.2 | Every protected endpoint refuses an anonymous caller with `401`, in envelope form | 5/5 protected endpoints → `401 enveloped` | runtime-verified |
| C3.3 | An expired access token is refreshed transparently, without the user noticing | `/api/auth/token/refresh/` + the client interceptor | manual |
| C3.4 | The signed-in user's identity and effective permission list are retrievable, and the frontend gates render from that same list | `GET /api/auth/me/` → `200, role=agent, permissions=8`; `GET /api/permissions/` | runtime-verified |
| C3.5 | A user lacking a permission is refused the action with `403`, not merely hidden from it in the UI | agent → reports KPIs `403`; agent → portal `403`; portal customer → staff tickets `403` | runtime-verified |
| C3.6 | Role permission grants stay consistent with the code catalog: no unknown strings, an admin role holds everything, every permission is held by someone | `sync_role_permissions` → invariants [1][2][3] all OK | automated |
| C3.7 | Roles and their permissions are editable at runtime by an authorized admin (A10) | `/roles` screens, `roles.manage` | manual |
| C3.8 | Password set / forgot / reset flows work by one-time token | `/api/auth/password/*`, `accounts/tokens.py` | manual |
| C3.9 | Two-factor authentication can be enabled, challenged at login, and recovered with a recovery code | `accounts/mfa.py`, demo account `agent.mfa@supportos.local` | manual |
| C3.10 | Login attempts are rate-limited | `throttled_token_views.py` | manual |
| C3.11 | An inactive user cannot log in and cannot be assigned work | demo account `agent.hassan.inactive@supportos.local` | manual |

### C4 — Agent workspace

| # | Criterion | Evidence | Status |
|---|---|---|---|
| C4.1 | An agent has a landing dashboard showing their open work, tasks and unread notifications, with each tile gated by permission | `app/HomePage.tsx`, `<Can>` | manual |
| C4.2 | An agent can work a ticket end to end on one screen: conversation, status, assignment, escalation, SLA, customer context | `TicketDetailPage` + 15 endpoints ([traces](FRONTEND-WORKFLOWS.md#end-to-end-traces)) | runtime-verified (endpoints), manual (screen) |
| C4.3 | Customer context is visible without leaving the ticket | `CustomerContextPanel`, `GET /api/tickets/{id}/context/` | manual |
| C4.4 | Internal notes are visible to staff and never to the customer | `InternalNotesSection`, `/api/internal-notes/` | manual — **security-relevant, deserves an automated test** |
| C4.5 | Quick replies can be inserted into a reply | `/api/quick-replies/` | manual |
| C4.6 | Tasks/reminders can be created against a ticket, completed and reopened | `/api/tasks/`, `…/complete/`, `…/reopen/` | manual |
| C4.7 | Notifications arrive live over WebSocket and the unread count reflects them | `notifications/consumers.py`, `useUnreadCount` | manual (A6 limits this to one process) |
| C4.8 | An agent can see their own performance metrics; a manager sees the team rollup | `/reports/agents`, `/reports/dashboard` | runtime-verified (gating), manual (figures) |

### C5 — Customer portal

| # | Criterion | Evidence | Status |
|---|---|---|---|
| C5.1 | A portal account sees **only its own** requests | portal customer → `200, own tickets=6` | runtime-verified |
| C5.2 | A portal account cannot reach any staff surface | portal customer → `/api/tickets/` `403` | runtime-verified |
| C5.3 | A customer can submit a request and track its status and history | `POST /api/portal/tickets/`, `/portal/tickets/history` | manual |
| C5.4 | A customer can reply on their own request | `/api/portal/messages/` | manual |
| C5.5 | A customer can submit CSAT feedback on a resolved request | `POST /api/portal/feedback/` | manual |
| C5.6 | FAQs and knowledge-base articles are readable from the portal | `/api/faqs/`, `/api/articles/` | manual |
| C5.7 | The chatbot answers and can hand off to a human | `/api/portal/chatbot/`, `…/handoff/` | manual (A14) |

### C6 — Setup and operability

| # | Criterion | Evidence | Status |
|---|---|---|---|
| C6.1 | A new machine can reach a running backend and frontend from the README alone | `README.md` steps 1–5 | manual |
| C6.2 | `migrate` then `seed_demo_data` produces a working demo dataset **on a fresh database** | fixed and re-run — see [the three setup defects](VERIFICATION.md#three-setup-defects-this-run-found-and-fixed) | runtime-verified |
| C6.3 | Model and migration state never diverge | `makemigrations --check --dry-run` → `No changes detected` | automated |
| C6.4 | The API surface generates a valid OpenAPI document with no warnings | `spectacular` → 131 paths, clean | automated |
| C6.5 | A health endpoint reports service state without authentication | `GET /api/health/` → `200 enveloped` | automated |
| C6.6 | Style, formatting, typecheck, RTL and contrast gates pass on every push | `.github/workflows/lint.yml`, `.githooks/pre-commit` | automated |
| C6.7 | Every request is traceable end to end by one correlation id (A18) | `X-Request-ID` in client and backend log | runtime-verified |

---

## Where the criteria are weakest

Counting the table above: **automated** covers infrastructure and consistency (C3.6, C6.3–C6.6);
**runtime-verified** covers the core CRUD and authorization spine (C1.1–C1.2, C2.1–C2.4, C2.7–C2.8,
C3.1–C3.5, C5.1–C5.2); everything else is **manual**.

The four manual criteria that most deserve automation, in order, because each is either
security-relevant or silently breakable:

1. **C4.4** — internal notes must never leak to a customer. A leak is invisible until it is a
   real incident.
2. **C3.5 per role** — the permission matrix is checked at three points today; it has 25
   permissions × 4 roles of surface.
3. **C1.7** — erasure/export correctness under A8's `PROTECT` constraint.
4. **C2.8 breach timing** — time-dependent, so manual checking is close to worthless.

The full gap analysis, including why counting 19 test files overstates coverage, is in
[`VERIFICATION.md` § Coverage gaps](VERIFICATION.md#coverage-gaps).
