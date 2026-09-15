# SupportOS — Customer Support CRM Backlog (SDD / Squad Kit)

**Project:** SupportOS — an all-in-one customer support platform.

**Frontend:** React · Vite · TypeScript · Tailwind CSS · shadcn/ui · React Router · TanStack Query · React Hook Form · Zod · Axios · i18next
**Backend:** Django · Django REST Framework · PostgreSQL (locally installed; **Docker optional, not required** for initial dev)
**Method:** Spec-Driven Development. Order = implementation dependency order. Foundations are built once and reused everywhere.

---

## How to read this backlog

- **EPIC → STORY → TASK.** Each story has a user story, description, dependencies, and tasks. Each task has: what to implement, constraints, dependencies, expected outcome.
- **🔑 = Reusable Foundation.** A 🔑 task produces a shared spec/module that later tasks **reference and reuse**. Later tasks must NOT re-implement these.
- **Shared Specs (defined once, referenced by ID everywhere):**
  - `ARCH` — architecture & folder structure (EPIC 0)
  - `CONV` — codebase conventions (EPIC 0)
  - `ENV` — environment/config strategy, local Postgres (EPIC 0)
  - `API` — API layer: Axios client, TanStack Query, error model, response envelope (EPIC 0)
  - `AUTHZ` — auth/authorization conventions (EPIC 2)
  - `I18N` — i18n/RTL foundation (EPIC 1)
  - `UI` — design system: Tailwind + shadcn shared primitives & states (EPIC 1)
  - `FORM` — form + validation conventions: RHF + Zod (EPIC 1)
  - `DSN` — AI-generated design intelligence: palette, typography, UI patterns, UX/accessibility guidelines, chart guidance (EPIC 8, extends `UI`)

- **Token-efficiency rule for every implementation task (applies globally — do not repeat in each task):**
  1. **Inspect before modify:** read the relevant existing files and the referenced Shared Specs first; reuse existing code/abstractions; change only what's necessary.
  2. **Reference, don't repeat:** depend on the Shared Specs by ID instead of restating architectural rules.
  3. **No duplication:** if a shared component/util/hook exists, use it; do not recreate it.
  4. **Minimal report on completion:** report only → _what changed · files changed · blockers · next recommended task_. No long explanations unless asked.

---

---

# EPIC 0 — Project Foundation & Architecture

**Description:** Establishes the repository, backend and frontend skeletons, local (non-Docker) PostgreSQL setup, the shared API layer, error handling, and the project's coding standards. Everything else depends on this epic. Produces the reusable specs `ARCH`, `CONV`, `ENV`, `API`.

---

### STORY (FND-1) — Repository & Local Dev Bootstrap

**As a developer, I want a monorepo that runs locally without Docker, so that anyone can start developing in minutes.**
**Description:** One repository with `/backend` (Django) and `/frontend` (React/Vite) that runs against a **locally installed PostgreSQL**. Docker files may exist but are optional and never required to run the app.
**Dependencies:** none.

- **Task: Create monorepo structure & docs** 🔑 (defines `ARCH` scaffold)
  - Implement: `/backend`, `/frontend`, root `README` with exact local-run steps (install local Postgres, create DB, run migrations, start both servers), `.gitignore`, `main`+`develop` branches.
  - Constraints: no Docker requirement in the run steps; Docker files (if added) marked optional/future.
  - Depends on: none.
  - Outcome: a fresh clone runs both apps locally following the README only.

- **Task: Environment & config strategy** 🔑 (defines `ENV`)
  - Implement: `.env.example` for backend (DB name/user/password/host/port, secret key, JWT settings) and frontend (`VITE_API_BASE_URL`); a settings split (`base`/`dev`/`prod`) reading env vars; documented local Postgres connection.
  - Constraints: no secrets committed; local Postgres is the default; must work without Docker.
  - Depends on: FND-1 repo task.
  - Outcome: both apps read all config from env; local Postgres connects on `dev`.

---

### STORY (FND-2) — Backend Foundation (Django + DRF)

**As a developer, I want a domain-organized Django + DRF backend, so that features live in clear business boundaries.**
**Description:** Django project organized by domain apps (one app per business area), DRF configured with a **standard response envelope and error model** that all endpoints follow.
**Dependencies:** FND-1.

- **Task: Django project & domain app layout** 🔑 (defines backend half of `ARCH`)
  - Implement: Django project + empty domain apps (`customers`, `tickets`, `communications`, `agents`, `sla`, `knowledge_base`, `portal`, `reports`, `ai`, `integrations`, `accounts`, `organization`); shared `core` app for cross-cutting utilities.
  - Constraints: organize by domain, not by technical layer; avoid premature abstractions.
  - Depends on: FND-1.
  - Outcome: importable domain apps with a documented placement rule for new code.

- **Task: DRF base config, response envelope & error model** 🔑 (defines backend half of `API`)
  - Implement: DRF setup; a **consistent success/error response shape**; a global exception handler mapping errors to that shape; pagination defaults; base viewset/serializer conventions.
  - Constraints: every future endpoint reuses this envelope + exception handler — no per-feature error formats.
  - Depends on: Django project task.
  - Outcome: `GET /api/health/` returns the standard envelope; errors are uniform.

- **Task: Local PostgreSQL wiring & migration workflow** 🔑
  - Implement: connect Django to local Postgres via `ENV`; document `makemigrations`/`migrate`; initial migration.
  - Constraints: local install only; no Docker dependency.
  - Depends on: `ENV`, Django project task.
  - Outcome: migrations run against local Postgres.

---

### STORY (FND-3) — Frontend Foundation (React + Vite + TS)

**As a developer, I want a scalable feature-based React app with a shared API layer, so that features stay consistent and isolated.**
**Description:** React/Vite/TS app with a **feature-based structure**, React Router, and a single shared API layer (Axios + TanStack Query) with centralized error handling. No per-feature API clients.
**Dependencies:** FND-1, FND-2 (`API` envelope/error model).

- **Task: Scaffold React app & feature-based structure** 🔑 (defines frontend half of `ARCH`)
  - Implement: Vite + TS app; structure = `src/features/<feature>/{components,api,hooks,types}`, plus `src/shared/{ui,lib,hooks,i18n}`, `src/app` (router/providers); React Router with route boundaries.
  - Constraints: no dumping ground `components`/`utils`; each feature self-contained; shared code only under `src/shared`.
  - Depends on: FND-1.
  - Outcome: documented structure with a placement rule for new files.

- **Task: Shared API layer (Axios + TanStack Query)** 🔑 (defines frontend half of `API`)
  - Implement: one configured Axios instance (base URL from `ENV`, interceptors for auth token + the standard error model); TanStack Query client + query/mutation conventions; typed API response helpers matching the backend envelope.
  - Constraints: **the only** API client in the app; all data fetching goes through TanStack Query; no `fetch`/ad-hoc Axios in features.
  - Depends on: `API` (backend envelope), scaffold task.
  - Outcome: features call the backend through one consistent, typed, error-handled layer.

- **Task: Global error, loading & empty-state handling** 🔑 (part of `UI`/`API`)
  - Implement: error boundary, standardized query error/loading/empty rendering, and a toast system wired to API errors.
  - Constraints: features reuse these patterns; no per-feature error/loading implementations.
  - Depends on: shared API layer task.
  - Outcome: one consistent way to show loading/error/empty across the app.

---

### STORY (FND-4) — Codebase Conventions & Foundation Spec

**As a team, we want one written conventions spec, so that every developer (and the AI) follows the same patterns and avoids duplication.**
**Description:** A single living document (`CONV`) that all later tasks reference instead of re-deriving standards. This is the anti-duplication, low-token backbone of the project.
**Dependencies:** FND-1, FND-2, FND-3.

- **Task: Author the CONV spec** 🔑 (defines `CONV`)
  - Implement: one doc covering — folder structure & file placement; naming conventions; TypeScript conventions; API communication conventions (reference `API`); error/loading/empty handling; validation approach (reference `FORM`); reusable-component rule (reference `UI`); shared utilities; env/config (reference `ENV`); logging strategy (frontend + backend); API response conventions; frontend/backend boundaries; auth conventions (reference `AUTHZ`); linting/formatting; import conventions; explicit "check for existing implementation before writing new code" rule.
  - Constraints: concise and reference-based; later tasks link to `CONV` rather than repeating rules.
  - Depends on: FND-1/2/3.
  - Outcome: a single source of truth every task cites.

- **Task: Linting, formatting & CI checks** 🔑
  - Implement: ESLint + Prettier (frontend), Black + Ruff/isort (backend), pre-commit hooks, and a CI job running lint for both apps.
  - Constraints: enforce `CONV` import/naming rules automatically.
  - Depends on: CONV task.
  - Outcome: consistent style enforced on every commit.

---

---

# EPIC 1 — Internationalization & Design System

**Description:** Builds bilingual (Arabic/English) + RTL support and the shared UI/design system **before any feature UI**. Produces `I18N`, `UI`, and `FORM`. Every later feature must consume these — no feature re-implements i18n, UI primitives, or validation.

---

### STORY (I18N-1) — Internationalization & RTL Foundation

**As a user, I want the app fully usable in Arabic and English with correct layout direction, so that language is never a limitation.**
**Description:** i18n is a day-one foundation: translation structure, runtime language switching, RTL/LTR layout, and localized date/number formatting. No hardcoded user-facing strings anywhere.
**Dependencies:** FND-3.

- **Task: i18next setup & translation structure** 🔑 (defines `I18N`)
  - Implement: react-i18next; per-feature namespace structure for `en` and `ar`; a typed `t()` usage convention; lint rule/guidance against hardcoded strings.
  - Constraints: every feature adds its own namespace files; strings never hardcoded.
  - Depends on: FND-3.
  - Outcome: translation keys resolve in both languages; adding a feature = adding its namespace.

- **Task: RTL/LTR layout system & language switcher** 🔑 (part of `I18N`)
  - Implement: direction-aware layout (html `dir`/`lang`), Tailwind logical properties usage, a language switcher persisting choice, and direction-correct defaults.
  - Constraints: shared components must render correctly in both directions; use logical (start/end) spacing, not left/right.
  - Depends on: i18next setup task.
  - Outcome: switching language flips layout direction correctly app-wide.

- **Task: Locale formatting utilities** 🔑 (part of `I18N`)
  - Implement: shared date/number/currency formatting helpers bound to the active locale; backend `LANGUAGE`/locale settings for any server-rendered/localized text.
  - Constraints: features format via these helpers, not inline.
  - Depends on: i18next setup task.
  - Outcome: dates/numbers display correctly per locale everywhere.

---

### STORY (UI-1) — Design System & Shared Components

**As a developer, I want a shared, direction-aware component library, so that features reuse consistent UI instead of duplicating it.**
**Description:** Tailwind + shadcn/ui foundation plus the shared business-agnostic primitives and standard states. Built once; every feature reuses these.
**Dependencies:** FND-3, I18N-1.

- **Task: Tailwind + shadcn/ui setup & theme tokens** 🔑 (defines `UI` base)
  - Implement: Tailwind config with design tokens (colors, spacing, radius, typography), shadcn/ui initialized, dark-mode-ready theme, RTL-aware base styles.
  - Constraints: prefer shadcn primitives over hand-built ones; tokens are the single styling source.
  - Depends on: FND-3, I18N RTL task.
  - Outcome: themed, direction-aware styling foundation.

- **Task: Shared UI primitives** 🔑 (part of `UI`)
  - Implement (via shadcn where sensible): Button, Input, Select, Dialog/Modal, Dropdown, Table, Pagination, Toast/notifications, Tabs, Badge, Card.
  - Constraints: all i18n- and RTL-aware; **reuse-first** — features must use these, not re-create them.
  - Depends on: Tailwind/shadcn task.
  - Outcome: a documented primitive set covering common UI needs.

- **Task: Standard states & patterns** 🔑 (part of `UI`)
  - Implement: reusable Loading, Empty, Error states, and a Confirmation dialog pattern; wire them to the `API` error/loading conventions.
  - Constraints: features render these states via shared components only.
  - Depends on: shared primitives task, FND-3 error/loading task.
  - Outcome: consistent loading/empty/error/confirm UX everywhere.

- **Task: Data table + pagination pattern** 🔑 (part of `UI`)
  - Implement: a reusable table pattern (sorting, pagination, empty/loading) built on the primitives + TanStack Query conventions.
  - Constraints: all list screens use this pattern; no bespoke tables per feature.
  - Depends on: shared primitives task, shared API layer.
  - Outcome: one table pattern reused by every list view.

---

### STORY (FORM-1) — Forms & Validation Foundation

**As a developer, I want one form + validation pattern, so that all forms behave and validate consistently.**
**Description:** React Hook Form + Zod as the single forms/validation approach, with shared form components and shared Zod schema conventions (reused for both client and shape alignment with DRF serializers).
**Dependencies:** UI-1, I18N-1.

- **Task: RHF + Zod form foundation** 🔑 (defines `FORM`)
  - Implement: shared Form field components bound to RHF, a Zod resolver setup, localized validation messages (via `I18N`), and reusable schema helpers.
  - Constraints: **the only** form/validation approach; no alternative validation per feature; messages never hardcoded.
  - Depends on: UI primitives, I18N.
  - Outcome: features build forms by composing shared field components + a Zod schema.

---

---

# EPIC 2 — Authentication & Authorization

**Description:** Secure login, token handling, roles, and granular permissions. Produces `AUTHZ`, reused by every protected feature and endpoint.
**Depends on:** EPIC 0 (`API`,`ENV`,`CONV`), EPIC 1 (`UI`,`I18N`,`FORM`).

---

### STORY (AUTH-1) — Authentication (JWT)

**As a user, I want to log in and stay authenticated securely, so that my access is protected.**
**Description:** JWT auth (login/refresh/logout) with the token wired into the shared Axios layer and route guards on the frontend.
**Dependencies:** FND-2, FND-3, UI-1, FORM-1.

- **Task: Backend JWT auth endpoints** 🔑 (part of `AUTHZ`)
  - Implement: `djangorestframework-simplejwt` login/refresh; a `User` model strategy (extend Django auth); auth using the standard `API` envelope.
  - Constraints: reuse `API` error model; no custom response shapes.
  - Depends on: FND-2.
  - Outcome: working token issuance/refresh via standard API.

- **Task: Frontend auth flow & guards** 🔑 (part of `AUTHZ`)
  - Implement: login form (RHF+Zod, i18n), token storage + refresh in the Axios interceptor, protected route guards, and an auth context/hook.
  - Constraints: reuse shared API layer + `FORM` + `UI`; single source of auth state.
  - Depends on: backend JWT task, FND-3, FORM-1.
  - Outcome: users log in and reach protected routes; tokens refresh transparently.

---

### STORY (AUTH-2) — Roles, Permissions & Authorization

**As an admin, I want roles and granular permissions, so that access matches each person's job.**
**Description:** Role model + permission checks enforced uniformly on the backend and reflected in the frontend (hiding/disabling unauthorized actions).
**Dependencies:** AUTH-1.

- **Task: Backend roles & permission enforcement** 🔑 (part of `AUTHZ`)
  - Implement: roles (Admin, Manager, Agent, plus extensible), a reusable DRF permission layer mapping actions→roles, applied via base viewset conventions.
  - Constraints: one permission mechanism reused by all endpoints; no per-feature ad-hoc checks.
  - Depends on: AUTH-1.
  - Outcome: endpoints enforce role permissions consistently.

- **Task: Frontend authorization helpers** 🔑 (part of `AUTHZ`)
  - Implement: a `can(permission)` hook/util and guard components to conditionally render/disable actions.
  - Constraints: features gate UI via these helpers; no bespoke role checks.
  - Depends on: backend permission task.
  - Outcome: UI reflects permissions consistently.

### STORY (AUTH-3) — Role-Based Post-Login Landing

**As a customer, I want to land on the customer portal right after logging in, so that I never see the staff application shell I have no business in.**
**Dependencies:** AUTH-2.
**Context:** confirmed live — `RootLayout.tsx`'s `/` route has no role/permission check beyond `RequireAuth`, so a `portal.access`-only account lands on the staff `Sidebar`/`HomePage` instead of `/portal`. Two sidebar items leak through even though nothing there is a data risk (`TaskViewSet` is user-scoped, empty for a customer; `knowledge_base.view` is legitimately granted to the `customer` role for portal FAQ/article browsing) — but the shell itself is the wrong one to show. Separately, `Sidebar.tsx`'s `/tasks` link is the only nav item not wrapped in `<Can permission="...">`, unlike every other entry in that file.

- **Task: Role-aware landing redirect** — After login (and on any direct hit of `/`), redirect an account whose only permission is `portal.access` to `/portal` instead of rendering `RootLayout`. Outcome: a customer account never sees the staff shell.
- **Task: Gate or hide the `/tasks` nav link consistently** — Decide and apply the same `<Can>` convention every other `Sidebar.tsx` entry uses, or document why `/tasks` is deliberately ungated. Outcome: no sidebar link that silently bypasses this project's own gating convention.

---

---

# EPIC 3 — Customer Management

**Description:** Customer profiles, contact details, interaction history, and notes/attachments — the record everything else attaches to.
**Depends on:** EPIC 0, 1, 2 (all foundations). _(These prerequisites apply to every feature epic below and are not repeated per task.)_

---

### STORY (CUST-1) — Customer Profiles

**As an agent, I want to create and view customer profiles, so that each customer has one record.**
**Dependencies:** AUTH-2, `API`, `UI`, `FORM`, `I18N`.

- **Task: `Customer` model & CRUD API** — Implement Customer model + DRF CRUD using base viewset/envelope/permissions. Constraints: reuse `AUTHZ`, `API`. Outcome: standard customer CRUD endpoints.
- **Task: Customer list & profile UI** — Implement list (shared table pattern) + profile view. Constraints: reuse `UI` table/states, `I18N`. Outcome: browse and view customers.
- **Task: Create/edit customer form** — Implement form via `FORM` (RHF+Zod) with i18n messages. Constraints: reuse `FORM`, shared fields. Outcome: create/edit customers.

### STORY (CUST-2) — Contact Details

**As an agent, I want multiple contact channels per customer, so that I can reach them correctly.**
**Dependencies:** CUST-1.

- **Task: `ContactDetail` model & API** — Implement channel-typed contacts (email/phone/WhatsApp) related to Customer + CRUD. Reuse `API`,`AUTHZ`. Outcome: contact CRUD.
- **Task: Contact details UI** — Implement add/edit/remove within profile using shared primitives + `FORM`. Outcome: manage contacts inline.

### STORY (CUST-3) — Interaction History

**As an agent, I want a customer's full timeline, so that I have context.**
**Dependencies:** CUST-1, TKT-1, COMM-\*.

- **Task: Interaction aggregation API** — Implement endpoint aggregating tickets + messages chronologically. Reuse `API`. Outcome: unified timeline data.
- **Task: Timeline UI** — Implement timeline on profile using shared states. Reuse `UI`,`I18N`. Outcome: chronological history view.

### STORY (CUST-4) — Notes & Attachments

**As an agent, I want notes and files on a customer, so that context is shared.**
**Dependencies:** CUST-1.

- **Task: `Note` & `Attachment` models + upload API** — Implement models + file upload via `API` conventions; document storage location via `ENV`. Outcome: notes/files persistence.
- **Task: Notes & attachments UI** — Implement add/list/download using shared primitives. Outcome: manage notes/files on profile.

### STORY (CUST-5) — Portal Access Management

**As an agent, I want to see and grant/revoke a customer's portal login from their profile, so that onboarding a customer to self-service doesn't require Django Admin access.**
**Dependencies:** CUST-1, SEC-5.

- **Task: Grant/revoke portal access API** — Expose whether a `Customer` has a linked portal `User` and add a permission-gated endpoint that provisions one (reusing SEC-5's invite-email flow, `role=customer`) or revokes it (unlink/deactivate), replacing the current Django-admin-only path (`Customer.user`, Story 42). Outcome: staff-controlled portal onboarding without admin access.
- **Task: Portal access UI** — Implement a status indicator ("Portal access: enabled/disabled") + grant/revoke action on the customer profile page. Outcome: visible, actionable portal-access control for agents.

---

---

# EPIC 4 — Ticket Management

**Description:** The core support workflow — create/track tickets, categories, priorities, assignment, status, escalation, and full history.
**Depends on:** foundations + Customer Management.

### STORY (TKT-1) — Create & Track Tickets

**As an agent, I want to create and track tickets, so that every issue is recorded to resolution.**
**Dependencies:** CUST-1, AUTH-2.

- **Task: `Ticket` model & CRUD API** 🔑 (core ticket domain reused by many epics) — Implement Ticket (subject, description, customer FK, timestamps, status, priority placeholders) + CRUD via base conventions. Outcome: ticket CRUD other epics build on.
- **Task: Ticket list & detail UI** — Implement list (shared table) + detail view. Reuse `UI`,`I18N`. Outcome: browse/view tickets.
- **Task: Create/edit ticket form** — Implement via `FORM`, customer selector reusing customer API. Outcome: create/edit tickets.

### STORY (TKT-2) — Categories & Priorities

**Dependencies:** TKT-1.

- **Task: `Category` model + priority + API** — Implement categories and priority field with management endpoints. Reuse `AUTHZ`. Outcome: classify tickets.
- **Task: Category/priority UI & filters** — Implement selectors + list filters via shared table pattern. Outcome: filter/sort by category/priority.

### STORY (TKT-3) — Assignment

**Dependencies:** TKT-1, AUTH-2.

- **Task: Assignment API** — Implement `assigned_agent` + assign/reassign endpoint with permission checks. Outcome: assign tickets.
- **Task: Assignment UI & "my tickets"** — Implement assignment control + agent-scoped filter. Reuse authorization helpers. Outcome: clear ownership + personal queue.

### STORY (TKT-4) — Status & Escalation

**Dependencies:** TKT-1.

- **Task: Status/escalation API** — Implement status enum with valid transitions + escalation level/flag endpoints. Outcome: controlled status/escalation.
- **Task: Status/escalation UI** — Implement status control + escalate action using shared confirm dialog. Outcome: transparent progress + escalation.

### STORY (TKT-5) — Ticket History

**Dependencies:** TKT-1.

- **Task: `TicketActivity` log & API** 🔑 (reusable activity-log pattern) — Implement change logging (status/assignment/replies) + history endpoint. Outcome: auditable ticket timeline pattern reusable elsewhere.
- **Task: History timeline UI** — Implement activity timeline reusing timeline/state components. Outcome: full ticket history view.

### STORY (TKT-6) — Category Management UI

**⏭ Next up.**
**Description:** `TKT-2` already shipped the `Category` model and its management API — but no in-app screen, so Django Admin has been the only way to add/edit/delete a category. This story closes that gap with a small, dedicated screen inside the app itself.
**Dependencies:** TKT-2.

- **Task: Category CRUD UI** — Implement a simple list + create/edit/delete screen for `Category`, reusing the existing `UI` table/primitives and `FORM` (RHF+Zod), calling `TKT-2`'s already-built `Category` API — no backend change needed. Constraints: reuse `AUTHZ` (`tickets.manage`, matching the permission other ticket-admin actions already use); no new permission string unless a real gap is found. Outcome: categories are managed from the app, Django Admin no longer required for day-to-day use.

### STORY (TKT-7) — Bulk Ticket Actions

**As an agent, I want to act on many tickets at once, so that clearing a queue is not one ticket at a time.**
**Description:** Verified gap: the ticket list has no row selection at all, so assigning ten tickets to a colleague, closing a batch of resolved duplicates, or re-prioritising after an incident is ten separate round-trips through the detail screen. This is the most repeated manual action in day-to-day queue work.
**Dependencies:** TKT-3, TKT-4, DSN-7.

- **Task: Row selection in the shared table pattern** 🔑 (reusable by every list screen) — Add optional multi-select (per-row plus select-all-on-page) and a contextual bulk-action bar to the shared `DataTable`, opt-in per screen. Constraints: shared-component level so other lists inherit it; keyboard-accessible and RTL-correct per `I18N`/`DSN`; selection state must survive sort/filter changes predictably or be cleared explicitly, never left silently stale. Outcome: a reusable selection pattern, adopted first by tickets.
- **Task: Bulk assign / status / priority endpoints** — Implement bulk operations that apply per-ticket permission and `TKT-4` transition validation to every row, returning a per-row result rather than failing the whole batch on one invalid item. Constraints: reuse `AUTHZ` and the existing single-ticket transition rules — no bypass path; every change writes to `TKT-5`'s activity log exactly as the single-ticket action does. Outcome: batch changes as safe and auditable as individual ones.
- **Task: Bulk-action UI with partial-failure reporting** — Wire the action bar to the endpoints, with a confirm step for destructive actions (shared confirm dialog) and a clear summary when some rows succeed and others do not. Constraints: reuse `UI` toast/confirm primitives. Outcome: agents clear queues quickly and always know exactly what changed.

### STORY (TKT-8) — Saved Views & Filter Presets

**As an agent, I want to save a filter combination and return to it, so that my working queues are one click away.**
**Description:** Verified gap: `TKT-2` shipped filters and `ORG-4` defaults them to the caller's own department/branch, but nothing persists a combination. Every agent rebuilds "my open urgent tickets" or "unassigned in my branch" by hand each session, and there is no way to share a team queue definition.
**Dependencies:** TKT-2, TKT-3, ORG-4.

- **Task: `SavedView` model + API** — Implement named, per-user saved filter/sort combinations with an optional shared/team flag, stored as the same query parameters the list already accepts. Constraints: store the filter payload, never a raw SQL fragment or a frozen result set; a shared view is readable by others but editable only by its owner or a manager, via `AUTHZ`. Outcome: filter combinations persist and can be shared.
- **Task: Saved-view UI on the ticket list** — Implement save/rename/delete plus a view switcher on the list screen, with the caller's default view applied on load. Constraints: reuse `UI`/`FORM`; a saved view is a starting point the agent can still change, never a lock — the same "default, not a boundary" rule `ORG-4` established. Outcome: one-click access to personal and team queues.

### STORY (TKT-9) — Ticket Merge & Duplicate Handling

**As an agent, I want to merge duplicate tickets, so that one issue has one thread and one history.**
**Description:** Verified gap: nothing detects or resolves duplicates, yet they are produced structurally — `COMM-1`/`COMM-4`/`COMM-5` each create a ticket per inbound message, so a customer who emails and then submits the web form about the same problem generates two. Today the only remedy is closing one by hand and losing its conversation context.
**Dependencies:** TKT-1, TKT-5, COMM-0.

- **Task: Merge API** — Implement merging a source ticket into a target: move messages, attachments and internal notes onto the target, record the merge in both tickets' `TKT-5` history, and close the source with a pointer to the target. Constraints: never hard-delete the source — the merge stays auditable and reversible by inspection; apply `AUTHZ` permission checks to both tickets, not just one. Outcome: duplicates are consolidated without losing conversation history.
- **Task: Duplicate candidate suggestion** — Surface likely duplicates on the ticket detail screen (same customer, near in time, similar subject), reusing `KB-3`'s existing text-similarity retrieval rather than adding a second search mechanism. Constraints: suggestion only, never auto-merge; `AI-0` may improve ranking later but must not be a dependency of this task. Outcome: agents notice duplicates before working them twice.
- **Task: Merge UI** — Implement target selection and a confirm step showing exactly what will move, via the shared confirm dialog. Constraints: reuse `UI`; make the irreversible parts explicit in the confirm copy per `DSN-12`. Outcome: merging is deliberate and its effect is obvious beforehand.

---

---

# EPIC 5 — Communication Channels

**Description:** Unify email, WhatsApp, live chat, SMS, and web forms into tickets. A shared message model + channel-adapter pattern is built once and reused per channel.
**Depends on:** Ticket Management.

### STORY (COMM-0) — Messaging Core & Channel Adapter Pattern

**As a developer, I want one message model and channel-adapter interface, so that each channel plugs in consistently.**
**Dependencies:** TKT-1.

- **Task: `Message` model + channel adapter interface** 🔑 (defines the messaging foundation) — Implement a unified Message model (ticket FK, direction, channel, body, metadata) and an adapter interface each channel implements (inbound→ticket, outbound send). Constraints: channels reuse this; no per-channel bespoke models. Outcome: reusable messaging spine.
- **Task: Shared conversation UI** 🔑 — Implement a channel-agnostic conversation/thread + reply component (reusing `UI`,`FORM`,`I18N`). Outcome: one conversation view all channels reuse.

### STORY (COMM-1) — Email

**Dependencies:** COMM-0.

- **Task: Email adapter (inbound parse + outbound send)** — Implement the email adapter against the shared interface + provider config via `ENV`. Outcome: email ↔ tickets.
- **Task: Email in conversation UI** — Wire email into the shared conversation view. Outcome: reply by email in-ticket.

### STORY (COMM-2) — WhatsApp

**Dependencies:** COMM-0.

- **Task: WhatsApp adapter** — Implement provider (WhatsApp Business API) adapter + webhook intake. Outcome: WhatsApp ↔ tickets.
- **Task: WhatsApp in conversation UI** — Reuse shared conversation view. Outcome: reply via WhatsApp.

### STORY (COMM-3) — Live Chat

**Dependencies:** COMM-0.

- **Task: Real-time chat backend (Django Channels)** — Implement WebSocket chat persisting to Message/ticket via the adapter pattern. Outcome: real-time chat as tickets.
- **Task: Live-chat widget + agent console** — Implement customer widget + agent console reusing shared conversation UI. Outcome: real-time support.

### STORY (COMM-4) — SMS

**Dependencies:** COMM-0.

- **Task: SMS adapter** — Implement provider send/receive adapter. Outcome: SMS ↔ tickets.
- **Task: SMS in conversation UI** — Reuse shared conversation view. Outcome: reply via SMS.

### STORY (COMM-5) — Web Forms

**Dependencies:** COMM-0, TKT-2.

- **Task: Web form intake API** — Implement configurable form submission → ticket creation. Outcome: forms create tickets.
- **Task: Embeddable/portal web form** — Implement form via `FORM`+`I18N`, reusing validation. Outcome: structured request capture.

---

---

# EPIC 6 — Agent Workspace

**Description:** The agent's home base — assigned tickets, customer context, tasks/reminders, quick replies, and team collaboration.
**Depends on:** Ticket Management, Communication Channels.

### STORY (AGENT-1) — Assigned Tickets Workspace

**Dependencies:** TKT-3.

- **Task: Agent queue API** — Implement filtered "my tickets" (status/priority/SLA) reusing ticket API. Outcome: focused queue data.
- **Task: Agent queue UI** — Implement queue using shared table pattern + filters. Outcome: agent work list.

### STORY (AGENT-2) — Customer Context Panel

**Dependencies:** CUST-1, TKT-1.

- **Task: Combined context API** — Implement ticket+customer+recent-history endpoint. Outcome: one call for context.
- **Task: Context side panel UI** — Implement reusable side panel beside ticket detail. Outcome: context without screen switching.

### STORY (AGENT-3) — Tasks & Reminders

**Dependencies:** AUTH-1, SLA-4 (notifications).

- **Task: `Task`/`Reminder` model + API** — Implement personal tasks (optional ticket link, due date). Outcome: reminders persistence.
- **Task: Tasks/reminders UI + due notifications** — Implement UI reusing primitives; trigger via shared notification system. Outcome: follow-ups don't get lost.

### STORY (AGENT-4) — Quick Replies

**Dependencies:** COMM-0.

- **Task: `QuickReply` model + API** — Implement reusable reply templates. Outcome: template store.
- **Task: Quick-reply picker in conversation** — Implement picker inside shared conversation view. Outcome: faster replies.

### STORY (AGENT-5) — Team Collaboration

**Dependencies:** TKT-5, SLA-4.

- **Task: Internal notes + @mentions API** — Implement private notes + mentions on tickets (reuse activity-log pattern). Outcome: private collaboration.
- **Task: Collaboration UI + mention notifications** — Implement internal-note UI + notify mentioned agents. Outcome: agents solve together.

---

---

# EPIC 7 — SLA & Automation

**Description:** Response/resolution targets, automatic assignment, escalation rules, and alerts — built on a shared background-job foundation.
**Depends on:** Ticket Management.

### STORY (SLA-0) — Background Jobs Foundation

**As a developer, I want a shared async/scheduled-job foundation, so that automation, escalation, and notifications reuse it.**
**Dependencies:** FND-2.

- **Task: Celery + scheduler setup** 🔑 (reused by SLA, escalation, notifications, AI, integrations) — Implement Celery worker + beat with local broker documented in `ENV`; **must remain runnable locally without Docker** (document local broker option). Outcome: reusable async/scheduled task foundation.

### STORY (SLA-1) — Response & Resolution Targets

**Dependencies:** TKT-2.

- **Task: `SLAPolicy` model + computation** — Implement policies per priority/category; compute due times + breach status. Outcome: SLA tracking.
- **Task: SLA config UI + on-ticket indicators** — Implement admin config + ticket badges reusing primitives. Outcome: visible SLA status.

### STORY (SLA-2) — Automatic Assignment

**Dependencies:** TKT-3, SLA-0.

- **Task: Assignment rules engine** — Implement rules (category/load/round-robin) applied on ticket creation. Outcome: auto-routing.
- **Task: Assignment rules UI** — Implement config UI. Outcome: manageable routing.

### STORY (SLA-3) — Escalation Rules

**Dependencies:** SLA-1, SLA-0.

- **Task: Escalation evaluation job** — Implement scheduled job (via SLA-0) escalating at-risk/idle tickets. Outcome: automatic escalation.
- **Task: Escalation rules UI** — Implement config UI. Outcome: manageable escalation.

### STORY (SLA-4) — Alerts & Notifications

**As a developer, I want one notification system, so that all features send alerts consistently.**
**Dependencies:** SLA-0.

- **Task: Notification model + delivery** 🔑 (reused by tasks, collaboration, SLA, AI) — Implement in-app + email delivery triggered from events. Outcome: shared notification service.
- **Task: Notification center UI** 🔑 — Implement reusable notification center + toasts. Outcome: consistent alerts everywhere.

### STORY (SLA-5) — Business Hours & Holiday Calendar

**As a support manager, I want SLA targets measured in working hours, so that targets reflect the hours we actually staff.**
**Description:** Verified gap, and it makes current SLA figures wrong rather than merely imprecise. `SLA-1` computes both due times as plain wall-clock arithmetic — `apps/sla/policy.py` adds `timedelta(minutes=target)` to `ticket.created_at` and nothing else — so a ticket raised at 17:00 on Thursday with a four-hour response target is already breached before anyone is due back at work. There is no business-hours, working-week or holiday concept anywhere in the codebase or this backlog. A commercial support product cannot report credible SLA attainment without one.
**Dependencies:** SLA-1, SEC-4, ORG-2.

- **Task: `BusinessCalendar` model + working-time arithmetic** 🔑 (reused by SLA due times, escalation, and reporting) — Implement a calendar of weekly working windows plus dated holiday exceptions, and a working-time function that advances a timestamp by N working minutes and measures elapsed working minutes between two timestamps. Constraints: timezone-aware, honouring `ENV`'s configured timezone; this function is the single implementation every consumer calls — no second copy in escalation or reports. Outcome: a reusable working-time primitive.
- **Task: Apply working time to SLA due times & escalation** — Change `SLA-1`'s due-time computation and `SLA-3`'s escalation thresholds to consume the working-time function instead of raw `timedelta`. Constraints: a calendar is optional — an organization or policy with none configured keeps today's 24/7 wall-clock behaviour exactly, so this is additive and not a breaking change to existing data; recompute derived due times on ticket save rather than retroactively rewriting history. Outcome: SLA and escalation both respect working hours.
- **Task: Calendar management UI + per-policy assignment** — Implement an admin screen to define working windows and holidays, and let an `SLAPolicy` (and optionally a `Branch`, per `ORG-2`) select a calendar. Constraints: reuse `UI`/`FORM`/`I18N`; support a per-branch calendar so regional offices can differ. Outcome: managers configure real working hours without code.

### STORY (SLA-6) — Waiting-on-Customer Status & SLA Clock Pause

**As an agent, I want the SLA clock to stop while I am waiting on the customer, so that our targets measure our responsiveness rather than theirs.**
**Description:** Verified gap: `Ticket.Status` offers only `open`, `in_progress`, `resolved`, `closed` — there is no "waiting on customer" state, so a ticket blocked on a customer reply keeps accruing SLA time and eventually breaches for a delay the team did not cause. With `SLA-5`, this is the second of the two reasons current breach figures overstate the problem. The state also gives the escalation job (`SLA-3`) a way to tell "idle because blocked" from "idle because neglected".
**Dependencies:** TKT-4, SLA-1, SLA-5.

- **Task: `pending_customer` status + transition rules** — Add the status to `TKT-4`'s enum and its valid-transition graph, entered from `in_progress` and left automatically when the customer replies (via `COMM-0`'s inbound message path) or manually by an agent. Constraints: extend `TKT-4`'s existing transition validation rather than adding a parallel state machine; every automatic transition is logged through `TKT-5`'s activity log. Outcome: a ticket can be explicitly blocked on the customer.
- **Task: Pause and resume the SLA clock** — Implement accumulated paused time on the ticket and subtract it when computing response/resolution status, so time in `pending_customer` does not count against a target. Constraints: consume `SLA-5`'s working-time function rather than adding a second time calculation; store accumulated pause explicitly so history stays auditable and recomputation is not required. Outcome: SLA attainment reflects only time the team owned the ticket.
- **Task: Surface the paused state in UI and reports** — Show the status and a paused-SLA indicator on the ticket list and detail via `UI`/`DSN` semantics, and separate paused time in `RPT-2`'s SLA reporting. Constraints: reuse existing badge semantics (`DSN-4`) — no new colour vocabulary. Outcome: paused tickets are obvious to agents and correctly excluded from breach figures.

---

---

# EPIC 8 — Design Intelligence & UI/UX System

**Description:** Applies AI-driven design intelligence (via the `ui-ux-pro-max` skill) to generate and codify a tailored design system — palette, typography, UI patterns, accessibility/UX guidelines, and chart guidance — layered on top of `UI` (EPIC 1) and retrofitted across already-built screens (EPIC 0-7) before Knowledge Base and later features add more UI. Also runs the dedicated _audit → fix → verify_ pass (`DSN-6`–`DSN-13`) over the entire built product (EPICs 0–11) from a professional UI/UX perspective — cross-feature consistency, usability, interaction/feedback, responsiveness, forms, information architecture, and bilingual content quality — before AI Features and later epics add more surface.
**Depends on:** Internationalization & Design System (`UI`, `I18N`), Agent Workspace (existing built screens).

### STORY (DSN-0) — Design Intelligence Foundation

**As a developer, I want an AI-generated design system tailored to a customer-support SaaS product, so that all future UI work reuses a consistent, justified set of design decisions instead of ad-hoc choices.**

- **Task: Generate tailored design system via `ui-ux-pro-max` skill** 🔑 (reused by Knowledge Base, Portal, Reports charts, Branding) — Run the skill against SupportOS's product type (B2B customer-support platform) to produce a recommended UI style, color palette, typography pairing, layout patterns, and anti-patterns to avoid. Codify the output as the `DSN` shared spec, extending `UI` (does not replace it). Outcome: one authoritative, reusable design-system spec.
- **Task: Reconcile `DSN` with existing `UI` tokens** — Map the generated palette/typography onto the existing Tailwind/shadcn tokens from EPIC 1; document any deltas and how they're resolved. Constraints: no visual regression without an explicit decision. Outcome: `DSN` and `UI` stay in sync, not competing sources of truth.

### STORY (DSN-1) — Design System Refresh Across Built Screens

**Dependencies:** DSN-0.

- **Task: Apply refreshed tokens to existing screens** — Retrofit already-built screens (EPICs 0-7) with `DSN`'s palette/typography via `UI` primitives only. Constraints: token/style updates only, no re-architecture of existing components. Outcome: visually consistent app before new features add more surface.

### STORY (DSN-2) — UX Guidelines & Accessibility Audit

**Dependencies:** DSN-0.

- **Task: Run UX/anti-pattern + accessibility checklist** — Apply the skill's UX guidelines and pre-delivery accessibility checklist across built screens; log and fix flagged issues (contrast, text resilience, focus states, RTL per `I18N`). Outcome: accessibility/UX debt cleared before it compounds.

### STORY (DSN-3) — Dashboard Chart Design Guidance

**Dependencies:** DSN-0.

- **Task: Capture chart-type guidance for future dashboards** 🔑 (reused by Reports & Analytics `RPT-0`) — Record the skill's chart-type recommendations (by data shape/use case) as part of `DSN`, for the shared chart wrapper built later in Reports & Analytics. Outcome: chart choices are justified up front, not picked ad hoc when `RPT-0` is built.

### STORY (DSN-4) — Comprehensive Visual Redesign of Built Screens

**As a user, I want the app to look polished and visually considered instead of flat and generic, so that using it feels trustworthy and professional.**
**Description:** DSN-1 only swapped color/font/radius tokens — a deliberate narrow scope, not a full redesign. Screens still read as unstyled shadcn defaults: uniform-gray status/priority badges with no semantic color, no iconography, no density/hierarchy polish on tables and forms. This story goes past the token swap to make every already-built screen actually look designed, using `DSN`'s guidance (`design-system/supportos/MASTER.md`) and the `ui-ux-pro-max` skill, while staying inside the existing shadcn/ui + Tailwind v4 primitive set — visual/styling only, no new component library and no re-architecture of data flow or logic.
**Dependencies:** DSN-0, DSN-1.

- **Task: Semantic status/priority color-coding** — Extend the shared `Badge` primitive's variants (or add new ones) so ticket status, priority, notification kind, and task state render with distinct, meaningful colors (e.g. success/warning/danger/info) per `DSN`'s palette, instead of one uniform gray pill. Constraints: reuse the existing `badge.tsx` primitive and `DSN` tokens; no per-feature badge reimplementation. Outcome: status is scannable at a glance across every list view.
- **Task: Iconography pass** — Add icons (via the icon library already bundled with shadcn) to primary actions, nav items, status badges, and empty states per `DSN` guidance. Constraints: reuse one icon set consistently; no mixed icon libraries. Outcome: improved scannability and a less "bare" feel.
- **Task: Spacing, density & table polish** — Apply `DSN`'s spacing scale and visual-hierarchy guidance to the shared `DataTable` pattern, page headers, and form layouts every already-built screen composes from. Constraints: shared-component-level changes only, so every consuming screen inherits the fix. Outcome: consistent, less flat layout app-wide with no per-page rework.
- **Task: Full-app visual QA pass** — Walk every already-built route (same list as DSN-1's `## Verification Steps`) confirming the refresh landed consistently; log and fix any straggler screen. Outcome: no unstyled screen left behind.

### STORY (DSN-5) — App Shell Redesign: Sidebar Navigation & Theme Backgrounds

**As a user, I want a proper sidebar and a considered light/dark background palette instead of a bare top bar and flat grayscale surfaces, so that navigating the app feels like a real product, not a scaffold.**
**Description:** Complements `DSN-4`. That story polishes existing components in place; this one changes the app **shell** itself — the current top-bar nav (`frontend/src/app/RootLayout.tsx`) becomes a sidebar, and the base surface tokens (background/card/muted/border — not just the accent colors `DSN-1` already retinted) get a real light/dark treatment. This is the one story in `EPIC 8` that is _not_ token-only — converting the nav from a header to a sidebar is a deliberate layout restructuring, done carefully to preserve every existing permission gate, i18n label, and route unchanged.
**Dependencies:** DSN-0. Complements DSN-4 (either order is fine; both build on `DSN`'s spec).

- **Task: Sidebar navigation shell** — Replace `RootLayout.tsx`'s top `<nav>` with a collapsible sidebar (start-side in LTR, end-side in RTL, per `I18N`'s logical-direction rules), preserving every existing `<Can permission="...">`-gated link, i18n label, the notification bell, and logout exactly as they behave today — only the container markup and layout change, not the route/permission logic. Outcome: real app-shell navigation instead of a single crowded header row.
- **Task: Light/dark background & surface refresh** — Beyond `DSN-1`'s accent-only swap (`--primary`/`--secondary`/`--destructive`), retint the base surface tokens (`--background`, `--foreground`, `--card`, `--muted`, `--border`) in `frontend/src/index.css` for both `:root` and `.dark` per `DSN`'s guidance, so the new sidebar and every page have real depth/contrast instead of shadcn's default flat grayscale. Outcome: light and dark mode both look designed, not just recolored accents on a gray canvas.
- **Task: Button & input primitive polish** — Refine the shared primitives every form and screen already composes from (`shared/ui/primitives/button.tsx`, `input.tsx`, `select.tsx`, and the shared field components in `shared/ui/form/`) with `DSN`'s guidance on shadows, hover/focus/active states, and sizing. Constraints: component-level only — no per-feature overrides — so every consuming screen inherits the polish automatically. Outcome: every button and input in the app feels considered, not default shadcn.
- **Task: Full-app QA pass** — Verify the sidebar and new theme across every already-built route, in both languages/directions (`ar`/RTL, `en`/LTR) and both color modes (light/dark), confirming permission-gated links still show/hide correctly and no screen is left half-migrated. Outcome: one consistent, polished shell everywhere.

**Thread guardrail (DSN-6 through DSN-13 below):** frontend visual/UX only, inside the existing shadcn/ui + Tailwind + `DSN`/`UI` primitives. No data-flow, API, or route-logic changes; no new component library; permission gates and i18n keys preserved exactly. Fixes land at the **shared-component/foundation level** wherever possible so every consuming screen inherits them (no per-page rework).

### STORY (DSN-6) — Full UI/UX Audit & Issue Register

**As a product team, we want one professional audit of the entire built UI, so that inconsistencies and usability issues are found and prioritized once, and every fix traces back to a recorded finding.**
**Description:** A single systematic review of every already-built route (EPICs 0–11) through `ui-ux-pro-max` plus a Nielsen heuristic pass, cataloguing what's inconsistent or hard to use. This is the "identify" half — it produces the register the remediation stories act on, so the app is never re-scanned from scratch.
**Dependencies:** DSN-0, DSN-4, DSN-5 (audit reflects the current refreshed UI).

- **Task: Produce the prioritized UX issue register** 🔑 (consumed by DSN-7–DSN-13) — Implement: walk every built route via `ui-ux-pro-max` + a heuristic checklist (consistency, feedback, error prevention, recognition-over-recall, minimalism, match to real workflow); record each finding in `design-system/supportos/UX-AUDIT.md` with a stable ID, screen, category (consistency / interaction / responsive / form / IA / content / bilingual), severity (critical/major/minor), and recommended fix + owning DSN story. Constraints: catalogue only — no code changes here beyond trivially obvious one-liners; reference `DSN`/`UI`/`I18N`, don't restate them. Outcome: one authoritative, ID'd issue register that all remediation references.

### STORY (DSN-7) — Cross-Feature Consistency Remediation

**As a user, I want every screen to behave and read the same way, so that patterns I learn in one feature carry everywhere.**
**Description:** Fixes the register's `consistency` findings — divergent patterns that crept in as features were built independently (button order/placement, primary-action naming, page-header structure, modal-vs-inline choices, table column/date conventions, badge usage). Fixes land in shared components so consistency is structural, not per-screen.
**Dependencies:** DSN-6.

- **Task: Standardize page & action patterns at the shared level** — Implement: from the register's `consistency` items, converge page-header layout, primary/secondary button order & placement, and action naming onto one pattern via the shared layout/primitive components; align date/number display on the `I18N` formatters. Constraints: change shared components, not individual screens; update register entries to resolved. Outcome: one consistent interaction vocabulary app-wide.
- **Task: Consolidate divergent UI patterns** — Implement: replace any one-off tables/dialogs/dropdowns that bypassed the `UI` primitives with the shared ones flagged in the register. Constraints: reuse-first, no new variants unless the register proves a real gap. Outcome: no duplicated UI patterns remain.

### STORY (DSN-8) — Interaction, State & Feedback Polish

**As a user, I want the app to respond clearly to what I do, so that every action feels acknowledged and nothing feels frozen or silent.**
**Description:** Fixes the register's `interaction` findings — inconsistent or missing hover/focus/active/disabled states, jarring or absent transitions, spinner-vs-skeleton inconsistency, and toast/confirm-dialog inconsistency. Distinct from `DSN-4` (static visual styling) — this is behavior and feedback over time.
**Dependencies:** DSN-6. Complements DSN-4/DSN-5.

- **Task: Unify component interaction states** — Implement: apply consistent hover/focus/active/disabled treatments per `DSN` to the shared button/input/select/row primitives; ensure keyboard focus is always visible and RTL-correct. Constraints: primitive-level only. Outcome: predictable, uniform feedback on every interactive element.
- **Task: Standardize loading, transition & notification feedback** — Implement: converge on the shared loading/empty/error states (skeletons for lists, inline for actions), add restrained transitions per `DSN`, and make all toasts/confirms use the shared patterns wired to the `API` error model. Constraints: reuse EPIC 1 state components; no per-feature spinners. Outcome: consistent, calm feedback throughout.

### STORY (DSN-9) — Responsive & Mobile UX Remediation

**As a user on a phone or tablet, I want every screen to be fully usable, so that the "responsive" requirement holds in practice, not just in theory.**
**Description:** Fixes the register's `responsive` findings across all built routes at mobile/tablet breakpoints — sidebar collapse behavior (from `DSN-5`), dense tables that need a card/stacked view on small screens, touch-target sizing, and overflow/scroll issues, in both LTR and RTL.
**Dependencies:** DSN-5 (shell), DSN-6.

- **Task: Add responsive behavior to the shared table & layout patterns** — Implement: give the shared `DataTable`/list pattern a small-screen presentation (stacked/card or prioritized columns) and fix page-shell overflow at each breakpoint. Constraints: shared-pattern level so all lists inherit it; verify RTL. Outcome: list-heavy screens work on mobile everywhere at once.
- **Task: Per-screen responsive fixes & touch targets** — Implement: resolve remaining register `responsive` items (forms, side panels, dialogs, chart placeholders) and enforce minimum touch-target sizing via shared primitives. Constraints: styling/layout only. Outcome: no broken or cramped screen on mobile/tablet.

### STORY (DSN-10) — Forms & Data-Entry UX Remediation

**As a user filling in forms, I want clear, forgiving, consistent data entry, so that I always know what's expected and how to fix mistakes.**
**Description:** Fixes the register's `form` findings at the `FORM` foundation so every form inherits the improvement — validation timing (on-blur/submit, not aggressive on-change), readable localized error messaging, error summary + focus-to-first-error, logical field grouping/order, autofocus, and clear submit/loading/disabled states.
**Dependencies:** FORM-1, DSN-6.

- **Task: Improve validation & error UX in the shared form foundation** 🔑 (all forms inherit) — Implement: standardize validation trigger timing, localized (via `I18N`) inline messages, an error-summary + focus-first-error behavior, and consistent submit/pending/disabled states in the shared RHF+Zod field components. Constraints: change `FORM` shared components only; no per-feature validation. Outcome: every form in the app gets consistent, forgiving data-entry UX from one change.
- **Task: Field grouping, order & focus review** — Implement: apply the register's per-form layout/order/autofocus fixes using shared field components. Constraints: composition-level, no bespoke fields. Outcome: forms read logically and are keyboard-friendly.

### STORY (DSN-11) — Navigation & Information Architecture Review

**As a user, I want to always know where I am and how to get where I'm going, so that finding features and moving between them is effortless.**
**Description:** Fixes the register's `IA` findings — nav grouping/labels and active-state clarity (on the `DSN-5` sidebar), consistent page titles/breadcrumbs, discoverability of admin/config areas, and sane back/deep-link behavior. Preserves every existing permission-gated route exactly.
**Dependencies:** DSN-5, DSN-6.

- **Task: Refine navigation structure & wayfinding** — Implement: group/label sidebar items and make active/current state unambiguous; add consistent page titles/breadcrumbs via the shared shell. Constraints: presentation only — routes and `Can`-gates unchanged. Outcome: clear, learnable navigation.
- **Task: Fix IA discoverability & back/deep-link behavior** — Implement: resolve register items on hard-to-find admin/config surfaces and inconsistent back/deep-link handling. Constraints: no route logic changes. Outcome: features are discoverable and navigation is predictable.

### STORY (DSN-12) — Microcopy & Bilingual (AR/EN) Quality Review

**As an Arabic or English user, I want labels, empty states, and error messages that read naturally and mirror correctly, so that the product feels professionally localized, not machine-translated.**
**Description:** Fixes the register's `content` and `bilingual` findings — inconsistent terminology/tone, weak empty-state and error copy, and Arabic/English parity + RTL mirroring gaps. A professional bilingual pass over the `I18N` strings; complements `DSN-2`'s structural RTL checklist by focusing on language quality and parity.
**Dependencies:** I18N-1, DSN-6.

- **Task: Terminology, tone & empty/error copy pass** — Implement: standardize terminology and improve empty-state/error/confirmation copy in the `I18N` namespaces (both languages). Constraints: edit translation resources only; no hardcoded strings introduced. Outcome: consistent, helpful microcopy everywhere.
- **Task: Arabic/English parity & RTL correctness review** — Implement: verify every key exists and reads naturally in both languages and that AR mirrors correctly (icons, directionality, number/date rendering) per `I18N`; fix gaps. Constraints: content/direction only. Outcome: true bilingual parity, professionally localized.

### STORY (DSN-13) — Final UX Verification & Sign-off

**As a product team, we want to confirm the review actually closed the issues, so that we enter later features (AI, Integrations, Admin, Branding) on a clean, consistent UI baseline.**
**Description:** Re-walks the register to confirm every critical/major item is resolved with no regressions, across both languages/directions and both color modes. The "verify" bookend of the audit→fix→verify thread.
**Dependencies:** DSN-7, DSN-8, DSN-9, DSN-10, DSN-11, DSN-12.

- **Task: Verify register to zero open criticals & sign off** — Implement: re-check each `UX-AUDIT.md` finding on its screen in `ar`/RTL + `en`/LTR and light/dark; mark resolved, log any regressions as new items, and record sign-off. Constraints: verification + straggler fixes only. Outcome: a clean, consistent UI baseline for all later feature work.

### STORY (DSN-14) — Post-Sign-off UX Findings

**As a product team, we want a running home for UI/UX issues users report after `DSN-13`'s sign-off, so that real-world feedback keeps improving the baseline instead of needing a new story per finding.**
**Description:** Reported by users once the app was in real use, after `DSN-6`–`DSN-13`'s audit→fix→verify thread had already closed — not part of the original `DSN-6` register. Each distinct finding is its own `Task` below, added as it comes in; this story accumulates rather than closing after one pass.
**Dependencies:** DSN-13.

- **Task: Fix sidebar scroll visibility on long pages** — Implement: reported via screenshot of `/tickets/:id` (staff ticket detail), dark theme — scrolling down a long page's content scrolls the sidebar (`app/Sidebar.tsx`, rendered inside `RootLayout.tsx`) out of view along with it, instead of the sidebar staying pinned to the viewport while only `<main>` scrolls. Confirm the actual current scroll structure of `RootLayout.tsx`/`Sidebar.tsx` against the reported symptom first — `Sidebar.tsx`'s `<aside>` is `h-dvh` with an internal `overflow-y-auto` `<nav>`, which reads as intended to stay viewport-pinned, so whether `RootLayout.tsx` (or a shared ancestor) actually isolates scroll to `<main>` or lets the whole page scroll as one unit isn't yet diagnosed. Not yet confirmed whether this reproduces on other long staff pages (`/customers/:id`, `/knowledge-base/articles/:id/edit`, etc.) or only on ticket detail. Constraints: layout/CSS-only, no route or permission-gate changes; verify across the same route set `DSN-9`/`DSN-13` already covered. Outcome: the sidebar stays reachable no matter how far the page is scrolled.
- **Task: Strengthen action-button affordance app-wide (icon + color, not just Roles)** — Implement: originally reported via screenshot of `/roles` (Roles list) — a deletable role's Actions cell renders `RoleListPage.tsx`'s existing `<Button size="sm" variant="ghost">` delete action with no visible border/background, reading ambiguously next to a system role's bordered "System" `Badge` in the same column. **Broadened by a second screenshot**, a different list's Actions column showing 8 rows that each just read "Delete" in plain bold ghost-button text with zero visual differentiation row-to-row and no badge/color/icon at all — user's own direction: "make it with color or have also bin icon." Verified against current code — every `DataTable` "Delete"/destructive action across the app (`RoleListPage.tsx`, `CategoryListPage.tsx`, `TaskListPage.tsx`, `FaqListPage.tsx`, `ArticleListPage.tsx`, and others) uses the identical `<Button size="sm" variant="ghost">{t('...actions.delete')}</Button>` pattern — not broken, but uniformly low-affordance app-wide, not a Roles-specific gap. Give destructive row actions a real affordance via the shared `Button`/`DataTable` pattern — e.g. a trash/bin icon (`lucide-react`'s `Trash2Icon`, already the icon set this app standardizes on per `DSN-4`) and/or a destructive-tone color treatment, not just plain text — applied once at the shared level so every `DataTable` consumer inherits it, not a one-off per screen. Constraints: shared-component level; no new component library; preserve existing `useConfirm()` gating on every delete action untouched. Outcome: every destructive row action is visually distinct and unambiguous at a glance, app-wide.
- **Task: Re-evaluate reports/charts on a real charting library** — Implement: reported via screenshot of `/reports/tickets` (Ticket Reports, "Ticket volume over time") — user's own words: "all reports not good want to use best lib to charts and reports". Verified against current code: every chart in the app (`LineChart`, `BarChart`, `GaugeChart`, `WaffleChart`, `ChartDataTable`, all under `frontend/src/shared/ui/chart/`) is hand-built inline SVG with no charting library dependency at all (`frontend/package.json` has no `recharts`/`chart.js`/`visx`/`d3`/`nivo` or similar) — `DSN-3`'s chart-type guidance (`CONVENTIONS.md` § 25) picked chart _types_ per report but never evaluated adopting a real charting library for the _implementation_. This is a genuine "no new dependency" decision, the same category `UX-018` (Story 65) deferred rather than assumed — needs a product decision on which library (e.g. `recharts`, `visx`, `chart.js`) before a rebuild is planned, weighed against a possible narrower fix (polish the existing hand-built `LineChart`'s rendering — e.g. `/reports/tickets`'s "Last 30 days" default currently plots ~28 zero-value points before a 2-point spike, which reads as broken/empty at a glance) if a full library swap turns out to be disproportionate. Outcome: a scoped decision — adopt a charting library (and which one) or polish current charts — recorded before any rebuild starts, not silently assumed.
- **Task: Shrink the sidebar footer and move theme/language into a real settings surface** — Implement: reported via screenshot of the `Sidebar.tsx` footer block (`RootLayout.tsx`'s sidebar, bottom section) — user wants the notification-bell/email/language/theme/logout block made visually smaller, and wants a dedicated settings page to host the dark-mode toggle and language switcher instead of the sidebar footer, which should then drop them. Verified against current code: the footer (`Sidebar.tsx` lines 285-311) is 3 stacked rows (`NotificationBell` + email; `LanguageSwitcher` + `ThemeToggle`; the `Log out` button), each with its own `gap-3`/`p-3` padding — the visual bulk the screenshot shows. **Constraint that must be resolved before implementing, not assumed:** the only existing `/settings` route (`features/organization/components/SettingsPage.tsx`) is an **org-admin** form (name/logo/departments/branches/SLA targets) gated behind `settings.manage` — most staff users can't reach it, so moving a personal preference like theme/language there as-is would make it unreachable for non-admins. This needs either a new, ungated **user-preferences** page (or a tab/section within a broader settings area open to every authenticated user, separate from the admin-only org config) — not simply appending fields to the existing gated form. Constraints: preserve the theme/language state mechanism already in place (`ThemeToggle`/`LanguageSwitcher`, `i18n`/local storage), only relocate + restyle; no permission-gate regression (the new surface must stay open to every authenticated user, unlike `/settings`). Outcome: a visually lighter sidebar footer (bell, email, logout only) and a real, universally-reachable place for personal display preferences.
- **Task: Audit `Badge`/tag color usage app-wide for consistency** — Implement: user's own direction: "see all colors in tags please add comments with realted task" — a request to review every `Badge` usage across the app, not a specific defect reported yet. Verified against current code (not yet a full audit): the shared `badge.tsx` primitive (`frontend/src/shared/ui/primitives/badge.tsx`) declares 9 variants — `default`, `secondary`, `destructive`, `success`, `warning`, `info`, `outline`, `ghost`, `link` — added incrementally across `DSN-4` (semantic status/priority color-coding) and later stories; no single pass has re-walked every current `Badge` call site (ticket status/priority, task state, article draft/published, role "System", audit-log action, SLA breach state, etc.) to confirm each still picks the semantically correct variant and that no two unrelated meanings share the same color by coincidence. Walk every `<Badge variant="...">` call site app-wide and confirm/correct variant choice against its actual semantic meaning (success = positive/resolved, warning = at-risk, destructive = breached/error, etc.), consistently. Constraints: shared-component level where a systemic mismatch is found; no new badge variant unless a real semantic gap is proven, matching `DSN-4`'s own original bar. Outcome: every tag/badge color in the app is semantically correct and consistent, confirmed by an actual walk of every call site, not assumed.
- **Task: Style primary-column table links so they read as links** — Implement: reported via screenshot of `/categories` (Category list), "Name" column — "Account Access", "Billing", "Bug Report", "Feature Request" render as plain white text with no color/underline; user's own words: "this is link but as ui ux i dont know that so can make it color or anything". Verified against current code: `CategoryListPage.tsx:48` renders `<Link to={...}>{row.name}</Link>` with no `className` at all — Tailwind's Preflight reset strips the browser's default link underline/color, so with nothing added back it's visually indistinguishable from static text. **Confirmed app-wide, not category-specific:** the identical bare, unstyled `<Link to=...>{row.field}</Link>` pattern (in a `DataTable` primary-column `cell`) also exists in `TaskListPage.tsx`, `FaqListPage.tsx`, `PortalTicketHistoryPage.tsx`, `PortalTicketListPage.tsx`, `CustomerListPage.tsx`, `MyTicketsPage.tsx`, `TicketListPage.tsx`, `RoleListPage.tsx`, `UserListPage.tsx` (a literal grep match — likely not fully exhaustive; `ArticleListPage.tsx`'s multi-line variant of the same pattern wasn't caught by the grep but should be checked too). Give every `DataTable` primary-column link a real, consistent link affordance (e.g. `text-primary` + `hover:underline`, or an underline by default) at the shared level — ideally a small shared style/class applied once, not 10+ per-file edits — so every consuming list inherits it. Constraints: shared-component/CSS-utility level preferred; preserve every existing `to`/route target exactly; verify contrast holds in both light/dark. Outcome: every clickable table-cell link is visually recognizable as a link, everywhere in the app, from one change.

### STORY (DSN-15) — Form Presentation: Dialog vs Full Page

**As a user, I want a short form to open in place rather than throwing me onto another screen, so that I keep my list, my filters and my scroll position.**
**Description:** Verified against current code, and the imbalance is total: the app has **17 full-page form routes** — `RoleFormPage`, `UserFormPage`, `CustomerFormPage`, `ArticleFormPage`, `CategoryFormPage` (two of them), `FaqFormPage`, `BranchFormPage`, `DepartmentFormPage`, `LandingHighlightFormPage`, `LandingSocialLinkFormPage`, `PortalFeedbackFormPage`, `PortalTicketFormPage`, `TaskFormPage`, `TicketFormPage`, `WebFormPage`, `WebhookSubscriptionFormPage` — and **zero** dialogs anywhere in `features/`. The `dialog.tsx` primitive exists and is fully built, but its only consumer in the entire codebase is `shared/ui/confirm/ConfirmProvider.tsx`; no form has ever used it. So a two-field form like Department (name + description) or Category (name) costs a full route change, a fresh page mount, and the loss of the list's filters and scroll position — the same cost as editing a whole ticket. `DSN-10` fixed validation and error UX _inside_ forms and never asked where a form should appear; `DSN-11` reviewed navigation structure, not form presentation. This is the uncovered half.
**Dependencies:** DSN-10, DSN-11, `UI`, `FORM`.

- **Task: Decide and document the presentation rule** 🔑 (every later form follows it) — Establish, and record in `CONVENTIONS.md` beside the `FORM` conventions, when a form is a **dialog** (few fields, single entity, no nested navigation — e.g. Category, Department, Branch, FAQ, Quick Reply, Landing highlight/social link), when it stays a **full page** (many fields, multi-section, file upload, or a form a user deep-links and shares — e.g. Ticket, Article, User, Webhook subscription), and whether a **sheet/drawer** tier is worth introducing at all for the middle ground. Constraints: this is a written rule with worked examples, not per-screen taste; decide the sheet question explicitly rather than leaving it open — a third tier nobody can define the boundary of is worse than two clear ones. Outcome: a rule any future form obeys without re-litigating it.
- **Task: Shared `FormDialog` pattern** 🔑 (all dialog forms inherit) — Build one shared wrapper over the existing `dialog.tsx` primitive that composes with `FORM` (RHF+Zod) and inherits every `DSN-10` behaviour — validation timing, error summary, focus-to-first-error, submit/pending/disabled states — so a dialog form is not a second, weaker form implementation. Constraints: **must not fork `FORM`**; correct focus trap and initial-focus per `DSN-2`; RTL-correct per `I18N`; `Escape`/overlay-dismiss must run the same unsaved-changes guard as a cancel button, never silently discard input. Outcome: a dialog form is exactly as good as a page form, from one component.
- **Task: Migrate the qualifying forms, without breaking their routes** — Convert the forms the rule classifies as dialogs, opening them over their list screen. Constraints, and this is the load-bearing one: **the existing routes must keep working.** `/categories/new`, `/departments/:id/edit` and friends are bookmarkable, shareable, and reachable from `DSN-11`'s navigation — a direct hit on one of those URLs must still render the form (over its list, or standalone), and closing the dialog must restore the list URL rather than pushing a dead history entry. Preserve every existing permission gate and `useConfirm()` interaction untouched. Outcome: short forms open in place while every existing URL, deep link and back-button path still behaves.
- **Task: Verify against the surfaces this affects** — Re-check the migrated screens for the register's existing concerns: mobile behaviour per `DSN-9` (a dialog on a 375px viewport is a different problem from a dialog on a desktop), keyboard-only operation, and screen-reader announcement of the dialog. Constraints: reuse `DSN-13`'s verification route set; no new audit register. Outcome: the new pattern is confirmed on real screens, not assumed from the component.

### STORY (DSN-16) — Motion Completion & Micro-Interaction Craft

**As a user, I want the interface to respond with motion that feels considered rather than absent, so that state changes read as cause and effect instead of sudden replacement.**
**Description:** `MOTION-0` delivered the foundation and it is genuinely good — a documented 150/200/300ms scale plus `--motion-reveal` (`frontend/src/index.css`), a single `prefers-reduced-motion: reduce` policy, and `Reveal` promoted to `shared/ui/Reveal.tsx`. What it did **not** finish is its own third task, the app-wide micro-interaction pass. Measured across the shared primitives: `dialog.tsx` carries **1** duration/motion reference, `dropdown-menu.tsx` **2**, `select.tsx` **2**, `ToastProvider.tsx` **1**, and `ConfirmProvider.tsx` **0**. There is **no route or page transition anywhere** — a grep of `app/` for any transition mechanism returns nothing, so every navigation is an instant hard swap. There are also no `sheet`, `popover` or `tooltip` primitives at all, so three of the surfaces `MOTION-0`'s task list named do not yet exist to animate. This story finishes the pass to a senior bar and is explicitly **not** a licence to add decorative animation.
**Dependencies:** MOTION-0, DSN-8, `UI`.

- **Task: Finish the primitive-level motion pass** — Apply the motion tokens to every shared primitive that still has none or nearly none: dialog and alert-dialog enter/exit, dropdown, select, tabs, checkbox/switch/radio state changes, button press feedback, and the confirm dialog (currently zero). Constraints: **shared-component level only** — animate the primitive once so every consumer inherits it, never per feature screen; **transform and opacity only**, never animating layout properties (width/height/top/left) which force reflow and drop frames; nothing exceeds the 300ms ceiling `MOTION-0` set; nothing moves under `prefers-reduced-motion: reduce`. Outcome: every interactive primitive responds visibly, from one change set.
- **Task: Route and page transition** — Introduce a single, restrained route transition so navigation reads as movement rather than replacement. Constraints: it must **never delay perceived interactivity** — content is interactive the moment it paints, the transition is decoration over it, not a gate in front of it; must not fight `DSN-8`'s pending/skeleton states or double up with them; must be direction-correct under RTL per `I18N`; check the browser View Transition API and what React Router already offers before adding any dependency (`CONVENTIONS.md` § 0/§ 17), matching the constraint `LAND-1` and `MOTION-0` were both given. Outcome: navigation feels continuous instead of abrupt.
- **Task: Data-state motion — lists, tables and loading** — Animate the transitions the app makes constantly and currently makes instantly: skeleton→content handoff (cross-fade, not a hard swap), row enter/exit when a list filters or a `TKT-7` bulk action removes rows, optimistic-update settle, and empty→populated state changes. Constraints: motion must be **cheap at list scale** — a 25-row table must not animate 25 elements independently if a container-level transition reads the same; must not shift layout while a user is reading or clicking; reuse `DSN-8`'s existing state components rather than introducing parallel ones. Outcome: data changes read as changes, not as flicker.
- **Task: Motion quality pass** — Walk the whole app and verify the result to a craft standard rather than a checklist: no animation exceeding its token's duration, no two overlapping animations fighting for the same element, no motion on an element the user is actively interacting with, no cumulative layout shift introduced, correct behaviour in both LTR and RTL, and a genuine full stop under `prefers-reduced-motion: reduce` (not merely a shortened duration). Constraints: reuse `DSN-13`'s verification route set; record any deliberate exception in `CONVENTIONS.md` beside the motion tokens. Outcome: motion that a senior front-end reviewer would sign off, verified on real screens.

### STORY (DSN-17) — Measured Colour & Contrast Audit (Light + Dark)

**As any user — including one with low vision — I want every colour in both themes to be genuinely legible, so that the theme I choose does not decide whether I can read the app.**
**Description:** `DSN-4` and `DSN-5` chose the palette and the dark theme; `DSN-2` produced accessibility _guidelines_. Neither ever **measured** the shipped tokens pair by pair, and measurement finds real failures. `--primary` (`#2563EB`) is defined identically in both themes (`frontend/src/index.css`, commented "same as :root"), and it is used as **text** via `text-primary` in 34 places — every `DataTable` link, "Forgot password?", every auth link. Measured against WCAG 2.x, where AA body text requires **4.5:1**: on the dark `--background` (`#0A1018`) it reaches **3.69:1**, and on the dark `--card` (`#171D26`) only **3.28:1** — both fail. `--secondary` (`#64748B`) as text on a dark card measures **3.56:1** and also fails. The token was verified for its _button-fill_ use (white on blue, ≈8.6:1) and never for its _text_ use, and dark mode is the default in every shipped screenshot. Separately, an org-supplied brand colour overrides `--primary` with no bound in the text direction: a corporate navy (`#1E3A8A`) renders links at **1.81:1** in dark mode, and the pink currently shipped (`#E879F9`) fails in _light_ mode at **2.35:1**. Those two specific failures are fixed by `bugs/101` (F-5/F-6 in `QA-REPORT-1.md`); **this story is the systematic pass that finds the rest**, and the two must not duplicate each other.
**Dependencies:** DSN-4, DSN-5, DSN-2, `bugs/101`.

- **Task: Measure every token pair in both themes** — Walk every semantic token (`foreground`, `muted-foreground`, `primary`, `secondary`, `destructive`, `success`, `warning`, `info`, `border`, `ring`, and each `-foreground` partner) against every surface it is actually rendered on (`background`, `card`, `popover`, `muted`, and each solid fill), in **both** light and dark, and record the computed ratio next to each token — the convention `index.css` already follows for `--success-foreground` (`/* 6.37:1, verified */`) but applies to only a handful. Constraints: measure the shipped values, do not re-derive the palette; distinguish the AA thresholds correctly — 4.5:1 body text, 3:1 large text, 3:1 non-text/UI boundaries — since applying 4.5:1 to a border is as wrong as applying 3:1 to body copy. Outcome: a complete, recorded contrast matrix instead of spot checks.
- **Task: Fix every measured failure** — Correct the pairs that fail, at token level. Constraints: the likely shape is **separating the "colour as fill" token from the "colour as text" token** rather than darkening or lightening one value and breaking the other use — `bugs/101` establishes exactly that split for `--primary`; extend the same approach to any other token the matrix condemns rather than inventing a second mechanism. No call-site-by-call-site colour overrides; every fix lands in `index.css` and is inherited. Outcome: no token pair in either theme fails its applicable AA threshold.
- **Task: Bound the org-supplied brand colour in both directions** — `shared/branding/contrast.ts`'s `foregroundFor()` already picks black or white for text **on** the brand colour, which is correct and stays; what is unbounded is the brand colour used **as** text on the page. Derive a theme-appropriate text variant by clamping lightness per theme, validate `primary_color` server-side, and warn the admin in Organization Settings when their chosen colour cannot reach 4.5:1 in either theme. Constraints: an admin must never be able to make the app unreadable by entering a legitimate corporate colour; keep `foregroundFor()`'s existing button behaviour untouched. Outcome: any brand colour an organization can enter produces a legible app in both themes.
- **Task: Make contrast a standing check, not a one-off** — Add a contrast assertion to the same gate set as `npm run check:rtl` — a script that recomputes the matrix from `index.css` and fails on a regression. Constraints: reuse the existing script/gate pattern in `frontend/scripts/`, no new toolchain; it must run without a browser so it can gate in CI. Outcome: the next token added or edited cannot silently reintroduce a failure, which is exactly how the current ones arrived.

---

# EPIC 9 — Knowledge Base

**Description:** FAQs, help articles/guides, and search — powering self-service and AI suggestions later. Built on the `DSN` design system from EPIC 8.
**Depends on:** foundations, AUTH-2, Design Intelligence (`DSN`).

### STORY (KB-1) — FAQs

- **Task: `FAQ` model + API** — Implement CRUD (admin) reusing `AUTHZ`. Outcome: FAQ management.
- **Task: FAQ UI** — Implement admin + display views reusing primitives/`I18N`. Outcome: browse FAQs.

### STORY (KB-2) — Help Articles & Guides

- **Task: `Article` model + API** — Implement rich-text articles (category, status, bilingual fields). Outcome: article store.
- **Task: Article editor + reader UI** — Implement editor (admin) + reader reusing primitives. Outcome: publish/read guides.

### STORY (KB-3) — Knowledge Base Search

**Dependencies:** KB-1, KB-2.

- **Task: Full-text search API** 🔑 (reused by AI suggestions) — Implement Postgres full-text search across FAQs/articles. Outcome: ranked search + reusable retrieval for AI.
- **Task: Search UI** — Implement search + results reusing primitives/states. Outcome: quick answer discovery.

---

---

# EPIC 10 — Customer Portal

**Description:** Self-service portal — submit/track tickets, history, FAQs, feedback. Reuses ticket, KB, and messaging foundations with customer-scoped access.
**Depends on:** Ticket Management, Knowledge Base, AUTH-2.

### STORY (PORTAL-0) — Portal Access & Customer Auth

- **Task: Customer auth + scoped access** 🔑 — Implement customer login and a scoping rule limiting portal data to the logged-in customer (reuse `AUTHZ`). Outcome: secure customer boundary reused by all portal stories.
- **Task: Portal shell UI** 🔑 — Implement portal layout (bilingual/RTL, responsive) reusing `UI`/`I18N`. Outcome: portal frame for all portal features.

### STORY (PORTAL-1) — Submit Tickets

**Dependencies:** PORTAL-0, TKT-1.

- **Task: Customer-scoped create API + UI** — Reuse ticket create + `FORM`. Outcome: customers open tickets.

### STORY (PORTAL-2) — Track Requests

**Dependencies:** PORTAL-0.

- **Task: Scoped ticket list/detail + UI** — Reuse ticket API (scoped) + shared table/states. Outcome: live status tracking.

### STORY (PORTAL-3) — View History

**Dependencies:** PORTAL-2.

- **Task: Historical tickets view** — Extend scoped list with closed tickets. Outcome: past-request history.

### STORY (PORTAL-4) — Access FAQs

**Dependencies:** PORTAL-0, KB-1/2.

- **Task: KB in portal** — Surface KB content within the portal shell. Outcome: self-service answers.

### STORY (PORTAL-5) — Submit Feedback (CSAT)

**Dependencies:** PORTAL-2.

- **Task: `Feedback`/CSAT model + API + form** 🔑 (feeds Reports CSAT) — Implement post-resolution rating + comment via `FORM`. Outcome: satisfaction capture reused by reporting.

---

---

# EPIC 11 — Reports & Analytics

**Description:** Ticket, SLA, agent, and CSAT reporting plus management dashboards — built on a shared reporting/aggregation foundation.
**Depends on:** Ticket Management, SLA, Portal (CSAT).

### STORY (RPT-0) — Reporting Foundation

- **Task: Aggregation + export utilities** 🔑 (reused by all reports) — Implement shared query/aggregation helpers + CSV/export and a reusable chart wrapper (reusing `UI`). Outcome: one reporting pattern for all reports.

### STORY (RPT-1) — Ticket Reports

- **Task: Ticket metrics API + report UI** — Volume/trends by status/category/channel/time using RPT-0. Outcome: ticket analytics.

### STORY (RPT-2) — SLA Performance

**Dependencies:** SLA-1.

- **Task: SLA metrics API + report UI** — Response/resolution times, breach rates via RPT-0. Outcome: SLA analytics.

### STORY (RPT-3) — Agent Performance

- **Task: Agent metrics API + report UI** — Handled/resolution time/CSAT per agent via RPT-0. Outcome: agent analytics.

### STORY (RPT-4) — Customer Satisfaction

**Dependencies:** PORTAL-5.

- **Task: CSAT metrics API + report UI** — Aggregate satisfaction trends via RPT-0. Outcome: CSAT analytics.

### STORY (RPT-5) — Management Dashboards

**Dependencies:** RPT-1..4.

- **Task: Combined KPI API + dashboard UI** — Open tickets, SLA health, CSAT, agent load in one dashboard reusing RPT-0 charts. Outcome: at-a-glance overview.

---

---

# EPIC 12 — Security & Administration

**Description:** User/role administration UI, permission management, audit logs, system configuration, and the full account-credential lifecycle (invitation, password recovery, password change, deletion) over the `AUTHZ` foundation. Builds on the reusable activity-log pattern. `SEC-5` through `SEC-8` were absorbed from a short-lived, now-removed `Account Lifecycle`/`Password Self-Service` epic — every one of them is a `User`-account concern, so they live here rather than split across a separate epic.
**Depends on:** EPIC 2, SLA-4 (email delivery, for `SEC-5`/`SEC-7`), FORM.

### STORY (SEC-1) — Users & Roles Admin

- **Task: User/role admin API + UI** — Implement management screens over `AUTHZ` models. Outcome: manage users/roles.

### STORY (SEC-2) — Permissions Management

**Dependencies:** SEC-1.

- **Task: Permission config API + UI** — Implement role→permission mapping UI enforced by `AUTHZ`. Outcome: granular access control.

### STORY (SEC-3) — Audit Logs

- **Task: Audit-log service + viewer** 🔑 (reuses activity-log pattern) — Implement immutable logging of sensitive actions + filtered viewer. Outcome: traceability.

### STORY (SEC-4) — System Configuration

- **Task: Settings model + admin UI** 🔑 (backs branding/departments/branches/SLA defaults) — Implement central configurable settings. Outcome: org-level configuration.

### STORY (SEC-5) — New User Invitation & First-Login Password Setup

**As a newly-added staff member, I want to set my own password the first time I sign in, so that my credentials are never known to anyone else.**
**Description:** Moved here from the former `Account Lifecycle & Credential Management` epic (was `ACCT-1`) — it extends this epic's own `SEC-1` screen directly. Verified gap: `UserAdminSerializer`/`UserFormPage.tsx`'s create form has a required `password` field the _admin_ fills in directly — there is no invite email, no temporary/forced-reset password, and no self-service "set your password" step. The admin ends up knowing (and having to relay out-of-band) every new user's first password. This story replaces that with an invite: the admin creates the account with no password, the new user gets a signed, time-limited "set your password" link by email, and the account stays unusable until they do.
**Dependencies:** SEC-1, SLA-4 (email delivery), AUTH-1.

- **Task: Backend invite issuance & first-password-set endpoint** 🔑 (the token mechanism the `Password Self-Service` epic's forgot-password story reuses) — Implement `UserAdminSerializer`'s create path so a new `User` is created with an unusable password and `is_active=False` (or an equivalent "pending" state) until first login is completed; issue a signed, time-limited invite token sent via `SLA-4`'s email delivery; add a confirm endpoint (token + new password) that sets the password and activates the account, through the standard `API` envelope/error model. Constraints: token single-use and expiring; reuse `SLA-4`'s email delivery — no second email-sending mechanism. Outcome: a new account is unusable until its owner sets their own password.
- **Task: Frontend invite-confirm UI & admin-form update** — Implement a "set your password" page (opened from the emailed link) via `FORM`; update `UserFormPage.tsx`'s create form to drop the direct `password` field, since the admin no longer sets one. Outcome: admins create accounts without ever handling a new user's password.

### STORY (SEC-6) — User Account Deletion

**As an admin, I want to permanently delete a user account, so that stale or mistaken accounts don't linger indefinitely.**
**Description:** Moved here from the former `Account Lifecycle & Credential Management` epic (was `ACCT-4`) — it extends this epic's own `SEC-1` screen directly. `SEC-1` deliberately shipped deactivation-only for `User` — a hard `DELETE` would cascade onto `agents.Task.owner` and `notifications.Notification.recipient` (both `on_delete=CASCADE`), silently destroying unrelated data (see `security-administration/48-story-users-roles-admin-SUPPORTOS-72.md`'s own verified finding). Verified against every FK to `User` in the codebase — `Task.owner`/`Notification.recipient` are the _only_ two `CASCADE` relationships; every other reference (`Customer.user`, `Note.author`, `Attachment.uploaded_by`, `Ticket.assigned_agent`, `TicketActivity.actor`, `InternalNote.author`, `AssignmentRule.last_assigned_agent`, `AuditLog.actor`/`target_user`) is already `SET_NULL` and safe. This story completes the lifecycle by adding a _safe_ delete path instead of leaving deactivation as the permanent ceiling.
**Dependencies:** SEC-1.

- **Task: Safe user-deletion backend flow** — Implement a delete action on `UserViewSet` that first reassigns or nullifies the target's owned `Task` and `Notification` rows (or blocks the delete with a clear error while unhandled dependent records exist — a product decision to confirm before building), writes an audit-log entry via `SEC-3`'s pattern recording the deletion and what happened to dependent data, then removes the `User` row. Constraints: reuse `AUTHZ` permissions, `API` envelope, `SEC-3`'s audit-log pattern; must never silently cascade-delete a customer's own ticket/interaction history through any indirect FK. Outcome: a user can be permanently removed without silently destroying unrelated data.
- **Task: Delete-user UI & confirmation** — Implement a destructive "Delete" action on the Users admin screen (`SEC-1`) with a confirmation dialog (reusing the shared confirm pattern) that states plainly what happens to the user's owned tasks/notifications before the irreversible action proceeds. Outcome: admins remove accounts with an explicit, informed confirmation.

### STORY (SEC-7) — Forgot Password / Self-Service Reset

**As a user, I want to reset my own password when I forget it, so that I'm not locked out waiting on an admin.**
**Description:** Moved here from the now-removed `Password Self-Service` epic (was `ACCT-1`). `AUTH-1` shipped login/refresh/logout only; `LoginPage`'s current "Locked out or forgot your password? Ask an admin to reset it" copy is the whole story today. This story adds a real self-service flow: request a reset by email, receive a time-limited link, set a new password. Shares its token mechanism with `SEC-5`'s invite flow — one signed-token utility, two triggers (admin invite vs. self-service "forgot").
**Dependencies:** AUTH-1, SLA-4, SEC-5 (reuses its token utility).

- **Task: Backend password-reset request & confirm endpoints** — Implement a request-reset endpoint (email → signed, time-limited token, sent via `SLA-4`'s existing email delivery, reusing `SEC-5`'s token utility) and a confirm-reset endpoint (token + new password) through the standard `API` envelope/error model. Constraints: rate-limit the request endpoint; never reveal whether an email is registered; no second token/email mechanism. Outcome: secure, working self-service password reset.
- **Task: Frontend forgot/reset password UI** — Implement a "Forgot password?" link on `LoginPage` → request form (`FORM`) → a confirmation screen, plus a reset-confirm page (opened from the emailed link) to set a new password. Constraints: reuse `FORM`/`UI`/`I18N`; update `LoginPage`'s existing admin-reset copy once this ships. Outcome: users recover access without admin involvement.

### STORY (SEC-8) — Change Password

**As a signed-in user, I want to change my own password, so that I can update my credentials without having to forget them first.**
**Description:** Moved here from the now-removed `Password Self-Service` epic (was `ACCT-2`). Verified gap: `PreferencesPage.tsx` (the personal, ungated settings screen every authenticated user reaches) has only language and theme — no password field at all. This is the one credential action that doesn't require a token/email round-trip, since the user is already authenticated; it belongs beside `SEC-7`, not folded into it.
**Dependencies:** AUTH-1, FORM.

- **Task: Change-password endpoint** — Implement a `POST` action (current password + new password) on the authenticated user's own account, through the standard `API` envelope/error model. Constraints: require the current password; reuse `AUTHZ`'s existing password-hashing/validation, no new mechanism. Outcome: a signed-in user can change their password directly.
- **Task: Change-password UI in Preferences** — Add a change-password form to `PreferencesPage.tsx` via `FORM`, alongside the existing language/theme controls. Outcome: one place for every personal account setting, credentials included.

### STORY (SEC-9) — Two-Factor Authentication (2FA)

**As an administrator, I want staff accounts protected by a second factor, so that a leaked password alone cannot expose customer data.**
**Description:** Verified gap: the backlog has no second-factor story anywhere, and `AUTH-1`'s JWT flow authenticates on password alone. Every staff account in this product can read customer PII, ticket history and conversation transcripts, so a stolen or reused password is a complete compromise of that data. `SEC-7`/`SEC-8` cover changing and resetting a password, not proving a second factor.
**Dependencies:** AUTH-1, SEC-1, FORM.

- **Task: TOTP enrolment & verification** — Implement time-based one-time-password enrolment (shared secret + QR provisioning URI) and a verification step inserted into the existing token-issue flow, so a 2FA-enabled account exchanges credentials for a short-lived challenge rather than a token pair. Constraints: extend `AUTH-1`'s existing token views — do **not** build a second auth flow (`AUTHZ`, `CONV`); secrets stored encrypted and never returned after enrolment. Outcome: staff accounts can require a second factor at sign-in.
- **Task: Recovery codes & account-recovery path** — Implement single-use recovery codes issued at enrolment, plus an admin-side reset for a user who has lost their device. Constraints: recovery-code use and admin reset both write to `SEC-3`'s audit log; an admin reset must never reveal the secret. Outcome: 2FA cannot permanently lock a legitimate user out.
- **Task: 2FA UI + org-level enforcement policy** — Add enrolment/disable to `PreferencesPage.tsx` via `FORM`, and an org setting (via `SEC-4`) to require 2FA for chosen roles. Constraints: reuse `UI`/`I18N`; enforcement is per-role, not global, so portal customers are unaffected. Outcome: an organization can mandate 2FA for staff while leaving portal logins simple.

### STORY (SEC-10) — Data Retention & Data-Subject Rights (PDPL / GDPR)

**As a compliance owner, I want retention limits and a way to export or erase a person's data, so that the product can be operated lawfully.**
**Description:** Verified gap: no retention, anonymization, export or erasure story exists anywhere in this backlog. The system stores customer names, emails, phone numbers, conversation transcripts and attachments indefinitely, with no defined lifetime. `SEC-6` deletes a **staff** user account; it does not address a **customer's** personal data, which is the regulated category. Saudi PDPL — and GDPR for any EU-resident contact — both require a defined retention period and a means of honouring access and erasure requests.
**Dependencies:** SEC-3, SEC-4, CUST-1, SLA-0.

- **Task: Retention policy + scheduled purge/anonymization job** — Implement configurable retention periods per data class (closed tickets, conversation messages, attachments, audit entries) and a scheduled job (via `SLA-0`) that anonymizes or purges past the limit. Constraints: anonymize in place where a record must survive for reporting, so `RPT-*` aggregates do not break; purging is irreversible and audited. Outcome: personal data has a defined, enforced lifetime.
- **Task: Data-subject export & erasure for a customer** — Implement an admin action producing a machine-readable export of everything held about one `Customer` (profile, tickets, messages, attachments, feedback), and a corresponding erasure action. Constraints: gate on a dedicated permission via `AUTHZ`; both actions write to `SEC-3`'s audit log; erasure must respect any legal-hold or retention override. Outcome: access and erasure requests can be honoured without direct database work.

---

---

# EPIC 13 — AI Features

**Description:** AI assistance — ticket summaries, suggested replies, auto-categorization, suggested solutions, and a customer chatbot. Built on a shared AI-service foundation grounded in the knowledge base.
**Depends on:** Ticket Management, Knowledge Base, Communication Channels.

### STORY (AI-0) — AI Service Foundation

- **Task: AI provider client + prompt/util layer** 🔑 (reused by all AI stories) — Implement one server-side AI client (keys via `ENV`), shared prompt-building utilities, and KB grounding via KB-3 search. Constraints: single AI integration point; features call it, don't re-integrate. Outcome: reusable AI foundation.

### STORY (AI-1) — Ticket Summaries

- **Task: Summary endpoint + UI action** — Summarize ticket conversation via AI-0; add "summarize" action in ticket detail. Outcome: quick ticket comprehension.

### STORY (AI-2) — Suggested Replies

**Dependencies:** AI-0, COMM-0.

- **Task: Suggested-reply endpoint + UI** — Draft replies from ticket + KB context; surface in shared conversation view. Outcome: faster quality replies.

### STORY (AI-3) — Automatic Categorization

**Dependencies:** AI-0, TKT-2.

- **Task: AI categorization on intake** — Auto-tag category/priority (agent-overridable) via AI-0. Outcome: less manual triage.

### STORY (AI-4) — Suggested Solutions

**Dependencies:** AI-0, KB-3.

- **Task: Solution-suggestion endpoint + panel** — Match ticket to KB solutions; show panel in ticket detail. Outcome: faster resolutions.

### STORY (AI-5) — AI Chatbot

**Dependencies:** AI-0, KB-3, PORTAL-0.

- **Task: Chatbot backend (grounded + handoff)** — Implement KB-grounded chatbot with human/ticket handoff via AI-0. Outcome: instant self-service.
- **Task: Chatbot widget** — Implement portal widget reusing conversation UI. Outcome: customer-facing bot.

---

---

# EPIC 14 — Integrations

**Description:** Public API, ERP, messaging-provider config, and outbound webhooks — reusing existing endpoints and provider config patterns.
**Depends on:** foundations, relevant domains.

### STORY (INT-1) — Public REST API & Docs

- **Task: API keys/token auth + OpenAPI docs** 🔑 — Implement external auth (API keys) reusing `AUTHZ` + generate Swagger/OpenAPI. Outcome: documented external API.

### STORY (INT-2) — ERP Integration

**Dependencies:** CUST-1, SLA-0.

- **Task: ERP sync service + config UI** — Implement import/export sync (async via SLA-0) with field mapping + config. Outcome: customer/order sync.

### STORY (INT-3) — Messaging Providers Config

**Dependencies:** COMM-1/2/4.

- **Task: Provider config models + UI** 🔑 — Implement secure central config for email/SMS/WhatsApp credentials reused by channel adapters. Outcome: one place to connect channels.

### STORY (INT-4) — Outbound Webhooks

**Dependencies:** SLA-0.

- **Task: Webhook subscriptions + dispatch + UI** — Implement event subscriptions firing async on domain events. Outcome: external systems notified.

---

---

# EPIC 15 — Public Landing Page

**Description:** A real front door for the product — right now `/` is gated by `RequireAuth` with no public route in between, so a signed-out visitor opening the app lands straight on the bare login form with zero introduction to what SupportOS is. Confirmed live: `PublicLayout` (`/login`, `/reset-password`, ...) exists but is a minimal centered-card shell, not a landing page — no route currently renders anything else for a visitor. `LAND-1` ships that first front door, but every word on it starts out frozen in the frontend bundle: `features/landing/components/LandingPage.tsx` renders entirely from `features/landing/locales/{en,ar}.json`, with no API call at all, and its four feature cards come from a hard-coded `FEATURES` array pairing fixed `lucide-react` icons to fixed keys — changing a single line of marketing copy is a code change, a rebuild and a deploy, and there is no social or contact presence anywhere on the page either. The rest of this epic (`LAND-2`–`LAND-4`, `MOTION-0`) makes the landing page an admin-editable surface, gives it a real visual identity beyond the `LAND-1` skeleton, and extracts the motion `LAND-1` improvised (`Reveal.tsx`, `animate-in fade-in slide-in-from-bottom-4`) into a reusable foundation the whole app can use.
**Depends on:** `UI`, `I18N` (EPIC 1), `DSN` (EPIC 8), SEC-4, ORG-3 (EPIC 16).

### STORY (LAND-1) — Animated Public Landing Page

**As a visitor, I want a polished landing page with a warm, animated introduction before I ever see a login form, so that my first impression of SupportOS matches the quality of the product itself.**
**Dependencies:** `UI`, `I18N`.

- **Task: Landing page content & layout** — Implement a genuinely public `/` route (reachable with no session) with a hero section (name, one-line value proposition, primary "Log in" / "Get a demo" calls to action), a handful of feature highlights (omni-channel tickets, SLA automation, AI-assisted replies, reporting), reusing `UI` design tokens and `I18N` for full Arabic/English + RTL support. Constraints: reuse `PublicLayout`'s "no staff chrome" precedent rather than a third shell type. Outcome: an unauthenticated visitor sees a real introduction, not a bare form.
- **Task: Entrance motion & micro-interactions** — Add tasteful, not-gratuitous motion: a hero entrance animation, scroll-triggered reveals for the feature sections, subtle hover states on CTAs. Constraints: prefer CSS transitions/Tailwind (CONVENTIONS.md § 0/§ 17 — check for an existing animation utility before adding a new dependency); respect `prefers-reduced-motion`. Outcome: the page feels alive without harming load time or accessibility.
- **Task: Routing reconciliation with AUTH-3** — Move the authenticated dashboard off the now-public `/`, so a signed-out visitor sees the landing page, a signed-in staff member still lands on the app shell, and a `portal.access`-only customer still redirects to `/portal` per AUTH-3. Outcome: one `/` route that means the right thing for every visitor type.

### STORY (LAND-2) — Editable Landing Content (Admin CMS)

**As an organization admin, I want to edit the landing page's headline, value proposition, feature highlights and calls to action from inside the app, so that I can change how SupportOS introduces itself without a developer, a rebuild or a deploy.**
**Description:** The content model is the whole story here, and two existing constraints decide its shape before any UI is drawn. **First, bilingual:** every landing string today exists twice, in `landing/locales/en.json` and `ar.json` — an admin-editable version must store both locales per field, or the Arabic side of the page silently freezes while the English side becomes editable. **Second, public read:** the landing page has no session, and `OrganizationSettings`'s own docstring records why that matters — `primary_color` "is read publicly through `BrandingView`, unlike every other field here … That is why the public serializer is a separate, narrower class." Landing content joins `primary_color` as deliberately-public data and must go through that same narrow public path, never by widening `OrganizationSettingsSerializer`.
**Dependencies:** SEC-4 (`OrganizationSettings` singleton), ORG-3 (`BrandingView` public read path), `I18N`, `FORM`.

- **Task: Landing content model + public read endpoint** 🔑 (every later landing-CMS task reads through this) — Implement per-locale storage for the landing page's editable copy (hero headline, value proposition, both CTA labels and targets, the CTA band, footer text), exposed on a **public, unauthenticated read** path and written only under `settings.manage`. Constraints: extend the existing public `BrandingView`/`BrandingSerializer` surface (`apps/organization/`) or add a sibling public view next to it — do **not** widen `OrganizationSettingsSerializer`, which is admin-only by design; store English and Arabic as separate fields per string, mirroring the `title_en`/`title_ar`/`body_en`/`body_ar` split the `knowledge_base` `Article` model already establishes, rather than inventing a second bilingual pattern; blank means "fall back to the shipped `landing/locales` default", never "render empty". Outcome: one public content endpoint the landing page reads, and one admin-writable record behind it.
- **Task: Landing page reads content from the API with bundle fallback** — Rewire `LandingPage.tsx` to render admin-set copy when present and the existing `landing/locales/{en,ar}.json` strings when not, picking the locale half that matches the active `i18n` language. Constraints: reuse `API` (TanStack Query) — the page must still render correctly (from bundle defaults) if the request fails or the org has never edited anything, since this is the first impression for an unauthenticated visitor; no loading spinner in place of the hero. Outcome: an admin edit changes the live page, and a backend hiccup degrades to today's behaviour instead of a blank front door.
- **Task: Editable feature highlights** — Replace the hard-coded four-entry `FEATURES` array (`LandingPage.tsx:13-18`) with an admin-managed, ordered list of highlight cards (bilingual title + description, chosen icon, sort order). Constraints: the icon must be picked from a fixed, curated `lucide-react` set — the icon library `DSN-4` standardized on — not a free-text name an admin could break the page with; reuse the ordered-row admin pattern `Department`/`Branch` (ORG-1/ORG-2) already established; **no `JSONField`** — ORG-1 and ORG-2 deliberately promoted this codebase's last two JSON list columns to real models, and `CONVENTIONS.md` § 33 recorded that constraint. Outcome: an admin can add, reorder, retitle and remove landing highlights without touching code.
- **Task: Landing content admin editor UI** — Build the editing surface for all of the above. Constraints: this belongs on the **admin** `/settings` surface (`features/organization/components/SettingsPage.tsx`), correctly gated behind `settings.manage` — unlike `DSN-14`'s personal-preferences case, org marketing copy is admin-only by intent, so no new ungated route; reuse `FORM` (RHF + Zod) and the shared field components, including `DSN-10`'s error-summary and focus-first-error behaviour; the existing settings form is already long, so give landing content its own section or tab rather than appending fields to the org form. Outcome: one place an admin edits the public face of the product.
- **Task: Live preview of unsaved landing content** — Give the editor a preview so an admin can see the page as it will look before saving. Constraints: render the real `LandingPage` presentation components against draft form values — do not fork a second copy of the landing markup that can drift; honour the active locale and theme. Outcome: editing marketing copy is not a publish-and-hope operation.

### STORY (LAND-3) — Social Media & Contact Presence

**As an organization admin, I want to manage the social and contact links shown on the public site, so that visitors can reach us on the channels we actually use.**
**Description:** There is no social or contact presence on the landing page today — the footer renders only `footer.copyright`, and the hero's secondary CTA points at `/contact`, a route whose current content should be confirmed as part of this story rather than assumed. Which networks an organization uses is exactly the kind of per-deployment list that must not be hard-coded.
**Dependencies:** LAND-2 (public content endpoint).

- **Task: Social link model + admin management** — Implement an ordered, admin-managed list of social and contact links (platform, URL, sort order, enabled flag) served through LAND-2's public read path. Constraints: a real model with a fixed platform choice set mapped to curated `lucide-react` icons — **not** a `JSONField` (see `CONVENTIONS.md` § 33) and not free-text icon names; validate URLs server-side; an empty list must render no social row at all rather than an empty shell. Outcome: an admin turns channels on and off without a deploy.
- **Task: Social & contact block on the landing page** — Render the enabled links in the landing footer, and wherever `DSN` guidance places them in LAND-4's redesign, with accessible labels — an icon-only link needs an `aria-label` or a visible text alternative, per `DSN-2`'s accessibility bar. Constraints: reuse `UI` primitives and `I18N`; external links open safely (`rel="noopener noreferrer"`); verify the layout in RTL, which `check:rtl` enforces in CI. Outcome: a visitor can find the organization off-site.
- **Task: Reconcile the `/contact` CTA** — Confirm what `/contact` currently renders (the hero's secondary "Get a demo" CTA at `LandingPage.tsx:56` links to it) and make it consistent with the admin-managed contact details from this story — either wiring the real contact channels into it or repointing the CTA. Constraints: resolve by inspection first; do not assume the route is missing or complete. Outcome: no CTA on the front door leads somewhere unfinished.

### STORY (LAND-4) — Landing Page Visual Redesign

**As a visitor, I want the landing page to look designed rather than assembled, so that the product's front door reflects its quality.**
**Description:** `LAND-1` was scoped to "content & layout" and delivered exactly that — a header, a plain hero, a four-card grid, a CTA band and a footer, built from unadorned `Card`/`Button` primitives with a single `animate-in` on the hero. This is the same gap `DSN-4` closed for the staff app ("screens still read as unstyled shadcn defaults"), applied to the one screen `DSN-6`–`DSN-13`'s audit thread never covered, because the landing page did not exist yet when `DSN-6`'s register was compiled.
**Dependencies:** LAND-2, LAND-3, MOTION-0, `DSN`.

- **Task: Hero and section visual treatment** — Redesign the hero and the section rhythm per `DSN` guidance (`design-system/supportos/MASTER.md`) — real typographic hierarchy, spacing scale, background treatment, and support for an admin-set hero image or illustration. Constraints: stay inside the existing shadcn/ui + Tailwind v4 primitive set, the same guardrail `DSN-4` held to — no new component library; the brand colour must keep flowing from ORG-3's `primary_color` token rather than hard-coded hexes; **decide, do not assume, how a hero image is stored** — `OrganizationSettings.logo_url` is a plain `URLField` and not an upload, for a reason its own docstring records (Story 53), so an uploaded hero image is a scope decision this task must settle explicitly. Outcome: a hero that looks intentional.
- **Task: Feature, social-proof and CTA section design** — Give the (now admin-managed) highlight cards, the CTA band and the footer a designed treatment — iconography, semantic colour, card depth and borders per `DSN`. Constraints: reuse the shared `Card`/`Badge`/`Button` primitives and `DSN-4`'s semantic variants; no per-section bespoke components. Outcome: the page reads as one designed system, not five stacked defaults.
- **Task: Responsive and RTL pass on the redesigned page** — Verify the redesign across the breakpoints `DSN-9` established for the app and in Arabic/RTL. Constraints: logical CSS properties only (`npm run check:rtl` enforces this in CI); verify in both light and dark themes, since the page carries a `ThemeToggle`. Outcome: the front door holds up on a phone and in Arabic.

### STORY (MOTION-0) — Shared Motion Foundation

**As a developer, I want one shared motion vocabulary, so that animation across the app is consistent, accessible and not reinvented per screen.**
**Description:** `LAND-1` introduced this app's only motion — `Reveal.tsx` (56 lines, a scroll-triggered reveal) and an inline `animate-in fade-in slide-in-from-bottom-4 duration-700` on the hero — as landing-page-local code. `tw-animate-css` is already a devDependency, so the primitive layer exists; what does not exist is a shared decision about durations, easings, which interactions animate, and how `prefers-reduced-motion` is honoured app-wide. `DSN-8` polished interaction _states_ but never defined motion.
**Dependencies:** `DSN`, `UI`, LAND-1.

- **Task: Motion tokens & reduced-motion policy** 🔑 (every later animation consumes this) — Define a small motion scale (durations, easings, distances) as design tokens extending `DSN`, plus a single documented `prefers-reduced-motion` strategy applied once rather than per component. Constraints: check `tw-animate-css` and Tailwind v4's built-ins before adding any animation dependency — the same "check for an existing animation utility first" constraint `LAND-1` was given (`CONVENTIONS.md` § 0/§ 17); record the outcome in `CONVENTIONS.md` and `design-system/supportos/MASTER.md` so it is discoverable. Outcome: one motion vocabulary, reduced-motion respected everywhere by construction.
- **Task: Promote `Reveal` to a shared primitive** — Move `features/landing/components/Reveal.tsx` into the shared `UI` layer and re-express it on the motion tokens. Constraints: keep the landing page's current behaviour identical after the move; no feature-local copies left behind. Outcome: scroll-reveal is available to any screen instead of one feature.
- **Task: App-wide micro-interaction pass** — Apply the motion foundation to the interactions that already exist: route and page transitions, dialog and sheet enter/exit, toast entrance, dropdown and popover motion, table row and skeleton loading states, button press feedback. Constraints: shared-component level only — animate the `UI` primitives once so every consumer inherits it, never per feature screen; motion must not delay perceived interactivity or fight `DSN-8`'s pending/disabled states; nothing moves under `prefers-reduced-motion: reduce`. Outcome: the whole app feels responsive and alive, from one change set.

---

---

# EPIC 16 — Multi-Department / Multi-Branch / Branding

**Description:** Organizational scoping (departments, branches) and custom branding. Scoping is a cross-cutting concern applied via a shared pattern; branding builds on system configuration.
**Depends on:** Ticket Management, SEC-4.

### STORY (ORG-1) — Multi-Department

- **Task: `Department` model + scoping pattern** 🔑 (reused by branch + reports) — Implement departments linking agents/tickets + a reusable scoping/filter mechanism. Outcome: department-scoped data.
- **Task: Department management UI** — Implement admin UI + scoped queues/reports. Outcome: function-based organization.

### STORY (ORG-2) — Multi-Branch

**Dependencies:** ORG-1.

- **Task: `Branch` model + scoping** — Implement branches associating users/customers/tickets reusing the scoping pattern. Outcome: branch-segmented data.
- **Task: Branch management UI** — Implement admin UI + branch-level access/reports. Outcome: branch structure.

### STORY (ORG-3) — Custom Branding

**Dependencies:** SEC-4.

- **Task: Branding settings + dynamic theming** — Implement logo/colors/name via system config applied through `UI` tokens. Outcome: brand-matched portal/app.

### STORY (ORG-4) — Ticket List Scoped to the Caller's Own Department/Branch

**As an agent, I want my Tickets and My Tickets lists to only show tickets in my own department and branch, so that I am not scrolling past other teams' or other locations' work to find mine.**
**Description:** ORG-1/ORG-2 built a real, reusable scoping mechanism (`apps.core.scoping.ScopeFilter`, CONVENTIONS.md §33) but only ever exposed it through two separate, single-dimension pages — `DepartmentQueuePage`/`BranchQueuePage` (`frontend/src/features/tickets/components/`), each sending exactly one of `?department=`/`?branch=` and never both together, plus two sidebar links shown only when the caller has that one field set. An agent who holds **both** a department and a branch — the ordinary case for someone doing hands-on ticket work — has no view scoped to the intersection: "Department queue" shows every branch's tickets in their department, "Branch queue" shows every department's tickets in their branch, and neither combines. Measured against this project's own seed data: 12 tickets match the department alone, 17 match the branch alone, and only 6 match both — the two existing pages can only ever show the agent the wrong two numbers, never the right one. This story removes both pages and instead scopes the two lists every agent already uses — the plain `TicketListPage` and `MyTicketsPage` — automatically, reusing `ScopeFilter`'s existing AND-composition (CONVENTIONS.md §33: "Multiple scopes compose with **AND**") rather than adding new filtering logic.

CONVENTIONS.md §33 draws a firm, deliberate line: `apps.core.scoping` scopes by **what the caller asked for**, opt-in, and "a `?department=` filter is a convenience; it authorizes nothing." Applying it automatically, with no way for the agent to turn it off, is what this story asks for — and that functions as a real access restriction in practice, even though it is wired through the same "convenience" query-param mechanism. This story must not quietly blur that line: it should either (a) keep the existing `?department=`/`?branch=` params available and unrestricted for anyone who still wants to pass them explicitly (e.g. a manager checking another team's queue), with only the **default**, no-params-supplied view changing to the caller's own scope, or (b) explicitly promote this to a real access boundary and say so — the implementer must pick one, not land in between by accident.
**Dependencies:** ORG-1, ORG-2.

- **Task: Decide, and document, who gets auto-scoped** 🔑 (every other task depends on this answer) — Settle explicitly whether the new default applies to every staff role or only specific ones (an ordinary `agent` almost certainly should get it; whether `manager`/`admin` should too, given they plausibly need cross-department/branch oversight, is the open question). Record the decision and its reasoning in `CONVENTIONS.md` §33, the same way every other scoping decision already living there is documented. Outcome: a written, deliberate answer instead of an implicit one baked silently into a query param default.
- **Task: Auto-scope `TicketListPage` and `MyTicketsPage` to the caller's own department/branch** — For a caller this rule applies to (per the task above), the request these two pages already send via `useTickets()` includes `department=<user.department.id>` and/or `branch=<user.branch.id>` whenever the caller has that field set — reusing `ScopeFilter`'s existing AND-composition, no new backend filtering code. Constraints: a caller with only a department set gets scoped by department alone; only a branch, by branch alone; both, by their intersection; neither, today's unscoped list — unchanged. Outcome: an agent with both set sees exactly the intersection count, not the department-only or branch-only count.
- **Task: Remove the Department queue and Branch queue pages** — Delete `DepartmentQueuePage.tsx`/`BranchQueuePage.tsx`, their `tickets/department`/`tickets/branch` routes (`app/router.tsx`), their two sidebar links (`app/Sidebar.tsx`), and the `departmentQueue.*`/`branchQueue.*` locale keys (`features/tickets/locales/{en,ar}.json`). Constraints: confirm nothing else links to either route before deleting it. Outcome: no orphaned single-dimension queue screens once the two lists above make them redundant.
- **Task: Confirm the assignment/routing side stays consistent** — `apps.sla.tasks.auto_assign_ticket` and any assignment-rule logic already reason about an agent's department/branch when routing a new ticket to them. Confirm this story's list-side scoping does not silently diverge from that assignment-side logic — e.g. a ticket auto-assigned to an agent whose own department/branch no longer matches it, because either changed after assignment, must not become invisible to that agent on the very lists this story scopes. Constraints: read `apps/sla/tasks.py`/`apps/sla/models.py` before assuming a mismatch does or does not already exist — verify, do not guess. Outcome: a ticket assigned to an agent is never invisible to them.

---

---

# EPIC 17 — Production Readiness

**Description:** Hardening for deployment — observability, performance, security review, and optional Docker packaging (future-ready, still not required for local dev).
**Depends on:** all prior epics.

### STORY (PROD-1) — Observability & Logging

- **Task: Structured logging + error monitoring** — Implement the `CONV` logging strategy end-to-end + error tracking. Outcome: diagnosable production issues.

### STORY (PROD-2) — Performance & Caching

- **Task: Query optimization + caching pass** — Add pagination/index review + caching where measured. Constraints: optimize by evidence, no premature tuning. Outcome: responsive at scale.

### STORY (PROD-3) — Security Hardening

- **Task: Security review** — Enforce authz coverage, rate limiting, input validation audit, secret handling review. Outcome: reduced attack surface.

### STORY (PROD-4) — Optional Docker Packaging

- **Task: Docker/compose (optional)** — Provide optional containerization for parity. Constraints: **must not** become required for local dev; local (non-Docker) path stays first-class. Outcome: future-ready deployment.

---

---

# EPIC 18 — Node.js Backend Port

**Description:** Replace the Django API with a Node/TypeScript one **behind an unchanged contract**. Two things stay fixed for the whole epic: the existing PostgreSQL schema (introspected, never re-generated) and the API surface (the same paths and the same `{success, data, meta}` envelope). Because the contract does not move, the React client is not touched and both backends can serve the same database while endpoints move over one module at a time. The port runs in its own repository (`ZiadHosny/Support-OS`, tagged `django-baseline` at the pre-port commit); the Django implementation stays as the reference to diff against until parity is reached.
**Depends on:** all prior epics — the port has no product scope of its own, only the scope already shipped.
**Stack:** NestJS (module-per-business-area, mirroring `apps/`), Prisma (introspect-only), BullMQ on the existing Redis, `@nestjs/swagger`.

### STORY (NODE-0) — Port Contract & Node Conventions

- **Task: Freeze the Django API contract** 🔑 (consumed by every NODE story) — Generate the OpenAPI document from the live Django URLConf and commit it as a **frozen reference snapshot** (`docs/api-contract.django.yaml`), stating in the file header that it is a port contract, not the live schema. Constraints: this is a deliberate, documented exception to the "schema is generated, never committed" rule — the snapshot must be regenerated only when the Django reference itself changes. Outcome: an executable definition of what the Node service must answer.
- **Task: Node conventions spec** 🔑 (`CONV-NODE`, reused by every NODE story) — Write the Node counterpart of `CONV`: module layout, the single envelope interceptor, the exception filter and error-code mapping, DTO validation, guard placement, config validation, logging and correlation-id propagation. Constraints: one page, reference-based, no restating of `CONV`; must state the introspect-only database rule and the "no controller builds its own response shape" rule explicitly. Outcome: the architecture is decided before any feature code exists.

### STORY (NODE-1) — Node Service Foundation

**Dependencies:** NODE-0.

- **Task: Service skeleton + config + envelope** 🔑 (reused by every later module) — Scaffold the NestJS project beside the Django one, wire schema-validated environment config, the response-envelope interceptor, the exception filter, pagination, and the correlation-id middleware. Constraints: no domain feature in this story; the envelope and error shapes must match the frozen contract byte-for-byte. Outcome: an empty service that already answers in the product's own API shape.
- **Task: Prisma introspection of the existing schema** 🔑 — Generate the Prisma client from the live database (`db pull`) and commit the generated schema. Constraints: **introspection only — no migration command may ever run from the Node service**; the Django migrations remain the single source of schema truth for the whole epic. Outcome: typed database access over the 43 existing models without touching the schema.
- **Task: Health endpoint** — Port `/api/health/` as the first end-to-end proof that routing, config, database access and the envelope all work together. Outcome: one verifiable live endpoint.

### STORY (NODE-2) — Contract-Diff Harness

**Dependencies:** NODE-0, NODE-1.

- **Task: Dual-target response diff** 🔑 (the acceptance gate for every later NODE story) — Build a harness that reads the frozen contract, issues the same request to the Django and Node services against the same seeded database, and reports per-path differences in status code, envelope shape, error code and payload structure. Constraints: compare **shape and semantics, not generated identifiers or timestamps** — a create call produces a different row on each side; the harness must be runnable as one command and must exit non-zero on any mismatch. Outcome: "ported" becomes a measurable state instead of a judgement.
- **Task: Coverage report** — Emit a per-module progress summary (paths matching / mismatching / not yet implemented) against the 131-path contract. Outcome: the port's real completion percentage is always visible.

### STORY (NODE-3) — Authentication, Permissions & Scoping

**Dependencies:** NODE-1, NODE-2.

- **Task: JWT issuance, refresh and logout** — Port the token endpoints and the `me` endpoint, matching the existing token lifetimes, claims and error codes. Constraints: existing tokens and the frontend's silent-refresh interceptor must keep working unchanged. Outcome: sign-in parity.
- **Task: Django password-hash verification** 🔑 — Implement a verifier for the stored `pbkdf2_sha256$iterations$salt$hash` format, plus rehash-on-login if the hashing strategy later changes. Constraints: every existing account must sign in with its current password — a forced password reset is not an acceptable outcome. Outcome: no credential migration.
- **Task: Permission guard over the existing catalogue** 🔑 — Enforce the same permission strings, read from the same `Role.permissions` rows, as a framework-level guard. Constraints: the permission catalogue endpoint must return exactly what the frontend gates already expect; a route without a declared permission must fail closed. Outcome: authorization parity, verified by the denials as much as by the grants.
- **Task: Scope enforcement layer** 🔑 — Reimplement department/branch scoping as a query layer that cannot be bypassed. Constraints: it must be structurally impossible for a handler to issue an unscoped query for a scoped model — an opt-in helper is not sufficient. Outcome: the visibility boundary survives the port.
- **Task: Rate limiting and MFA** — Port login throttling and the TOTP/recovery-code challenge. Outcome: the hardening from SEC-9 and PROD-3 is not silently dropped.

### STORY (NODE-4) — Customer Management Port

**Dependencies:** NODE-3.

- **Task: Customer CRUD, contacts, notes and attachments** — Port the customer module module-for-module against the contract. Constraints: file upload and download behaviour, including content types and size limits, must match. Outcome: the first complete business module on Node.
- **Task: Timeline, export and erasure** — Port the interaction timeline and the data-subject export/erasure paths. Constraints: erasure must preserve ticket integrity exactly as the Django implementation does under the protected customer reference. Outcome: PDPL/GDPR behaviour parity.

### STORY (NODE-5) — Ticket Management Port

**Dependencies:** NODE-4.

- **Task: Ticket CRUD, categories and saved views** — Port the ticket surface, including filtering, sorting and pagination semantics. Constraints: query-parameter names and filter behaviour come from the contract, not from preference. Outcome: the queue works on Node.
- **Task: Lifecycle services — status, assignment, escalation, history** 🔑 — Port each business concern as its own service, with the transition rules and the activity record they write. Constraints: a status or assignment change must never be a bare field write; every transition writes its activity row inside one transaction, exactly as the Django services do. Outcome: the ticket lifecycle keeps its audit trail.
- **Task: Merge, duplicates and bulk actions** — Port duplicate detection, merge, and the bulk status/priority/assignment paths. Constraints: bulk operations stay transactional and permission-checked per ticket. Outcome: agent throughput features preserved.

### STORY (NODE-6) — Communications & Agent Workspace Port

**Dependencies:** NODE-5.

- **Task: Messaging core and channel adapters** — Port the message model surface and the email/SMS/WhatsApp/live-chat/web-form adapters over the existing database-stored provider configuration. Constraints: one adapter interface, as today; provider credentials are read from the database, never from code. Outcome: multi-channel parity.
- **Task: Agent workspace surface** — Port tasks/reminders, quick replies, internal notes and the ticket context panel endpoints. Constraints: internal notes must remain unreachable from any customer-facing route — this is the one boundary worth an explicit negative test in the harness. Outcome: the workspace runs on Node.

### STORY (NODE-7) — SLA, Background Jobs & Realtime

**Dependencies:** NODE-5.

- **Task: Job runner and scheduled work** 🔑 — Port the background tasks and their schedule onto BullMQ over the existing Redis: SLA breach detection, escalation, auto-assignment, retention purge and notification fan-out. Constraints: the schedule and idempotency guarantees must match; a job must not run twice against the same row after a restart. Outcome: time-driven behaviour parity.
- **Task: Business-hours SLA calculation** — Port due-time and pause calculation over the working-window and holiday calendars. Constraints: verify against recorded Django outputs with a frozen clock — elapsed-time behaviour cannot be checked by inspection. Outcome: SLA timing parity.
- **Task: Realtime gateway with a shared backend** — Port the notification and live-chat sockets to a WebSocket gateway backed by a Redis adapter. Constraints: this must remove the single-process limitation the Django channel layer has, so the frontend behaves identically with more than one backend instance. Outcome: realtime that scales horizontally.

### STORY (NODE-8) — Reports Port

**Dependencies:** NODE-5, NODE-7.

- **Task: Aggregation endpoints** — Port the ticket-volume, breakdown, SLA trend/breach-rate, CSAT and agent-performance endpoints, plus dashboard KPIs. Constraints: aggregation stays in the database, never row-by-row in the service; bucket boundaries and gap-filling must match the reference output exactly. Outcome: identical numbers on identical data.
- **Task: Report export** — Port the export paths with the same formats and file naming. Outcome: no change for existing consumers.

### STORY (NODE-9) — Portal & Knowledge Base Port

**Dependencies:** NODE-3, NODE-5.

- **Task: Knowledge base and search** — Port articles, categories, FAQs and the search retrieval behaviour. Outcome: self-service content parity.
- **Task: Customer portal surface** — Port submission, tracking, history, replies and CSAT feedback. Constraints: owner-scoping must be enforced by the scope layer from NODE-3, not by per-handler filtering; the staff surface stays unreachable for portal-only accounts. Outcome: the portal boundary survives the port.

### STORY (NODE-10) — Integrations & AI Port

**Dependencies:** NODE-5, NODE-9.

- **Task: API keys, ERP sync and outbound webhooks** — Port key-based authentication, the ERP client and sync runs, and webhook subscription/delivery with its retry behaviour. Constraints: delivery attempts and their recorded outcomes keep the same shape, so existing subscribers see no change. Outcome: integration parity.
- **Task: AI features over one client** — Port summaries, suggested replies, categorization, suggested solutions and the chatbot behind a single AI client with the existing rate throttle. Constraints: AI stays additive — with no provider key configured, every ticket and portal workflow must continue to work. Outcome: AI parity without new dependencies.

### STORY (NODE-11) — Admin Surface Replacement

**Dependencies:** NODE-4, NODE-5.

- **Task: Replace the Django admin** — Provide an equivalent internal administration surface for the reference and operational data the Django admin covered today. Constraints: it must respect the same permission catalogue rather than introducing a second privilege path; decide explicitly per model whether it belongs in the admin surface or in the product's own screens instead of porting all of it by reflex. Outcome: operational access is not lost with the framework.

### STORY (NODE-12) — Cutover & Django Retirement

**Dependencies:** all prior NODE stories.

- **Task: Point the client at the Node service** — Switch the frontend's API base URL and exercise every screen. Constraints: **no frontend file may change** — a required frontend edit means an endpoint diverged from the contract and the port is not done. Outcome: the product runs end to end on Node.
- **Task: Parity sign-off** — Reach a green contract-diff run across the whole contract and record the run, as the Django-side verification is recorded today. Constraints: mismatches are fixed or explicitly accepted in writing; a mismatch is never silently ignored. Outcome: a defensible parity claim.
- **Task: Retire the reference implementation** — Remove the Django service and rewrite the architecture, workflow, assumption and verification documents around the Node implementation. Constraints: schema ownership moves to the Node service in this task and not before, which is when the introspect-only rule from NODE-1 is lifted and replaced by a stated migration strategy. Outcome: one backend, and documentation that describes it.

---

## Foundation Map (what must exist before features)

- `ARCH`, `CONV`, `ENV`, `API` → EPIC 0
- `I18N`, `UI`, `FORM` → EPIC 1
- `AUTHZ` → EPIC 2
- Messaging core (Message + adapter + conversation UI) → EPIC 5 (COMM-0)
- Background jobs (SLA-0), Notifications (SLA-4) → EPIC 7
- `DSN` design system + chart guidance (DSN-0, DSN-3) → EPIC 8
- KB search retrieval (KB-3) → EPIC 9
- Reporting foundation (RPT-0) → EPIC 11
- UX issue register (`design-system/supportos/UX-AUDIT.md`) → EPIC 8 (DSN-6); consumed by DSN-7–DSN-13
- Shared form UX behavior (validation timing, error summary, focus) → EPIC 8 (DSN-10), extends `FORM`
- Responsive table/shell patterns → EPIC 8 (DSN-9), extend `UI`/`DSN-5`
- AI service foundation (AI-0) → EPIC 13
- System config (SEC-4) → EPIC 12; Org scoping pattern (ORG-1) → EPIC 16
- Working-time / business-hours calendar (SLA-5) → EPIC 7; consumed by SLA due times, escalation (SLA-3), SLA pause (SLA-6) and SLA reporting (RPT-2)
- Table row-selection / bulk-action pattern (TKT-7) → EPIC 4, extends `UI`
- Form presentation rule + shared `FormDialog` (DSN-15) → EPIC 8, extends `UI`/`FORM`
- Frozen API contract + `CONV-NODE` (NODE-0) → EPIC 18; the contract is the acceptance spec for every NODE story
- Node service foundation (NODE-1) and the contract-diff harness (NODE-2) → EPIC 18; no NODE story after these ships without a harness run
- Node auth, permission guard and scope layer (NODE-3) → EPIC 18; every ported module depends on it, exactly as EPIC 2 `AUTHZ` is depended on today

**Rule for every later task:** consume these foundations by reference; never re-implement them.

**Rule for EPIC 18 specifically:** the port adds no product scope. A NODE story that introduces a new endpoint, a new response shape, a schema change or a frontend edit has stopped being a port — raise it as its own story in the owning epic instead.
