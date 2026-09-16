/**
 * `error.code` by HTTP status — the 12-code table from `README.md` §
 * "Error codes", reproduced exactly. `apps/core/exceptions.py` derives
 * these from DRF's own exception classes; this is the fixed target, not a
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
 * 401 carries TWO codes, and the difference is load-bearing (NODE-3).
 * Probed against Django:
 *
 *   no Authorization header          -> not_authenticated
 *   present but malformed/expired    -> token_not_valid
 *
 * The frontend's silent-refresh interceptor
 * (frontend/src/shared/lib/api/client.ts:96-98) retries ONLY on
 * `token_not_valid`. Returning `not_authenticated` for an expired token
 * means the refresh never fires and every user is hard-logged-out when
 * their access token expires; returning `token_not_valid` for a missing
 * token makes the browser attempt a pointless refresh on every anonymous
 * request.
 *
 * STATUS_TO_CODE above cannot express two codes for one status, so this
 * one is thrown explicitly by the JWT guard, through the `code` seam
 * `AllExceptionsFilter.resolveHttpException` already reads.
 */
export const TOKEN_NOT_VALID = 'token_not_valid';
export const TOKEN_NOT_VALID_MESSAGE =
  'Given token not valid for any token type';

/**
 * The THIRD 401 code: simplejwt's `TokenObtainSerializer` raises DRF's
 * `AuthenticationFailed` for a bad credential pair, whose `default_code`
 * is `authentication_failed` — not `not_authenticated`, which is what a
 * plain `UnauthorizedException` would produce here. Verified by probing
 * Django with a wrong password.
 */
export const AUTHENTICATION_FAILED = 'authentication_failed';
export const NO_ACTIVE_ACCOUNT_MESSAGE =
  'No active account found with the given credentials';

export const VALIDATION_MESSAGE = 'The submitted data is invalid.';
export const INTERNAL_MESSAGE = 'An unexpected error occurred.';
export const NON_FIELD_KEY = 'non_field_errors';
