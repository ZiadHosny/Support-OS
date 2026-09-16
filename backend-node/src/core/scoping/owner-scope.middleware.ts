/**
 * Establishes the owner-scope store for the request.
 *
 * It must run BEFORE routing (so every later query sees it) but the scope
 * itself is not known until the auth guard has authenticated the caller —
 * so this seeds `{customerId: null}` and the guard mutates it in place.
 * A request that never reaches the guard (a public route) therefore keeps
 * `customerId: null`, i.e. unscoped, which is correct: there is no owner
 * to scope to.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithOwnerScope } from './owner-scope.js';

@Injectable()
export class OwnerScopeMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    runWithOwnerScope({ customerId: null }, () => next());
  }
}
