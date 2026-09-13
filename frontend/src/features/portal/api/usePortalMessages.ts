import { useQuery } from '@tanstack/react-query'

import { getPortalMessages } from './getPortalMessages'
import { portalTicketKeys } from './portalTicketKeys'

export function usePortalMessages(ticketId: number) {
  return useQuery({
    queryKey: portalTicketKeys.resource('messages', ticketId),
    queryFn: () => getPortalMessages(ticketId),
  })
}
