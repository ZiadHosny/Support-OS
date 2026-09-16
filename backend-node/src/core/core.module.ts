/**
 * Cross-cutting machinery every later NODE module depends on — the
 * counterpart of `apps/core`. The global providers are registered here
 * rather than via `app.useGlobalFilters()` so DI reaches them
 * (`AllExceptionsFilter` needs `ConfigService`).
 *
 * `NotFoundController` holds the `/api/*path` catch-all and must be declared
 * last among all controllers app-wide — see `AppModule`.
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
import { PermissionsController } from './auth/permissions.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { ThrottleGuard } from './throttling/throttle.guard.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController, PermissionsController, NotFoundController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    // Registration order is guard order. Throttling runs before auth,
    // matching DRF: a throttled caller is rejected without paying the
    // ~180 ms password verification.
    { provide: APP_GUARD, useClass: ThrottleGuard },
    { provide: APP_GUARD, useClass: AcceptNegotiationGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class CoreModule {}
