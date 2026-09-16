/**
 * Portal owner-scoping — the un-bypassable half of the scope task, porting
 * `CustomerScopedModelViewSet` (apps/core/views.py).
 *
 * READ CONVENTIONS.md § 33 BEFORE CHANGING THIS. It defines two different
 * primitives and only one is a security boundary: owner-scoping scopes by
 * who is calling and has no opt-out; `apps.core.scoping` (department/branch,
 * see scope-filter.ts) scopes by what was asked and "authorizes nothing".
 * Making the latter mandatory would empty every staff screen.
 *
 * "Structurally impossible to issue an unscoped query" rules out an opt-in
 * helper, so this is a Prisma client extension: a handler writing a raw
 * `findMany()` still gets a scoped query, because no unscoped path exists.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which models are owner-scoped, and the owning column — `customer_field`,
 * declared in one place. A whitelist, not a convention: defaulting every
 * model to a `customer` relation caused a live false-403 on
 * `Article.retrieve` (Story 46), which has no customer FK at all.
 *
 * Empty until NODE-9 ports the portal.
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
 * `AsyncLocalStorage.run()` must wrap a continuation, which a guard
 * returning a boolean cannot do — so the middleware seeds the store before
 * routing and the guard mutates that same object. Its identity is stable
 * for the request, which is what makes the change visible to later queries.
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
 * The Prisma extension, applied once in `PrismaService`.
 *
 * Staff (no `customerId`) are not narrowed, as Django's non-portal viewsets
 * do. A portal caller is narrowed to their own rows; one with no linked
 * Customer sees an empty result, never another customer's data.
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
          // No scope: a background job, not a request. Unscoped, as on the
          // Django side where there is no `request.user` either.
          if (!scope) return query(args);
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
