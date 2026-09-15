/**
 * Root module. `NODE-1` wires only `CoreModule` — no domain module exists
 * yet (`NODE-4` onward add them, each mirroring `backend/apps/<name>/`).
 *
 * The correlation-id middleware (and the body parsers — see below) are
 * applied here, not as DI providers, because Nest applies
 * `configure()`-registered middleware separately from `APP_*` tokens.
 * Registration order in this one `configure()` call IS the Express
 * middleware order:
 *
 *   CORS (main.ts, before app.listen()) → RequestIdMiddleware →
 *   AccessLogMiddleware → express.json()/urlencoded() → routing
 *
 * matching `backend/config/settings/base.py`'s `MIDDLEWARE` order (CORS,
 * then request-id, then access log) with one necessary addition: the body
 * parsers run AFTER request-id, not before — `main.ts` disables Nest's
 * automatic parser registration (`bodyParser: false`) specifically so a
 * malformed-JSON request still gets a `request_id` in its error envelope,
 * matching Django (DRF parses the body inside the view, i.e. after
 * `RequestIDMiddleware` has already run).
 */

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import express from 'express';
import { CoreModule } from './core/core.module.js';
import {
  RequestIdMiddleware,
  AccessLogMiddleware,
} from './core/middleware/request-id.middleware.js';

@Module({
  imports: [CoreModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestIdMiddleware,
        AccessLogMiddleware,
        express.json(),
        express.urlencoded({ extended: true }),
      )
      .forRoutes('*');
  }
}
