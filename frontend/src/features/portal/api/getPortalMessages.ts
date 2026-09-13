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
