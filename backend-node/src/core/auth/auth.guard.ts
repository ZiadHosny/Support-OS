/**
 * The global authentication + authorization guard — `IsAuthenticated` plus
 * `HasPermission` (apps/core/permissions.py) in one place.
 *
 * Runtime semantics match Django exactly:
 *  - `@PublicRoute()`         -> no credentials needed at all.
 *  - `@RequirePermission(p)`  -> authenticated AND holds `p`, else 403.
 *  - `@AuthenticatedOnly()`   -> authenticated, no permission checked.
 *    This is Django's grant-on-omission case, made explicit. See
 *    route-declaration.decorator.ts for why the runtime is NOT inverted.
 *
 * The two 401 codes are decided here, and only here:
 *  - no Authorization header at all -> `not_authenticated`
 *  - a header present but rejected  -> `token_not_valid`
 * The frontend's silent refresh keys on the second exactly
 * (frontend/src/shared/lib/api/client.ts:96-98).
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtService } from '../../accounts/jwt/jwt.service.js';
import {
  TOKEN_NOT_VALID,
  TOKEN_NOT_VALID_MESSAGE,
} from '../filters/error-codes.js';
import { setAuthUser } from './auth-context.js';
import { enterOwnerScope } from '../scoping/owner-scope.js';
import { permissionsFor } from './permissions.js';
import {
  PUBLIC_ROUTE_KEY,
  REQUIRED_PERMISSION_KEY,
} from './route-declaration.decorator.js';
import { UserLoaderService } from './user-loader.service.js';

/** Carries an explicit `code`, which AllExceptionsFilter reads preferentially. */
function tokenNotValid(): UnauthorizedException {
  return new UnauthorizedException({
    code: TOKEN_NOT_VALID,
    message: TOKEN_NOT_VALID_MESSAGE,
  });
}

/** DRF's own wording for a request with no credentials at all. */
function notAuthenticated(): UnauthorizedException {
  return new UnauthorizedException(
    'Authentication credentials were not provided.',
  );
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UserLoaderService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ROUTE_KEY,
      targets,
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    // No header at all is a different answer from a header we rejected.
    if (!header) throw notAuthenticated();

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw tokenNotValid();

    const claims = await this.jwt.verify(token, 'access');
    if (!claims) throw tokenNotValid();

    const user = await this.users.load(BigInt(claims.user_id));
    // An unknown or deactivated account is a token that no longer resolves
    // to a usable identity — simplejwt's own authentication raises its
    // `token_not_valid` family here rather than `not_authenticated`.
    if (!user || !user.is_active) throw tokenNotValid();

    setAuthUser(request, user);
    // Publish the owner scope for the rest of this request, so the Prisma
    // extension narrows every query a portal caller makes without any
    // handler opting in. A staff account (customerId === null) is not
    // narrowed. See core/scoping/owner-scope.ts.
    enterOwnerScope({ customerId: user.customerId });

    const required = this.reflector.getAllAndOverride<string>(
      REQUIRED_PERMISSION_KEY,
      targets,
    );
    if (!required) {
      // @AuthenticatedOnly(), or a route the startup check already refused
      // to let boot. Authenticated is enough — Django's grant-on-omission.
      return true;
    }

    if (!permissionsFor(user).has(required)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }
    return true;
  }
}
