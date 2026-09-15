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

export const VALIDATION_MESSAGE = 'The submitted data is invalid.';
export const INTERNAL_MESSAGE = 'An unexpected error occurred.';
export const NON_FIELD_KEY = 'non_field_errors';
