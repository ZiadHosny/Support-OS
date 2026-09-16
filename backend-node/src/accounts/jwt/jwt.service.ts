/**
 * JWT issuance and verification, byte-compatible with
 * `rest_framework_simplejwt` as this project configures it.
 *
 * A token issued by either service must be accepted by the other — that
 * is what "existing tokens must keep working" means concretely, and it is
 * the acceptance test for this module.
 *
 * Claims, read from a live Django-issued token:
 *
 *   {"token_type":"access","exp":…,"iat":…,
 *    "jti":"260fb32cdda04c6bbdd8d684d8adcf01","user_id":"150"}
 *
 * HS256. No `aud`, no `iss`. `jti` is 32 hex characters. `user_id` is a
 * STRING — an integer there still validates on this side and fails on
 * Django's, which is the dangerous direction because a Node-only test
 * would pass it.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '../../core/config/env.schema.js';

export type TokenType = 'access' | 'refresh';

export interface SimpleJwtClaims extends JWTPayload {
  token_type: TokenType;
  jti: string;
  user_id: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/** simplejwt's `jti` is `uuid4().hex` — 32 lowercase hex characters. */
function newJti(): string {
  return randomBytes(16).toString('hex');
}

@Injectable()
export class JwtService {
  private readonly key: Uint8Array;
  private readonly accessLifetimeSeconds: number;
  private readonly refreshLifetimeSeconds: number;

  constructor(config: ConfigService<Env, true>) {
    // base.py:196 — `env("JWT_SIGNING_KEY", default="").strip() or SECRET_KEY`.
    // Blank-but-present is this project's normal state, so the fallback is
    // the live path.
    const configured = config.get('JWT_SIGNING_KEY', { infer: true }).trim();
    const signingKey =
      configured || config.get('DJANGO_SECRET_KEY', { infer: true });
    this.key = new TextEncoder().encode(signingKey);

    this.accessLifetimeSeconds =
      config.get('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', { infer: true }) * 60;
    this.refreshLifetimeSeconds =
      config.get('JWT_REFRESH_TOKEN_LIFETIME_DAYS', { infer: true }) *
      24 *
      60 *
      60;
  }

  lifetimeSeconds(tokenType: TokenType): number {
    return tokenType === 'access'
      ? this.accessLifetimeSeconds
      : this.refreshLifetimeSeconds;
  }

  async sign(
    tokenType: TokenType,
    userId: number | bigint | string,
    jti: string = newJti(),
  ): Promise<{ token: string; jti: string; expiresAt: Date }> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.lifetimeSeconds(tokenType);

    const token = await new SignJWT({
      token_type: tokenType,
      jti,
      // String, matching simplejwt. Not a number.
      user_id: String(userId),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.key);

    return { token, jti, expiresAt: new Date(expiresAt * 1000) };
  }

  /**
   * Verifies signature, expiry and `token_type`. Returns null for anything
   * invalid — the caller decides which of the two 401 codes that becomes,
   * because "no header at all" and "a header this rejected" are different
   * answers (see core/filters/error-codes.ts).
   */
  async verify(
    token: string,
    expectedType: TokenType,
  ): Promise<SimpleJwtClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
      });
      const claims = payload as SimpleJwtClaims;
      if (claims.token_type !== expectedType) return null;
      if (typeof claims.user_id !== 'string' || !claims.jti) return null;
      return claims;
    } catch {
      return null;
    }
  }
}
