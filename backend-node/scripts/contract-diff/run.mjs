#!/usr/bin/env node
/**
 * The contract-diff harness (NODE-2) — the acceptance gate for every later
 * NODE story. Reads the frozen contract, issues the same request to Django
 * and Node, and reports per-operation differences. "Ported" becomes a
 * measured state instead of a judgement.
 *
 * Usage:
 *   npm run contract:diff                     read-only (GET only)
 *   npm run contract:diff -- --mutating        also issue POST/PUT/PATCH/DELETE
 *   npm run contract:diff -- --only customers  restrict to one or more tags
 *   npm run contract:diff -- --json out.json   also write a machine-readable report
 *
 * Exit code is non-zero only on a real MISMATCH or UNDECLARED operation.
 * A 0%-coverage run with nothing implemented yet is a healthy exit 0 —
 * "not yet implemented" is progress information, not a failure.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  parseContract,
  assertContract,
  summarizeContract,
  ContractAssertionError,
} from './contract.mjs';
import { getConfig, preflight, acquireToken, ApiClient } from './client.mjs';
import { discoverIds, substituteId, collectionPathFor } from './ids.mjs';
import { compareResults } from './compare.mjs';
import { printReport, writeJsonReport } from './report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const HELP = `
contract-diff — NODE-2's contract-diff harness

Usage: npm run contract:diff -- [options]

Options:
  --mutating          Also issue POST/PUT/PATCH/DELETE operations (144 more).

                       WARNING: both services share one database
                       (backend/.env). A mutating run issues each write
                       TWICE — once against Django, once against Node — so
                       it leaves two rows where a user would leave one, and
                       it is not idempotent across runs. Re-seed with
                       'python manage.py seed_demo_data' (from backend/)
                       before and after. That command deletes ALL rows of
                       every model it manages, not only seeded ones.

  --only <tag>         Restrict to one contract tag. Repeatable.
  --json <path>        Also write a machine-readable report to <path>.
                       Suggested: contract-diff-report.json (gitignored).
  --help, -h            Show this message.

Without --mutating, only the 95 GET operations run; everything else is
reported SKIPPED (read-only mode).
`;

function parseArgs(argv) {
  const args = { mutating: false, only: [], json: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mutating') args.mutating = true;
    else if (arg === '--only') args.only.push(argv[(i += 1)]);
    else if (arg === '--json') args.json = argv[(i += 1)];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Unknown argument: ${arg}\n${HELP}`);
      process.exit(1);
    }
  }
  return args;
}

function loadJson(relativePath) {
  return JSON.parse(readFileSync(path.resolve(here, relativePath), 'utf-8'));
}

const CATCH_ALL_SIGNATURE = { status: 404, code: 'not_found' };

function isCatchAll(result) {
  return (
    result.status === CATCH_ALL_SIGNATURE.status &&
    result.body?.error?.code === CATCH_ALL_SIGNATURE.code
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  if (args.mutating) {
    console.log(
      'WARNING: --mutating shares one database with Django and is not idempotent. Each write is\n' +
        'issued TWICE — once against Django, once against Node — leaving two rows where a user\n' +
        "would leave one. Re-seed with 'python manage.py seed_demo_data' (from backend/) before\n" +
        'and after; that command deletes ALL rows of every model it manages, not only seeded ones.\n',
    );
  }

  const config = getConfig();

  console.log(
    `Preflighting ${config.djangoBaseUrl} and ${config.nodeBaseUrl} ...`,
  );
  await preflight(config);

  const { doc, operations: allOperations } = parseContract();
  assertContract({ doc, operations: allOperations });
  const summary = summarizeContract({ operations: allOperations });
  console.log(
    `Contract parsed: ${summary.paths} paths, ${summary.operations} operations, ${summary.tags} tags ` +
      `(get ${summary.methodCounts.get}, post ${summary.methodCounts.post}, patch ${summary.methodCounts.patch}, ` +
      `delete ${summary.methodCounts.delete}, put ${summary.methodCounts.put}).`,
  );

  const operations =
    args.only.length > 0
      ? allOperations.filter((op) => args.only.includes(op.tag))
      : allOperations;
  if (args.only.length > 0) {
    console.log(
      `--only ${args.only.join(', ')}: ${operations.length} operation(s) selected.`,
    );
  }

  console.log(`Acquiring token for ${config.email} ...`);
  let token = await acquireToken({
    djangoBaseUrl: config.djangoBaseUrl,
    email: config.email,
    password: config.password,
  });
  const reauth = async () => {
    token = await acquireToken({
      djangoBaseUrl: config.djangoBaseUrl,
      email: config.email,
      password: config.password,
    });
    return token;
  };
  const django = new ApiClient({
    baseUrl: config.djangoBaseUrl,
    token,
    isDjango: true,
    reauth,
  });
  const node = new ApiClient({
    baseUrl: config.nodeBaseUrl,
    token,
    isDjango: false,
  });

  console.log('Discovering {id} values from Django ...');
  const { idByCollection, emptyCollections } = await discoverIds(
    operations,
    django,
  );

  const implemented = new Set(loadJson('./implemented.json'));
  const fixtures = loadJson('./fixtures.json');

  const results = [];
  for (const op of operations) {
    // Read-only by default: only GET operations are ever attempted unless
    // --mutating was passed. Nothing else is issued at all in that mode.
    if (op.method !== 'get' && !args.mutating) {
      results.push({
        ...op,
        outcome: 'SKIPPED',
        reason: 'read-only mode (use --mutating)',
      });
      continue;
    }

    let effectivePath = op.path;
    if (op.hasPathId) {
      const collection = collectionPathFor(op.path);
      if (emptyCollections.has(collection)) {
        results.push({
          ...op,
          outcome: 'SKIPPED',
          reason: `no seed row (${collection})`,
        });
        continue;
      }
      effectivePath = substituteId(op.path, idByCollection.get(collection));
    }

    let fixtureBody;
    if (op.hasRequestBody) {
      if (!(op.operationId in fixtures)) {
        results.push({ ...op, outcome: 'SKIPPED', reason: 'no fixture' });
        continue;
      }
      fixtureBody = fixtures[op.operationId];
    }

    const [djangoResult, nodeResult] = await Promise.all([
      django.request(op.method, effectivePath, fixtureBody),
      node.request(op.method, effectivePath, fixtureBody),
    ]);

    if (implemented.has(op.operationId)) {
      const { isMatch, differences } = compareResults(djangoResult, nodeResult);
      results.push({
        ...op,
        outcome: isMatch ? 'MATCH' : 'MISMATCH',
        differences,
      });
    } else if (isCatchAll(nodeResult)) {
      results.push({ ...op, outcome: 'NOT_IMPLEMENTED' });
    } else {
      results.push({
        ...op,
        outcome: 'UNDECLARED',
        differences: [
          `operationId not in implemented.json, but node answered HTTP ${nodeResult.status} ` +
            `(expected the catch-all 404 not_found for an unimplemented route)`,
        ],
      });
    }
  }

  console.log('');
  printReport(results, { skippedCollections: emptyCollections });

  if (args.json) {
    const jsonPath = String(args.json);
    writeJsonReport(results, path.resolve(process.cwd(), jsonPath), {
      skippedCollections: emptyCollections,
    });
    console.log(`\nWrote JSON report to ${jsonPath}`);
  }

  const hasFailure = results.some(
    (r) => r.outcome === 'MISMATCH' || r.outcome === 'UNDECLARED',
  );
  process.exit(hasFailure ? 1 : 0);
}

main().catch((error) => {
  if (error instanceof ContractAssertionError) {
    console.error(error.message);
  } else {
    console.error(`contract-diff failed: ${error.message}`);
  }
  process.exit(1);
});
