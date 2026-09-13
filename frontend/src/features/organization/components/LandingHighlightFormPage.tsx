import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { DEFAULT_ICON_KEY, LANDING_ICON_KEYS, LandingIcon, isIconKey } from '@/shared/landing'
import { choice, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
  useAppForm,
} from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import {
  useCreateLandingHighlight,
  useUpdateLandingHighlight,
} from '../api/useLandingHighlightMutations'
import { useLandingHighlight } from '../api/useLandingHighlight'
import type { LandingHighlightInput, LandingHighlightRow } from '../types/landing'

const LIST_PATH = '/settings/landing/highlights'

const schema = z.object({
  title_en: requiredString(120),
  title_ar: requiredString(120),
  description_en: requiredString(2000),
  description_ar: requiredString(2000),
  // A fixed set, mirroring `LandingHighlight.Icon` — an admin cannot type a
  // name that renders nothing where a card's icon belongs.
  icon: choice(LANDING_ICON_KEYS),
  // NOT `positiveInt()`: that helper floors at 1, and `order`'s default is 0
  // — the same call `FaqFormPage.tsx` records for its own `order` field.
  order: z.coerce.number().int().min(0).max(9999),
})

type FormValues = z.output<typeof schema>

const EMPTY_DEFAULTS: FormValues = {
  title_en: '',
  title_ar: '',
  description_en: '',
  description_ar: '',
  icon: DEFAULT_ICON_KEY,
  order: 0,
}

function toDefaults(highlight: LandingHighlightRow): FormValues {
  return {
    title_en: highlight.title_en,
    title_ar: highlight.title_ar,
    description_en: highlight.description_en,
    description_ar: highlight.description_ar,
    // Plain `string` from the API — narrow, falling back to the model's own
    // default, so a value this bundle does not know still opens the form.
    icon: isIconKey(highlight.icon) ? highlight.icon : DEFAULT_ICON_KEY,
    order: highlight.order,
  }
}

function toHighlightInput(values: FormValues): LandingHighlightInput {
  return { ...values }
}

/** A full page, not a dialog — this form's three bilingual Cards with
 *  auto-growing textareas can exceed the viewport height, which left the
 *  Save button unreachable in a fixed-height dialog. Formerly `DSN-15`
 *  (Story 112) classified this as a dialog on width alone; that premise
 *  didn't account for height. See `TicketFormPage` for the same
 *  create/edit-in-one-component shape. */
export function LandingHighlightFormPage() {
  const { id: idParam } = useParams()
  const isEdit = idParam !== undefined
  const id = Number(idParam)

  const highlightQuery = useLandingHighlight(id, { enabled: isEdit })

  if (!isEdit) {
    return <LandingHighlightForm mode="create" />
  }

  return (
    <QueryBoundary query={highlightQuery}>
      {(highlight) => <LandingHighlightForm mode="edit" id={id} highlight={highlight} />}
    </QueryBoundary>
  )
}

function LandingHighlightForm({
  mode,
  id,
  highlight,
}: {
  mode: 'create' | 'edit'
  id?: number
  highlight?: LandingHighlightRow
}) {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: highlight ? toDefaults(highlight) : EMPTY_DEFAULTS,
  })

  const createMutation = useCreateLandingHighlight()
  const updateMutation = useUpdateLandingHighlight(id ?? 0)
  const mutation = mode === 'create' ? createMutation : updateMutation

  const iconDraft = form.watch('icon')

  const iconOptions = LANDING_ICON_KEYS.map((key) => ({
    value: key,
    label: t(`landingHighlights.icons.${key}`),
  }))

  function onSubmit(values: FormValues) {
    mutation.mutate(toHighlightInput(values), {
      onSuccess: () => {
        toast({
          tone: 'success',
          message: t(mode === 'create' ? 'landingHighlights.created' : 'landingHighlights.updated'),
        })
        navigate(LIST_PATH)
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  // Mirrors `FormDialog`'s own dismiss-confirm — this form used to get it
  // for free from the dialog wrapper's single `onOpenChange`; as a full
  // page, the Cancel button has to gate it itself.
  async function handleCancel() {
    if (form.formState.isDirty) {
      const confirmed = await confirm({
        title: t('unsavedChanges.title', { ns: 'common' }),
        description: t('unsavedChanges.description', { ns: 'common' }),
        destructive: true,
      })
      if (!confirmed) return
    }
    navigate(LIST_PATH)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">
        {t(mode === 'create' ? 'landingHighlights.new' : 'landingHighlights.edit')}
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('landing.sections.english')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <TextField
                control={form.control}
                name="title_en"
                label={t('landingHighlights.fields.title')}
              />
              <TextareaField
                control={form.control}
                name="description_en"
                label={t('landingHighlights.fields.description')}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('landing.sections.arabic')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <TextField
                control={form.control}
                name="title_ar"
                label={t('landingHighlights.fields.title')}
                dir="auto"
              />
              <TextareaField
                control={form.control}
                name="description_ar"
                label={t('landingHighlights.fields.description')}
                dir="auto"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <SelectField
                control={form.control}
                name="icon"
                label={t('landingHighlights.fields.icon')}
                options={iconOptions}
              />
              {/* F-32 (QA-REPORT-1): `role="group"` is required for
                  `aria-label` to apply — a bare `<div>` is
                  `role="generic"`, which ARIA prohibits naming. */}
              <div
                role="group"
                className="flex items-center gap-2 text-muted-foreground"
                aria-label={t('landingHighlights.iconPreview')}
              >
                <LandingIcon icon={iconDraft} className="size-6 text-primary" />
                <span className="text-sm">{t(`landingHighlights.icons.${iconDraft}`)}</span>
              </div>
              <TextField
                control={form.control}
                name="order"
                type="number"
                label={t('landingHighlights.fields.order')}
                description={t('landingHighlights.orderHint')}
              />
            </CardContent>
          </Card>
          <FormErrorSummary errors={formErrors} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <SubmitButton pending={mutation.isPending}>
              {t('landingHighlights.actions.save')}
            </SubmitButton>
            <Button type="button" variant="outline" onClick={() => void handleCancel()}>
              {t('actions.cancel', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
