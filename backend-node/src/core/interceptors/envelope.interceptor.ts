/**
 * The single global envelope interceptor — CONVENTIONS-NODE.md § 4.
 * No controller builds its own response shape; this is what wraps every
 * success in `{success, data, error, meta}`, mirroring
 * `apps/core/renderers.py`'s `EnvelopeJSONRenderer`.
 *
 * Three behaviours, each ported exactly:
 *  1. A payload that is already an envelope passes through untouched
 *     (pagination produces one directly — see `../pagination/paginate.ts`).
 *  2. 204 and 304 return an EMPTY body, not a wrapped null. `response.
 *     statusCode` already reflects a route's `@HttpCode()` by the time an
 *     interceptor's `map()` runs (Nest calls `setStatus` before invoking
 *     the interceptor chain), so this is safe to read here.
 *  3. `@SkipEnvelope()` opts a route out entirely (the WhatsApp handshake).
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isEnvelope, successEnvelope } from '../envelope/envelope.js';
import { SKIP_ENVELOPE_KEY } from '../envelope/skip-envelope.decorator.js';

const EMPTY_BODY_STATUS_CODES = new Set([204, 304]);

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        if (EMPTY_BODY_STATUS_CODES.has(response.statusCode)) {
          return undefined;
        }
        if (isEnvelope(payload)) {
          return payload;
        }
        return successEnvelope(payload);
      }),
    );
  }
}
