/**
 * The single response shape for the whole API — the Node port of
 * `apps/core/envelope.py`. Every response body is:
 *
 *     { success: bool, data: <payload> | null, error: null | {...}, meta: null | {...} }
 *
 * All four keys are always present, in this key order, so a client can
 * discriminate on `success` without probing for optional keys — and so a
 * byte-for-byte diff against the Django response is meaningful.
 */

export interface ErrorBody {
  code: string;
  message: string;
  fields: Record<string, string[]>;
  request_id?: string;
  debug?: { exception: string; stack?: string };
}

export interface Envelope<T = unknown> {
  success: boolean;
  data: T | null;
  error: ErrorBody | null;
  meta: Record<string, unknown> | null;
}

// A WeakSet, not a marker property on the object itself: a payload that
// happens to contain a `success` key must never be mistaken for an
// already-wrapped body (the same reason apps/core/envelope.py's `Envelope`
// is a nominal `dict` subclass rather than a shape check), and membership
// here adds nothing to the serialized JSON — unlike an extra property,
// which JSON.stringify would then have to be trusted to never re-order.
const ENVELOPES = new WeakSet<object>();

export function successEnvelope<T>(
  data: T | null = null,
  meta: Record<string, unknown> | null = null,
): Envelope<T> {
  const envelope: Envelope<T> = { success: true, data, error: null, meta };
  ENVELOPES.add(envelope);
  return envelope;
}

export function errorEnvelope(
  code: string,
  message: string,
  fields: Record<string, string[]> = {},
): Envelope<null> {
  const error: ErrorBody = { code, message, fields };
  const envelope: Envelope<null> = {
    success: false,
    data: null,
    error,
    meta: null,
  };
  ENVELOPES.add(envelope);
  return envelope;
}

export function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && ENVELOPES.has(value);
}
