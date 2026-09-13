# portal-ticket-conversation — plan overview

Entry point for the **portal-ticket-conversation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 115 | [115-story-portal-ticket-conversation.md](115-story-portal-ticket-conversation.md) | Reply to Tickets from the Customer Portal | _(none yet)_ | SUPPORTOS-57 (PORTAL-2), SUPPORTOS-60 (PORTAL-5) |

## Dependency notes

Extends `PortalTicketDetailPage` (SUPPORTOS-57) with a message thread, reusing the existing `communications.Message` model untouched (no schema change) and the `CustomerScopedModelViewSet` + `validate_ticket` ownership pattern SUPPORTOS-60 (Submit Feedback/CSAT) established for a second customer-owned sub-resource hung off a ticket. No staff-side code changes — a portal-submitted reply is visible in the existing `TicketConversation` view unmodified.
