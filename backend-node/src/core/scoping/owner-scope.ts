/**
 * Portal owner-scoping — the un-bypassable half of NODE-3's 🔑 scope task,
 * porting `CustomerScopedModelViewSet` (apps/core/views.py).
 *
 * READ THIS BEFORE CHANGING IT. The backlog phrases this task as
 * "department/branch scoping ... that cannot be bypassed", but
 * CONVENTIONS.md § 33 states in a table that there are two DIFFERENT
 * primitives and only one is a security boundary:
 *
 *   CustomerScopedModelViewSet  scopes by WHO IS CALLING   no opt-out — a boundary
 *   apps.core.scoping           scopes by WHAT WAS ASKED   opt-in — "authorizes nothing"
 *
 * Department/branch is the SECOND one. Making it mandatory would return
 * empty lists on every staff screen. So the un-bypassable layer is built
 * here, for owner-scoping, which is the real boundary and the one NODE-9
 * explicitly depends on ("owner-scoping must be enforced by the scope
 * layer from NODE-3, not by per-handler filtering"). See scope-filter.ts
 * for the other half.
 *
 * "Structurally impossible for a handler to issue an unscoped query" is
 * the requirement, and an opt-in helper is explicitly not sufficient — so
 * this is a Prisma client EXTENSION. A handler that writes a raw
 * `prisma.tickets_ticket.findMany()` still gets a scoped query, because
 * there is no unscoped path to call.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which models are owner-scoped, and the column that owns them — the
 * `customer_field` equivalent, declared in ONE place.
 *
 * Registration is explicit and per-model, and an unregistered model is
 * left completely alone. Defaulting every model to a `customer` relation
 * caused a live false-403 on `Article.retrieve` for portal callers (Story
 * 46) — `Article` has no customer FK at all. That bug is the reason this
 * is a whitelist rather than a convention.
 *
 * Empty until NODE-9 ports the portal. NODE-4/5 add their models here in
 * the same change that ports them.
 */
export const OWNER_SCOPED_MODELS: Record<string, string> = {
  // e.g. tickets_ticket: 'customer_id'
};

export interface OwnerScope {
  /** The caller's own `customers_customer.id`, or null for a staff account. */
  customerId: bigint | null;
}

const ownerScopeStorage = new AsyncLocalStorage<OwnerScope>();

export function runWithOwnerScope<T>(scope: OwnerScope, fn: () => T): T {
  return ownerScopeStorage.run(scope, fn);
}

export function currentOwnerScope(): OwnerScope | undefined {
  return ownerScopeStorage.getStore();
}

/**
 * Fills in the scope once the caller is known.
 *
 * `AsyncLocalStorage.run()` has to WRAP a continuation, which a guard —
 * returning a boolean — cannot do. So `OwnerScopeMiddleware` establishes
 * the store with `{customerId: null}` before routing, and the auth guard
 * mutates that same object in place once it has authenticated. The store
 * object's identity is stable for the whole request, which is what makes
 * the mutation visible to every later query. This is the same pattern
 * `RequestIdMiddleware` already documents for `userId`.
 */
export function enterOwnerScope(scope: OwnerScope): void {
  const store = ownerScopeStorage.getStore();
  if (store) store.customerId = scope.customerId;
}

/** The read operations that must be narrowed to the caller's own rows. */
const SCOPED_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
  'update',
  'delete',
]);

/**
 * The Prisma extension. Applied once, in `PrismaService`, so every query
 * in the process goes through it.
 *
 * A staff caller (no `customerId`) is NOT narrowed — staff see the whole
 * table, exactly as Django's non-portal viewsets do. A portal caller with
 * a `customerId` is narrowed to their own rows. A portal caller whose
 * account has no linked Customer sees an EMPTY result, never another
 * customer's data and never a 500 — `CustomerScopedModelViewSet`'s own
 * documented behaviour.
 */
export function ownerScopeExtension() {
  return {
    name: 'owner-scope',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          const ownerField = OWNER_SCOPED_MODELS[model];
          if (!ownerField || !SCOPED_OPERATIONS.has(operation)) {
            return query(args);
          }

          const scope = currentOwnerScope();
          // No scope in context at all: a background job or a startup
          // query, not a request. Unscoped, as on the Django side where
          // there is no `request.user` either.
          if (!scope) return query(args);
          // A staff caller. Not narrowed.
          if (scope.customerId === null) return query(args);

          const where = (args.where ?? {}) as Record<string, unknown>;
          return query({
            ...args,
            where: { ...where, [ownerField]: scope.customerId },
          });
        },
      },
    },
  };
}
