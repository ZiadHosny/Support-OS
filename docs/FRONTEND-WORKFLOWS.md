# Frontend workflows — screen inventory and frontend-to-database traces

This document evidences that every user-facing capability is a **complete path from a rendered
screen to a database table**, not a screen with a stub behind it. It contains:

1. the full route/screen inventory, with the permission that gates each route;
2. end-to-end traces (screen → hook → endpoint → controller → service → model → table);
3. the agent workspace surface, enumerated;
4. the commands that verify the frontend, and what they currently report.

The backend half of every trace is documented in
[`BACKEND-ARCHITECTURE.md`](BACKEND-ARCHITECTURE.md).

---

## How a screen reaches the database

Every data-touching screen uses the same four-hop chain. There is one HTTP client for the whole
app and no component calls `fetch`/`axios` directly.

```
Screen            features/<area>/components/<Name>Page.tsx
  → Hook          features/<area>/api/use<Thing>.ts        (TanStack Query useQuery/useMutation)
      → Fetch fn  features/<area>/api/<verb><Thing>.ts     (typed, one endpoint each)
          → Client shared/lib/api/client.ts                 (the single Axios instance)
              → DRF controller → service module → model → PostgreSQL table
```

`shared/lib/api/client.ts` is the only module that knows about transport. It attaches the
bearer token, `Accept-Language`, and the `X-Request-ID` correlation header, unwraps the
`{ success, data, meta }` envelope, normalizes errors into one error type, and performs the
silent refresh-and-retry on `401`. That is why no screen contains envelope handling: the
client's contract matches `apps/core/renderers.py` on the other side, and a request can be
traced end to end by its `X-Request-ID` in the backend log.

Query keys are centralized per feature (`ticketKeys.ts`, `customerKeys.ts`,
`portalTicketKeys.ts`, …), so a mutation invalidates by key prefix and every affected screen
refetches. Server state is TanStack Query v5 (one `QueryClient` in `app/providers.tsx`); session
state is the `AuthContext` in `shared/auth/`. There is no Redux/Zustand layer — nothing needs
client-owned duplicate state.

Measured surface: **17 feature areas, 66 page components, 328 typed API modules, 82 route
entries** in the single router config `src/app/router.tsx` (react-router v7, every route
lazy-loaded).

---

## Route inventory

Routes are gated declaratively: `RequireAuth` for the session, then `RequirePermission` with a
permission string that must exist in the backend's catalog of 25 (`apps/core/permissions.py`,
served at `/api/permissions/`). The gate strings below are read from the router itself.

### Public — no session (`PublicLayout`)

| Route | Screen |
|---|---|
| `/` | `features/landing/components/LandingPage.tsx` |
| `/login` | `features/auth/components/LoginPage.tsx` |
| `/set-password`, `/forgot-password`, `/reset-password` | `features/auth/components/*PasswordPage.tsx` |
| `/chat` | `features/live-chat/components/LiveChatWidget.tsx` |
| `/contact` | `features/web-form/components/WebFormPage.tsx` |

### Staff application (`RootLayout` + `RequireAuth`)

| Route(s) | Screen(s) | Permission gate |
|---|---|---|
| `/home` | `app/HomePage.tsx` | session only |
| `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit` | `CustomerListPage`, `CustomerFormDialog`, `CustomerProfilePage` | `customers.view` |
| `/tickets`, `/tickets/new`, `/tickets/my-tickets`, `/tickets/:id`, `/tickets/:id/edit` | `TicketListPage`, `TicketFormPage`, `MyTicketsPage`, `TicketDetailPage` | `tickets.view` |
| `/categories`, `/categories/new`, `/categories/:id/edit` | `features/tickets` category management | `tickets.manage` |
| `/knowledge-base`, `/knowledge-base/articles`, `/knowledge-base/articles/:id`, `/knowledge-base/search` | KB reader screens | `knowledge_base.view` |
| `/knowledge-base/manage`, `/knowledge-base/articles/manage` (+ `new`, `:id/edit`), `/knowledge-base/categories` (+ `new`, `:id/edit`) | KB authoring screens | `knowledge_base.manage` |
| `/users` | `features/accounts` user list | `users.view` |
| `/users/new`, `/users/:id/edit` | user form | `users.manage` |
| `/roles`, `/roles/new`, `/roles/:id/edit` | role editor | `roles.manage` |
| `/reports/tickets`, `/reports/sla`, `/reports/agents`, `/reports/csat`, `/reports/dashboard` | `features/reports/components/*Page.tsx` | `reports.view` |
| `/audit-log` | `features/audit-log` | `audit_log.view` |
| `/settings`, `/settings/landing` (+ `highlights`, `social`, each with `new`/`:id/edit`) | `features/organization` settings screens | `settings.manage` |
| `/settings/erp` | `features/integrations` | `integrations.manage` |
| `/settings/channels` | `features/communications` | `communications.manage` |
| `/settings/webhooks` (+ `new`, `:id/edit`) | `features/webhooks` | `webhooks.manage` |
| `/settings/departments` / `/settings/branches` / `/settings/calendars` | org structure screens | `*.view` to read, `*.manage` to mutate |
| `/tasks`, `/tasks/new`, `/tasks/:id/edit` | `features/tasks` | session only |
| `/preferences` | `app/PreferencesPage.tsx` | session only |
| `*` | `NotFoundPage` | — |

### Customer portal (`PortalLayout` + `RequireAuth` + `portal.access`)

| Route | Screen |
|---|---|
| `/portal` | `PortalHomePage` |
| `/portal/tickets`, `/portal/tickets/new`, `/portal/tickets/:id`, `/portal/tickets/history`, `/portal/tickets/:id/feedback` | portal ticket screens (submit, track, history, CSAT) |
| `/portal/faqs`, `/portal/articles`, `/portal/articles/:id` | portal self-service content |
| `/portal/chat` | portal chatbot |

The portal is a **separate layout with its own permission gate**, not a filtered view of the
staff app — a customer cannot reach a staff route by typing its URL, because the staff branch
sits behind `RequirePermission` gates that a portal-only account does not hold, and
`RedirectPortalOnly` sends such an account to `/portal`.

---

## End-to-end traces

Each row is one continuous path from a rendered screen to a table. Endpoints are the literal
strings in the fetch modules; controllers and services are the backend files that answer them.

### Ticket lifecycle (agent side)

| Action | Screen | Hook | Endpoint | Controller → service | Model |
|---|---|---|---|---|---|
| List / filter | `TicketListPage` | `useTickets` | `GET /api/tickets/` | `TicketViewSet.list` + `ScopedQuerysetMixin` | `Ticket` |
| Create | `TicketFormPage` | `useCreateTicket` | `POST /api/tickets/` | `TicketViewSet.create` | `Ticket` |
| Read detail | `TicketDetailPage` | `useTicket` | `GET /api/tickets/{id}/` | `TicketViewSet.retrieve` | `Ticket` |
| Update | `TicketFormPage` (edit) | `useUpdateTicket` | `PATCH /api/tickets/{id}/` | `TicketViewSet.partial_update` | `Ticket` |
| Change status | `TicketDetailPage` | `useSetTicketStatus` | `POST /api/tickets/{id}/status/` | `TicketViewSet.status` → `tickets/status.py` | `Ticket`, `TicketActivity` |
| Assign | `TicketAssigneeControl` | `useAssignTicket` | `POST /api/tickets/{id}/assign/` | → `tickets/assignment.py` | `Ticket`, `TicketActivity` |
| Pick assignee | `TicketAssigneeControl` | `useAssignableAgents` | `GET /api/tickets/assignable-agents/` | → `tickets/assignment.py` | `User`, `Role` |
| Escalate | `TicketDetailPage` | `useEscalateTicket` | `POST /api/tickets/{id}/escalate/` | → `tickets/escalation.py`, `sla/escalation_rules.py` | `Ticket`, `EscalationRule` |
| Activity history | `TicketDetailPage` | `useTicketHistory` | `GET /api/tickets/{id}/history/` | → `tickets/history.py` | `TicketActivity` |
| SLA state | `TicketDetailPage` | `useTicketSla` | `GET /api/tickets/{id}/sla/` | → `sla/policy.py` | `SLAPolicy` |
| Merge duplicates | `TicketDetailPage` | `useMergeTicket` | `POST /api/tickets/{id}/merge/` | → `tickets/merge.py` | `Ticket`, `TicketActivity` |
| Duplicate candidates | `TicketDetailPage` | `useDuplicateCandidates` | `GET /api/tickets/{id}/duplicate-candidates/` | → `tickets/duplicates.py` | `Ticket` |
| Bulk actions | `TicketBulkActionBar` | `useBulkAssignTickets`, `useBulkSetTicketStatus`, `useBulkSetTicketPriority` | `POST /api/tickets/bulk-assign/`, `/bulk-status/`, `/bulk-priority/` | → `tickets/bulk.py` | `Ticket`, `TicketActivity` |
| Saved views | `TicketListPage` | `useSavedViews` | `GET/POST /api/saved-views/`, `POST /api/saved-views/{id}/set-default/` | `SavedViewViewSet` | `SavedView` |
| Conversation | `TicketConversation` | `useMessages` | `GET/POST /api/messages/` | `MessageViewSet` → `communications/adapters.py` | `Message` |
| Internal notes | `InternalNotesSection` | `useInternalNotes` | `GET/POST /api/internal-notes/` | `InternalNoteViewSet` | `InternalNote` |
| AI reply draft | `TicketDetailPage` | `useSuggestTicketReply` | `POST /api/tickets/{id}/suggest-reply/` | → `tickets/reply_suggestions.py` → `ai/client.py` | `Ticket`, `Message` |
| AI summary | `TicketDetailPage` | `useSummarizeTicket` | `POST /api/tickets/{id}/summarize/` | → `tickets/summarization.py` → `ai/` | `Ticket` |
| AI solutions | `TicketDetailPage` | `useSuggestTicketSolutions` | `POST /api/tickets/{id}/suggest-solutions/` | → `tickets/solution_suggestions.py` | `Article` |

### Customer lifecycle

| Action | Screen | Hook | Endpoint | Controller → service | Model |
|---|---|---|---|---|---|
| List / search | `CustomerListPage` | `useCustomers` | `GET /api/customers/` | `CustomerViewSet.list` + scoping | `Customer` |
| Create | `CustomerFormDialog` | `useCreateCustomer` | `POST /api/customers/` | `CustomerViewSet.create` | `Customer` |
| Read profile | `CustomerProfilePage` | `useCustomer` | `GET /api/customers/{id}/` | `CustomerViewSet.retrieve` | `Customer` |
| Update / delete | `CustomerFormDialog` | `useUpdateCustomer`, `useDeleteCustomer` | `PATCH`/`DELETE /api/customers/{id}/` | `CustomerViewSet` | `Customer` |
| Contact details | `CustomerProfilePage` | `useContactDetails` | `/api/contact-details/` | `ContactDetailViewSet` | `ContactDetail` |
| Interaction timeline | `CustomerProfilePage` | `useCustomerTimeline` | `GET /api/customers/{id}/timeline/` | → `customers/timeline.py` | `Ticket`, `Message`, `Note` |
| Notes + attachments | `CustomerProfilePage` | `useNotes`, `useAttachments` | `/api/notes/`, `/api/attachments/` | `NoteViewSet`, `AttachmentViewSet` | `Note`, `Attachment` |
| Grant / revoke portal access | `CustomerProfilePage` | `useGrantPortalAccess`, `useRevokePortalAccess` | `POST /api/customers/{id}/portal-access/` | `CustomerViewSet` → `accounts` | `User`, `Role` |
| GDPR erasure | `CustomerProfilePage` | `useEraseCustomerData` | `POST /api/customers/{id}/erase-data/` | → `customers/erasure.py` | `Customer` + related |

### Customer portal (self-service)

| Action | Screen | Hook | Endpoint | Controller | Model |
|---|---|---|---|---|---|
| Submit a request | `PortalTicketFormPage` | `useCreatePortalTicket` | `POST /api/portal/tickets/` | `portal` viewset → `tickets` services | `Ticket` |
| Track / history | `PortalTicketsPage`, `PortalTicketHistoryPage` | `usePortalTickets` | `GET /api/portal/tickets/` | `portal` viewset (owner-scoped) | `Ticket` |
| Read one request | `PortalTicketDetailPage` | `usePortalTicket` | `GET /api/portal/tickets/{id}/` | `portal` viewset | `Ticket`, `Message` |
| Reply | `PortalTicketDetailPage` | `usePortalMessages`, `usePortalMessageMutations` | `/api/portal/messages/` | `portal` viewset | `Message` |
| CSAT feedback | `PortalFeedbackPage` | `usePortalFeedbackMutations` | `POST /api/portal/feedback/` | `portal` viewset | `Feedback` |
| FAQs / articles | `PortalFaqsPage`, `PortalArticlesPage` | `usePortalFaqs`, `usePortalArticles` | `/api/faqs/`, `/api/articles/` | `knowledge_base` viewsets | `FAQ`, `Article` |
| Chatbot | `PortalChatPage` | `usePortalChatbot`, `usePortalChatbotMutations` | `POST /api/portal/chatbot/`, `…/handoff/` | `portal` → `ai/chatbot.py` | `ChatbotSession` |

### Authentication and session

| Action | Screen | Endpoint | Controller | Model |
|---|---|---|---|---|
| Log in | `LoginPage` | `POST /api/auth/token/` | `throttled_token_views.py` (rate-limited) | `User` |
| Silent refresh | `shared/lib/api/client.ts` interceptor | `POST /api/auth/token/refresh/` | `accounts` | — |
| Current user + permissions | `AuthProvider` | `GET /api/auth/me/` | `accounts` | `User`, `Role` |
| Password set / forgot / reset | `*PasswordPage` | `/api/auth/password/*` | `accounts` → `tokens.py` | `User` |
| MFA | `LoginPage` | `/api/auth/mfa/*` | `accounts` → `mfa.py` | `TwoFactorRecoveryCode` |
| Permission catalog | `Can` / `RequirePermission` | `GET /api/permissions/` | `core.PermissionCatalogView` | — |

The permission catalog endpoint is what makes the two halves consistent: the frontend gates
render off the same 25 strings the backend enforces, so a gate cannot drift into referencing a
permission the backend does not know.

---

## Agent workspace coverage

There is no folder named `agent-dashboard`; the agent's working surface is composed of these
screens, and this is the complete list.

| Surface | Screen | What the agent does there | Data it reads |
|---|---|---|---|
| Daily landing | `app/HomePage.tsx` (`/home`) | stat tiles + quick links, each permission-gated with `<Can>` | `useTickets`, `useTasks`, `useUnreadCount` |
| Personal queue | `MyTicketsPage` (`/tickets/my-tickets`) | work assigned to the signed-in agent | `GET /api/tickets/` (assignee-filtered) |
| Team queue | `TicketListPage` (`/tickets`) | filter, sort, saved views, bulk actions | `/api/tickets/`, `/api/saved-views/` |
| Ticket workspace | `TicketDetailPage` (`/tickets/:id`) | the main work surface — conversation, status, assignment, escalation, SLA, AI assists | 15+ endpoints (see trace table) |
| Customer context | `CustomerContextPanel` (`useTicketContext`) | who the requester is, without leaving the ticket | `GET /api/tickets/{id}/context/` |
| Conversation | `TicketConversation` | inbound/outbound messages across channels | `/api/messages/` |
| Internal collaboration | `InternalNotesSection` | agent-only notes on a ticket | `/api/internal-notes/` |
| Canned answers | quick-reply controls | reuse approved replies | `/api/quick-replies/` |
| Tasks / reminders | `features/tasks` (`/tasks`) | follow-ups, complete/reopen | `/api/tasks/`, `…/complete/`, `…/reopen/` |
| Notifications | app shell | unread count + live updates over WebSocket | `/api/notifications/`, `notifications/consumers.py` |
| Own performance | `AgentReportsPage` (`/reports/agents`) | per-agent metrics | `GET /api/reports/agents/performance/` |
| Manager rollup | `ManagementDashboardPage` (`/reports/dashboard`) | KPI dashboard across the team | `GET /api/reports/dashboard/kpis/` |

Reporting screens are backed by dedicated aggregation endpoints — `/api/reports/tickets/volume/`
and `/breakdown/`, `/api/reports/sla/trend/` and `/breach-rate/`,
`/api/reports/csat/trend/` and `/breakdown/`, `/api/reports/agents/performance/`,
`/api/reports/dashboard/kpis/` — computed in `apps/reports/aggregation.py` rather than by
fetching rows and summing them in the browser.

---

## Verifying the frontend

Run from `frontend/`. Recorded outcomes are in [`VERIFICATION.md`](VERIFICATION.md).

```bash
npm run build          # tsc -b (full typecheck) + vite production build
npm run lint           # oxlint
npm run format:check   # prettier
npm run check:rtl      # fails on physical direction utilities (ml-*/pl-*/left/right)
npm run check:contrast # fails if a measured token pair misses its WCAG AA threshold
```

`check:rtl` and `check:contrast` are project-specific gates, not boilerplate: the app ships
Arabic and English, so a physical-direction utility is a real RTL bug, and the contrast script
measures actual design-token pairs instead of trusting that a palette "looks accessible".

**Known gap, stated plainly:** the frontend has **no automated test suite** — no test runner in
`package.json` and no test files under `src/`. Type checking, linting, and the RTL/contrast
gates are what currently guard it; behavioural correctness is verified manually against the
scenarios in [`HOW_TO_USE.md`](../HOW_TO_USE.md) and recorded in
[`VERIFICATION.md`](VERIFICATION.md#coverage-gaps). Treating `tsc` as a substitute for tests
would be a misreading of this document.
