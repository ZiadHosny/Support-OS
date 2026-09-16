/**
 * Renders the per-operation lines, the per-tag coverage table (all 39
 * contract tags), and the totals line. `--json` writes the same data
 * machine-readably.
 */

import { writeFileSync } from 'node:fs';

const OUTCOME_ORDER = [
  'MISMATCH',
  'UNDECLARED',
  'MATCH',
  'SKIPPED',
  'NOT_IMPLEMENTED',
];

function pad(value, width) {
  return String(value).padEnd(width);
}

/**
 * Prints everything except NOT_IMPLEMENTED per-operation (239 lines of
 * "not yet implemented" is noise, not information — the per-tag table
 * already carries that count).
 */
function printOperationLines(results) {
  const visible = results.filter((r) => r.outcome !== 'NOT_IMPLEMENTED');
  if (visible.length === 0) {
    console.log(
      '(no MATCH / MISMATCH / UNDECLARED / SKIPPED operations to list)',
    );
    return;
  }
  for (const r of visible.sort(
    (a, b) =>
      OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome),
  )) {
    const label = `${r.method.toUpperCase()} ${r.path}`;
    console.log(`${pad(r.outcome, 15)} ${pad(r.operationId, 32)} ${label}`);
    if (r.outcome === 'MISMATCH') {
      for (const d of r.differences) console.log(`    - ${d}`);
    }
    if (r.outcome === 'SKIPPED') {
      console.log(`    - ${r.reason}`);
    }
  }
}

function printTagTable(results) {
  const byTag = new Map();
  for (const r of results) {
    if (!byTag.has(r.tag)) {
      byTag.set(r.tag, {
        matched: 0,
        mismatched: 0,
        notImplemented: 0,
        undeclared: 0,
        skipped: 0,
        total: 0,
      });
    }
    const row = byTag.get(r.tag);
    row.total += 1;
    if (r.outcome === 'MATCH') row.matched += 1;
    else if (r.outcome === 'MISMATCH') row.mismatched += 1;
    else if (r.outcome === 'NOT_IMPLEMENTED') row.notImplemented += 1;
    else if (r.outcome === 'UNDECLARED') row.undeclared += 1;
    else if (r.outcome === 'SKIPPED') row.skipped += 1;
  }

  console.log('\nCoverage by tag:');
  console.log(
    pad('tag', 24) +
      pad('matched', 9) +
      pad('mismatch', 10) +
      pad('undecl.', 9) +
      pad('not impl.', 11) +
      pad('skipped', 9) +
      'total',
  );
  for (const tag of [...byTag.keys()].sort((a, b) => a.localeCompare(b))) {
    const row = byTag.get(tag);
    console.log(
      pad(tag, 24) +
        pad(row.matched, 9) +
        pad(row.mismatched, 10) +
        pad(row.undeclared, 9) +
        pad(row.notImplemented, 11) +
        pad(row.skipped, 9) +
        row.total,
    );
  }
}

function printTotals(results) {
  const total = results.length;
  const matched = results.filter((r) => r.outcome === 'MATCH').length;
  const mismatched = results.filter((r) => r.outcome === 'MISMATCH').length;
  const undeclared = results.filter((r) => r.outcome === 'UNDECLARED').length;
  const paths = new Set(results.map((r) => r.path)).size;
  const pct = total === 0 ? 0 : Math.round((matched / total) * 1000) / 10;

  console.log(
    `\n${matched}/${total} operations matching (${pct}%) across ${paths} paths`,
  );
  console.log(`${mismatched} mismatch(es), ${undeclared} undeclared`);
}

function printFooterNotes(skippedCollections) {
  console.log('\nKnown, deliberately unchecked differences:');
  console.log(
    '  - error.message is not compared (Node ships English only; Django localises via gettext).',
  );
  console.log(
    '  - Content-Type is not compared (django: application/json; express: …; charset=utf-8).',
  );
  console.log(
    '  - Array/list ORDER is not compared — the shape signature ignores element order by',
  );
  console.log('    construction, so an ordering bug would pass this harness.');
  if (skippedCollections.size > 0) {
    console.log(
      `\nCollections with no seed row (operations under them were SKIPPED, not counted):`,
    );
    for (const c of [...skippedCollections].sort((a, b) => a.localeCompare(b)))
      console.log(`  - ${c}`);
  }
}

export function printReport(results, { skippedCollections = new Set() } = {}) {
  printOperationLines(results);
  printTagTable(results);
  printTotals(results);
  printFooterNotes(skippedCollections);
}

export function buildJsonReport(
  results,
  { skippedCollections = new Set() } = {},
) {
  const total = results.length;
  const matched = results.filter((r) => r.outcome === 'MATCH').length;
  return {
    total,
    matched,
    percent: total === 0 ? 0 : Math.round((matched / total) * 1000) / 10,
    mismatched: results.filter((r) => r.outcome === 'MISMATCH').length,
    undeclared: results.filter((r) => r.outcome === 'UNDECLARED').length,
    skipped: results.filter((r) => r.outcome === 'SKIPPED').length,
    notImplemented: results.filter((r) => r.outcome === 'NOT_IMPLEMENTED')
      .length,
    skippedCollections: [...skippedCollections].sort((a, b) =>
      a.localeCompare(b),
    ),
    operations: results,
  };
}

export function writeJsonReport(results, filePath, options) {
  writeFileSync(
    filePath,
    JSON.stringify(buildJsonReport(results, options), null, 2) + '\n',
    'utf-8',
  );
}
