/**
 * Django password-hash verification, so that no account needs a password
 * reset to move across.
 *
 * Stored format (read from a live row):
 *
 *   pbkdf2_sha256$1000000$d17LRk0TM3gfUCD5wTY0HQ$GZHI5Cb...pCI=
 *   └ algorithm ┘└ iters ┘└────── salt ────────┘└─ base64(hash) ─┘
 *
 * The salt is used as a RAW ASCII string, not base64-decoded first, and
 * dklen is 32. Verified byte-for-byte against that row.
 *
 * Always the async `crypto.pbkdf2`, never `pbkdf2Sync`: ~180 ms per
 * verification at 1,000,000 iterations, which the sync form would spend
 * blocking the event loop. The async form runs on the libuv threadpool,
 * whose default size of 4 caps concurrent logins.
 */
import { pbkdf2, randomInt, timingSafeEqual } from 'node:crypto';

export const DJANGO_ALGORITHM = 'pbkdf2_sha256';

/**
 * Only what a newly encoded password uses, and what `needsRehash` compares
 * against — verification reads the count from the row itself.
 */
export const DEFAULT_ITERATIONS = 1_000_000;

/** sha256 digest size. Django passes dklen=0, which resolves to this. */
const DKLEN = 32;

/** `RANDOM_STRING_CHARS`, verified against the installed Django 5.2.17. */
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
 * Null when the value is not a well-formed PBKDF2 hash. Django's "unusable
 * password" (`!` plus random characters, written for an account pending its
 * invite — SEC-5) lands here and must never verify.
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
 * For a `PASSWORD_HASHERS` fallback (PBKDF2SHA1, Argon2, BCryptSHA256,
 * Scrypt); no row uses one today. Loud on purpose — a silent `false` would
 * read as "wrong password" forever for a correct password.
 */
export class UnsupportedHashAlgorithmError extends Error {
  constructor(algorithm: string) {
    super(
      `Unsupported password hash algorithm "${algorithm}". This service verifies ` +
        `${DJANGO_ALGORITHM} only; every row in this database uses it.`,
    );
  }
}

/** False for an unusable or malformed stored value; throws only for an
 * algorithm this verifier does not implement. */
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
 * The bar is not that this service can read it back but that Django can:
 * both serve the same rows, and a password changed here is signed in with
 * there.
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
 * Re-encode after a successful login — what `check_password` does through
 * its `setter`. A no-op while both services sit at the same count; written
 * now so raising it later is a config change, not a discovery.
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
