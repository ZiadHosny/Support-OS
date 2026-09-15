import { i18next } from '@/shared/i18n'

import { applyZodLocale } from './config'

applyZodLocale(i18next.resolvedLanguage ?? i18next.language)
i18next.on('languageChanged', applyZodLocale)

export { zodResolver } from './resolver'
export * from './schemas'
export { applyServerErrors, isValidationError } from './serverErrors'
