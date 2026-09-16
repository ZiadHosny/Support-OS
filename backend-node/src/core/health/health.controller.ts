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
import { PublicRoute } from '../auth/route-declaration.decorator.js';

interface HealthPayload {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
}

// AllowAny + authentication_classes = [] on the Django side: a load
// balancer's liveness probe carries no credentials.
@PublicRoute()
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
      // Returned, not thrown: HealthView never raises, so Django wraps even
      // the 503 body in a SUCCESS envelope
      // (test_health_reports_degraded_when_database_unreachable).
      // `passthrough: true` sets the status while still handing the
      // interceptor a plain payload to wrap.
      response.status(503);
      return { status: 'degraded', database: 'error' };
    }
  }

  // Nest resolves one route per decorated method: stacking verb decorators
  // on one method silently keeps only the last. Each verb needs its own.
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
