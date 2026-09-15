/**
 * The one sanctioned opt-out from the envelope interceptor — the Node
 * counterpart of `apps/core/renderers.py`'s `PlainTextRenderer`. Meta's
 * WhatsApp webhook verification (`GET`) requires the `hub.challenge` value
 * echoed back as a raw string, not this API's envelope. No route in this
 * story uses it; it exists so `NODE-6` (Communications Port) has it
 * without re-deriving the mechanism.
 *
 * Usage: `@SkipEnvelope() @Get('webhooks/whatsapp') handshake() { ... }`
 */

import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

export const SkipEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE_KEY, true);
