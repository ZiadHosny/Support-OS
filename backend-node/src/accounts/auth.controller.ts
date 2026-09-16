/**
 * The 12 `auth`-tagged contract operations. Paths, methods and response
 * shapes come from `docs/api-contract.django.yaml` and from probing the
 * running Django service — never from preference.
 *
 * Every route declares its access rule explicitly (@PublicRoute /
 * @AuthenticatedOnly / @RequirePermission); the startup check in
 * `core/auth/route-declaration.check.ts` refuses to boot if one does not.
 */

import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { getAuthUser } from '../core/auth/auth-context.js';
import {
  AuthenticatedOnly,
  PublicRoute,
} from '../core/auth/route-declaration.decorator.js';
import { Throttle } from '../core/throttling/throttle.decorator.js';

interface TokenBody {
  email?: string;
  password?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * `POST /api/auth/token/` — login. Returns a token pair, or, for a
   * 2FA-enabled account, `{mfa_required, mfa_token}` and NO pair.
   */
  @Post('token')
  @HttpCode(200)
  @PublicRoute()
  @Throttle('auth_credentials')
  async token(@Body() body: TokenBody) {
    return this.auth.obtainToken(body?.email ?? '', body?.password ?? '');
  }

  @Post('token/refresh')
  @HttpCode(200)
  @PublicRoute()
  @Throttle('auth_credentials')
  async refresh(@Body() body: { refresh?: string }) {
    return this.auth.refresh(body?.refresh ?? '');
  }

  @Post('token/verify-mfa')
  @HttpCode(200)
  @PublicRoute()
  @Throttle('auth_credentials')
  async verifyMfa(@Body() body: { mfa_token?: string; code?: string }) {
    return this.auth.verifyMfa(body?.mfa_token ?? '', body?.code ?? '');
  }

  /**
   * No `Authorization` header: the refresh token in the body IS the
   * credential being revoked, and a client whose access token has already
   * expired must still be able to invalidate it — which is precisely the
   * state a logging-out user is often in.
   */
  @Post('logout')
  @HttpCode(200)
  @PublicRoute()
  async logout(@Body() body: { refresh?: string }) {
    await this.auth.logout(body?.refresh ?? '');
    return null;
  }

  @Get('me')
  @AuthenticatedOnly()
  me(@Req() request: Request) {
    const user = getAuthUser(request);
    return user ? this.auth.serializeUser(user) : null;
  }

  @Post('change-password')
  @HttpCode(200)
  @AuthenticatedOnly()
  async changePassword(
    @Req() request: Request,
    @Body() body: { current_password?: string; new_password?: string },
  ) {
    const user = getAuthUser(request)!;
    await this.auth.changePassword(
      user,
      body?.current_password ?? '',
      body?.new_password ?? '',
    );
    return null;
  }

  /**
   * Always 200, whether or not the address exists — revealing which
   * addresses are registered would be an enumeration oracle.
   */
  @Post('password-reset/request')
  @HttpCode(200)
  @PublicRoute()
  @Throttle('password_reset_request')
  async requestPasswordReset(@Body() body: { email?: string }) {
    await this.auth.requestPasswordReset(body?.email ?? '');
    return null;
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  @PublicRoute()
  @Throttle('auth_credentials')
  async confirmPasswordReset(
    @Body() body: { token?: string; password?: string },
  ) {
    await this.auth.confirmPasswordReset(
      body?.token ?? '',
      body?.password ?? '',
    );
    return null;
  }

  @Post('invite/confirm')
  @HttpCode(200)
  @PublicRoute()
  @Throttle('auth_credentials')
  async confirmInvite(@Body() body: { token?: string; password?: string }) {
    await this.auth.confirmInvite(body?.token ?? '', body?.password ?? '');
    return null;
  }

  @Post('2fa/enroll')
  @HttpCode(200)
  @AuthenticatedOnly()
  async enrollTwoFactor(@Req() request: Request) {
    return this.auth.enrollTwoFactor(getAuthUser(request)!);
  }

  @Post('2fa/confirm')
  @HttpCode(200)
  @AuthenticatedOnly()
  async confirmTwoFactor(
    @Req() request: Request,
    @Body() body: { code?: string },
  ) {
    return this.auth.confirmTwoFactor(getAuthUser(request)!, body?.code ?? '');
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @AuthenticatedOnly()
  async disableTwoFactor(
    @Req() request: Request,
    @Body() body: { password?: string },
  ) {
    await this.auth.disableTwoFactor(
      getAuthUser(request)!,
      body?.password ?? '',
    );
    return null;
  }
}
