/**
 * Root module. Registration order in `configure()` IS the Express
 * middleware order:
 *
 *   CORS (main.ts) -> RequestId -> AccessLog -> OwnerScope -> body parsers
 *
 * matching `base.py`'s MIDDLEWARE with one necessary difference: the body
 * parsers run AFTER request-id (`main.ts` sets `bodyParser: false`) so a
 * malformed-JSON request still carries a `request_id` in its error
 * envelope, as it does in Django.
 */

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import express from 'express';
import { CoreModule } from './core/core.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import {
  RequestIdMiddleware,
  AccessLogMiddleware,
} from './core/middleware/request-id.middleware.js';
import { OwnerScopeMiddleware } from './core/scoping/owner-scope.middleware.js';

// AccountsModule first: CoreModule's catch-all must be registered last.
@Module({
  imports: [AccountsModule, CoreModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestIdMiddleware,
        AccessLogMiddleware,
        OwnerScopeMiddleware,
        express.json(),
        express.urlencoded({ extended: true }),
      )
      .forRoutes('*');
  }
}
