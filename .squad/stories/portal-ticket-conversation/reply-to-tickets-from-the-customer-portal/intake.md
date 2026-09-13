> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `jira` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/portal-ticket-conversation/reply-to-tickets-from-the-customer-portal/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Reply to Tickets from the Customer Portal
- **Feature slug (folder under `plans/`):** `portal-ticket-conversation`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `` *(no Jira ticket exists yet — link one later with `squad tracker link`)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Reply to tickets from the customer portal
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
PORTAL-2 (SUPPORTOS-57, "Track Requests") shipped a read-only ticket detail
page for customers: `PortalTicketDetailPage` explicitly excludes any
conversation/messages, by design, as an out-of-scope item ("Ticket
conversation/messages, internal notes, SLA status, or assignment controls on
the detail page ... All staff/agent-only concerns").

A customer can currently submit a ticket, watch its status change, and rate
it once resolved/closed — but cannot ask a follow-up question, answer an
agent's question, or attach more information without contacting support
through another channel. Staff already have a two-way conversation thread
(`TicketConversation` component, `apps.communications.models.Message`,
already used by the AI chatbot flow at `apps/portal/views.py`'s
`PortalChatbotView`/`_chatbot_state`).

This story gives the customer a way to view and add to that same message
thread from their own ticket detail page.
```

```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- A customer viewing one of their own tickets at `/portal/tickets/:id` can
  see the existing message thread for that ticket (customer- and
  agent-authored messages, oldest-first — matching staff `TicketConversation`
  ordering), not just the static fields already shown.
- The customer can submit a new message/reply on their own ticket regardless
  of ticket status (open, in-progress, resolved, or closed) — replying does
  not require the ticket to already be resolved/closed (unlike the CSAT
  feedback flow, which is post-resolution only).
- A submitted reply is persisted as a `Message` (`apps.communications.models`)
  with `direction=INBOUND`, associated with the correct ticket, and becomes
  visible to staff in the existing agent-facing `TicketConversation` view
  without any staff-side changes beyond what already renders `Message` rows.
- The endpoint/serializer enforces the same ownership check the existing
  `PortalFeedbackSerializer`/`PortalTicketViewSet` use: a customer can only
  read or post messages on a ticket that belongs to them (403/404 otherwise,
  not another customer's ticket data).
- Internal-only notes (`Note` model / staff "internal notes" concept, if
  distinct from `Message`) are never exposed to the portal — only the
  customer-visible conversation thread.
- Empty-thread and empty-message-body states are handled (no message list,
  or attempting to submit a blank reply) without a server error.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** SUPPORTOS-57 (PORTAL-2, "Track Requests" — created `PortalTicketDetailPage`, the page this story extends), SUPPORTOS-60 (PORTAL-5, "Submit Feedback/CSAT" — the other portal detail-page addition to follow as a precedent for a scoped, customer-owned sub-resource).
- **Depends on code areas or other stories:** `apps.communications.models.Message`, `apps.portal.views`/`apps.portal.serializers`, `apps.tickets.views.TicketViewSet` + `apps.tickets.serializers` (staff-side conversation, for parity), `frontend/src/features/tickets` staff `TicketConversation` component, `frontend/src/features/portal` (viewset, serializers, `PortalTicketDetailPage`, router).

## Extra notes (optional)

- Raised from a user question about why a customer "can't open a ticket and reply to it" — confirmed this is deliberate existing scope (not a bug): `PortalTicketDetailPage`'s own docstring and SUPPORTOS-57's plan both list "ticket conversation/messages" under "Explicitly out of scope."

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: `Message` model already exists in `apps/communications/models.py` with a `direction` (`INBOUND`/`OUTBOUND`) field; `apps/portal/views.py`'s `_chatbot_state()` already shows the pattern for serializing a ticket's `Message` queryset into a customer-safe shape (author normalized to `"customer"`/`"agent"`/`"bot"`, never exposing raw `direction`/`metadata`). The staff-side `TicketViewSet`/conversation endpoint (`backend/apps/tickets/views.py`, `apps/tickets/serializers.py`) is the closest precedent for a ticket-scoped message sub-resource; `CustomerScopedModelViewSet` (`apps/core/views.py`) is the base class `PortalTicketViewSet` already uses for ownership scoping and should extend to this new endpoint too.
- Frontend: `frontend/src/features/tickets/components/TicketDetailPage.tsx`'s `TicketConversation` section is the staff-side precedent to mirror (minus staff-only affordances); `PortalFeedbackFormPage.tsx`/`usePortalFeedbackMutations.ts` is the closest existing portal precedent for a scoped create-mutation form pattern to copy for posting a reply. Router: `frontend/src/app/router.tsx`'s existing `path: 'tickets/:id'` / `tickets/:id/feedback` portal routes.

## Out of scope

- What this story explicitly does **not** cover:
- Internal (staff-only) notes — those stay staff-only, never surfaced to the portal.
- Attachments/file uploads on a portal reply (unless the underlying `Message` model already supports this trivially — confirm during planning; if it requires new upload infrastructure, split into a follow-up story).
- Real-time updates (websockets/polling/push) for new agent replies — the customer sees new messages on page load/refresh, same as the rest of the portal.
- Any change to the existing CSAT feedback flow (SUPPORTOS-60) or its post-resolution-only gating.
- Editing or deleting a previously sent message/ticket, consistent with SUPPORTOS-57's existing "no update/destroy" scope for `PortalTicketViewSet`.
- Automated tests (standing project policy — no test cases are written in this repo).
