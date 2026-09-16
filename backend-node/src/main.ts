/**
 * Bootstrap. Order matters here (see `app.module.ts`'s docstring for why):
 * CORS is enabled before `app.listen()` so it mounts on the Express stack
 * before `AppModule`'s `configure()`-registered middleware, matching
 * `backend/config/settings/base.py`'s `MIDDLEWARE` order (CORS first).
 *
 * `bodyParser: false`: Nest's default registers `express.json()`/
 * `express.urlencoded()` automatically during `init()`, BEFORE any
 * `configure()`-based middleware — which would put body-parsing ahead of
 * `RequestIdMiddleware`, so a malformed-JSON request would 400 with no
 * `request_id` in the envelope (Django's equivalent parses the body
 * inside the view, i.e. after `RequestIDMiddleware` has already set the
 * context — see `app.module.ts` for the parser registered in the right
 * place instead).
 */

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import type { Env } from './core/config/env.schema.js';
import { configureLogger } from './core/logging/logger.js';
import { assertEveryRouteDeclaresAccess } from './core/auth/route-declaration.check.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<Env, true>);

  configureLogger({
    level: config.get('DJANGO_LOG_LEVEL', { infer: true }),
    format: config.get('DJANGO_LOG_FORMAT', { infer: true }),
  });

  // All 131 frozen-contract paths end with a trailing slash
  // (docs/api-contract.django.yaml); every route in this service is
  // declared and reached the same way.
  app.setGlobalPrefix('api');

  const corsOrigins = config
    .get('CORS_ALLOWED_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  // The fail-closed guarantee, relocated to startup (NODE-3): a route that
  // declares no access rule cannot reach production, because the process
  // refuses to start. See core/auth/route-declaration.decorator.ts for why
  // the RUNTIME keeps Django's grant-on-omission instead.
  assertEveryRouteDeclaresAccess(app);

  const port = config.get('NODE_PORT', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `SupportOS Node service listening on http://localhost:${port}/api`,
  );
}

await bootstrap();
