/**
 * Loads the `AuthenticatedUser` for a verified token. One query, with the
 * role, department, branch and linked customer already joined, because
 * every request needs all four: the permission guard needs `role`, `/me`
 * needs all of them, and the owner-scope layer needs `customerId`.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './auth-context.js';

@Injectable()
export class UserLoaderService {
  constructor(private readonly prisma: PrismaService) {}

  async load(userId: bigint): Promise<AuthenticatedUser | null> {
    const row = await this.prisma.accounts_user.findUnique({
      where: { id: userId },
      include: {
        accounts_role: true,
        organization_department: true,
        organization_branch: true,
        customers_customer: { select: { id: true } },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      is_active: row.is_active,
      is_staff: row.is_staff,
      is_superuser: row.is_superuser,
      mfa_enabled: row.mfa_enabled,
      role: row.accounts_role
        ? {
            id: row.accounts_role.id,
            slug: row.accounts_role.slug,
            name: row.accounts_role.name,
            permissions: row.accounts_role.permissions,
            requires_two_factor: row.accounts_role.requires_two_factor,
          }
        : null,
      department: row.organization_department
        ? {
            id: row.organization_department.id,
            name: row.organization_department.name,
          }
        : null,
      branch: row.organization_branch
        ? { id: row.organization_branch.id, name: row.organization_branch.name }
        : null,
      customerId: row.customers_customer?.id ?? null,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.accounts_user.findUnique({ where: { email } });
  }
}
