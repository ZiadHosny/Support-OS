/**
 * Every route declares what it requires; `route-declaration.check.ts` fails
 * the boot if one declares nothing.
 *
 * At runtime this keeps Django's grant-on-omission (`HasPermission`,
 * apps/core/permissions.py) — inverting it would 403 working endpoints and
 * stop being a port. The backlog's fail-closed requirement is met at startup
 * instead: an undeclared route cannot boot.
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';
export const PUBLIC_ROUTE_KEY = 'publicRoute';
export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/** Authenticated AND holding this permission. */
export const RequirePermission = (
  permission: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);

/** No credentials at all — Django's `authentication_classes = []` + `AllowAny`. */
export const PublicRoute = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_ROUTE_KEY, true);

/** Authenticated, gated on no permission — Django's grant-on-omission, made explicit. */
export const AuthenticatedOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);
