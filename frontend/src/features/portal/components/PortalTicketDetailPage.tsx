import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { usePortalTicket } from '../api/usePortalTicket'
import { ticketPriorityVariant, ticketStatusVariant } from '../lib/statusBadge'
import { PortalConversationSection } from './PortalConversationSection'

/**
 * A mostly read-only view of one of the customer's own tickets —
 * PORTAL-2, plus `PortalConversationSection`'s reply thread (a later
 * addition). Still no assign/escalate/status controls, no internal
 * notes — all staff/agent-only concerns the staff `TicketDetailPage`
 * (features/tickets/components/TicketDetailPage.tsx) has that this one
 * deliberately does not reuse or mirror.
 */
export function PortalTicketDetailPage() {
  const { t } = useTranslation('portal')
  const { date } = useFormatters()
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const isValidId = !Number.isNaN(id)

  const query = usePortalTicket(id, { enabled: isValidId })

  return (
    <div className="flex flex-col gap-4">
      <Link to="/portal/tickets" className="text-sm text-muted-foreground hover:underline">
        {t('tickets.detail.backToList')}
      </Link>
      {isValidId ? (
        <QueryBoundary query={query}>
          {(ticket) => (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle asChild className="text-lg">
                    <h1>{ticket.subject}</h1>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.status')}
                      </dt>
                      <dd>
                        <Badge variant={ticketStatusVariant(ticket.status)}>
                          {t(`tickets.statuses.${ticket.status}`)}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.priority')}
                      </dt>
                      <dd>
                        <Badge variant={ticketPriorityVariant(ticket.priority)}>
                          {t(`tickets.priorities.${ticket.priority}`)}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.category')}
                      </dt>
                      <dd>{ticket.category_name ?? t('tickets.fields.noCategory')}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.assignedAgent')}
                      </dt>
                      <dd>{ticket.assigned_agent_name ?? t('tickets.fields.unassigned')}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.createdAt')}
                      </dt>
                      <dd>{date(ticket.created_at)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.description')}
                      </dt>
                      <dd className="whitespace-pre-wrap">{ticket.description}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
              <PortalConversationSection ticketId={ticket.id} />
              {!ticket.has_feedback &&
              (ticket.status === 'resolved' || ticket.status === 'closed') ? (
                <Button asChild>
                  <Link to={`/portal/tickets/${ticket.id}/feedback`}>
                    {t('tickets.feedback.cta')}
                  </Link>
                </Button>
              ) : null}
              {ticket.has_feedback ? (
                <p className="text-sm text-muted-foreground">{t('tickets.feedback.thanks')}</p>
              ) : null}
            </div>
          )}
        </QueryBoundary>
      ) : null}
    </div>
  )
}
