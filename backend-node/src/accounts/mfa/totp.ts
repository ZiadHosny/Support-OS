/**
 * TOTP (RFC 6238) and recovery-code hashing — `apps/accounts/mfa.py`'s
 * `pyotp` half, ported onto `node:crypto`.
 *
 * `valid_window=1` on the Django side means the previous and next 30-second
 * step are accepted too, tolerating ordinary clock drift between the server
 * and an authenticator app without widening the window so far that a
 * guessed code has a meaningfully larger chance of landing inside it.
 *
 * Recovery codes are the opposite case from the TOTP secret: verified by
 * comparison only, never read back, so plain sha256 + constant-time compare
 * — not a KDF. The code is already 40 bits of `secrets.token_hex` output,
 * so a slow hash defends nothing (mfa.py documents the same reasoning).
 */

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
const VALID_WINDOW = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** The current code — used by enrolment confirmation flows and by tooling. */
export function currentTotpCode(
  secret: string,
  now: Date = new Date(),
): string {
  return generateAt(secret, Math.floor(now.getTime() / 1000 / STEP_SECONDS));
}

/** `pyotp.TOTP(secret).verify(code, valid_window=1)`. */
export function verifyTotpCode(
  secret: string,
  code: string,
  now: Date = new Date(),
): boolean {
  const normalised = code.trim();
  if (!/^\d{6}$/.test(normalised)) return false;
  const counter = Math.floor(now.getTime() / 1000 / STEP_SECONDS);
  for (let offset = -VALID_WINDOW; offset <= VALID_WINDOW; offset += 1) {
    const candidate = generateAt(secret, counter + offset);
    const a = Buffer.from(candidate, 'utf-8');
    const b = Buffer.from(normalised, 'utf-8');
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/**
 * `pyotp.random_base32()` — 160 bits, which is that function's own default
 * AND its minimum (it raises below 32 base32 characters).
 */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20); // 160 bits
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** `pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="SupportOS")`. */
export function provisioningUri(email: string, secret: string): string {
  const issuer = 'SupportOS';
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

/**
 * Ten codes of 10 hex characters (40 bits) each — `secrets.token_hex(5)`,
 * matching `RECOVERY_CODE_COUNT = 10`.
 */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString('hex'));
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(Buffer.from(code, 'utf-8')).digest('hex');
}

export function recoveryCodeMatches(storedHash: string, code: string): boolean {
  const a = Buffer.from(storedHash, 'utf-8');
  const b = Buffer.from(hashRecoveryCode(code), 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
