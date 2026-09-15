# Plans index

One row per feature folder under `.squad/plans/`. `NN` continues as a global execution sequence across all features when `naming.globalSequence` is `true` in `config.yaml`.

The `NN` sequence encodes execution order implicitly. Two sections below make it explicit: [Build order and dependencies](#build-order-and-dependencies) says *why* each epic waits for the one before it, and [Layer coverage](#layer-coverage) shows which concerns each epic actually covers. Acceptance criteria per capability live in [`docs/ASSUMPTIONS.md`](../../docs/ASSUMPTIONS.md); the story intakes carry the tracker text, not the criteria.

| Feature | Overview | NN range |
|---------|----------|----------|
| project-foundation-architecture | [project-foundation-architecture/00-overview.md](project-foundation-architecture/00-overview.md) | 01–04 (EPIC 0 complete) |
| internationalization-design-system | [internationalization-design-system/00-overview.md](internationalization-design-system/00-overview.md) | 05–07 (EPIC 1 fully planned) |
| authentication-authorization | [authentication-authorization/00-overview.md](authentication-authorization/00-overview.md) | 08–09 (EPIC 2 fully planned) |
| customer-management | [customer-management/00-overview.md](customer-management/00-overview.md) | 10–11, 20–21 (EPIC 3 fully planned) |
| ticket-management | [ticket-management/00-overview.md](ticket-management/00-overview.md) | 12, 18, 22–24 (EPIC 4 fully planned), 54 (SUPPORTOS-96 addition), 106 (SUPPORTOS-130 addition), 108 (SUPPORTOS-131 addition), 109 (SUPPORTOS-132 addition) |
| communication-channels | [communication-channels/00-overview.md](communication-channels/00-overview.md) | 13–17, 19 (EPIC 5 fully planned) |
| agent-workspace | [agent-workspace/00-overview.md](agent-workspace/00-overview.md) | 25–26, 32–34 (EPIC 6 fully planned) |
| sla-automation | [sla-automation/00-overview.md](sla-automation/00-overview.md) | 27–31 (EPIC 7 fully planned), 111 (SUPPORTOS-133 addition), 112 (SUPPORTOS-134 addition) |
| design-intelligence-ui-ux-system | [design-intelligence-ui-ux-system/00-overview.md](design-intelligence-ui-ux-system/00-overview.md) | 35–38, 50–51, 61–69, 112–114 (EPIC 8 fully planned AND implemented, `DSN-0` through `DSN-17` plus `MOTION-0` all implemented) |
| knowledge-base | [knowledge-base/00-overview.md](knowledge-base/00-overview.md) | 39–41 (EPIC 9 fully planned, KB-1/KB-2/KB-3) |
| customer-portal | [customer-portal/00-overview.md](customer-portal/00-overview.md) | 42–47 (EPIC 10 fully planned, PORTAL-0 through PORTAL-5) |
| security-administration | [security-administration/00-overview.md](security-administration/00-overview.md) | 48–49, 52–53, 70–73, 107, 110 (EPIC 12, SEC-1 through SEC-10 fully planned; SEC-1 through SEC-9 implemented; SEC-8 (Story 73) and SEC-10 (Story 110, SUPPORTOS-136) planned, not yet implemented) |
| reports-analytics | [reports-analytics/00-overview.md](reports-analytics/00-overview.md) | 55–60 (EPIC 11 fully planned, RPT-0/RPT-1/RPT-2/RPT-3/RPT-4 implemented, RPT-5 planned) |
| ai-features | [ai-features/00-overview.md](ai-features/00-overview.md) | 74–79 (EPIC 13 fully planned, AI-0 through AI-5; AI-0–AI-4 implemented, AI-5 outstanding) |
| integrations | [integrations/00-overview.md](integrations/00-overview.md) | 80–83 (EPIC 14 fully planned; INT-1/INT-2/INT-3 implemented, INT-4 planned) |
| public-landing-page | [public-landing-page/00-overview.md](public-landing-page/00-overview.md) | 86, 94, 95, 96, 97 (EPIC 15 **fully planned**; LAND-1/LAND-2/LAND-3/LAND-4 (Stories 86, 94, 95, 96) implemented, MOTION-0 (Story 97) planned) |
| multi-department-multi-branch-branding | [multi-department-multi-branch-branding/00-overview.md](multi-department-multi-branch-branding/00-overview.md) | 87, 89–90, 98 (EPIC 16 fully planned; ORG-1/ORG-2/ORG-3 implemented, ORG-4 (Story 98, a later addition) planned) |
| production-readiness | [production-readiness/00-overview.md](production-readiness/00-overview.md) | 88, 91, 92, 93 (EPIC 17 **fully planned**; PROD-1/PROD-2/PROD-3 implemented, PROD-4 planned) |
| bugs | [bugs/00-overview.md](bugs/00-overview.md) | 99 (defect remediation, not a backlog epic — cut from `qa-report-1`; Stories 99–105 all implemented, closing F-1..F-20. F-3 and F-15 are deferred by explicit decision, recorded in the overview) |
| portal-ticket-conversation | [portal-ticket-conversation/00-overview.md](portal-ticket-conversation/00-overview.md) | 115 (a later addition to the customer-portal area, raised from a user question about the portal's lack of a ticket reply/conversation feature — not a numbered backlog epic; Story 115 planned, not yet implemented) |

---

## Build order and dependencies

Read top to bottom: an epic may only start once everything in its **Depends on** column exists,
and the **Needs from it** column says what it consumes. This is why the `NN` sequence is what it
is — the ordering is a data dependency, not a preference.

| Order | Epic | Depends on | Needs from it |
|---|---|---|---|
| 0 | project-foundation-architecture | — | the monorepo, split settings, the response envelope, exception handler, pagination, health endpoint. Everything else assumes these exist. |
| 1 | internationalization-design-system | 0 | i18n wiring, the design tokens, the shared UI kit and the form stack (RHF + Zod) that every later screen is built from |
| 2 | authentication-authorization | 0, 1 | envelope + error model (0) and the form/UI primitives for the login screens (1). Produces the `User`/`Role` models, JWT endpoints, the permission catalog and the route guards — **every later epic gates on these**. |
| 3 | customer-management | 2 | a user to act as, and `customers.*` permissions to enforce. Produces `Customer`, the record every ticket points at. |
| 4 | ticket-management | 3 | the `Customer` FK (`PROTECT`) a ticket cannot exist without |
| 5 | communication-channels | 4 | a `Ticket` for a `Message` to belong to; adds the channel adapters |
| 6 | agent-workspace | 4, 5 | the ticket queue (4) and the conversation (5) the workspace is assembled around |
| 7 | sla-automation | 4 + Redis/Celery | tickets to time, plus the broker and beat schedule from `config/celery.py` |
| 8 | design-intelligence-ui-ux-system | 1, and the screens from 3, 4, 6 | real screens to audit and refresh — a design pass before the screens exist has nothing to act on |
| 9 | knowledge-base | 2 | `knowledge_base.*` permissions; produces the `Article`/`FAQ` content that 10 and 13 consume |
| 10 | customer-portal | 2, 3, 4, 9 | the `portal.access` grant (2), the customer record (3), tickets to submit and track (4), articles/FAQs to read (9) |
| 11 | reports-analytics | 4, 7 | ticket data to aggregate and SLA state to report breach rates against |
| 12 | security-administration | 2 | roles and permissions to administer; adds audit log, API keys, MFA, retention |
| 13 | ai-features | 4, 9 | ticket text to summarize/classify (4) and articles to suggest as solutions (9) |
| 14 | integrations | 2, 3, 4 | API-key auth on top of the permission model (2), and customer/ticket data to sync and to fire webhooks about |
| 15 | public-landing-page | 1 | the design system; deliberately independent of the authenticated app |
| 16 | multi-department-multi-branch-branding | 2, 3, 4 | the scoping seam — departments/branches narrow user, customer and ticket visibility, so the three models must exist first |
| 17 | production-readiness | all of the above | performance/caching, security hardening and deployment posture applied to a complete system |
| — | bugs | `QA-REPORT-1` | defect remediation cut from the QA pass; Stories 99–105 close findings F-1…F-20 (F-3 and F-15 deferred by recorded decision) |
| — | portal-ticket-conversation | 10 | the portal ticket surface it adds a reply thread to |

Cross-cutting dependencies that are easy to miss:

- **Every epic from 2 onward depends on epic 2's permission catalog.** A new endpoint without a
  permission string is enforced-but-ungrantable — the exact failure class migration
  `0015_repair_admin_role_grants` exists to repair, and `sync_role_permissions` to detect.
- **Epics 7, 12 and 13 depend on infrastructure, not just code:** Redis + Celery worker and beat
  (7, 12's retention purge) and an AI provider key (13). Without them the code is present and
  inert, which is [assumption A5/A14](../../docs/ASSUMPTIONS.md#assumptions).
- **Epic 16 retro-fits scoping into models built in 3 and 4**, which is why it is late and why its
  stories touch existing querysets rather than adding new ones.

## Layer coverage

Which concerns each epic actually covers. `—` means "not applicable to this epic", not "missing".
`DB` counts schema changes (migrations) owned by the epic; `E2E` means the epic's plans carry
verification steps that cross frontend → API → database.

| Epic | Backend | DB / migrations | Auth & permissions | Frontend | E2E verification |
|---|---|---|---|---|---|
| 0 project-foundation-architecture | ✅ envelope, exceptions, pagination, health | — | — | ✅ app shell, router, API client | ✅ health round-trip |
| 1 internationalization-design-system | ✅ locale files, `Accept-Language` | — | — | ✅ tokens, UI kit, forms, RTL | ✅ language switch |
| 2 authentication-authorization | ✅ `accounts`, JWT, permission catalog | ✅ `User`, `Role` | ✅ **defines the model** | ✅ login, guards, `Can` | ✅ login → guarded route |
| 3 customer-management | ✅ `customers` + timeline/export/erasure | ✅ `Customer`, `ContactDetail`, `Note`, `Attachment` | ✅ `customers.*` | ✅ list, form, profile | ✅ CRUD + timeline |
| 4 ticket-management | ✅ `tickets` + 11 service modules | ✅ `Ticket`, `Category`, `TicketActivity`, `SavedView` | ✅ `tickets.*` | ✅ list, form, detail, my-tickets | ✅ create → status → history |
| 5 communication-channels | ✅ `communications` + 5 adapters | ✅ `Message`, provider configs | ✅ `communications.manage` | ✅ conversation, live chat, web form | ⚠️ provider-dependent (A13) |
| 6 agent-workspace | ✅ `agents` | ✅ `Task`, `QuickReply`, `InternalNote` | ✅ per-surface gates | ✅ home, panels, tasks | ✅ assign → note → task |
| 7 sla-automation | ✅ `sla` + Celery tasks | ✅ `SLAPolicy`, `AssignmentRule`, `EscalationRule` | ✅ via ticket perms | ✅ SLA badges, escalation UI | ⚠️ time-dependent, manual |
| 8 design-intelligence-ui-ux-system | — | — | — | ✅ DSN-0…DSN-17, MOTION-0 | ✅ contrast + RTL gates |
| 9 knowledge-base | ✅ `knowledge_base` + search | ✅ `Article`, `Category`, `FAQ` | ✅ `knowledge_base.*` | ✅ reader + authoring | ✅ author → search → read |
| 10 customer-portal | ✅ `portal` | — (reuses 3/4 models) | ✅ `portal.access` + owner scoping | ✅ portal layout, 10 screens | ✅ submit → track → CSAT |
| 11 reports-analytics | ✅ `reports` aggregation | — (read-only) | ✅ `reports.view` | ✅ 5 report screens | ✅ dashboard KPIs |
| 12 security-administration | ✅ audit log, API keys, MFA, retention | ✅ `AuditLog`, `TwoFactorRecoveryCode`, `ApiKey` | ✅ **hardens the model** | ✅ roles, users, audit log | ✅ role edit → enforcement |
| 13 ai-features | ✅ `ai` + per-feature services | ✅ `ChatbotSession` | ✅ throttled per user | ✅ inline assists, chatbot | ⚠️ provider-dependent (A14) |
| 14 integrations | ✅ ERP client/sync, webhook dispatch | ✅ `ErpConnection`, `ErpOrder`, `ErpSyncRun`, `WebhookSubscription`, `WebhookDelivery` | ✅ API-key auth | ✅ ERP + webhook settings | ⚠️ external-system-dependent |
| 15 public-landing-page | ✅ landing content endpoints | ✅ `LandingContent`, `LandingHighlight`, `LandingSocialLink` | — (public) | ✅ landing + settings editors | ✅ edit → public render |
| 16 multi-department-multi-branch-branding | ✅ scoping mixin + business hours | ✅ `Department`, `Branch`, `BusinessCalendar`, `WorkingWindow`, `Holiday`, `OrganizationSettings` | ✅ scope narrows visibility | ✅ org settings, branding | ✅ scope isolation |
| 17 production-readiness | ✅ caching, monitoring, security headers | — | ✅ throttling | ✅ build/bundle posture | ✅ health + cache behaviour |

Totals across the 18 numbered epics: backend work in 17, schema changes in 12, permission
surface in 14, frontend work in all 18, and end-to-end verification confirmed in 14 — the
remaining 4 depend on an external provider or on elapsed time.

`⚠️` rows are the honest ones — they cannot be verified without a live provider or a clock, and
their current verification state is recorded in
[`docs/VERIFICATION.md` § Coverage gaps](../../docs/VERIFICATION.md#coverage-gaps) rather than
assumed to pass.
