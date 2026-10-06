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

  // Business-initiated message OUTSIDE the 24-hour customer-service window
  // (e.g. a listing alert to someone who hasn't messaged us today). Meta only
  // allows pre-approved templates there; free-form text is rejected. The
  // template is expected to have ONE body variable ({{1}}) carrying the text.
  async sendTemplateMessage(to: string, templateName: string, languageCode: string, bodyText: string): Promise<void> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!accessToken || !phoneNumberId) {
      throw new Error('WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured — cannot send');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: [{ type: 'body', parameters: [{ type: 'text', text: bodyText }] }],
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const bodyText2 = await response.text().catch(() => '<unreadable body>');
      throw new Error(`WhatsApp template send failed (${response.status}): ${bodyText2}`);
    }
  }

  // Inbound media (a photo or PDF a user sent us): Meta gives only a media id
  // in the webhook; the bytes take two authenticated calls. Throws on any
  // failure — the caller decides that a failed download must not break the
  // flow.
  async downloadMedia(
    mediaId: string,
    maxBytes: number,
  ): Promise<{ data: Buffer; mimeType: string }> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN not configured — cannot download media');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const meta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(mediaId)}`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!meta.ok) throw new Error(`Media lookup failed (${meta.status})`);
      const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
      if (!info.url || !info.mime_type) throw new Error('Media lookup returned no url');
      if (info.file_size && info.file_size > maxBytes) throw new Error('Media file too large');

      const file = await fetch(info.url, { headers: { authorization: `Bearer ${accessToken}` }, signal: controller.signal });
      if (!file.ok) throw new Error(`Media download failed (${file.status})`);
      const data = Buffer.from(await file.arrayBuffer());
      if (data.length > maxBytes) throw new Error('Media file too large');
      return { data, mimeType: info.mime_type.split(';')[0].trim() };
    } finally {
      clearTimeout(timeout);
    }
  }
}
