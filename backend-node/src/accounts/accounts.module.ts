/**
 * The `accounts` module — the Node counterpart of `backend/apps/accounts/`,
 * and the first domain-shaped module in this service (NODE-3).
 *
 * `JwtService` and `UserLoaderService` are exported because the global
 * auth guard in `core` depends on them.
 */

import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtService } from './jwt/jwt.service.js';
import { TokenBlacklistService } from './jwt/token-blacklist.service.js';
import { UserLoaderService } from '../core/auth/user-loader.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    TokenBlacklistService,
    UserLoaderService,
  ],
  exports: [JwtService, UserLoaderService, TokenBlacklistService],
})
export class AccountsModule {}
