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
