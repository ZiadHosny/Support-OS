/**
 * DRF's content negotiation rejects a request whose `Accept` header cannot
 * be satisfied by the one registered renderer (JSON) with a 406 — this API
 * only ever speaks JSON (`test_health.py::
 * test_html_accept_header_returns_json_envelope`). A `CanActivate` guard,
 * not middleware: guards run only after Nest has already resolved a
 * matching route, exactly when DRF's per-view negotiation runs — an
 * unmatched path still falls through to the 404 catch-all regardless of
 * `Accept`, never a 406.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotAcceptableException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AcceptNegotiationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const accept = request.headers.accept;
    if (!accept || accept.trim() === '') {
      return true;
    }

    const acceptable = accept.split(',').some((part) => {
      const type = part.split(';')[0]?.trim().toLowerCase();
      return (
        type === '*/*' ||
        type === 'application/*' ||
        type === 'application/json'
      );
    });

    if (!acceptable) {
      throw new NotAcceptableException();
    }
    return true;
  }
}
