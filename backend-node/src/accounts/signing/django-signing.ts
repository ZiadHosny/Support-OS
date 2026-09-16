/**
 * `django.core.signing` — byte-compatible. A challenge/invite/reset token
 * issued by either service must be readable by the other.
 *
 * Format: `<payload>:<timestamp>:<signature>`
 *   payload   = urlsafe-base64(JSON), '=' padding stripped
 *   timestamp = base62 seconds since the epoch (TimestampSigner)
 *   signature = urlsafe-base64(HMAC digest), '=' padding stripped
 *
 * Key derivation, read from the installed Django 5.2.17 source rather
 * than from memory:
 *
 *   key_salt = <salt> + "signer"
 *   key      = sha256(key_salt + SECRET_KEY).digest()
 *   sig      = HMAC(key, value, sha256)
 *
 * The algorithm is sha256, not sha1: `salted_hmac`'s own default parameter
 * is sha1, but `Signer.__init__` overrides it. Verified against a real token.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Django's `b64_encode`: urlsafe base64 with '=' padding stripped. */
function b64Encode(input: Buffer | string): string {
  return Buffer.from(input as never)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64Decode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(
    padded + '='.repeat((4 - (padded.length % 4)) % 4),
    'base64',
  );
}

/** `django.utils.baseconv.base62` — used for the TimestampSigner stamp. */
function base62Encode(value: number): string {
  if (value === 0) return BASE62[0];
  let remaining = value;
  let encoded = '';
  while (remaining > 0) {
    encoded = BASE62[remaining % 62] + encoded;
    remaining = Math.floor(remaining / 62);
  }
  return encoded;
}

function base62Decode(value: string): number {
  let decoded = 0;
  for (const char of value) {
    const index = BASE62.indexOf(char);
    if (index === -1) return Number.NaN;
    decoded = decoded * 62 + index;
  }
  return decoded;
}

/** `django.utils.crypto.salted_hmac(key_salt, value, secret, algorithm="sha256")`. */
function saltedHmac(keySalt: string, value: string, secret: string): Buffer {
  const key = createHash('sha256')
    .update(Buffer.from(keySalt + secret, 'utf-8'))
    .digest();
  return createHmac('sha256', key).update(Buffer.from(value, 'utf-8')).digest();
}

function signature(salt: string, value: string, secret: string): string {
  // Signer.signature(): base64_hmac(self.salt + "signer", value, key)
  return b64Encode(saltedHmac(`${salt}signer`, value, secret));
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf-8');
  const right = Buffer.from(b, 'utf-8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * `signing.dumps(payload, salt=…)`.
 *
 * Django compresses only when that shortens the payload, marking it with a
 * leading '.'. Nothing signed here compresses smaller, so this always emits
 * the uncompressed form; `loads` still reads a compressed one.
 */
export function dumps(
  payload: unknown,
  salt: string,
  secret: string,
  now: Date = new Date(),
): string {
  const json = JSON.stringify(payload, (_key, value) =>
    typeof value === 'bigint' ? Number(value) : value,
  );
  const base64Payload = b64Encode(json);
  const timestamp = base62Encode(Math.floor(now.getTime() / 1000));
  const value = `${base64Payload}:${timestamp}`;
  return `${value}:${signature(salt, value, secret)}`;
}

/**
 * `signing.loads(token, salt=…, max_age=…)`, returning null instead of
 * raising — `read_password_token` (apps/accounts/tokens.py) already
 * collapses BadSignature and SignatureExpired into "None", and callers
 * treat both identically.
 */
export function loads(
  token: string,
  salt: string,
  secret: string,
  maxAgeSeconds: number,
  now: Date = new Date(),
): unknown {
  if (!token) return null;
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [base64Payload, timestamp, providedSignature] = parts;
  if (!base64Payload || !timestamp || !providedSignature) return null;

  const value = `${base64Payload}:${timestamp}`;
  if (!constantTimeEquals(signature(salt, value, secret), providedSignature))
    return null;

  const signedAt = base62Decode(timestamp);
  if (!Number.isFinite(signedAt)) return null;
  const ageSeconds = Math.floor(now.getTime() / 1000) - signedAt;
  // A negative age (clock skew) is not an expiry; Django only rejects age
  // GREATER than max_age.
  if (ageSeconds > maxAgeSeconds) return null;

  try {
    let raw = base64Payload;
    let compressed = false;
    if (raw.startsWith('.')) {
      compressed = true;
      raw = raw.slice(1);
    }
    const decoded = b64Decode(raw);
    if (compressed) {
      // Django zlib-compresses only when it shortens the payload. Not
      // produced by `dumps` above, but read here so a Django-issued token
      // is never rejected for a reason this service controls.
      return JSON.parse(inflateSync(decoded).toString('utf-8'));
    }
    return JSON.parse(decoded.toString('utf-8'));
  } catch {
    return null;
  }
}

/** Salts and lifetimes, from `apps/accounts/tokens.py`. */
export const INVITE_SALT = 'apps.accounts.invite';
export const INVITE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 3;

export const RESET_SALT = 'apps.accounts.password_reset';
export const RESET_TOKEN_MAX_AGE_SECONDS = 60 * 60;

export const MFA_CHALLENGE_SALT = 'apps.accounts.mfa_challenge';
export const MFA_CHALLENGE_MAX_AGE_SECONDS = 60 * 5;

/**
 * `password_fingerprint` — sha256 of the stored hash, first 16 hex chars.
 * Baked into a reset token so that setting a password invalidates every
 * previously-issued one, with no stored "used" flag.
 */
export function passwordFingerprint(storedHash: string): string {
  return createHash('sha256')
    .update(Buffer.from(storedHash, 'utf-8'))
    .digest('hex')
    .slice(0, 16);
}
