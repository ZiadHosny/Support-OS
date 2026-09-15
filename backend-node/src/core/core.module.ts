/**
 * Cross-cutting machinery every later NODE module depends on — the Node
 * counterpart of `apps/core`. Registers the five reused pieces as global
 * providers (DI-wired, unlike `app.useGlobalFilters()` etc. in `main.ts`,
 * which would not get `ConfigService` injected into `AllExceptionsFilter`):
 * config, Prisma, the envelope interceptor, the exception filter, and the
 * `Accept` negotiation guard. The correlation-id middleware is wired
 * separately in `AppModule.configure()` — Nest applies middleware and
 * global providers through different mechanisms.
 *
 * Controllers here are the ones with no other home: the health endpoint
 * and the `/api/` catch-all. `NotFoundController` MUST be declared last
 * among all controllers app-wide so every other route is tried first —
 * see `AppModule`.
 */

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { EnvelopeInterceptor } from './interceptors/envelope.interceptor.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { AcceptNegotiationGuard } from './http/accept-negotiation.guard.js';
import { HealthController } from './health/health.controller.js';
import { NotFoundController } from './health/not-found.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController, NotFoundController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_GUARD, useClass: AcceptNegotiationGuard },
  ],
})
export class CoreModule {}
