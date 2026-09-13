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
