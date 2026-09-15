/**
 * Catch-all for unmatched paths under `/api/` — the Node port of
 * `apps/core/views.py::ApiNotFoundView`. Registered last (see
 * `app.module.ts`'s controller order), so every other controller's routes
 * are tried first; this only ever receives what nothing else matched.
 *
 * `@Controller()` + `@All('*')`, combined with `app.setGlobalPrefix('api')`
 * in `main.ts`, resolves to `/api/*` — any path OUTSIDE `/api/` never
 * reaches this controller at all, so it is left to Express/Nest's own
 * default 404 (not JSON), matching `apps/core/tests/test_health.py::
 * ApiCatchAllTests::test_non_api_paths_are_untouched`.
 *
 * Any method is a 404 here, not a 405 — the path does not exist, so no
 * method on it is allowed.
 */

import { All, Controller, NotFoundException } from '@nestjs/common';

@Controller()
export class NotFoundController {
  // Express 5 / path-to-regexp v6+ requires a NAMED wildcard — a bare '*'
  // is deprecated (auto-converted with a startup warning). '*path' matches
  // every remaining segment the same way '*' used to.
  @All('*path')
  notFound(): never {
    throw new NotFoundException();
  }
}
