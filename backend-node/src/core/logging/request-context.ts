/**
 * The Node equivalent of `apps/core/logging.py`'s `request_id_var`/
 * `user_id_var` `ContextVar`s. `AsyncLocalStorage` is the only mechanism
 * that survives an `await` boundary correctly — a module-level variable or
 * a plain object would leak between concurrently in-flight requests.
 *
 * Populated by `RequestIdMiddleware` (`../middleware/request-id.middleware.ts`)
 * for the lifetime of one request; read by the exception filter and the
 * access-log line. Nothing else should construct a second `AsyncLocalStorage`
 * for the same purpose.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId: number | null;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

export function getUserId(): number | null | undefined {
  return requestContextStorage.getStore()?.userId;
}
