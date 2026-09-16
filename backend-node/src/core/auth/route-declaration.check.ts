/**
 * The fail-closed guarantee, relocated to startup (NODE-3).
 *
 * The backlog asks that an undeclared route fail closed; Django's runtime
 * deliberately grants on omission and changing that would 403 working
 * endpoints (see route-declaration.decorator.ts). This check gives the
 * constraint its real intent instead: a route that declares NOTHING cannot
 * reach production, because the process refuses to start.
 *
 * Runs once, after the router is built, before `listen()`.
 */

import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTHENTICATED_ONLY_KEY,
  PUBLIC_ROUTE_KEY,
  REQUIRED_PERMISSION_KEY,
} from './route-declaration.decorator.js';

/**
 * Nest stores the decorator metadata on the controller METHOD. Walking the
 * Express router gives paths but not handlers we can reflect on, so the
 * check walks the DI container's controllers instead — which is where the
 * metadata actually lives.
 */
export function assertEveryRouteDeclaresAccess(app: INestApplication): void {
  const reflector = app.get(Reflector);
  const modules = (
    app as unknown as {
      container?: { getModules?: () => Map<string, unknown> };
    }
  ).container?.getModules?.();

  if (!modules) {
    throw new Error(
      'Route declaration check could not read the module container. It must not be ' +
        'silently skipped — every route has to declare @RequirePermission, @PublicRoute ' +
        'or @AuthenticatedOnly.',
    );
  }

  const undeclared: string[] = [];

  for (const moduleRef of modules.values()) {
    const controllers = (
      moduleRef as { controllers?: Map<unknown, { metatype?: unknown }> }
    ).controllers;
    if (!controllers) continue;

    for (const wrapper of controllers.values()) {
      const controller = wrapper.metatype as
        (new (...args: never[]) => unknown) | undefined;
      if (typeof controller !== 'function') continue;

      const prototype = controller.prototype as Record<string, unknown>;
      for (const methodName of Object.getOwnPropertyNames(prototype)) {
        if (methodName === 'constructor') continue;
        const handler = prototype[methodName];
        if (typeof handler !== 'function') continue;
        // Only methods Nest actually mapped as routes carry a path.
        const isRoute = Reflect.hasMetadata('path', handler);
        if (!isRoute) continue;

        const declared = [
          REQUIRED_PERMISSION_KEY,
          PUBLIC_ROUTE_KEY,
          AUTHENTICATED_ONLY_KEY,
        ].some(
          (key) =>
            reflector.getAllAndOverride(key, [handler, controller]) !==
            undefined,
        );
        if (!declared) {
          undeclared.push(`${controller.name}.${methodName}`);
        }
      }
    }
  }

  if (undeclared.length > 0) {
    throw new Error(
      `Refusing to start: ${undeclared.length} route(s) declare no access rule.\n` +
        undeclared.map((name) => `  - ${name}`).join('\n') +
        `\n\nEvery route must carry @RequirePermission(...), @PublicRoute() or ` +
        `@AuthenticatedOnly(). See src/core/auth/route-declaration.decorator.ts.`,
    );
  }
}
