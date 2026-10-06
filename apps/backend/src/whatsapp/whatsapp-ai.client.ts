import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { normalizeSizeLabel, sizeLabelToMarla } from '../common/plot-size';
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

// WHATSAPP LISTING INGESTION — a forwarded real-estate-group inventory
// message describes N plots, so extraction returns an array, not a single
// object like ExtractionResponseSchema above. One array element per PLOT —
// a multi-plot line ("FHC 7915 16") must already be split into two elements
// by the AI, per the confirmed rule (see buildListingSystemPrompt).
export interface ListingExtraction {
  society_name_raw: string;
  block: string | null;
  plot_number: string;
  size_raw: string | null;
  size_marla: number | null;
  price_lac: number | null;
  status_raw: string | null;
  contact_phone: string | null;
  raw_line: string;
}

export interface ListingExtractionOutcome {
  listings: ListingExtraction[];
  raw: unknown;
}

const ListingExtractionResponseSchema = z.object({
  listings: z.array(
    z.object({
      society_name_raw: z.string().trim().min(1),
      block: z.string().trim().min(1).nullable(),
      plot_number: z.string().trim().min(1),
      size_raw: z.string().trim().min(1).nullable(),
      size_marla: numericOrNull,
      price_lac: numericOrNull,
      status_raw: z.string().trim().min(1).nullable(),
      // Lenient: the model may omit it entirely; absent/blank both mean null.
      contact_phone: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v ?? null), z.string().trim().nullable()),
      raw_line: z.string().trim().min(1),
    }),
  ),
});

// Confirmed rules this prompt encodes verbatim (do not change without a new
// founder sign-off — a wrong rule here corrupts real inventory data at
// scale, not just one message):
//   - price: "5450 lac means 54.50" — insert a decimal point 2 digits from
//     the right, but ONLY when there are more than 2 digits (a bare "52"
//     stays 52.00, it is not treated as "0.52"). Also seen written with a
//     literal apostrophe decimal separator ("47'50" = 47.50).
//   - block code: "FHC" = Society name ("Faisal Hills") + Block letter ("C").
//   - status: "Just mention NDC open or Closed whatever mention in
//     messsage" — captured verbatim, free text, never a fixed enum.
//   - multi-plot: "7915 16" means plots 7915 AND 7916 — split into two
//     separate listing rows/array elements sharing the same block/price/status.
//   - size: not present in the first sample batch; nullable, more messages
//     will include it.
function buildListingSystemPrompt(): string {
  return [
    'You extract structured real-estate plot-inventory data from a WhatsApp message forwarded by a real estate group. The message lists one or more plots for sale, usually grouped under section headings. The sender states the society once (a line such as "Society: Faisal Hills"); every plot in the message belongs to that one society. Section headings such as "FHA - 25x50", "FHB - 30x60" or "FH Executive - 40x80" are NOT societies — they carry a block and/or a plot size (see rules) and apply to every plot below them until the next heading.',
    'Respond with ONLY a single JSON object — no prose, no markdown code fences — matching exactly this shape:',
    '{"listings": [{"society_name_raw": string, "block": string|null, "plot_number": string, "size_raw": string|null, "size_marla": number|null, "price_lac": number|null, "status_raw": string|null, "contact_phone": string|null, "raw_line": string}]}',
    '',
    'Field rules:',
    '- society_name_raw: the single society named by the sender (e.g. the "Society: Faisal Hills" line -> "Faisal Hills"). Never a block/size heading and never a line like "Inventory Updated: 6th Oct". Identical for every plot in the message.',
    '- block: a block letter/code if the plot code or its section heading names one — e.g. "FHC 7473" means Society abbreviation "FH" + Block letter "C", so block = "C"; a heading "FHA - 25x50" means block = "A" and size = 25x50 for the plots under it. Null if no block is indicated.',
    '- plot_number: the plot\'s own number as a string, e.g. "7473".',
    '- size_raw: the plot size, usually a dimension in a section heading such as "25x50", "25 * 50" or "30 x 60" (feet) — normalize to the form "25x50" (lowercase x, no spaces). A size given in Marla/Kanal is written like "5 Marla" / "1 Kanal". A size heading applies to every plot under it until the next heading. Null only if no size is stated for the plot.',
    '- size_marla: always null — the server derives it from size_raw. Do NOT compute it yourself.',
    '- price_lac: the final price in Lac as a decimal number. CRITICAL decimal rule, apply exactly: a price written as a plain multi-digit number with MORE than 2 digits (e.g. "5450") means insert a decimal point 2 digits from the right, giving 54.50 — NOT 5450.00. A number with 2 or fewer digits (e.g. "52") is already a whole Lac value and stays as-is (52.00), it does NOT become 0.52. A price written with a literal apostrophe as the decimal separator (e.g. "47\'50") means 47.50 directly — use the apostrophe position, do not also apply the digit-count rule to it. If no price is given for a plot, use null.',
    '- status_raw: copy the legal/possession status phrase verbatim exactly as written in the message (e.g. "MDR back NDC open", "NDC open", "NDC Closed", "Sun face NDC open") — do not normalize, abbreviate, or map it to a fixed set of values.',
    '- contact_phone: the number from a line like "Contact: 0300-1234567" (normally the last line, covering every plot in the message), copied as written. Null if the message contains no phone number. Never invent or guess a number.',
    '- raw_line: the exact original line(s) this plot was parsed from, for a human reviewer to double check the parse.',
    '',
    'CRITICAL multi-plot rule: a line naming two plot numbers together (e.g. "FHC 7915 16" or "FHC 7986 87") means TWO separate plots sharing the same block/size/price/status from that line and the "Final" line below it — e.g. "7915 16" means plot 7915 AND plot 7916 (the second number is the last two digits of the next consecutive plot number, sharing the first two/three digits of the first). You MUST emit two separate elements in the listings array for such a line, each with its own plot_number, never one element with both numbers.',
    '',
    'If the message describes no plots at all (not a listing message), return {"listings": []}.',
    'Always return valid JSON matching the shape above.',
  ].join('\n');
}

// Deterministic message-level rules, applied AFTER the AI so the founder's
// conventions never depend on model behaviour:
//   - ONE society per message: the "Society: X" line wins; otherwise the most
//     common (cleaned) name the AI produced. This is what keeps the society
//     filter free of duplicates and of "FHA - 25x50"-style heading junk.
//   - the trailing "Contact: 03xx…" number applies to every plot.
//   - size label normalized ("25 * 50" -> "25x50"), Marla derived from the
//     founder's dimension table, never from the model.
function cleanSocietyName(name: string): string {
  return name
    .replace(/[*_~]/g, '')
    .replace(/\s*[-–:]?\s*(inventory|updated|list(ing)?s?|available)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyMessageRules(text: string, listings: ListingExtraction[]): ListingExtraction[] {
  if (listings.length === 0) return listings;

  let society: string | null = null;
  const socMatch = text.match(/^[\s*_~]*society[\s*_~]*[:\-–][\s*_~]*(.+?)[\s*_~]*$/im);
  if (socMatch) society = cleanSocietyName(socMatch[1]);
  if (!society) {
    const counts = new Map<string, number>();
    for (const l of listings) {
      const n = cleanSocietyName(l.society_name_raw);
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    society = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  let contact: string | null = null;
  const contactMatches = [...text.matchAll(/contact[^\d+\n]*([+\d][\d\s\-()+]{8,})/gi)];
  if (contactMatches.length > 0) {
    contact = contactMatches[contactMatches.length - 1][1].trim();
  } else {
    const lastLine = text.trim().split('\n').pop()?.replace(/[*_~]/g, '').trim() ?? '';
    if (/^[+\d][\d\s\-()+]{9,}$/.test(lastLine)) contact = lastLine;
  }

  return listings.map((l) => {
    const label = normalizeSizeLabel(l.size_raw) ?? normalizeSizeLabel(l.raw_line);
    return {
      ...l,
      society_name_raw: society ?? cleanSocietyName(l.society_name_raw) ?? l.society_name_raw,
      contact_phone: contact ?? l.contact_phone,
      size_raw: label,
      size_marla: sizeLabelToMarla(label),
    };
  });
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const REQUEST_TIMEOUT_MS = 15_000;
const LISTING_REQUEST_TIMEOUT_MS = 90_000;

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

  // WHATSAPP LISTING INGESTION — same raw-fetch/timeout/fallback shape as
  // extractExpense above, kept as a second method on the same client rather
  // than a second client class: one Anthropic API call shape to maintain,
  // just a different system prompt/response schema. Throws only on a real
  // call failure (network/timeout/non-2xx) — an unparseable or empty
  // response falls back to {listings: []} rather than throwing, same
  // "don't treat a bad AI answer as a retryable infra failure" rule
  // extractExpense already follows.
  async extractListings(messageText: string): Promise<ListingExtractionOutcome> {
    // A daily inventory can run to hundreds of lines — far more JSON than one
    // response can hold. Split at line boundaries (preferring a section
    // heading) and re-send the opening lines (the "Society: …" line) plus the
    // heading currently in force, so every chunk keeps its society/block/size
    // context. Message-level rules are applied once, on the whole text.
    const lines = messageText.split('\n');
    const isHeading = (l: string) => /\d{1,3}\s*[x*×]\s*\d{1,3}/i.test(l) && !/^\W*[A-Za-z]{2,4}\s*\d{3,}/.test(l);
    const SOFT = 40;
    const HARD = 60;
    if (lines.length <= HARD) {
      const out = await this.extractListingsChunk(messageText);
      return { ...out, listings: applyMessageRules(messageText, out.listings) };
    }

    const preamble = lines.slice(0, 2).join('\n');
    const all: ListingExtraction[] = [];
    const raws: unknown[] = [];
    let heading = '';
    let buf: string[] = [];
    const flush = async () => {
      if (buf.length === 0) return;
      const startsWithHeading = isHeading(buf[0]);
      const chunk = [preamble, startsWithHeading ? '' : heading, ...buf].filter(Boolean).join('\n');
      const out = await this.extractListingsChunk(chunk);
      all.push(...out.listings);
      raws.push(out.raw);
      buf = [];
    };
    for (const line of lines.slice(2)) {
      if (buf.length >= HARD || (buf.length >= SOFT && isHeading(line))) await flush();
      buf.push(line);
      if (isHeading(line)) heading = line;
    }
    await flush();
    return {
      listings: applyMessageRules(messageText, all),
      raw: { chunks: raws.length, responses: raws },
    };
  }

  private async extractListingsChunk(messageText: string): Promise<ListingExtractionOutcome> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Throw (not an empty result) so the message stays LISTING_RECEIVED and
      // the failure is visible, instead of being silently marked parsed.
      throw new Error('ANTHROPIC_API_KEY not set — cannot extract listings');
    }

    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LISTING_REQUEST_TIMEOUT_MS);

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
          max_tokens: 8192,
          system: buildListingSystemPrompt(),
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

    if ((json as { stop_reason?: unknown }).stop_reason === 'max_tokens') {
      throw new Error('Listing AI response was truncated (max_tokens) — chunk too large');
    }

    let candidate: unknown;
    try {
      candidate = extractJsonObject(textBlock);
    } catch (err) {
      throw new Error(`Listing AI response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }

    const validated = ListingExtractionResponseSchema.safeParse(candidate);
    if (!validated.success) {
      throw new Error(`Listing AI extraction failed shape validation: ${validated.error.message}`);
    }

    return { listings: validated.data.listings, raw: json };
  }
}
