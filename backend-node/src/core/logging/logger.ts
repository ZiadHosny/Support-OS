/**
 * Structured logging — the mechanism `CONVENTIONS-NODE.md` § 9 requires,
 * mirroring `apps/core/logging.py`.
 *
 * Two rules carried over as-is:
 *  - `request_id`/`user_id` are attached from the `AsyncLocalStorage`
 *    context automatically; a caller-supplied value with the same key is
 *    overwritten, exactly as Django's `ContextFilter` overwrites `extra`.
 *  - Every field is scrubbed BY KEY NAME, case-insensitively, as a
 *    substring — never by guessing at a value's shape. A scrubber that
 *    inspects values both over- and under-redacts.
 */

import { getRequestId, getUserId } from './request-context.js';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warning: 30,
  error: 40,
};

// CONVENTIONS.md § 10 / § 34, apps/core/logging.py's SENSITIVE_KEY_RE,
// reproduced verbatim.
const SENSITIVE_KEY_RE =
  /password|passwd|secret|token|api[_-]?key|authorization|credential|cookie|session/i;

const REDACTED = '[redacted]';

function scrub(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      result[key] = REDACTED;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      result[key] = scrub(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

let minLevel: LogLevel = 'info';
let format: 'text' | 'json' = 'text';

/** Called once, from `main.ts`, with the validated env. */
export function configureLogger(options: {
  level: string;
  format: 'text' | 'json';
}): void {
  const normalised = options.level.toLowerCase();
  if (normalised in LEVEL_ORDER || normalised === 'warn') {
    minLevel = (normalised === 'warn' ? 'warning' : normalised) as LogLevel;
  }
  format = options.format;
}

export function log(
  level: LogLevel,
  loggerName: string,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
    return;
  }

  const requestId = getRequestId();
  const userId = getUserId();
  const scrubbed = scrub(fields);
  // Reserved keys are always overwritten from the request context, matching
  // apps/core/logging.py's RESERVED set.
  if (requestId) scrubbed.request_id = requestId;
  if (userId !== undefined && userId !== null) scrubbed.user_id = userId;

  if (format === 'json') {
    const line = {
      level,
      logger: loggerName,
      message,
      timestamp: new Date().toISOString(),
      ...scrubbed,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
    return;
  }

  const requestIdPart = requestId ? `[${requestId}] ` : '';
  const extraPart = Object.keys(scrubbed).length
    ? ` ${JSON.stringify(scrubbed)}`
    : '';
  const line = `${level.toUpperCase()} ${loggerName} ${requestIdPart}${message}${extraPart}`;
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
