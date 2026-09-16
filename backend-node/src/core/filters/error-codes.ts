/**
 * `error.code` by HTTP status — the 12-code table from `README.md` §
 * "Error codes", reproduced exactly. This is the fixed target, not a
 * starting point.
 */
export const STATUS_TO_CODE: Record<number, string> = {
  400: 'validation_error',
  401: 'not_authenticated',
  403: 'permission_denied',
  404: 'not_found',
  405: 'method_not_allowed',
  406: 'not_acceptable',
  415: 'unsupported_media_type',
  429: 'throttled',
};

/**
 * 401 carries three codes, and the difference is load-bearing. Probed
 * against Django:
 *
 *   no Authorization header       -> not_authenticated
 *   present but malformed/expired -> token_not_valid
 *   wrong credential pair         -> authentication_failed
 *
 * The frontend's silent refresh (frontend/src/shared/lib/api/client.ts:96-98)
 * retries ONLY on `token_not_valid`. Get it wrong and either every user is
 * hard-logged-out when their access token expires, or every anonymous
 * request triggers a pointless refresh. Both are thrown explicitly, through
 * the `code` seam `AllExceptionsFilter.resolveHttpException` reads.
 */
export const TOKEN_NOT_VALID = 'token_not_valid';
export const TOKEN_NOT_VALID_MESSAGE =
  'Given token not valid for any token type';

export const AUTHENTICATION_FAILED = 'authentication_failed';
export const NO_ACTIVE_ACCOUNT_MESSAGE =
  'No active account found with the given credentials';

export const VALIDATION_MESSAGE = 'The submitted data is invalid.';
export const INTERNAL_MESSAGE = 'An unexpected error occurred.';
export const NON_FIELD_KEY = 'non_field_errors';
