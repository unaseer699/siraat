import { WhatsappOutboundClient } from './whatsapp-outbound.client';

// WHATSAPP INTEGRATION Phase 3 — CONFIRM/CORRECT LOOP. global.fetch is
// mocked throughout — no real network call ever leaves this suite, matching
// whatsapp-ai.client.spec.ts's convention.

describe('WhatsappOutboundClient', () => {
  const ORIGINAL_ENV = { ...process.env };
  let client: WhatsappOutboundClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new WhatsappOutboundClient();
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-number-id';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('POSTs a text message to the Graph API messages endpoint with the configured credentials', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });

    await client.sendTextMessage('923001234567', 'Got it: cement, 50 bags @ 1490. Reply YES to confirm.');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/test-phone-number-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer test-access-token' }),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '923001234567',
          type: 'text',
          text: { body: 'Got it: cement, 50 bags @ 1490. Reply YES to confirm.' },
        }),
      }),
    );
  });

  it('throws when WHATSAPP_ACCESS_TOKEN is unset', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(client.sendTextMessage('923001234567', 'hi')).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when WHATSAPP_PHONE_NUMBER_ID is unset', async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    await expect(client.sendTextMessage('923001234567', 'hi')).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the Graph API returns a non-2xx status — a retryable send failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid OAuth access token',
    });

    await expect(client.sendTextMessage('923001234567', 'hi')).rejects.toThrow(/401/);
  });

  it('throws when fetch itself rejects (network failure/timeout)', async () => {
    fetchMock.mockRejectedValue(new Error('network unreachable'));

    await expect(client.sendTextMessage('923001234567', 'hi')).rejects.toThrow('network unreachable');
  });
});
