import { api } from '@/shared/lib/api/client'

import type { PortalMessage, PortalMessageInput } from '../types/portalMessage'

export function createPortalMessage(input: PortalMessageInput): Promise<PortalMessage> {
  return api.post<PortalMessage>('/portal/messages/', input)
}
