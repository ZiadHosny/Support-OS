/**
 * The query-string-free request path — Django's `request.path`, never
 * `get_full_path()` (CONVENTIONS.md § 10/§ 34: a query string can carry a
 * credential).
 *
 * Not `req.path`: Nest mounts `configure()` middleware at the global prefix,
 * so there `/api/health/` reads as `/`. `req.originalUrl` is the one property
 * Express never rewrites for a sub-mount.
 */

import type { Request } from 'express';

export function getRequestPath(request: Request): string {
  const queryIndex = request.originalUrl.indexOf('?');
  return queryIndex === -1
    ? request.originalUrl
    : request.originalUrl.slice(0, queryIndex);
}
