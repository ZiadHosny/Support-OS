/**
 * Catch-all for unmatched paths under `/api/` — the port of
 * `ApiNotFoundView`. Registered last in `app.module.ts` so it only receives
 * what nothing else matched. Paths outside `/api/` never reach it and keep
 * Nest's own HTML 404 (test_health.py::test_non_api_paths_are_untouched).
 *
 * Any method is 404 here, not 405: the path does not exist, so no method on
 * it is allowed.
 */

import { All, Controller, NotFoundException } from '@nestjs/common';
import { PublicRoute } from '../auth/route-declaration.decorator.js';

// An unmatched path must 404 the same way with or without credentials.
@PublicRoute()
@Controller()
export class NotFoundController {
  // Express 5 requires a NAMED wildcard; a bare '*' is deprecated.
  @All('*path')
  notFound(): never {
    throw new NotFoundException();
  }
}
