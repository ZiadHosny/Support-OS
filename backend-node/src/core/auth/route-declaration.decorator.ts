/**
 * Every route must declare what it requires. Three decorators, and a
 * startup check that fails the boot if a route carries none of them
 * (`route-declaration.check.ts`).
 *
 * This is where NODE-3 reconciles a genuine conflict. The backlog asks
 * that "a route without a declared permission must fail closed", but
 * `HasPermission` (apps/core/permissions.py) deliberately does the
 * opposite at RUNTIME — an action with no `permission_map` entry is
 * authenticated-only, and its docstring argues the case: "a missing entry
 * is far more often an unfinished map than an intent to forbid, and a
 * silent 403 on a working endpoint is the harder bug to find."
 *
 * Inverting that would 403 working endpoints and stop being a port. So the
 * runtime keeps Django's grant-on-omission, and the fail-closed guarantee
 * moves to startup: an UNDECLARED route cannot reach production at all,
 * while a route declared open behaves exactly as Django's does. The
 * constraint's actual intent — no route slips through undeclared — is met
 * without changing a single response.
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';
export const PUBLIC_ROUTE_KEY = 'publicRoute';
export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/** The caller must be authenticated AND hold this permission. */
export const RequirePermission = (
  permission: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);

/**
 * No credentials required at all — the login endpoint, the token refresh,
 * the password-reset pair. Equivalent to Django's
 * `authentication_classes = []` + `permission_classes = [AllowAny]`.
 */
export const PublicRoute = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_ROUTE_KEY, true);

/**
 * Authenticated, but gated on no particular permission — Django's
 * grant-on-omission case, made explicit rather than implied by silence.
 * `/api/auth/me/` is the canonical example.
 */
export const AuthenticatedOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);
