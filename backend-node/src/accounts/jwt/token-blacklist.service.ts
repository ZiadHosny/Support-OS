/**
 * `rest_framework_simplejwt.token_blacklist`, ported onto the same two
 * tables Django already writes: `token_blacklist_outstandingtoken` and
 * `token_blacklist_blacklistedtoken`.
 *
 * `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION` are both on
 * (base.py:209-210), so a refresh must invalidate the token it replaces.
 * A Node refresh that issues a new pair WITHOUT writing the blacklist row
 * leaves the old token valid — a silent downgrade of a security control
 * that no response shape would reveal.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service.js';

@Injectable()
export class TokenBlacklistService {
  constructor(private readonly prisma: PrismaService) {}

  /** Records a freshly issued refresh token, as simplejwt's `for_user` does. */
  async recordOutstanding(
    jti: string,
    userId: bigint,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.token_blacklist_outstandingtoken.create({
      data: {
        jti,
        user_id: userId,
        token,
        created_at: new Date(),
        expires_at: expiresAt,
      },
    });
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const outstanding =
      await this.prisma.token_blacklist_outstandingtoken.findUnique({
        where: { jti },
        include: { token_blacklist_blacklistedtoken: true },
      });
    return Boolean(outstanding?.token_blacklist_blacklistedtoken);
  }

  /**
   * Blacklists by `jti`. Idempotent: blacklisting an already-blacklisted
   * token is not an error, because the caller's goal (this token must not
   * work again) already holds — the same reasoning `LogoutView` documents.
   *
   * A token with no outstanding row — issued before the blacklist app was
   * installed, or by a path that did not record it — gets one created here
   * so the blacklist entry has something to point at.
   */
  async blacklist(
    jti: string,
    userId: bigint | null,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const outstanding =
      await this.prisma.token_blacklist_outstandingtoken.upsert({
        where: { jti },
        create: {
          jti,
          user_id: userId,
          token,
          created_at: new Date(),
          expires_at: expiresAt,
        },
        update: {},
      });

    const existing =
      await this.prisma.token_blacklist_blacklistedtoken.findUnique({
        where: { token_id: outstanding.id },
      });
    if (existing) return;

    await this.prisma.token_blacklist_blacklistedtoken.create({
      data: { token_id: outstanding.id, blacklisted_at: new Date() },
    });
  }
}
