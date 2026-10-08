import { WhatsappAiClient, applyMessageRules, recoverMissedExpenseLines } from './whatsapp-ai.client';

// WHATSAPP INTEGRATION Phase 2 — AI PARSING. global.fetch is mocked
// throughout — no real network call ever leaves this suite, and no
// ANTHROPIC_API_KEY is required to run it (the "key unset" path is itself
// one of the cases under test).

function anthropicResponse(textBlockContent: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text: textBlockContent }] }),
    text: async () => textBlockContent,
  };
}

describe('WhatsappAiClient', () => {
  const ORIGINAL_ENV = { ...process.env };
  let client: WhatsappAiClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new WhatsappAiClient();
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('returns a LOW-confidence fallback without calling fetch when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await client.extractExpense('Bought cement 50 bags rate 1490');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.extraction).toEqual({
      item: null,
      quantity: null,
      unit: null,
      rate: null,
      trade_category: null,
      confidence: 'LOW',
      mentioned_business_name: null,
    });
  });

  describe('with ANTHROPIC_API_KEY set', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('parses a clear expense message into structured fields', async () => {
      fetchMock.mockResolvedValue(
        anthropicResponse(
          JSON.stringify({
            item: 'cement',
            quantity: 50,
            unit: 'bags',
            rate: 1490,
            trade_category: 'GENERAL_CONTRACTOR',
            confidence: 'HIGH',
            mentioned_business_name: null,
          }),
        ),
      );

      const result = await client.extractExpense('Bought cement 50 bags rate 1490');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
        }),
      );
      expect(result.extraction).toEqual({
        item: 'cement',
        quantity: 50,
        unit: 'bags',
        rate: 1490,
        trade_category: 'GENERAL_CONTRACTOR',
        confidence: 'HIGH',
        mentioned_business_name: null,
      });
      expect(result.raw).toBeDefined();
    });

    // ─── WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION ──

    it('extracts a mentioned business name independently of item/confidence', async () => {
      fetchMock.mockResolvedValue(
        anthropicResponse(
          JSON.stringify({
            item: 'cement',
            quantity: 50,
            unit: 'bags',
            rate: 1490,
            trade_category: 'GENERAL_CONTRACTOR',
            confidence: 'HIGH',
            mentioned_business_name: 'Al-Rehman Traders',
          }),
        ),
      );

      const result = await client.extractExpense('Al-Rehman Traders delivered cement 50 bags rate 1490');

      expect(result.extraction.mentioned_business_name).toBe('Al-Rehman Traders');
    });

    it('extracts a mentioned business name even when no expense is described (LOW confidence, null item)', async () => {
      fetchMock.mockResolvedValue(
        anthropicResponse(
          JSON.stringify({
            item: null,
            quantity: null,
            unit: null,
            rate: null,
            trade_category: null,
            confidence: 'LOW',
            mentioned_business_name: 'Ali Traders',
          }),
        ),
      );

      const result = await client.extractExpense('Ali Traders came by the site today');

      expect(result.extraction.confidence).toBe('LOW');
      expect(result.extraction.mentioned_business_name).toBe('Ali Traders');
    });

    it('strips a ```json fence if the model wraps its answer in one', async () => {
      fetchMock.mockResolvedValue(
        anthropicResponse(
          '```json\n' +
            JSON.stringify({
              item: 'steel bars',
              quantity: 10,
              unit: 'pcs',
              rate: 2500,
              trade_category: 'STEEL_FIXING',
              confidence: 'MEDIUM',
              mentioned_business_name: null,
            }) +
            '\n```',
        ),
      );

      const result = await client.extractExpense('10 steel bars @2500 each');

      expect(result.extraction.item).toBe('steel bars');
      expect(result.extraction.trade_category).toBe('STEEL_FIXING');
    });

    it('falls back to LOW confidence, not an error, for a non-expense/ambiguous message', async () => {
      fetchMock.mockResolvedValue(
        anthropicResponse(
          JSON.stringify({
            item: null,
            quantity: null,
            unit: null,
            rate: null,
            trade_category: null,
            confidence: 'LOW',
            mentioned_business_name: null,
          }),
        ),
      );

      const result = await client.extractExpense('hey is the site open today');

      expect(result.extraction).toEqual({
        item: null,
        quantity: null,
        unit: null,
        rate: null,
        trade_category: null,
        confidence: 'LOW',
        mentioned_business_name: null,
      });
    });

    it('falls back to LOW confidence (not throwing) when the AI responds with unparseable non-JSON text', async () => {
      fetchMock.mockResolvedValue(anthropicResponse('sure thing, let me check on that for you!'));

      const result = await client.extractExpense('is the site open today');

      expect(result.extraction.confidence).toBe('LOW');
      expect(result.extraction.item).toBeNull();
    });

    it('falls back to LOW confidence when the AI invents a trade_category not in TRADE_CATEGORIES', async () => {
      fetchMock.mockResolvedValue(
        anthropicResponse(
          JSON.stringify({
            item: 'paint',
            quantity: 5,
            unit: 'tins',
            rate: 900,
            trade_category: 'NOT_A_REAL_CATEGORY',
            confidence: 'HIGH',
          }),
        ),
      );

      const result = await client.extractExpense('5 tins of paint @900');

      // Shape validation fails (bad enum value) -> whole extraction falls
      // back, rather than silently keeping the invented category.
      expect(result.extraction.confidence).toBe('LOW');
      expect(result.extraction.trade_category).toBeNull();
    });

    it('throws when the Anthropic API returns a non-2xx status — a retryable call failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'internal server error',
        json: async () => ({}),
      });

      await expect(client.extractExpense('cement 50 bags')).rejects.toThrow(/500/);
    });

    it('throws when fetch itself rejects (network failure/timeout) — a retryable call failure', async () => {
      fetchMock.mockRejectedValue(new Error('network unreachable'));

      await expect(client.extractExpense('cement 50 bags')).rejects.toThrow('network unreachable');
    });
  });
});

describe('expense ledger prompt', () => {
  it('prefers the Rs-marked figure as the amount', () => {
    const src = require('fs').readFileSync(__dirname + '/whatsapp-ai.client.ts', 'utf8') as string;
    expect(src).toContain('Rs. 74,500');
  });
});

describe('dealer broadcast with crore prices and no Society line', () => {
  const text = '7 Marla plots\n● C-443 — PKR 1.70 Cr\n● C-964 — PKR 90 Lac\n\n10 Marla plot\n● Q-200 — PKR 1.55 Cr\n\n📞 0333-8215834\nEndeavor Marketing Gulberg';
  const base = { block: null, status_raw: null, contact_phone: null, size_marla: null };
  const rows = applyMessageRules(text, [
    { ...base, society_name_raw: 'Gulberg Residencia Islamabad', block: 'C', plot_number: '443', size_raw: '7 Marla', price_lac: 1.7, raw_line: '● C-443 — PKR 1.70 Cr' },
    { ...base, society_name_raw: 'Gulberg Residencia', block: 'C', plot_number: '964', size_raw: '7 Marla', price_lac: 90, raw_line: '● C-964 — PKR 90 Lac' },
    { ...base, society_name_raw: 'Gulberg Residencia', block: 'Q', plot_number: '200', size_raw: '10 Marla', price_lac: 1.55, raw_line: '● Q-200 — PKR 1.55 Cr' },
  ]);
  it('converts crore to lac regardless of the model', () => {
    expect(rows.map((r) => r.price_lac)).toEqual([170, 90, 155]);
  });
  it('drops the city from the society and finds the dealer phone', () => {
    expect(rows.every((r) => r.society_name_raw === 'Gulberg Residencia')).toBe(true);
    expect(rows[0].contact_phone).toBe('0333-8215834');
  });
  it('keeps marla sizes', () => {
    expect(rows.map((r) => r.size_marla)).toEqual([7, 7, 10]);
  });
});

describe('recoverMissedExpenseLines', () => {
  const msg = 'Project Name: THE COURTYARD\n\nJabbar Labour - 100000\nCement 50 bags- 76000';
  const cement = { date: null, description: 'Cement', amount: 76000, quantity: 50, unit: 'bags', vendor: null, paid_by: null, trade_category: 'CEMENT' as const, kind: 'MATERIAL' as const, raw_line: 'Cement 50 bags- 76000' };

  it('adds back a Name - amount line the model skipped', () => {
    const out = recoverMissedExpenseLines(msg, [cement]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ description: 'Jabbar Labour', amount: 100000, trade_category: 'MASON_LABOUR', kind: 'LABOUR' });
  });

  it('adds nothing when the model returned every line', () => {
    const labour = { ...cement, description: 'Jabbar Labour', amount: 100000, raw_line: 'Jabbar Labour - 100000' };
    expect(recoverMissedExpenseLines(msg, [labour, cement])).toEqual([]);
  });
});
