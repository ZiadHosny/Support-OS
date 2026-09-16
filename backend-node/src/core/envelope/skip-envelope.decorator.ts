/**
 * The one sanctioned opt-out from the envelope interceptor (Django's
 * `PlainTextRenderer`). Meta's WhatsApp webhook verification needs
 * `hub.challenge` echoed as a raw string. Unused until `NODE-6`.
 */

import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

export const SkipEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE_KEY, true);
