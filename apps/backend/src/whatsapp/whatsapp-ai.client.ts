import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { TradeCategorySchema, TRADE_CATEGORIES, type TradeCategory } from '@siraat/shared-types';

// WHATSAPP INTEGRATION Phase 2 — AI PARSING. No AI/LLM integration existed
// anywhere else in this codebase (checked: no SDK dependency, no client
// wrapper, no config for a provider key) — this is the first one, kept
// deliberately small and self-contained (raw fetch against Anthropic's
// Messages API, no SDK dependency added) rather than reaching for a bigger
// framework for a single extraction call.

export interface ExpenseExtraction {
  item: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  trade_category: TradeCategory | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  // WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION.
  // Added as an extra field on the SAME extraction call rather than a second
  // AI request per message (cheaper, and the model already reads the full
  // message text for item/trade_category) — independent of confidence/item:
  // a message with no identifiable expense can still name a business, and a
  // clear expense can still mention none. Detection only; never used to
  // link anything by itself — see WhatsappBusinessLinkService.
  mentioned_business_name: string | null;
}

export interface ExtractionOutcome {
  extraction: ExpenseExtraction;
  raw: unknown;
}

// A value of null/undefined/'' becomes null; anything else is coerced to a
// number, and an unparseable coercion (NaN) is rejected by z.number() below
// — zod's number check explicitly fails on NaN, so garbage the AI might emit
// (e.g. quantity: "a few") falls through to the shape-validation-failure
// path in extractExpense rather than silently becoming a wrong number.
const numericOrNull = z.preprocess(
  (val) => (val === null || val === undefined || val === '' ? null : typeof val === 'string' ? Number(val) : val),
  z.number().nullable(),
);

const ExtractionResponseSchema = z.object({
  item: z.string().trim().min(1).nullable(),
  quantity: numericOrNull,
  unit: z.string().trim().min(1).nullable(),
  rate: numericOrNull,
  // Must be one of TRADE_CATEGORIES or null — reusing the shared schema
  // means the AI can never produce a category this codebase doesn't
  // recognize, without a second hand-maintained enum list.
  trade_category: TradeCategorySchema.nullable(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  mentioned_business_name: z.string().trim().min(1).nullable(),
});

function lowConfidenceFallback(): ExpenseExtraction {
  return {
    item: null,
    quantity: null,
    unit: null,
    rate: null,
    trade_category: null,
    confidence: 'LOW',
    mentioned_business_name: null,
  };
}

function buildSystemPrompt(): string {
  return [
    'You extract structured construction-expense data from a short WhatsApp message sent by a site supervisor or contractor.',
    'Respond with ONLY a single JSON object — no prose, no markdown code fences — matching exactly this shape:',
    '{"item": string|null, "quantity": number|null, "unit": string|null, "rate": number|null, "trade_category": string|null, "confidence": "HIGH"|"MEDIUM"|"LOW", "mentioned_business_name": string|null}',
    '',
    'Field rules:',
    '- item: the material or work item purchased/performed (e.g. "cement", "steel bars"), or null if none is identifiable.',
    '- quantity: the numeric amount, or null.',
    '- unit: the unit as written in the message (e.g. "bags", "kg", "cft"), or null.',
    '- rate: the price per unit, or null. Do not compute a total; only the per-unit rate if one is stated.',
    `- trade_category: your best guess at which ONE of these categories the item/work belongs to — you MUST pick only from this exact list, never invent a new one: ${TRADE_CATEGORIES.join(', ')}. Use null only if none plausibly fits.`,
    '- confidence: "HIGH" if the message clearly describes a specific purchase/expense with usable numbers, "MEDIUM" if it describes an expense but some fields are guessed or missing, "LOW" if the message is not really describing an expense at all (a question, a greeting, a status update, etc.) — in that case set item/quantity/unit/rate/trade_category to null.',
    '- mentioned_business_name: the name of any contractor or supplier business named in the message (e.g. "Al-Rehman Traders delivered the cement" -> "Al-Rehman Traders"), or null if no business is named by name. This is independent of the other fields — extract it even when confidence is LOW or no expense is described.',
    '',
    'Always return valid JSON matching the shape above, even when every field is null.',
  ].join('\n');
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const REQUEST_TIMEOUT_MS = 15_000;

// Strips a ```json ... ``` fence if the model wraps its answer in one despite
// being told not to, then extracts the first {...} block — defensive against
// minor formatting drift rather than assuming perfect instruction-following.
function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const braceMatch = candidate.match(/\{[\s\S]*\}/);
  const jsonText = braceMatch ? braceMatch[0] : candidate;
  return JSON.parse(jsonText);
}

@Injectable()
export class WhatsappAiClient {
  private readonly logger = new Logger(WhatsappAiClient.name);

  // Throws on network failure/timeout/non-2xx — that's a real "the AI call
  // failed" case the caller (WhatsappParsingService) is expected to catch
  // and treat as retryable, distinct from the AI successfully responding
  // with something unparseable (handled below by falling back, not
  // throwing) or genuinely low-confidence (also not a failure).
  async extractExpense(messageText: string): Promise<ExtractionOutcome> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // No key configured — degrade gracefully rather than crash the
      // fire-and-forget parse flow (e.g. local dev with no key set yet).
      this.logger.warn('ANTHROPIC_API_KEY not set — storing a low-confidence draft without an AI call');
      return { extraction: lowConfidenceFallback(), raw: { skipped: 'no_api_key' } };
    }

    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: messageText }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '<unreadable body>');
      throw new Error(`Anthropic API returned ${response.status}: ${bodyText}`);
    }

    const json: unknown = await response.json();
    const textBlock = (json as { content?: Array<{ text?: unknown }> } | undefined)?.content?.[0]?.text;
    if (typeof textBlock !== 'string') {
      throw new Error('Anthropic response missing text content block');
    }

    let candidate: unknown;
    try {
      candidate = extractJsonObject(textBlock);
    } catch (err) {
      // The AI responded but not with parseable JSON — an unparseable
      // *message*, not a failed *call*. Fall back rather than throw so this
      // doesn't get treated as a retryable infra failure.
      this.logger.warn(`AI response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
      return { extraction: lowConfidenceFallback(), raw: json };
    }

    const validated = ExtractionResponseSchema.safeParse(candidate);
    if (!validated.success) {
      this.logger.warn(`AI extraction failed shape validation: ${validated.error.message}`);
      return { extraction: lowConfidenceFallback(), raw: json };
    }

    return { extraction: validated.data, raw: json };
  }
}
