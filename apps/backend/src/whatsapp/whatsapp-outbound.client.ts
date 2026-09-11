import { Injectable, Logger } from '@nestjs/common';

// WHATSAPP INTEGRATION Phase 3 — CONFIRM/CORRECT LOOP. The first outbound
// capability anywhere in this codebase (Phases 1-2 only ever received).
// Mirrors WhatsappAiClient's pattern — raw fetch, no SDK dependency, a
// single well-scoped call — for the same reason: one endpoint, not worth a
// bigger client library.
//
// THROWS on any failure (missing config, network, timeout, non-2xx) — same
// contract as WhatsappAiClient.extractExpense. That is deliberate: this
// class's job is only "attempt the send, report success or failure
// honestly." Deciding that a failed send must never block or fail the flow
// that triggered it (per the Phase 3 brief) is the CALLER's responsibility
// (WhatsappParsingService.parseAndStoreDraft /
// WhatsappConfirmationService.sendReplySafely), exactly like AI-call
// failures are WhatsappParsingService's responsibility to catch, not
// WhatsappAiClient's.
const GRAPH_API_VERSION = 'v21.0';
const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class WhatsappOutboundClient {
  private readonly logger = new Logger(WhatsappOutboundClient.name);

  async sendTextMessage(to: string, body: string): Promise<void> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!accessToken || !phoneNumberId) {
      // Unconfigured — throws rather than silently no-op-ing (unlike
      // WhatsappAiClient's "degrade to LOW confidence" for a missing key)
      // because there is no safe degraded behavior for a *send*: either the
      // message reaches the sender or it doesn't. Throwing gives callers one
      // single catch-and-log path for every failure mode instead of two.
      throw new Error('WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured — cannot send');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '<unreadable body>');
      throw new Error(`WhatsApp send failed (${response.status}): ${bodyText}`);
    }
  }
}
