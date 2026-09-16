/**
 * The authorization vocabulary — the Node half of `CONV` § 22's
 * "the vocabulary is code, the mapping is data" split, unchanged by the
 * port. These 25 strings are code (this file); the role → permission
 * mapping stays data, in `accounts_role.permissions`, read through Prisma.
 *
 * Ported verbatim from `backend/apps/core/permissions.py`. Adding one is a
 * change there AND here, in the same commit, for as long as both services
 * serve the same database.
 */

export const Permissions = {
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  CUSTOMERS_EXPORT_DATA: 'customers.export_data',
  CUSTOMERS_ERASE_DATA: 'customers.erase_data',
  TICKETS_VIEW: 'tickets.view',
  TICKETS_MANAGE: 'tickets.manage',
  KNOWLEDGE_BASE_VIEW: 'knowledge_base.view',
  KNOWLEDGE_BASE_MANAGE: 'knowledge_base.manage',
  PORTAL_ACCESS: 'portal.access',
  AUDIT_LOG_VIEW: 'audit_log.view',
  SETTINGS_MANAGE: 'settings.manage',
  DEPARTMENTS_VIEW: 'departments.view',
  DEPARTMENTS_MANAGE: 'departments.manage',
  BRANCHES_VIEW: 'branches.view',
  BRANCHES_MANAGE: 'branches.manage',
  CALENDARS_VIEW: 'calendars.view',
  CALENDARS_MANAGE: 'calendars.manage',
  API_KEYS_MANAGE: 'api_keys.manage',
  INTEGRATIONS_MANAGE: 'integrations.manage',
  COMMUNICATIONS_MANAGE: 'communications.manage',
  WEBHOOKS_MANAGE: 'webhooks.manage',
  REPORTS_VIEW: 'reports.view',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS: readonly Permission[] = Object.freeze(
  Object.values(Permissions),
);

/** What `GET /api/permissions/` returns: the full vocabulary, sorted. */
export function sortedPermissionCatalogue(): Permission[] {
  return [...ALL_PERMISSIONS].sort((a, b) => a.localeCompare(b));
}

/** The shape `permissionsFor` needs — deliberately not the full Prisma row. */
export interface PermissionSubject {
  is_superuser: boolean;
  role: { permissions: unknown } | null;
}

/**
 * Every permission this user holds — `permissions_for` from
 * `apps/core/permissions.py`, reproduced exactly.
 *
 * The superuser short-circuit is NOT optional and NOT hypothetical: this
 * database has a real superuser, and Django's own `has_perm` short-circuits
 * for one, so anything narrower here would make the API and `/auth/me/`
 * disagree for that account — a bug only one user would ever report.
 */
export function permissionsFor(
  user: PermissionSubject | null | undefined,
): Set<string> {
  if (!user) return new Set();
  if (user.is_superuser) return new Set(ALL_PERMISSIONS);
  const rolePermissions = user.role?.permissions;
  if (!Array.isArray(rolePermissions)) return new Set();
  return new Set(
    rolePermissions.filter(
      (value): value is string => typeof value === 'string',
    ),
  );
}
