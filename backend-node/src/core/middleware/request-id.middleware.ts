/**
 * Correlation id + access log — the Node port of `apps/core/middleware.py`.
 * Two middleware classes in one file, matching the Django module's shape:
 * `RequestIdMiddleware` resolves and echoes the id; `AccessLogMiddleware`
 * writes one line per request. Register both, in this order, first in
 * `AppModule.configure()` — after CORS (`main.ts`'s `app.enableCors()`,
 * called before `app.listen()`/`app.init()` so it mounts on the Express
 * stack first) and before anything else.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContextStorage } from '../logging/request-context.js';
import { log } from '../logging/logger.js';
import { getRequestPath } from '../http/request-path.js';

const REQUEST_HEADER = 'x-request-id';
const RESPONSE_HEADER = 'X-Request-ID';

// apps/core/logging.py's ID_RE, reproduced verbatim. A client-proposed id
// must look like this or it is silently replaced — it is a hint, not
// input, so a malformed one is never a 400.
const ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

// SKIP_PATHS in middleware.py: a load balancer hits this on a timer
// forever, and logging it would bury every line that matters.
const SKIP_PATHS = new Set(['/api/health/']);

function newRequestId(): string {
  // uuid.uuid4().hex on the Django side: 32 lowercase hex characters, no
  // dashes. randomUUID() is the same v4 UUID; stripping dashes matches it.
  return randomUUID().replace(/-/g, '');
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId =
      candidate && ID_RE.test(candidate) ? candidate : newRequestId();

    // Echoed on every response, always — set now so it is present even if
    // a downstream handler throws before it would otherwise be set.
    res.setHeader(RESPONSE_HEADER, requestId);

    // `userId` starts null; NODE-3's auth guard fills it in once the caller
    // is known, by mutating this same store object in place (the object
    // reference, not a new `.run()` call, is what later middleware/guards
    // see) — mirroring AccessLogMiddleware setting `user_id_var` only after
    // DRF resolves the authenticated user in middleware.py.
    requestContextStorage.run({ requestId, userId: null }, () => next());
  }
}

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const path = getRequestPath(req);
    if (SKIP_PATHS.has(path)) {
      next();
      return;
    }

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const status = res.statusCode;
      const level = status >= 500 ? 'warning' : 'info';
      // path, NEVER the URL with its query string — a query string can
      // carry a credential (the inbound-email webhook authenticates with
      // ?token=). CONVENTIONS.md § 10 / § 34.
      log(level, 'access', `${req.method} ${path} ${status}`, {
        http_method: req.method,
        http_path: path,
        http_status: status,
        duration_ms: Math.round(durationMs * 10) / 10,
      });
    });

    next();
  }
}
