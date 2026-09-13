# Story 115 — Reply to Tickets from the Customer Portal

## Prerequisites

- **PORTAL-2 complete:** [../customer-portal/44-story-track-requests-SUPPORTOS-57.md](../customer-portal/44-story-track-requests-SUPPORTOS-57.md) — `PortalTicketDetailPage` (`frontend/src/features/portal/components/PortalTicketDetailPage.tsx`), the page this story extends with a conversation section. That plan's own docstring for the page explicitly lists "no conversation" under scope excluded at the time — this story is the follow-up that fills it in.
- **PORTAL-5 complete:** [../customer-portal/47-story-submit-feedback-csat-SUPPORTOS-60.md](../customer-portal/47-story-submit-feedback-csat-SUPPORTOS-60.md) — the closest prior precedent for a second, scoped, customer-owned sub-resource hung off a ticket (`PortalFeedbackSerializer`/`PortalFeedbackViewSet`/`apps/portal/urls.py`). Task 3/4 below copy its `validate_ticket` + `CustomerScopedModelViewSet` + `perform_create`-forces-server-truth shape.
- **Verified: no staff-facing change is required.** `apps/communications/models.py`'s `Message` model (Story 13) already carries everything a portal reply needs — `ticket` (FK, `CASCADE`), `direction` (`Direction.INBOUND`/`OUTBOUND`, no default), `channel` (`Channel.WEB_FORM` already exists and is the correct value for a portal-authored message — the same channel `WebFormSubmissionView` (`apps/communications/views.py:369-394`) already uses for a ticket's very first inbound message), `body`, and `Meta.ordering = ("created_at",)` (chronological, oldest-first). **No model change, no migration.**
- **Verified: the staff conversation feed already reads every `Message` row regardless of who created it.** `MessageViewSet` (`apps/communications/views.py:57-106`) has no channel/creator filter beyond `?ticket=<id>`; a `Message` this story creates with `channel="web_form"`/`direction="inbound"` shows up in the existing staff `TicketConversation` (`frontend/src/features/tickets/components/TicketConversation.tsx`) with **zero staff-side code changes** — `MessageRow` already renders any `direction`/`channel` combination via its two `Badge`s and `t('conversation.directions.inbound')`/`t('conversation.channels.web_form')`, both already translated (`frontend/src/features/tickets/locales/{en,ar}.json`).
- **Verified — the `customer_field` nested-lookup finding from Story 47 does NOT block this story, and here is why.** Story 47's `## Prerequisites` found that `CustomerScopedModelViewSet.get_queryset()` and `HasPermission.has_object_permission` (`apps/core/views.py:38-66`, `apps/core/permissions.py`) both resolve `customer_field`, but by two different mechanisms: `get_queryset()` uses `queryset.filter(**{customer_field: customer})` (a real Django ORM call — a double-underscore path like `"ticket__customer"` is valid syntax here), while `has_object_permission` uses `getattr(obj, f"{customer_field}_id", None)` (a **single attribute lookup** — `"ticket__customer_id"` is never a real attribute on a `Message` instance, always `None`). That second mechanism only runs when DRF calls `get_object()`, which only `RetrieveModelMixin`/`UpdateModelMixin`/`DestroyModelMixin` trigger. **This story's viewset (task 2) routes only `list` and `create`** — never `retrieve`/`update`/`partial_update`/`destroy` — the same restricted-action shape `PortalFeedbackViewSet` (create-only) and `PortalTicketViewSet` (no update/destroy) already both use. `list` is scoped by `get_queryset()` alone (the ORM-path-safe mechanism); `create` has no existing object to check permissions against at all. So `customer_field = "ticket__customer"` is safe here specifically because no object-level permission check ever runs against a `Message` in this feature — unlike `Feedback`, which chose a denormalized direct FK instead. Do not add `retrieve`/`update`/`destroy` routes for `PortalMessageViewSet` without first revisiting this finding.
- **Verified: `Message.body` has no `blank=True`** (`apps/communications/models.py`, the `body = models.TextField(_("body"))` line) — DRF's serializer generation makes it `required=True` by default, so an empty reply body is rejected server-side with no extra validation code needed, the same free validation `Feedback.rating`'s missing `blank=True` already gives Story 47.
- **Verified: `frontend/.oxlintrc.json`'s `no-restricted-imports` rule** (`"group": ["@/features/*", "@/features/*/**"]`) forbids importing `frontend/src/features/tickets/components/TicketConversation.tsx` or `frontend/src/features/tickets/types/message.ts` from `features/portal/`. This story's frontend types/component (tasks 6, 8) are therefore self-contained duplicates, the same boundary `portalTicket.ts`/`portalFeedback.ts` already work within — confirmed by their own doc comments.

---

## Story Goal

Let a customer read and add to their own ticket's message thread from `PortalTicketDetailPage` — the "conversation" that page's own PORTAL-2 docstring currently excludes — reusing the existing `communications.Message` model and the staff `TicketConversation`'s data untouched, with a new, narrower, customer-facing read/write surface.

1. **`PortalMessageSerializer`** (`apps/portal/serializers.py`) — a customer-safe view of `Message`: `id`, `ticket`, a derived `author` (`"customer"` | `"agent"`, never raw `direction`), `body`, `created_at`. No `channel`/`metadata`/`target_address` — those are staff/adapter concerns with no portal equivalent.
2. **`PortalMessageViewSet`** (`apps/portal/views.py`), `CustomerScopedModelViewSet`-based, routing only `list` and `create` — reusing `Permissions.PORTAL_ACCESS` (no new permission constant). `list` requires `?ticket=<id>` (mirrors `MessageViewSet`'s own required-param shape); `create` validates the ticket belongs to the caller and forces `direction=INBOUND`, `channel=WEB_FORM` server-side.
3. **No ticket-status gate.** Unlike `PortalFeedbackSerializer` (post-resolution only), a customer can reply on an `open`, `in_progress`, `resolved`, or `closed` ticket alike — this story's acceptance criteria say so explicitly, and there is no product reason a customer should be blocked from adding information to an active ticket.
4. **`PortalConversationSection`**, a new component embedded directly in `PortalTicketDetailPage` (not a separate route, unlike `PortalFeedbackFormPage`) — a message list plus a body-only reply form, the minimal subset of staff `TicketConversation` that makes sense for a customer (no channel picker, no `target_address`, no quick replies, no AI summarize/suggest-reply).
5. **Zero staff-side code changes.** A reply submitted through this story's endpoint is immediately visible, unmodified, in the existing staff `TicketConversation` view — see `## Prerequisites`' verified finding.

### Explicitly out of scope

- **Internal (staff-only) notes.** Not the same model as `Message` — never touched or exposed here.
- **Attachments/file uploads on a portal reply.** `Message` has no attachment field today; adding one is a larger, separate change.
- **Real-time updates** (websockets/polling/push) for new agent replies on the portal side. `useTicketChatSocket` (staff-only, `frontend/src/features/tickets/api/useTicketChatSocket.ts`) is not reused or mirrored here — the customer sees new messages on page load/refetch, the same as every other portal page today.
- **Channel selection, `target_address`, quick replies, AI summarize/suggest-reply.** All staff-only affordances of `TicketConversation`/`ReplyForm` (`frontend/src/features/tickets/components/TicketConversation.tsx:170-367`) — a portal reply is always `channel=web_form`, always addressed nowhere in particular (no `target_address` concept for an inbound customer message, the same as every other inbound `Message` today).
- **Editing or deleting a previously sent message.** `PortalMessageViewSet` routes `list`/`create` only — consistent with `PortalTicketViewSet` (no update/destroy) and `PortalFeedbackViewSet` (create-only).
- **Any change to the CSAT feedback flow (PORTAL-5) or its post-resolution-only gating.** Untouched.
- **Automated tests.** Standing policy, `CONVENTIONS.md` §16. See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/portal-ticket-conversation/reply-to-tickets-from-the-customer-portal/intake.md` — the story intake this plan implements; no tracker id yet (`squad new-story --no-tracker`).
2. `backend/apps/communications/models.py` lines 8-67 — the full `Message` model: `Direction`/`Channel` choices (16-25), `ticket` FK (30-32, `CASCADE`), `target_address` (44-55, why it stays blank on every inbound message), `Meta.ordering = ("created_at",)` (57-62, chronological).
3. `backend/apps/communications/serializers.py` lines 1-92 — `MessageSerializer` (the staff shape) and its `validate()` (44-92, `target_address` resolution) — confirms `PortalMessageSerializer` (task 1) needs none of this: a portal reply never sets `channel`/`target_address` itself.
4. `backend/apps/communications/views.py` lines 57-106 — `MessageViewSet`: `get_queryset()`'s required `?ticket=` param (75-86) and `perform_create()`'s outbound-only adapter dispatch (88-105, confirms an `INBOUND` message never calls `adapter.send()` — task 2's `perform_create` needs no adapter-resilience code at all, unlike `MessageViewSet`'s).
5. `backend/apps/portal/serializers.py` (full file, post-PORTAL-5, 116 lines) — `PortalFeedbackSerializer.validate_ticket` (84-103) is the exact ownership-check shape task 1 copies, minus the status gate.
6. `backend/apps/portal/views.py` (full file, post-AI-5, 245 lines) — `PortalFeedbackViewSet` (111-136) is the exact `CustomerScopedModelViewSet`/`perform_create` shape task 2 copies; `_chatbot_state()` (139-163) is the existing precedent for deriving `"customer"`/`"agent"` from `Message.direction` instead of exposing it raw — task 1's `get_author` reuses that exact two-way branch (no `"bot"` case needed here, unlike `_chatbot_state`, since a portal reply thread has no bot messages).
7. `backend/apps/portal/urls.py` (full file, post-AI-5, 39 lines) — task 3 adds one more `path()`, same plain-`path()`-not-router shape as every existing entry (the file's own top comment explains why: this viewset does not need router-generated update/destroy routes).
8. `backend/apps/core/views.py` lines 38-66 — `CustomerScopedModelViewSet`, read together with `## Prerequisites`' nested-lookup finding before writing task 2's `customer_field`.
9. `frontend/src/features/tickets/components/TicketConversation.tsx` (full file, 368 lines) — the staff precedent task 8's `PortalConversationSection` narrows: `MessageRow` (149-168) for the list-row shape, `ReplyForm`'s `onSubmit`/`mutation.mutate` wiring (276-289) for the submit pattern, both stripped of channel/target-address/quick-reply/AI concerns.
10. `frontend/src/features/tickets/api/{getMessages.ts,useMessages.ts,useMessageMutations.ts}` — the `api.getPage('/messages/', { params: { ticket, page_size: 100 } })` + `useQuery` + `useMutation`/`invalidateQueries` pattern tasks 6-7's portal equivalents copy verbatim, pointed at `/portal/messages/`.
11. `frontend/src/features/portal/types/portalFeedback.ts` and `api/{createPortalFeedback.ts,usePortalFeedbackMutations.ts}` — the closest existing **portal** precedent (not `features/tickets/`) for a self-contained type + create-mutation pair task 6-7 follow the same file-splitting convention of.
12. `frontend/src/features/portal/components/PortalTicketDetailPage.tsx` (full file, 111 lines, post-PORTAL-5) — task 9 adds one import and one JSX block directly after the existing `</Card>`, before the feedback CTA block.
13. `frontend/src/features/portal/locales/{en,ar}.json` (full files, post-PORTAL-5) — task 10 adds a `tickets.conversation` block; `frontend/src/features/tickets/locales/en.json` lines 116-146 (the staff `conversation` block) is the naming precedent to narrow, not copy verbatim (no `channels`/`targetAddress`/`quickReply`/`summarize`/`suggestReply` keys needed).
14. `frontend/.oxlintrc.json` lines 4-17 — the `no-restricted-imports` rule confirming task 6/8 must not import from `features/tickets/`.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **A customer can view and add to their own ticket's message thread from the ticket detail page.** | Intake acceptance criteria | `PortalConversationSection` embedded in `PortalTicketDetailPage` (task 9); `PortalMessageViewSet.list` scoped by `CustomerScopedModelViewSet` (task 2). |
| **Replying does not require the ticket to be resolved/closed.** | Intake acceptance criteria | `PortalMessageSerializer.validate_ticket` (task 1) checks ownership only — no status branch, unlike `PortalFeedbackSerializer.validate_ticket`. |
| **A reply becomes visible to staff via the existing conversation view, with no staff-side change.** | Intake acceptance criteria | `channel=web_form`, `direction=inbound` (task 2's `perform_create`) — `MessageViewSet`/`TicketConversation` already render any `Message` row unconditionally; see `## Prerequisites`' verified finding. |
| **Ownership is enforced — a customer cannot read or post on another customer's ticket.** | Intake acceptance criteria | `CustomerScopedModelViewSet.get_queryset()` (reads) + `PortalMessageSerializer.validate_ticket` (writes) — the same two-layer defense every prior portal create endpoint uses. |
| **Internal-only notes are never exposed to the portal.** | Intake acceptance criteria | Not applicable to any file this story touches — internal notes are not `Message` rows; nothing here reads or exposes them. |
| **A feature must not import from another feature.** | `frontend/.oxlintrc.json` §15 | `features/portal/types/portalMessage.ts` and `components/PortalConversationSection.tsx` are self-contained; nothing imports from `features/tickets/`. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — `PortalMessageSerializer`

**File: `backend/apps/portal/serializers.py`** — add the import and the new class:

```python
from apps.communications.models import Message
```

```python
class PortalMessageSerializer(BaseModelSerializer):
    """A customer's own reply on their ticket's conversation — the portal
    counterpart to `MessageViewSet`'s staff-facing shape. No
    staff-facing serializer is subclassed (unlike `PortalTicketSerializer`
    narrowing `TicketSerializer`) — this exposes a deliberately narrower
    field set (`channel`/`metadata`/`target_address` all omitted), so it
    stands alone, the same relationship `PortalFeedbackSerializer` has to
    `Feedback` (no staff viewer exists to subclass either).

    `author` is derived rather than exposing `direction` raw — the same
    reasoning `apps.portal.views._chatbot_state()` already documents: "a
    customer-facing surface should not have to know that 'outbound' means
    'not the customer.'"
    """

    author = serializers.SerializerMethodField()
    immutable_fields = ("ticket",)

    class Meta(BaseModelSerializer.Meta):
        model = Message
        fields = ("id", "ticket", "author", "body", "created_at")

    def get_author(self, message: Message) -> str:
        return "customer" if message.direction == Message.Direction.INBOUND else "agent"

    def validate_ticket(self, ticket: Ticket) -> Ticket:
        """Ownership only — deliberately no status branch. Contrast
        `PortalFeedbackSerializer.validate_ticket` (task's sibling,
        post-resolution only): this story's acceptance criteria say a
        customer can reply regardless of ticket status.
        """
        customer = self.context["request"].user.customer_profile
        if ticket.customer_id != customer.id:
            raise serializers.ValidationError(_("That ticket does not belong to you."))
        return ticket
```

`Ticket` and `_` are already imported at the top of this file (`from apps.tickets.models import Feedback, Ticket`, `from django.utils.translation import gettext_lazy as _`) — no new import needed for either.

---

### 2 — `PortalMessageViewSet`

**File: `backend/apps/portal/views.py`** — add the import and the new class (`Message` is already imported at the top of this file for `_chatbot_state`, line 14):

```python
from .serializers import (
    PortalChatbotMessageSerializer,
    PortalFeedbackSerializer,
    PortalMessageSerializer,
    PortalTicketSerializer,
)
```

```python
class PortalMessageViewSet(CustomerScopedModelViewSet):
    """A customer's own reply thread on their tickets. `list` + `create`
    only — never `retrieve`/`update`/`partial_update`/`destroy` (see
    `## Prerequisites`' verified finding on why `customer_field` being a
    nested lookup is safe specifically because of this restricted action
    set; do not add those routes without re-reading that finding first).

    `customer_field = "ticket__customer"` — `Message` has no direct
    `customer` FK (unlike `Feedback`, which denormalized one specifically
    to support `has_object_permission`'s single-attribute lookup — not
    needed here since no object-level permission check ever runs against
    a `Message` through this viewset).
    """

    customer_field = "ticket__customer"
    queryset = Message.objects.select_related("ticket").all()
    serializer_class = PortalMessageSerializer
    permission_map = {
        "list": Permissions.PORTAL_ACCESS,
        "create": Permissions.PORTAL_ACCESS,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        # Same required-param shape as MessageViewSet.get_queryset
        # (apps/communications/views.py:75-86) — a conversation list with
        # no ticket filter makes no sense for either surface.
        ticket_id = self.request.query_params.get("ticket")
        if not ticket_id:
            raise ValidationError({"ticket": [_("This query parameter is required.")]})
        try:
            ticket_id = int(ticket_id)
        except ValueError:
            raise ValidationError({"ticket": [_("Must be a valid ticket id.")]}) from None
        return queryset.filter(ticket_id=ticket_id)

    def perform_create(self, serializer):
        # Same guard as PortalTicketViewSet.perform_create /
        # PortalFeedbackViewSet.perform_create — a staff account can hold
        # portal.access (e.g. super_admin) without ever having a linked
        # Customer row.
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(
                _("Only customer accounts can send messages through the portal.")
            )
        # A portal reply is always inbound, always web_form — never
        # client-controlled. No adapter dispatch: MessageViewSet.perform_create
        # only calls adapter.send() for OUTBOUND messages
        # (apps/communications/views.py:88-105); an inbound customer
        # message needs no delivery step.
        serializer.save(direction=Message.Direction.INBOUND, channel=Message.Channel.WEB_FORM)
```

`ValidationError`, `PermissionDenied`, `Permissions`, and `_` are all already imported at the top of this file — no new imports needed beyond `Message` (already present) and the serializer above.

---

### 3 — Route `GET`/`POST /api/portal/messages/`

**File: `backend/apps/portal/urls.py`** — add the import and one `path()`:

```python
from .views import (
    PortalChatbotHandoffView,
    PortalChatbotView,
    PortalFeedbackViewSet,
    PortalMessageViewSet,
    PortalTicketViewSet,
)
```

```python
    path(
        "portal/messages/",
        PortalMessageViewSet.as_view({"get": "list", "post": "create"}),
        name="portal-message-list",
    ),
```

Add it directly after the existing `portal/feedback/` entry and before `portal/chatbot/`. Endpoint: `GET /api/portal/messages/?ticket=<id>` and `POST /api/portal/messages/`.

**No migration required** — `Message` is unchanged; only new application code (serializer, viewset, URL) is added.

---

## Frontend Tasks

### 4 — `features/portal/types/portalMessage.ts`

**Create file: `frontend/src/features/portal/types/portalMessage.ts`**

```ts
/** Mirrors `apps.portal.serializers.PortalMessageSerializer` — the
 * customer-visible half of a ticket's conversation. Not imported from
 * `features/tickets/types/message.ts` — `no-restricted-imports`
 * (`frontend/.oxlintrc.json` §15) forbids a cross-feature import, the
 * same boundary `portalTicket.ts`/`portalFeedback.ts` already work
 * within. Deliberately narrower than the staff `Message` type: no
 * `direction`/`channel`/`metadata`/`target_address` — `author` is
 * derived server-side instead, the same reasoning
 * `PortalChatbotView._chatbot_state()` (backend) already documents for
 * not exposing raw `direction` to a customer-facing surface. */
export const PORTAL_MESSAGE_AUTHORS = ['customer', 'agent'] as const
export type PortalMessageAuthor = (typeof PORTAL_MESSAGE_AUTHORS)[number]

export type PortalMessage = {
  id: number
  ticket: number
  author: PortalMessageAuthor
  body: string
  created_at: string
}

/** The write shape. `ticket` comes from the ticket detail page the
 * reply form is embedded in, never a field the customer edits. */
export type PortalMessageInput = {
  ticket: number
  body: string
}
```

---

### 5 — `features/portal/api/` for messages

**Create file: `frontend/src/features/portal/api/getPortalMessages.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { PortalMessage } from '../types/portalMessage'

// page_size: 100 (server max) — same no-pagination-UI simplification
// the staff `getMessages.ts` already uses for a conversation thread. No
// `ordering` param — `Message.Meta.ordering` (chronological) is already
// the order this view needs.
export function getPortalMessages(ticketId: number): Promise<Page<PortalMessage>> {
  return api.getPage<PortalMessage>('/portal/messages/', {
    params: { ticket: ticketId, page_size: 100 },
  })
}
```

**Create file: `frontend/src/features/portal/api/usePortalMessages.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPortalMessages } from './getPortalMessages'
import { portalTicketKeys } from './portalTicketKeys'

export function usePortalMessages(ticketId: number) {
  return useQuery({
    queryKey: portalTicketKeys.resource('messages', ticketId),
    queryFn: () => getPortalMessages(ticketId),
  })
}
```

**Create file: `frontend/src/features/portal/api/createPortalMessage.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalMessage, PortalMessageInput } from '../types/portalMessage'

export function createPortalMessage(input: PortalMessageInput): Promise<PortalMessage> {
  return api.post<PortalMessage>('/portal/messages/', input)
}
```

**Create file: `frontend/src/features/portal/api/usePortalMessageMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPortalMessage } from './createPortalMessage'
import { portalTicketKeys } from './portalTicketKeys'
import type { PortalMessageInput } from '../types/portalMessage'

/**
 * Scoped invalidation of this ticket's own `messages` key — a new reply
 * cannot affect another ticket's conversation or the ticket list, the
 * same reasoning `useCreateMessage` (staff) already documents.
 */
export function useCreatePortalMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PortalMessageInput) => createPortalMessage(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: portalTicketKeys.resource('messages', ticketId) }),
  })
}
```

---

### 6 — `PortalConversationSection`

**Create file: `frontend/src/features/portal/components/PortalConversationSection.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextareaField, useAppForm } from '@/shared/ui/form'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreatePortalMessage } from '../api/usePortalMessageMutations'
import { usePortalMessages } from '../api/usePortalMessages'
import type { PortalMessage } from '../types/portalMessage'

const replySchema = z.object({ body: requiredString(5000) })
type ReplyFormValues = z.output<typeof replySchema>
const EMPTY_REPLY: ReplyFormValues = { body: '' }

/**
 * The customer's own, narrower half of the staff `TicketConversation`
 * (`features/tickets/components/TicketConversation.tsx`) — not imported
 * from there, `no-restricted-imports` (`frontend/.oxlintrc.json` §15)
 * forbids the cross-feature import. No channel picker, no
 * `target_address`, no quick replies, no AI summarize/suggest-reply —
 * all staff-only affordances out of this story's scope. A customer can
 * reply regardless of the ticket's status (unlike `PortalFeedbackFormPage`,
 * which only unlocks post-resolution).
 */
export function PortalConversationSection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('portal')
  const query = usePortalMessages(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('tickets.conversation.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('tickets.conversation.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <ReplyForm ticketId={ticketId} />
      </CardContent>
    </Card>
  )
}

function MessageRow({ message }: { message: PortalMessage }) {
  const { t } = useTranslation('portal')
  const { date } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={message.author === 'agent' ? 'default' : 'secondary'}>
          {t(`tickets.conversation.authors.${message.author}`)}
        </Badge>
        <span>{date(message.created_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — a message body is free-form prose that
          may itself be Arabic, the same reasoning staff `MessageRow`
          already applies. */}
      <p className="whitespace-pre-wrap">{message.body}</p>
    </li>
  )
}

function ReplyForm({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('portal')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: replySchema, defaultValues: EMPTY_REPLY })
  const mutation = useCreatePortalMessage(ticketId)

  function onSubmit(values: ReplyFormValues) {
    mutation.mutate(
      { ticket: ticketId, body: values.body },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('tickets.conversation.sent') })
          form.reset(EMPTY_REPLY)
          setFormErrors([])
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <TextareaField
          control={form.control}
          name="body"
          label={t('tickets.conversation.fields.body')}
        />
        <FormErrorSummary errors={formErrors} />
        <SubmitButton pending={mutation.isPending} className="self-start">
          {t('tickets.conversation.actions.send')}
        </SubmitButton>
      </form>
    </Form>
  )
}
```

---

### 7 — Embed it in `PortalTicketDetailPage`

**File: `frontend/src/features/portal/components/PortalTicketDetailPage.tsx`** — add the import and one line directly after the existing `</Card>`, before the feedback CTA block:

```tsx
import { PortalConversationSection } from './PortalConversationSection'
```

```tsx
                </CardContent>
              </Card>
              <PortalConversationSection ticketId={ticket.id} />
              {!ticket.has_feedback &&
              (ticket.status === 'resolved' || ticket.status === 'closed') ? (
```

No other line in this file changes. **No router changes required** — this is an embedded section on the existing `/portal/tickets/:id` route, not a new page (unlike PORTAL-5's separate `/feedback` route).

---

### 8 — Locale keys

**File: `frontend/src/features/portal/locales/en.json`** — add a `conversation` block inside the existing `tickets` key, alongside `feedback`:

```json
    "conversation": {
      "title": "Conversation",
      "empty": "No messages yet.",
      "authors": {
        "customer": "You",
        "agent": "Agent"
      },
      "fields": {
        "body": "Message"
      },
      "actions": {
        "send": "Send"
      },
      "sent": "Your message has been sent."
    }
```

**File: `frontend/src/features/portal/locales/ar.json`** — the same key structure, translated:

```json
    "conversation": {
      "title": "المحادثة",
      "empty": "لا توجد رسائل بعد.",
      "authors": {
        "customer": "أنت",
        "agent": "الموظف"
      },
      "fields": {
        "body": "الرسالة"
      },
      "actions": {
        "send": "إرسال"
      },
      "sent": "تم إرسال رسالتك."
    }
```

Every key present in `en` must exist in `ar` (`CONVENTIONS.md` §18) — a missing key falls back silently to English.

---

## Edge Cases & Failure Modes

- **An empty-thread ticket shows "No messages yet.", not a blank card.** `QueryBoundary`'s `isEmpty`/`empty` props (task 6) — the same pattern staff `TicketConversation` already uses.
- **A blank reply is rejected before any request fires.** `requiredString(5000)` (task 6's `replySchema`) blocks client-side submission; the server independently rejects it too (`Message.body` has no `blank=True` — DRF's default `required=True`), so a direct API call bypassing the UI still gets a clean `400`, not a `500`.
- **A reply on another customer's ticket id gets a clean `400` naming `ticket`, not a `403`/`404`/`500`.** `PortalMessageSerializer.validate_ticket` (task 1) — the same explicit-validation shape `PortalFeedbackSerializer.validate_ticket` already uses, for the same reason: `create()` never calls `get_queryset()`, so scoping alone cannot protect a write.
- **`list` with no `?ticket=` param 400s cleanly** (`PortalMessageViewSet.get_queryset`, task 2) — mirrors `MessageViewSet.get_queryset`'s identical required-param behavior.
- **A reply on an `open`/`in_progress` ticket succeeds** — deliberately, no status branch in `validate_ticket` (contrast `PortalFeedbackSerializer`, which has one). This is the story's whole point, not an oversight.
- **A staff account without `portal.access` gets a clean `403`; an unauthenticated request gets `401`.** `BaseModelViewSet`'s `IsAuthenticated`+`HasPermission` (`apps/core/views.py:14-35`), `permission_map = {"list": PORTAL_ACCESS, "create": PORTAL_ACCESS}`.
- **A `portal.access`-holding staff account with no linked `Customer` row** (the same `super_admin` exception `PortalTicketViewSet.perform_create`'s own comment names) reaching `create` — `validate_ticket` (task 1) accesses `self.context["request"].user.customer_profile` directly, with no `hasattr` guard, the same as `PortalFeedbackSerializer.validate_ticket` already does. This means an unguarded `AttributeError` (500) is possible in this specific edge case — a **pre-existing, shared characteristic** of the `Feedback` endpoint too, not a regression introduced here. Not fixed in this story (out of scope — fixing it means touching `PortalFeedbackSerializer` as well, a separate cross-cutting change); `list`'s `CustomerScopedModelViewSet.get_queryset()` path is unaffected (`getattr(self.request.user, "customer_profile", None)` there already guards safely).
- **A `Message` created through this endpoint appears in the staff `TicketConversation` immediately, with the correct "Customer" badge.** `direction=INBOUND` (task 2) — `MessageRow` (staff) already renders `t('conversation.directions.inbound')` = "Customer" for it, no staff-side change needed.
- **Deleting a ticket takes its messages with it.** `Message.ticket`'s `CASCADE` (pre-existing, `apps/communications/models.py:30-32`) — unaffected by this story.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` — clean, and the existing suite's passing count (`python manage.py test`) is unchanged by this story (no test files touched).
2. `ruff format --check .` / `ruff check .` on the new and changed Python (`apps/portal/serializers.py`, `apps/portal/views.py`, `apps/portal/urls.py`).
3. `npm run build` — typechecks the new types/API files, `PortalConversationSection`, and the `PortalTicketDetailPage` edit.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files.
5. Real HTTP checks proving ownership, the missing-`?ticket=`-param rejection, and the no-status-gate behavior all actually fire, and that a portal-created message is visible via the staff `/api/messages/?ticket=<id>` endpoint unmodified — Verification Steps 3–8. This is where the story's actual claims get tested; nothing static can see any of them.

---

## Migration / Rollback

**No schema migration.** `communications.Message` is unchanged — only new application code (one serializer, one viewset, one URL, new frontend files, one edit to an existing frontend file, two locale additions).

**Rollback:** revert the commits. No `npm install`/`pip install` needed — no new dependency in either app. Nothing else references `PortalMessageViewSet`/`PortalMessageSerializer`, so removing them cannot orphan any other code.

**Half-applied states to avoid:**

- **Task 3's URL route before task 1/2's serializer/viewset exist** → `ImportError` on Django startup. Ship tasks 1-2 before task 3.
- **Task 7's `PortalTicketDetailPage` import before task 6's `PortalConversationSection.tsx` exists** → `npm run build` fails on the missing import. Ship task 6 before task 7.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
2. **No migration to apply** — `python manage.py showmigrations communications` shows no new, unapplied migration (none was generated).
3. **A customer can reply on their own ticket regardless of status:**

   ```powershell
   $t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"cust1@example.com\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
   # Use an OPEN (not resolved/closed) ticket id belonging to cust1.
   curl.exe -s -X POST http://127.0.0.1:8000/api/portal/messages/ -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d '{\"ticket\":<open-ticket-id>,\"body\":\"Any update on this?\"}'
   ```

   Expect `201`, `data.author == "customer"`.
4. **The reply is visible via the staff endpoint, unmodified:** `GET /api/messages/?ticket=<same-id>` with a staff token holding `tickets.view` → the new row appears with `direction: "inbound"`, `channel: "web_form"`.
5. **List requires `?ticket=`:** `GET /api/portal/messages/` (no query param) with `$t` → `400`, `error.fields.ticket` present.
6. **A reply on another customer's ticket id is rejected:** repeat step 3 with a ticket id belonging to `cust2`. Expect `400`, `error.fields.ticket` = *"That ticket does not belong to you."*
7. **A blank body is rejected:** repeat step 3 with `"body":""`. Expect `400` naming `body`.
8. **A staff account, or unauthenticated request, cannot use the portal endpoint:** repeat step 3 with a staff token lacking `portal.access` → `403`. With no `Authorization` header → `401`.
9. **Frontend builds and lints clean:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0.
10. **The end-to-end flow works in the browser, in both languages, and cross-checks against the staff view.** With the backend running: `npm run dev`, log in as `cust1@example.com`, open any one of their tickets (any status) — the conversation section shows existing messages (or "No messages yet.") and a reply box. Send a reply: a success toast appears, the message appears in the list immediately. Log in separately as a staff/agent account, open the same ticket's staff detail page, and confirm the reply appears in `TicketConversation` with a "Customer" badge. Switch the portal to Arabic and repeat sending a reply on a different ticket: all copy (title, empty state, badge labels, button, toast) renders in Arabic.

---

## Done Criteria

- [ ] `PortalMessageSerializer` exists in `apps/portal/serializers.py` — `author` derived from `direction` (never exposes it raw), `validate_ticket` checks ownership only (no status gate).
- [ ] `PortalMessageViewSet` exists in `apps/portal/views.py`, routing only `list`/`create`, `permission_map = {"list": Permissions.PORTAL_ACCESS, "create": Permissions.PORTAL_ACCESS}` — no new `Permissions` constant, `customer_field = "ticket__customer"`.
- [ ] `GET`/`POST /api/portal/messages/` routed in `apps/portal/urls.py`.
- [ ] Verified by real HTTP (Steps 3-8): a customer can reply on their own ticket regardless of status; the reply is visible unmodified via the staff `/api/messages/` endpoint; a missing `?ticket=` param, another customer's ticket, and a blank body are all rejected cleanly; staff/unauthenticated callers are denied.
- [ ] `frontend/src/features/portal/types/portalMessage.ts`, `api/{getPortalMessages.ts,usePortalMessages.ts,createPortalMessage.ts,usePortalMessageMutations.ts}`, and `components/PortalConversationSection.tsx` all exist and are self-contained (no `features/tickets/` import).
- [ ] `PortalTicketDetailPage` renders `PortalConversationSection` for every ticket regardless of status — no new route added.
- [ ] `features/portal/locales/{en,ar}.json` both have the new `tickets.conversation.*` block, with identical key sets.
- [ ] `python manage.py check`/`test`, `ruff format --check .`, `ruff check .`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0.
- [ ] `.squad/plans/portal-ticket-conversation/00-overview.md` updated with this story.
- [ ] `.squad/plans/00-index.md` gains a row for the new `portal-ticket-conversation` feature slug.

**STOP HERE. Report to the user and wait for confirmation before implementing.**
