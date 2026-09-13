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
