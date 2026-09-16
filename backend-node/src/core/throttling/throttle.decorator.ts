/**
 * Marks a route with a named throttle scope — DRF's `throttle_scope`.
 *
 * `auth_credentials` is ONE shared 10/minute budget across all five
 * credential endpoints, not five independent ones (base.py:373-375 says so
 * explicitly: "Shared across all five, so the budgets are NOT
 * independent"). Implementing five separate buckets would quintuple the
 * real limit while looking correct.
 */

import { SetMetadata } from '@nestjs/common';

export const THROTTLE_SCOPE_KEY = 'throttleScope';

export type ThrottleScope =
  'auth_credentials' | 'password_reset_request' | 'anon_write' | 'ai';

export const Throttle = (
  scope: ThrottleScope,
): MethodDecorator & ClassDecorator => SetMetadata(THROTTLE_SCOPE_KEY, scope);

/** `DEFAULT_THROTTLE_RATES` (base.py:361-385), for the scopes NODE-3 ports. */
export const THROTTLE_RATES: Record<
  ThrottleScope,
  { limit: number; windowSeconds: number }
> = {
  auth_credentials: { limit: 10, windowSeconds: 60 },
  password_reset_request: { limit: 5, windowSeconds: 60 * 60 },
  anon_write: { limit: 10, windowSeconds: 60 * 60 },
  ai: { limit: 30, windowSeconds: 60 * 60 },
};
