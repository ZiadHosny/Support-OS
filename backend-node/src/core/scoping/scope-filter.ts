/**
 * Query-param scoping — `apps/core/scoping.py`, ported. The OPT-IN half,
 * and never a security boundary (CONVENTIONS.md § 33: "a `?department=`
 * filter is a convenience; it authorizes nothing"). See owner-scope.ts for
 * the layer that is one.
 *
 * The param contract:
 *   absent or empty -> no filtering at all
 *   a numeric id    -> filter by that id
 *   "none"          -> rows with no value in this scope
 *   anything else   -> 400, never a silent no-op: a typo'd filter that
 *                      quietly returns everything is the harder bug.
 *
 * Scopes compose with AND, so a no-overlap combination returns an empty
 * page — not a 400, and not an OR.
 */
import { BadRequestException } from '@nestjs/common';

/** A string, not an empty param: `?department=` already means "no filter". */
export const UNSCOPED = 'none';

export interface ScopeFilter {
  /** The query-string key. */
  param: string;
  /** The FK column on the model, e.g. `department_id`. */
  field: string;
}

/** Returns `{}` when no scope was sent — an unfiltered list is correct. */
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
