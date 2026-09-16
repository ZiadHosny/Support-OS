/**
 * Parses `docs/api-contract.django.yaml` into a flat operation list, and
 * asserts the parse against known totals so a contract that changed shape
 * stops the harness instead of silently measuring the wrong thing.
 *
 * The constants below were measured directly against the frozen contract
 * (NODE-2 planning session). Regenerating the contract
 * (`python manage.py freeze_api_contract`) is a deliberate act — update
 * these numbers in the same change that regenerates it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
// backend-node/scripts/contract-diff -> backend-node -> repo root -> docs/api-contract.django.yaml
export const CONTRACT_PATH = path.resolve(
  here,
  '../../../docs/api-contract.django.yaml',
);

export const EXPECTED = {
  paths: 131,
  operations: 239,
  tags: 39,
  methodCounts: { get: 95, post: 65, patch: 30, delete: 26, put: 23 },
  pathPlaceholders: ['id'],
};

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
];

export class ContractAssertionError extends Error {}

/**
 * Reads and flattens the contract. Each returned operation:
 *   { operationId, method, path, tag, hasPathId, requiresAuth,
 *     hasRequestBody, documentedStatuses }
 */
export function parseContract(contractPath = CONTRACT_PATH) {
  const raw = readFileSync(contractPath, 'utf-8');
  const doc = parseYaml(raw);

  const operations = [];
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    const hasPathId = /\{id\}/.test(pathKey);
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tags = operation.tags ?? [];
      const security = operation.security ?? [];
      const requiresAuth = security.some(
        (scheme) => 'jwtAuth' in scheme || 'ApiKeyAuth' in scheme,
      );

      operations.push({
        operationId: operation.operationId,
        method,
        path: pathKey,
        tag: tags[0] ?? '(untagged)',
        hasPathId,
        requiresAuth,
        hasRequestBody: Boolean(operation.requestBody),
        documentedStatuses: Object.keys(operation.responses ?? {}),
      });
    }
  }

  return { doc, operations };
}

/** Every placeholder actually present in the contract's path keys, e.g. ['id']. */
function findPlaceholders(paths) {
  const found = new Set();
  for (const pathKey of paths) {
    for (const match of pathKey.matchAll(/\{([a-z_]+)\}/g)) {
      found.add(match[1]);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

/**
 * Validates the parse against EXPECTED. Throws ContractAssertionError,
 * naming expected vs actual, on the first mismatch found — every check
 * still runs, so a single throw can report every discrepancy at once.
 */
export function assertContract({ doc, operations }, expected = EXPECTED) {
  const problems = [];

  const paths = Object.keys(doc.paths ?? {});
  if (paths.length !== expected.paths) {
    problems.push(`paths: expected ${expected.paths}, got ${paths.length}`);
  }

  if (operations.length !== expected.operations) {
    problems.push(
      `operations: expected ${expected.operations}, got ${operations.length}`,
    );
  }

  const tags = new Set(operations.map((op) => op.tag));
  if (tags.size !== expected.tags) {
    problems.push(
      `tags: expected ${expected.tags} distinct tags, got ${tags.size} (${[...tags].sort((a, b) => a.localeCompare(b)).join(', ')})`,
    );
  }

  const methodCounts = {};
  for (const op of operations) {
    methodCounts[op.method] = (methodCounts[op.method] ?? 0) + 1;
  }
  for (const [method, expectedCount] of Object.entries(expected.methodCounts)) {
    const actual = methodCounts[method] ?? 0;
    if (actual !== expectedCount) {
      problems.push(
        `method ${method}: expected ${expectedCount}, got ${actual}`,
      );
    }
  }

  const ids = operations.map((op) => op.operationId);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    problems.push(
      `duplicate operationId(s): ${[...new Set(duplicateIds)].join(', ')}`,
    );
  }

  const placeholders = findPlaceholders(paths);
  const unexpected = placeholders.filter(
    (p) => !expected.pathPlaceholders.includes(p),
  );
  if (unexpected.length > 0) {
    problems.push(
      `unexpected path placeholder(s): ${unexpected.join(', ')} (only ${expected.pathPlaceholders.join(', ')} expected)`,
    );
  }

  if (problems.length > 0) {
    throw new ContractAssertionError(
      `The contract no longer matches the harness's expected shape:\n` +
        problems.map((p) => `  - ${p}`).join('\n') +
        `\n\nIf docs/api-contract.django.yaml was regenerated deliberately ` +
        `(python manage.py freeze_api_contract), update the EXPECTED constants ` +
        `in scripts/contract-diff/contract.mjs in the same change.`,
    );
  }
}

export function summarizeContract({ operations }) {
  const tags = new Set(operations.map((op) => op.tag));
  const methodCounts = {};
  for (const op of operations) {
    methodCounts[op.method] = (methodCounts[op.method] ?? 0) + 1;
  }
  return {
    paths: new Set(operations.map((op) => op.path)).size,
    operations: operations.length,
    tags: tags.size,
    methodCounts,
  };
}
