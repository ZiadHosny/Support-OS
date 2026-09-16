/**
 * The auth flows — `apps/accounts/views.py` + `serializers.py`, ported.
 *
 * Every response shape and error code here is matched against the running
 * Django service by NODE-2's harness; the ones that are NOT expressible
 * there (a token issued by one service being accepted by the other) are
 * verified by direct probe.
 */

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UserLoaderService } from '../core/auth/user-loader.service.js';
import { permissionsFor } from '../core/auth/permissions.js';
import type { AuthenticatedUser } from '../core/auth/auth-context.js';
import type { Env } from '../core/config/env.schema.js';
import { JwtService, type TokenPair } from './jwt/jwt.service.js';
import { TokenBlacklistService } from './jwt/token-blacklist.service.js';
import {
  encodeDjangoPassword,
  needsRehash,
  parseDjangoHash,
  verifyDjangoPassword,
} from './password/django-hasher.js';
import {
  dumps,
  loads,
  passwordFingerprint,
  INVITE_SALT,
  INVITE_TOKEN_MAX_AGE_SECONDS,
  MFA_CHALLENGE_MAX_AGE_SECONDS,
  MFA_CHALLENGE_SALT,
  RESET_SALT,
  RESET_TOKEN_MAX_AGE_SECONDS,
} from './signing/django-signing.js';
import {
  decryptSecret,
  encryptSecret,
  InvalidFernetTokenError,
  resolveFernetKey,
} from './mfa/fernet.js';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  provisioningUri,
  recoveryCodeMatches,
  verifyTotpCode,
} from './mfa/totp.js';
import {
  AUTHENTICATION_FAILED,
  NO_ACTIVE_ACCOUNT_MESSAGE,
  TOKEN_NOT_VALID,
  TOKEN_NOT_VALID_MESSAGE,
} from '../core/filters/error-codes.js';

/**
 * simplejwt raises DRF's `AuthenticationFailed` for a bad credential pair,
 * whose code is `authentication_failed` — NOT `not_authenticated`, which
 * is what a bare UnauthorizedException would emit. Probed against Django.
 */
function authenticationFailed(): UnauthorizedException {
  return new UnauthorizedException({
    code: AUTHENTICATION_FAILED,
    message: NO_ACTIVE_ACCOUNT_MESSAGE,
  });
}

export interface MfaRequired {
  mfa_required: true;
  mfa_token: string;
}

function tokenNotValid(): UnauthorizedException {
  return new UnauthorizedException({
    code: TOKEN_NOT_VALID,
    message: TOKEN_NOT_VALID_MESSAGE,
  });
}

@Injectable()
export class AuthService {
  private readonly fernetKey: Buffer;
  private readonly secretKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserLoaderService,
    private readonly jwt: JwtService,
    private readonly blacklist: TokenBlacklistService,
    config: ConfigService<Env, true>,
  ) {
    this.secretKey = config.get('DJANGO_SECRET_KEY', { infer: true });
    this.fernetKey = resolveFernetKey(
      config.get('MFA_ENCRYPTION_KEY', { infer: true }),
      this.secretKey,
    );
  }

  /** Issues a pair and records the refresh token as outstanding. */
  private async issuePair(userId: bigint): Promise<TokenPair> {
    const access = await this.jwt.sign('access', userId);
    const refresh = await this.jwt.sign('refresh', userId);
    await this.blacklist.recordOutstanding(
      refresh.jti,
      userId,
      refresh.token,
      refresh.expiresAt,
    );
    return { access: access.token, refresh: refresh.token };
  }

  /** `UPDATE_LAST_LOGIN` is on (base.py:211). */
  private async touchLastLogin(userId: bigint): Promise<void> {
    await this.prisma.accounts_user.update({
      where: { id: userId },
      data: { last_login: new Date() },
    });
  }

  /**
   * `POST /api/auth/token/` — `MfaAwareTokenObtainPairSerializer`.
   * A 2FA account is authenticated but gets NO token pair; it receives a
   * signed 5-minute challenge instead.
   */
  async obtainToken(
    email: string,
    password: string,
  ): Promise<TokenPair | MfaRequired> {
    const row = await this.users.findByEmail(email);

    // Verify even when the row is missing, to keep the timing of "unknown
    // email" and "wrong password" comparable. An inactive account is
    // rejected the same way simplejwt does.
    const storedHash = row?.password ?? '';
    const passwordOk = row
      ? await verifyDjangoPassword(password, storedHash)
      : false;
    if (!row || !passwordOk || !row.is_active) {
      throw authenticationFailed();
    }

    if (needsRehash(storedHash)) {
      await this.prisma.accounts_user.update({
        where: { id: row.id },
        data: { password: await encodeDjangoPassword(password) },
      });
    }

    if (row.mfa_enabled) {
      return {
        mfa_required: true,
        mfa_token: dumps(Number(row.id), MFA_CHALLENGE_SALT, this.secretKey),
      };
    }

    const pair = await this.issuePair(row.id);
    await this.touchLastLogin(row.id);
    return pair;
  }

  /**
   * `POST /api/auth/token/refresh/` — rotates AND blacklists, because
   * ROTATE_REFRESH_TOKENS and BLACKLIST_AFTER_ROTATION are both on.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const claims = await this.jwt.verify(refreshToken, 'refresh');
    if (!claims) throw tokenNotValid();
    if (await this.blacklist.isBlacklisted(claims.jti)) throw tokenNotValid();

    const userId = BigInt(claims.user_id);
    const user = await this.users.load(userId);
    if (!user || !user.is_active) throw tokenNotValid();

    await this.blacklist.blacklist(
      claims.jti,
      userId,
      refreshToken,
      new Date((claims.exp ?? 0) * 1000),
    );
    return this.issuePair(userId);
  }

  /**
   * `POST /api/auth/logout/` — no Authorization header; the refresh token
   * in the body IS the credential. Idempotent: an already-blacklisted,
   * expired or malformed token still returns 200, because the caller's
   * goal already holds.
   */
  async logout(refreshToken: string): Promise<void> {
    const claims = await this.jwt.verify(refreshToken, 'refresh');
    if (!claims) return;
    try {
      await this.blacklist.blacklist(
        claims.jti,
        BigInt(claims.user_id),
        refreshToken,
        new Date((claims.exp ?? 0) * 1000),
      );
    } catch {
      // Already blacklisted, or a race with a concurrent logout. The
      // outcome the caller asked for holds either way.
    }
  }

  /** `POST /api/auth/token/verify-mfa/` — `MfaChallengeSerializer`. */
  async verifyMfa(mfaToken: string, code: string): Promise<TokenPair> {
    const payload = loads(
      mfaToken,
      MFA_CHALLENGE_SALT,
      this.secretKey,
      MFA_CHALLENGE_MAX_AGE_SECONDS,
    );
    if (typeof payload !== 'number') {
      throw new BadRequestException({
        fields: { mfa_token: ['This challenge is invalid or has expired.'] },
      });
    }

    const userId = BigInt(payload);
    const row = await this.prisma.accounts_user.findUnique({
      where: { id: userId },
    });
    if (!row || !row.is_active || !row.mfa_enabled) {
      throw new BadRequestException({
        fields: { mfa_token: ['This challenge is invalid or has expired.'] },
      });
    }

    if (await this.consumeSecondFactor(row.id, row.mfa_secret, code)) {
      const pair = await this.issuePair(row.id);
      await this.touchLastLogin(row.id);
      return pair;
    }

    throw new BadRequestException({ fields: { code: ['Invalid code.'] } });
  }

  /**
   * A TOTP code, or a single-use recovery code. A Fernet decryption failure
   * (rotated key, corrupt value) counts as "no working secret" rather than a
   * 500 — recovery codes are then the only way in, which is their purpose.
   */
  private async consumeSecondFactor(
    userId: bigint,
    encryptedSecret: string,
    code: string,
  ): Promise<boolean> {
    if (encryptedSecret) {
      try {
        if (
          verifyTotpCode(decryptSecret(encryptedSecret, this.fernetKey), code)
        )
          return true;
      } catch (error) {
        if (!(error instanceof InvalidFernetTokenError)) throw error;
      }
    }

    const unused = await this.prisma.accounts_twofactorrecoverycode.findMany({
      where: { user_id: userId, used_at: null },
    });
    for (const candidate of unused) {
      if (recoveryCodeMatches(candidate.code_hash, code)) {
        await this.prisma.accounts_twofactorrecoverycode.update({
          where: { id: candidate.id },
          data: { used_at: new Date() },
        });
        return true;
      }
    }
    return false;
  }

  /** `GET /api/auth/me/` — `UserSerializer`. */
  serializeUser(user: AuthenticatedUser) {
    return {
      id: Number(user.id),
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_staff: user.is_staff,
      role: user.role ? { slug: user.role.slug, name: user.role.name } : null,
      department: user.department
        ? { id: Number(user.department.id), name: user.department.name }
        : null,
      branch: user.branch
        ? { id: Number(user.branch.id), name: user.branch.name }
        : null,
      permissions: [...permissionsFor(user)].sort((a, b) => a.localeCompare(b)),
      mfa_enabled: user.mfa_enabled,
      mfa_required: user.role?.requires_two_factor ?? false,
    };
  }

  /**
   * `POST /api/auth/password-reset/request/` — always 200, existing address
   * or not, so it cannot be used to enumerate registered addresses.
   *
   * Delivery is not ported (`NODE-7` owns notifications): the token is
   * minted and discarded, so the observable contract holds but the side
   * effect does not yet. Recorded in backend-node/README.md.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const row = await this.users.findByEmail(email);
    if (!row || !row.is_active) return;
    dumps(
      [Number(row.id), passwordFingerprint(row.password)],
      RESET_SALT,
      this.secretKey,
    );
  }

  /** `POST /api/auth/password-reset/confirm/` — `PasswordResetConfirmSerializer`. */
  async confirmPasswordReset(token: string, password: string): Promise<void> {
    const invalid = new BadRequestException({
      fields: { token: ['This reset link is invalid or has expired.'] },
    });

    const payload = loads(
      token,
      RESET_SALT,
      this.secretKey,
      RESET_TOKEN_MAX_AGE_SECONDS,
    );
    if (!Array.isArray(payload) || payload.length !== 2) throw invalid;
    const [userId, fingerprint] = payload as [number, string];

    const row = await this.prisma.accounts_user.findFirst({
      where: { id: BigInt(userId), is_active: true },
    });
    // The fingerprint is what makes the token single-use for an ALREADY
    // active account, which has no "unused" state to gate on: once
    // set_password runs, the digest baked into any earlier token stops
    // matching (apps/accounts/tokens.py).
    if (!row || passwordFingerprint(row.password) !== fingerprint)
      throw invalid;

    await this.prisma.accounts_user.update({
      where: { id: row.id },
      data: { password: await encodeDjangoPassword(password) },
    });
  }

  /**
   * `POST /api/auth/invite/confirm/` — `InviteConfirmSerializer`.
   *
   * The precondition is `is_active = false` AND an unusable password, not
   * `is_active` alone: a still-valid invite in an old inbox must not
   * reactivate an account an admin later deactivated for cause.
   */
  async confirmInvite(token: string, password: string): Promise<void> {
    const invalid = new BadRequestException({
      fields: { token: ['This invite link is invalid or has expired.'] },
    });

    const payload = loads(
      token,
      INVITE_SALT,
      this.secretKey,
      INVITE_TOKEN_MAX_AGE_SECONDS,
    );
    if (typeof payload !== 'number') throw invalid;

    const row = await this.prisma.accounts_user.findFirst({
      where: { id: BigInt(payload), is_active: false },
    });
    if (!row || parseDjangoHash(row.password) !== null) throw invalid;

    await this.prisma.accounts_user.update({
      where: { id: row.id },
      data: { password: await encodeDjangoPassword(password), is_active: true },
    });
  }

  /** `POST /api/auth/2fa/enroll/` — mints a pending secret, stores it encrypted. */
  async enrollTwoFactor(user: AuthenticatedUser) {
    const secret = generateTotpSecret();
    await this.prisma.accounts_user.update({
      where: { id: user.id },
      // mfa_enabled stays false until /2fa/confirm/ proves the user can
      // produce a code from it.
      data: { mfa_secret: encryptSecret(secret, this.fernetKey) },
    });
    return {
      secret,
      provisioning_uri: provisioningUri(user.email, secret),
    };
  }

  /**
   * `POST /api/auth/2fa/confirm/` — proves the pending secret works, turns
   * 2FA on, and issues the recovery codes (returned exactly once).
   */
  async confirmTwoFactor(user: AuthenticatedUser, code: string) {
    const row = await this.prisma.accounts_user.findUnique({
      where: { id: user.id },
    });
    if (!row?.mfa_secret) {
      throw new BadRequestException({
        fields: { code: ['Start enrolment first.'] },
      });
    }

    let secret: string;
    try {
      secret = decryptSecret(row.mfa_secret, this.fernetKey);
    } catch {
      throw new BadRequestException({
        fields: { code: ['Start enrolment first.'] },
      });
    }
    if (!verifyTotpCode(secret, code)) {
      throw new BadRequestException({ fields: { code: ['Invalid code.'] } });
    }

    const codes = generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.accounts_user.update({
        where: { id: user.id },
        data: { mfa_enabled: true },
      }),
      this.prisma.accounts_twofactorrecoverycode.deleteMany({
        where: { user_id: user.id },
      }),
      this.prisma.accounts_twofactorrecoverycode.createMany({
        data: codes.map((value) => ({
          user_id: user.id,
          code_hash: hashRecoveryCode(value),
          created_at: new Date(),
          updated_at: new Date(),
        })),
      }),
    ]);

    return { recovery_codes: codes };
  }

  /** `POST /api/auth/2fa/disable/` — password-confirmed, clears everything. */
  async disableTwoFactor(
    user: AuthenticatedUser,
    password: string,
  ): Promise<void> {
    const row = await this.prisma.accounts_user.findUnique({
      where: { id: user.id },
    });
    if (!row || !(await verifyDjangoPassword(password, row.password))) {
      throw new BadRequestException({
        fields: { password: ['Password is incorrect.'] },
      });
    }
    await this.prisma.$transaction([
      this.prisma.accounts_user.update({
        where: { id: user.id },
        data: { mfa_enabled: false, mfa_secret: '' },
      }),
      this.prisma.accounts_twofactorrecoverycode.deleteMany({
        where: { user_id: user.id },
      }),
    ]);
  }

  /** `POST /api/auth/change-password/` — `ChangePasswordSerializer`. */
  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const row = await this.prisma.accounts_user.findUnique({
      where: { id: user.id },
    });
    if (!row || !(await verifyDjangoPassword(currentPassword, row.password))) {
      throw new BadRequestException({
        fields: { current_password: ['Current password is incorrect.'] },
      });
    }
    await this.prisma.accounts_user.update({
      where: { id: user.id },
      data: { password: await encodeDjangoPassword(newPassword) },
    });
  }
}
