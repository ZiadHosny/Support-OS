/**
 * Fernet decryption/encryption for the stored TOTP secret — SEC-9's
 * `apps/accounts/mfa.py`, ported.
 *
 * The TOTP secret is the one credential in this codebase that must be
 * DECRYPTED again later (every code verification needs the raw secret),
 * which is why it is encrypted at rest rather than hashed.
 *
 * Fernet: a 32-byte key split in half — the first 16 bytes sign
 * (HMAC-SHA256), the last 16 encrypt (AES-128-CBC). Token layout:
 *   version(1) | timestamp(8, big-endian) | iv(16) | ciphertext | hmac(32)
 * urlsafe-base64 over the whole thing.
 *
 * `MFA_ENCRYPTION_KEY`'s derivation when unset is NOT the same as
 * `JWT_SIGNING_KEY`'s: base.py:220-225 derives a validly-shaped Fernet key
 * with `urlsafe_b64encode(sha256(SECRET_KEY).digest())` rather than reusing
 * SECRET_KEY directly, because Fernet requires exactly 32 urlsafe-base64
 * bytes. Get this wrong and every enrolled secret becomes undecryptable,
 * with no error until a user tries to sign in.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function resolveFernetKey(
  mfaEncryptionKey: string,
  djangoSecretKey: string,
): Buffer {
  const configured = mfaEncryptionKey.trim();
  const urlsafeKey = configured
    ? configured
    : createHash('sha256')
        .update(Buffer.from(djangoSecretKey, 'utf-8'))
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

  const raw = Buffer.from(
    urlsafeKey.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
  if (raw.length !== 32) {
    throw new Error(
      `MFA_ENCRYPTION_KEY must decode to 32 bytes (got ${raw.length}). ` +
        'It is a Fernet key: urlsafe-base64, 44 characters.',
    );
  }
  return raw;
}

export class InvalidFernetTokenError extends Error {}

export function decryptSecret(token: string, key: Buffer): string {
  const signingKey = key.subarray(0, 16);
  const encryptionKey = key.subarray(16, 32);

  const raw = Buffer.from(
    token.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
  if (raw.length < 57 || raw[0] !== 0x80)
    throw new InvalidFernetTokenError('Malformed Fernet token');

  const body = raw.subarray(0, raw.length - 32);
  const providedHmac = raw.subarray(raw.length - 32);
  const expectedHmac = createHmac('sha256', signingKey).update(body).digest();
  if (
    providedHmac.length !== expectedHmac.length ||
    !timingSafeEqual(providedHmac, expectedHmac)
  ) {
    throw new InvalidFernetTokenError('Fernet signature mismatch');
  }

  const iv = raw.subarray(9, 25);
  const ciphertext = raw.subarray(25, raw.length - 32);
  const decipher = createDecipheriv('aes-128-cbc', encryptionKey, iv);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf-8');
}

export function encryptSecret(
  plaintext: string,
  key: Buffer,
  now: Date = new Date(),
): string {
  const signingKey = key.subarray(0, 16);
  const encryptionKey = key.subarray(16, 32);

  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-128-cbc', encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf-8')),
    cipher.final(),
  ]);

  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(Math.floor(now.getTime() / 1000)));

  const body = Buffer.concat([Buffer.from([0x80]), timestamp, iv, ciphertext]);
  const mac = createHmac('sha256', signingKey).update(body).digest();

  return Buffer.concat([body, mac])
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
