/**
 * `{id}` discovery — the only path placeholder in the whole contract
 * (verified: 52 paths, 125 operations, `- in: path` / `name: id` /
 * `type: integer`). Every collection parent derived by truncating a path
 * at `/{id}/` exists as a contract path in its own right (verified for
 * all 31, zero misses), which is what makes this one rule instead of a
 * table of special cases.
 *
 * Ids are discovered at RUNTIME from Django, never hardcoded — seeded row
 * ids are not stable across re-seeds (HOW_TO_USE.md).
 */

/** '/api/customers/{id}/timeline/' -> '/api/customers/' */
export function collectionPathFor(operationPath) {
  const index = operationPath.indexOf('{id}');
  if (index === -1) return null;
  return operationPath.slice(0, index);
}

export function substituteId(operationPath, id) {
  return operationPath.replace('{id}', String(id));
}

/**
 * One GET per distinct collection (not per operation). Returns:
 *   idByCollection: Map<collectionPath, id>
 *   emptyCollections: Set<collectionPath>  — no seed row; operations under
 *     these are reported SKIPPED, never given a fabricated id (a made-up
 *     id 404s on both sides and would score as a false match).
 */
export async function discoverIds(operations, djangoClient) {
  const collections = new Set();
  for (const op of operations) {
    if (op.hasPathId) {
      const collection = collectionPathFor(op.path);
      if (collection) collections.add(collection);
    }
  }

  const idByCollection = new Map();
  const emptyCollections = new Set();

  for (const collection of collections) {
    const result = await djangoClient.request(
      'get',
      `${collection}?page_size=1`,
    );
    const rows = result?.body?.data;
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined) {
      idByCollection.set(collection, rows[0].id);
    } else {
      emptyCollections.add(collection);
    }
  }

  return { idByCollection, emptyCollections };
}
