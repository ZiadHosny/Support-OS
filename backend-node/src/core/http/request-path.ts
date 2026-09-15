/**
 * The query-string-free request path — the Node equivalent of Django's
 * `request.path` (never `request.get_full_path()`; CONVENTIONS.md § 10/
 * § 34, since a query string can carry a credential, e.g. the inbound-
 * email webhook's `?token=`).
 *
 * NOT `req.path`/`req.url`: Nest mounts `configure()`-registered
 * middleware AT the global prefix (`app.setGlobalPrefix('api')`), so
 * inside that middleware `req.path` is relative to the mount point —
 * `/api/health/` arrives as `req.path === '/'`. `req.originalUrl` is the
 * one property Express never rewrites for a sub-mount, so it is the only
 * reliable source of the full path, with its query string sliced off.
 */

import type { Request } from 'express';

export function getRequestPath(request: Request): string {
  const queryIndex = request.originalUrl.indexOf('?');
  return queryIndex === -1
    ? request.originalUrl
    : request.originalUrl.slice(0, queryIndex);
}
