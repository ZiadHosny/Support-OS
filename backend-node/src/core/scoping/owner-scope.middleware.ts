/**
 * Establishes the owner-scope store for the request.
 *
 * It runs before routing, but the scope is unknown until the auth guard has
 * authenticated the caller — so it seeds `{customerId: null}` and the guard
 * mutates it in place. A public route keeps `null`, i.e. unscoped, which is
 * correct: there is no owner to scope to.
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
