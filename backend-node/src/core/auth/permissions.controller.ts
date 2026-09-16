/**
 * `GET /api/permissions/` — the full permission vocabulary, sorted.
 *
 * Gated on `roles.manage` (verified against Django): nobody can see the
 * vocabulary without also being able to act on it. It returns
 * ALL_PERMISSIONS — the catalogue the frontend's role editor renders its
 * checklist from — NOT what the calling user happens to hold.
 */

import { Controller, Get } from '@nestjs/common';
import { Permissions, sortedPermissionCatalogue } from './permissions.js';
import { RequirePermission } from './route-declaration.decorator.js';

@Controller('permissions')
export class PermissionsController {
  @Get()
  @RequirePermission(Permissions.ROLES_MANAGE)
  list(): string[] {
    return sortedPermissionCatalogue();
  }
}
