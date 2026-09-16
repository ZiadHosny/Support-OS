/**
 * Compares one Django/Node response pair. Four things by value — status
 * code, envelope shape, `error.code`, and payload structure — everything
 * else by shape.
 *
 * "Payload structure, deep-equal" means `data`/`meta` are reduced to a
 * recursive TYPE signature (every primitive leaf becomes its type name)
 * before comparing — which is what makes the plan's whole "volatile
 * values, stripped before comparison" list (ids, timestamps, request_id,
 * debug, JWTs, pagination URLs) automatic rather than a separate pass:
 * a differing id/timestamp/URL is just two equal-typed strings/numbers,
 * and the signature never looks at their actual content. The ONE
 * genuine exception is `meta.pagination.count`/`num_pages`, which ARE
 * compared by exact value (both services read the same database, so a
 * differing count is a real filtering/scoping bug, not noise).
 *
 * A field present on one side and missing on the other still fails: the
 * signature keeps every key, it only replaces the leaf VALUE with a type
 * marker. Deleting the key instead would mask exactly the defect this
 * harness exists to catch.
 */

// Compared by exact value instead of type-only, because both services
// share one database — see the module docstring.
const PRESERVED_VALUE_PATHS = new Set([
  'meta.pagination.count',
  'meta.pagination.num_pages',
]);

const HETEROGENEOUS = Symbol('heterogeneous-array');

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (!deepEqual(aKeys, bKeys)) return false;
    return aKeys.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}

/** Builds the recursive type signature described above. */
function buildSignature(value, keyPath) {
  if (PRESERVED_VALUE_PATHS.has(keyPath)) {
    return value;
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const first = buildSignature(value[0], `${keyPath}[]`);
    for (let i = 1; i < value.length; i += 1) {
      if (!deepEqual(first, buildSignature(value[i], `${keyPath}[]`))) {
        // A heterogeneous array on one side and a homogeneous one on the
        // other is a real structural difference — this marker makes that
        // fail deepEqual against a normal `[<signature>]` on the other side.
        return { [HETEROGENEOUS]: true, length: value.length };
      }
    }
    return [first];
  }
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = buildSignature(
        value[key],
        keyPath ? `${keyPath}.${key}` : key,
      );
    }
    return result;
  }
  return typeof value; // 'string' | 'number' | 'boolean'
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Human-readable description of the first differing path(s), for the report. */
function describeSignatureDiff(a, b, keyPath, out = [], limit = 5) {
  if (out.length >= limit || deepEqual(a, b)) return out;

  if (a === undefined) {
    out.push(`${keyPath || '(root)'} missing on django`);
    return out;
  }
  if (b === undefined) {
    out.push(`${keyPath || '(root)'} missing on node`);
    return out;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (out.length >= limit) break;
      const childPath = keyPath ? `${keyPath}.${key}` : key;
      if (!(key in a)) out.push(`${childPath} missing on django`);
      else if (!(key in b)) out.push(`${childPath} missing on node`);
      else describeSignatureDiff(a[key], b[key], childPath, out, limit);
    }
    return out;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    describeSignatureDiff(a[0], b[0], `${keyPath}[]`, out, limit);
    return out;
  }

  out.push(
    `${keyPath || '(root)'}: ${JSON.stringify(a)} (django) vs ${JSON.stringify(b)} (node)`,
  );
  return out;
}

const ENVELOPE_KEYS = ['success', 'data', 'error', 'meta'];

/**
 * Compares one operation's Django/Node result pair.
 * Returns { isMatch, differences: string[] }.
 */
export function compareResults(django, node) {
  const differences = [];

  if (django.networkError || node.networkError) {
    if (django.networkError)
      differences.push(`django network error: ${django.networkError}`);
    if (node.networkError)
      differences.push(`node network error: ${node.networkError}`);
    return { isMatch: false, differences };
  }

  if (django.status !== node.status) {
    differences.push(
      `status ${django.status} (django) vs ${node.status} (node)`,
    );
  }

  const djangoBody = django.body;
  const nodeBody = node.body;

  if (!isPlainObject(djangoBody) || !isPlainObject(nodeBody)) {
    differences.push(
      `response body is not a JSON object on ${!isPlainObject(djangoBody) ? 'django' : 'node'}`,
    );
    return { isMatch: differences.length === 0, differences };
  }

  const djangoKeys = Object.keys(djangoBody).sort();
  const nodeKeys = Object.keys(nodeBody).sort();
  if (
    !deepEqual(djangoKeys, ENVELOPE_KEYS.slice().sort()) ||
    !deepEqual(nodeKeys, ENVELOPE_KEYS.slice().sort())
  ) {
    differences.push(
      `envelope keys: django has [${djangoKeys.join(', ')}], node has [${nodeKeys.join(', ')}] ` +
        `(expected exactly [${ENVELOPE_KEYS.join(', ')}])`,
    );
  }

  if (djangoBody.success !== nodeBody.success) {
    differences.push(
      `success ${djangoBody.success} (django) vs ${nodeBody.success} (node)`,
    );
  }

  const djangoErrorCode = djangoBody.error?.code;
  const nodeErrorCode = nodeBody.error?.code;
  if (djangoErrorCode !== nodeErrorCode) {
    differences.push(
      `error.code ${JSON.stringify(djangoErrorCode)} (django) vs ${JSON.stringify(nodeErrorCode)} (node)`,
    );
  }

  const djangoDataSig = buildSignature(djangoBody.data, 'data');
  const nodeDataSig = buildSignature(nodeBody.data, 'data');
  if (!deepEqual(djangoDataSig, nodeDataSig)) {
    for (const d of describeSignatureDiff(djangoDataSig, nodeDataSig, 'data')) {
      differences.push(d);
    }
  }

  const djangoMetaSig = buildSignature(djangoBody.meta, 'meta');
  const nodeMetaSig = buildSignature(nodeBody.meta, 'meta');
  if (!deepEqual(djangoMetaSig, nodeMetaSig)) {
    for (const d of describeSignatureDiff(djangoMetaSig, nodeMetaSig, 'meta')) {
      differences.push(d);
    }
  }

  return { isMatch: differences.length === 0, differences };
}
