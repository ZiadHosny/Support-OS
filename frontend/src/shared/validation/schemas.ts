import * as z from 'zod'

/**
 * Shared field shapes. Features compose these instead of re-deriving them, so
 * "what does required text mean" is answered once. Messages come from the
 * error map (./errorMap.ts) — NEVER pass a literal `error:` string here.
 * See CONVENTIONS.md §20.
 */

/** Required text. `.trim()` first, so "   " is blank, not 3 characters. */
export function requiredString(max = 255) {
  return z.string().trim().min(1).max(max)
}

/** Optional text. Normalises '' to undefined so a blank input is "not sent". */
export function optionalString(max = 255) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional()
}

export function email() {
  return z.email().max(254)
}

export function optionalEmail() {
  return z.union([z.literal(''), z.email().max(254)]).transform((v) => (v === '' ? undefined : v))
}

/**
 * Optional text for a NULLABLE database column. Transforms '' to `null`, not
 * `undefined` — an undefined key is dropped by `JSON.stringify`, and DRF
 * treats an absent field as "leave unchanged", so a cleared input would
 * silently fail to clear. Verified; see CONVENTIONS.md §20.
 *
 * Use `optionalString` instead when the field is genuinely absent rather than
 * null (a query parameter, a partial payload you build by hand).
 */
export function nullableString(max = 255) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
}

/** Nullable email. Same '' -> null rule as `nullableString`. */
export function nullableEmail() {
  return z
    .union([z.literal(''), z.email().max(254)])
    .transform((value) => (value === '' ? null : value))
}

/** A number typed into a text input. `coerce` turns '42' into 42. */
export function positiveInt(max?: number) {
  const base = z.coerce.number().int().min(1)
  return max === undefined ? base : base.max(max)
}

/** A number typed into a text input, for a NULLABLE database column. Empty
 * input becomes `null`, not `undefined` — same '' -> null reasoning as
 * `nullableString`/`nullableEmail`, combined with `positiveInt`'s own
 * coerced validator. */
export function nullablePositiveInt(max?: number) {
  const numberSchema =
    max === undefined ? z.coerce.number().int().min(1) : z.coerce.number().int().min(1).max(max)
  return z.union([z.literal(''), numberSchema]).transform((value) => (value === '' ? null : value))
}

/** A `<select>` over a fixed set. Matches a DRF `ChoiceField`. */
export function choice<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values)
}
