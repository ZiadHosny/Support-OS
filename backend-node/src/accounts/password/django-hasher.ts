/**
 * Django password-hash verification — NODE-3's 🔑 "no credential
 * migration" task. Every existing account must sign in with its current
 * password; a forced reset is not an acceptable outcome.
 *
 * Stored format (read from a live row):
 *
 *   pbkdf2_sha256$1000000$d17LRk0TM3gfUCD5wTY0HQ$GZHI5Cb...pCI=
 *   └ algorithm ┘└ iters ┘└────── salt ────────┘└─ base64(hash) ─┘
 *
 * The salt is used as a RAW ASCII string — it is NOT base64-decoded first
 * — and dklen is 32 (the sha256 digest size, which is what Django's
 * `dklen=0` default resolves to). Verified byte-for-byte against that row.
 *
 * ALWAYS the async `crypto.pbkdf2`, NEVER `pbkdf2Sync`: measured at
 * ~180 ms per verification at Django's 1,000,000 iterations, which the
 * sync form would spend blocking the event loop, serialising the whole
 * service behind one login. The async form runs on the libuv threadpool,
 * whose default size is 4 — so at most four logins verify concurrently.
 * That cap is documented in backend-node/README.md rather than tuned away.
 */

import { pbkdf2, randomInt, timingSafeEqual } from 'node:crypto';

export const DJANGO_ALGORITHM = 'pbkdf2_sha256';

/**
 * Django 5.2's PBKDF2PasswordHasher default, and the value actually stored
 * in this database. A row hashed with a different count still verifies —
 * the count is read from the row, not from here. This constant is only
 * what a NEWLY encoded password uses, and what `needsRehash` compares
 * against.
 */
export const DEFAULT_ITERATIONS = 1_000_000;

/** sha256 digest size. Django passes dklen=0, which resolves to this. */
const DKLEN = 32;

/**
 * `django.utils.crypto.RANDOM_STRING_CHARS`, verified against the
 * installed Django 5.2.17. 22 characters of it is what `BasePasswordHasher
 * .salt()` produces (128 bits of entropy over a 62-character alphabet).
 */
const SALT_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SALT_LENGTH = 22;

export interface ParsedHash {
  algorithm: string;
  iterations: number;
  salt: string;
  hash: string;
}

/**
 * Splits a stored value, or returns null when it is not a well-formed
 * PBKDF2 hash. An "unusable password" — Django writes `!` followed by
 * random characters for an account pending its invite (SEC-5) — lands
 * here and must never verify.
 */
export function parseDjangoHash(
  stored: string | null | undefined,
): ParsedHash | null {
  if (!stored) return null;
  const parts = stored.split('$');
  if (parts.length !== 4) return null;
  const [algorithm, iterations, salt, hash] = parts;
  if (!algorithm || !iterations || !salt || !hash) return null;
  const parsedIterations = Number(iterations);
  if (!Number.isInteger(parsedIterations) || parsedIterations <= 0) return null;
  return { algorithm, iterations: parsedIterations, salt, hash };
}

function derive(
  password: string,
  salt: string,
  iterations: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, DKLEN, 'sha256', (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/**
 * Thrown for a stored hash this verifier cannot evaluate — a different
 * algorithm from Django's `PASSWORD_HASHERS` fallbacks (PBKDF2SHA1,
 * Argon2, BCryptSHA256, Scrypt). No row uses one today. Loud on purpose:
 * a silent `false` would read as "wrong password" forever, for an account
 * whose password is in fact correct.
 */
export class UnsupportedHashAlgorithmError extends Error {
  constructor(algorithm: string) {
    super(
      `Unsupported password hash algorithm "${algorithm}". This service verifies ` +
        `${DJANGO_ALGORITHM} only; every row in this database uses it.`,
    );
  }
}

/**
 * Constant-time verification of a plaintext password against a stored
 * Django hash. Returns false for an unusable or malformed stored value,
 * and throws only for a recognised-but-unsupported algorithm.
 */
export async function verifyDjangoPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  const parsed = parseDjangoHash(stored);
  if (!parsed) return false;
  if (parsed.algorithm !== DJANGO_ALGORITHM) {
    throw new UnsupportedHashAlgorithmError(parsed.algorithm);
  }

  const derived = await derive(password, parsed.salt, parsed.iterations);
  const expected = Buffer.from(parsed.hash, 'base64');
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** `django.utils.crypto.get_random_string` over the same alphabet. */
function generateSalt(): string {
  let salt = '';
  for (let i = 0; i < SALT_LENGTH; i += 1) {
    salt += SALT_CHARS[randomInt(SALT_CHARS.length)];
  }
  return salt;
}

/**
 * Encodes a new password in Django's format. The bar this has to clear is
 * not "the Node service can read it back" but "Django can read it back" —
 * both services serve the same rows, and a password changed here is signed
 * in with there.
 */
export async function encodeDjangoPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
  salt: string = generateSalt(),
): Promise<string> {
  const derived = await derive(password, salt, iterations);
  return `${DJANGO_ALGORITHM}$${iterations}$${salt}$${derived.toString('base64')}`;
}

/**
 * Whether a stored hash should be re-encoded after a successful login —
 * the same thing Django's `check_password` does through its `setter`
 * callback. A no-op today, with both services at 1,000,000 iterations;
 * written now precisely so that raising the count later is a config
 * change rather than a discovery.
 */
export function needsRehash(
  stored: string,
  iterations: number = DEFAULT_ITERATIONS,
): boolean {
  const parsed = parseDjangoHash(stored);
  if (!parsed) return false;
  return (
    parsed.algorithm === DJANGO_ALGORITHM && parsed.iterations !== iterations
  );
}
