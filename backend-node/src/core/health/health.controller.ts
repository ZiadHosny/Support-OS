/**
 * `GET /api/health/` — the Node port of `apps/core/views.py::HealthView`,
 * the first end-to-end proof that routing, config, database access and
 * the envelope all work together.
 *
 * Deliberately excluded from the frozen contract on the Django side
 * (`@extend_schema(exclude=True)` — a liveness probe is infrastructure,
 * not API surface), so there is nothing to document here either.
 *
 * Every other verb on this exact path is a 405, not the generic 404 an
 * unmatched Express route would otherwise produce — matching DRF's
 * `APIView.http_method_not_allowed`, which fires because the URL matched
 * but the view does not implement that verb.
 */

import {
  Controller,
  Get,
  Delete,
  Options,
  Patch,
  Post,
  Put,
  Res,
  MethodNotAllowedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

interface HealthPayload {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthPayload> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      // Returned, not thrown: HealthView returns a `Response`, never
      // raises, so `EnvelopeJSONRenderer` wraps the 503 body as a SUCCESS
      // envelope on the Django side too (test_health.py::
      // test_health_reports_degraded_when_database_unreachable). The
      // global EnvelopeInterceptor treats any non-thrown return value the
      // same way regardless of status code (its only status-code branch
      // is the 204/304 empty-body case) — `passthrough: true` lets this
      // handler set the status while still returning a plain payload for
      // that interceptor to wrap.
      response.status(503);
      return { status: 'degraded', database: 'error' };
    }
  }

  // Nest resolves one route (method + path) per decorated method — stacking
  // multiple verb decorators on a single method silently keeps only the
  // last one applied (a real mistake caught by testing this locally: it
  // registered POST only). Every disallowed verb needs its own handler.
  @Post()
  postNotAllowed(): never {
    throw new MethodNotAllowedException();
  }

  @Put()
  putNotAllowed(): never {
    throw new MethodNotAllowedException();
  }

  @Patch()
  patchNotAllowed(): never {
    throw new MethodNotAllowedException();
  }

  @Delete()
  deleteNotAllowed(): never {
    throw new MethodNotAllowedException();
  }

  @Options()
  optionsNotAllowed(): never {
    throw new MethodNotAllowedException();
  }
}
