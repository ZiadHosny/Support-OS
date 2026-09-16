/**
 * The authenticated caller for the current request.
 *
 * Guards and handlers read the caller from HERE, never from the JWT
 * directly — that indirection is the seam `NODE-10` needs when it ports
 * `ApiKeyAuthentication`, which resolves an API key to a real `User` so
 * every permission check applies unchanged. Adding that authenticator
 * must not require touching the permission guard.
 */

export interface AuthenticatedUser {
  id: bigint;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  mfa_enabled: boolean;
  role: {
    id: bigint;
    slug: string;
    name: string;
    permissions: unknown;
    requires_two_factor: boolean;
  } | null;
  department: { id: bigint; name: string } | null;
  branch: { id: bigint; name: string } | null;
  /** The linked `customers_customer` row, when this account is a portal login. */
  customerId: bigint | null;
}

/** Attached to the Express request by the JWT guard. */
export const AUTH_USER_KEY = 'authUser';

export interface RequestWithUser {
  [AUTH_USER_KEY]?: AuthenticatedUser;
}

export function getAuthUser(request: unknown): AuthenticatedUser | undefined {
  return (request as RequestWithUser | undefined)?.[AUTH_USER_KEY];
}

export function setAuthUser(request: unknown, user: AuthenticatedUser): void {
  (request as RequestWithUser)[AUTH_USER_KEY] = user;
}
