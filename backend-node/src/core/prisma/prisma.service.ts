/**
 * Typed database access over the introspected schema — introspect-only,
 * per CONVENTIONS-NODE.md § 2. This service never issues a migration; there
 * is no migration command in this service's `package.json` at all
 * (`npm run check:no-migrations` enforces that structurally).
 *
 * Prisma 7's `prisma-client` generator requires an explicit driver adapter
 * rather than reading a datasource URL from the environment implicitly, so
 * the connection string is composed here, from the same `POSTGRES_*`
 * variables Django reads, and handed to `PrismaPg` directly. It is never
 * written to a `.env` file (`database-url.ts`).
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { Env } from '../config/env.schema.js';
import { composeDatabaseUrl } from '../config/database-url.js';
import { ownerScopeExtension } from '../scoping/owner-scope.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<Env, true>) {
    const connectionString = composeDatabaseUrl({
      POSTGRES_USER: configService.get('POSTGRES_USER', { infer: true }),
      POSTGRES_PASSWORD: configService.get('POSTGRES_PASSWORD', {
        infer: true,
      }),
      POSTGRES_HOST: configService.get('POSTGRES_HOST', { infer: true }),
      POSTGRES_PORT: configService.get('POSTGRES_PORT', { infer: true }),
      POSTGRES_DB: configService.get('POSTGRES_DB', { infer: true }),
    });
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  /**
   * The owner-scope extension (NODE-3). Applied here rather than offered
   * as a helper, so a handler writing a raw
   * `prisma.<model>.findMany()` still gets a scoped query — there is no
   * unscoped path to call. See core/scoping/owner-scope.ts.
   *
   * `$extends` returns a NEW client rather than mutating this one, so the
   * scoped client is what modules must inject. Exposed as a getter so the
   * extension is built once.
   */
  private scopedClient?: ReturnType<PrismaClient['$extends']>;

  get scoped() {
    this.scopedClient ??= this.$extends(ownerScopeExtension());
    return this.scopedClient;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
