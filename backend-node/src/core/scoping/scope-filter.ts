/**
 * Query-param scoping — `apps/core/scoping.py`, ported. The OPT-IN half.
 *
 * This is NOT a security boundary and must never be made one.
 * CONVENTIONS.md § 33, verbatim: "Never reach for the second where the
 * first is meant. A `?department=` filter is a convenience; it authorizes
 * nothing." An absent `?department=` means NO FILTER — that is required
 * behaviour, not a gap. Making it mandatory would return empty lists on
 * every staff screen. See owner-scope.ts for the layer that IS a boundary.
 *
 * The param contract, identical everywhere:
 *   absent or empty -> no filtering at all
 *   a numeric id    -> filter by that id
 *   the literal
 *   "none"          -> rows with no value in this scope
 *   anything else   -> 400. NEVER a silent no-op: a typo'd filter that
 *                      quietly returns everything is the harder bug.
 *
 * Multiple scopes compose with AND, so `?department=3&branch=7` narrows on
 * both and a no-overlap combination returns an empty page — not a 400, and
 * not an OR.
 */

import { BadRequestException } from '@nestjs/common';

/**
 * The sentinel for "rows with no value in this scope". A string, not an
 * empty param: `?department=` (empty) already means "no filter", and the
 * two must not collide.
 */
export const UNSCOPED = 'none';

export interface ScopeFilter {
  /** The query-string key. */
  param: string;
  /** The FK column on the model, e.g. `department_id`. */
  field: string;
}

/**
 * Builds the `where` fragment for every scope the caller actually sent.
 * Returns `{}` when none were — an unfiltered list is the correct result.
 */
export function buildScopeWhere(
  query: Record<string, unknown>,
  scopes: readonly ScopeFilter[],
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const scope of scopes) {
    const raw = query[scope.param];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === null || value === '') continue;

    const asString = String(value);
    if (asString === UNSCOPED) {
      where[scope.field] = null;
      continue;
    }

    if (!/^\d+$/.test(asString)) {
      throw new BadRequestException({
        fields: { [scope.param]: [`Must be a numeric id or "${UNSCOPED}".`] },
      });
    }
    where[scope.field] = BigInt(asString);
  }

  return where;
}
