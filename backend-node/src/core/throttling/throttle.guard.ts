/**
 * Named-scope rate limiting — `apps/core/throttling.py`'s
 * `FailOpenScopedRateThrottle`, ported.
 *
 * **Fail open, never closed.** A cache outage must log at WARNING and
 * ALLOW the request. DRF's own throttle would raise inside the check and
 * turn a Redis blip into a 500 on every credential endpoint — strictly
 * worse than not throttling at all, because a security control that turns
 * a cache blip into a total outage is one an operator switches off, and
 * then there is no control.
 *
 * This is deliberately the OPPOSITE posture from the permission guard in
 * `core/auth/auth.guard.ts`, which fails closed. Both are in this same
 * story; copying one posture to the other would be a real mistake.
 *
 * Keyed per IP, because these endpoints have no authenticated identity
 * yet. `DJANGO_NUM_PROXIES` decides how far into `X-Forwarded-For` to
 * trust: 0 means ignore it entirely and use the socket address. Trusting a
 * client-supplied header makes every IP-keyed limit bypassable
 * (CONVENTIONS.md § 36).
 */

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Env } from '../config/env.schema.js';
import { log } from '../logging/logger.js';
import { getRequestPath } from '../http/request-path.js';
import {
  THROTTLE_RATES,
  THROTTLE_SCOPE_KEY,
  type ThrottleScope,
} from './throttle.decorator.js';

interface Bucket {
  hits: number[];
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  /**
   * An in-process store. Django backs its throttle with Redis (PROD-2), so
   * a multi-instance deployment shares one budget there and would not
   * here — recorded in backend-node/README.md as a known gap for the
   * cutover rather than papered over. The fail-open posture, the shared
   * scope and the per-IP key — the parts a parity run can observe — are
   * faithful.
   */
  private readonly buckets = new Map<string, Bucket>();
  private readonly numProxies: number;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    this.numProxies = config.get('DJANGO_NUM_PROXIES', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const scope = this.reflector.getAllAndOverride<ThrottleScope>(
      THROTTLE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!scope) return true;

    const request = context.switchToHttp().getRequest<Request>();

    try {
      const rate = THROTTLE_RATES[scope];
      const key = `${scope}:${this.identify(request)}`;
      const now = Date.now();
      const windowStart = now - rate.windowSeconds * 1000;

      const bucket = this.buckets.get(key) ?? { hits: [] };
      bucket.hits = bucket.hits.filter((at) => at > windowStart);

      if (bucket.hits.length >= rate.limit) {
        this.buckets.set(key, bucket);
        throw new HttpException(
          { code: 'throttled', message: 'Request was throttled.' },
          429,
        );
      }

      bucket.hits.push(now);
      this.buckets.set(key, bucket);
      return true;
    } catch (error) {
      // A real 429 must propagate; anything else is the store failing, and
      // the request is allowed.
      if (error instanceof HttpException) throw error;
      log(
        'warning',
        'throttle',
        `Throttle check failed open for ${getRequestPath(request)}`,
        {
          scope,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return true;
    }
  }

  /** DRF's `get_ident`, with NUM_PROXIES honoured. */
  private identify(request: Request): string {
    if (this.numProxies > 0) {
      const forwarded = request.headers['x-forwarded-for'];
      const chain = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (chain && chain.length > 0) {
        // The Nth entry from the end — a client cannot forge past a proxy
        // that appends rather than trusts.
        return (
          chain[Math.max(0, chain.length - this.numProxies)] ??
          chain[chain.length - 1]
        );
      }
    }
    return request.socket.remoteAddress ?? 'unknown';
  }
}
