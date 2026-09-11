import { WhatsappAiClient } from './whatsapp-ai.client';

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
      });
      expect(result.raw).toBeDefined();
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
