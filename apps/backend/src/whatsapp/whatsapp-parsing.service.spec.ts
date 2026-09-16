import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { WhatsappParsingService, buildDraftSummaryText } from './whatsapp-parsing.service';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { WhatsappBusinessLinkService } from './whatsapp-business-link.service';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function receivedMessage(overrides: Partial<WhatsappInboundMessageEntity> = {}): WhatsappInboundMessageEntity {
  return {
    id: 'msg-uuid-0001',
    wa_message_id: 'wamid.ABC123',
    wa_id: '923001234567',
    message_type: 'text',
    message_text: 'Bought cement 50 bags rate 1490',
    wa_timestamp: new Date('2026-01-01'),
    raw_payload: {},
    project_ref: 'proj-uuid-0001',
    status: 'RECEIVED',
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

const CLEAR_EXTRACTION = {
  item: 'cement',
  quantity: 50,
  unit: 'bags',
  rate: 1490,
  trade_category: 'GENERAL_CONTRACTOR' as const,
  confidence: 'HIGH' as const,
  mentioned_business_name: null,
};

const LOW_CONFIDENCE_EXTRACTION = {
  item: null,
  quantity: null,
  unit: null,
  rate: null,
  trade_category: null,
  confidence: 'LOW' as const,
  mentioned_business_name: null,
};

describe('WhatsappParsingService', () => {
  let service: WhatsappParsingService;
  let extractExpenseMock: jest.Mock;
  let draftCreateMock: jest.Mock;
  let draftSaveMock: jest.Mock;
  let draftFindMock: jest.Mock;
  let draftFindOneByMock: jest.Mock;
  let draftUpdateMock: jest.Mock;
  let inboundUpdateMock: jest.Mock;
  let inboundFindOneByMock: jest.Mock;
  let sendTextMessageMock: jest.Mock;
  let detectAndSuggestMock: jest.Mock;

  beforeEach(async () => {
    extractExpenseMock = jest.fn();
    draftCreateMock = jest.fn((data) => data);
    draftSaveMock = jest.fn((entity) => Promise.resolve({ id: 'draft-uuid-0001', ...entity }));
    draftFindMock = jest.fn().mockResolvedValue([]);
    draftFindOneByMock = jest.fn().mockResolvedValue(null);
    draftUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });
    inboundUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });
    inboundFindOneByMock = jest.fn().mockResolvedValue(null);
    sendTextMessageMock = jest.fn().mockResolvedValue(undefined);
    detectAndSuggestMock = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        WhatsappParsingService,
        {
          provide: getRepositoryToken(WhatsappInboundMessageEntity),
          useValue: { update: inboundUpdateMock, findOneBy: inboundFindOneByMock },
        },
        {
          provide: getRepositoryToken(WhatsappDraftExpenseEntity),
          useValue: {
            create: draftCreateMock,
            save: draftSaveMock,
            find: draftFindMock,
            findOneBy: draftFindOneByMock,
            update: draftUpdateMock,
          },
        },
        {
          provide: WhatsappAiClient,
          useValue: { extractExpense: extractExpenseMock },
        },
        // WHATSAPP INTEGRATION Phase 3 — mocked here (not the real client)
        // so these tests stay focused on WhatsappParsingService's own
        // trigger logic; WhatsappOutboundClient's own send behavior is
        // covered by whatsapp-outbound.client.spec.ts.
        {
          provide: WhatsappOutboundClient,
          useValue: { sendTextMessage: sendTextMessageMock },
        },
        // WHATSAPP INTEGRATION Phase 6b — mocked here (not the real
        // service) so these tests stay focused on WhatsappParsingService's
        // own trigger logic; WhatsappBusinessLinkService's own detection/
        // matching behavior is covered by whatsapp-business-link.service.spec.ts.
        {
          provide: WhatsappBusinessLinkService,
          useValue: { detectAndSuggest: detectAndSuggestMock },
        },
      ],
    }).compile();

    service = module.get(WhatsappParsingService);
  });

  // ─── Clear expense text ────────────────────────────────────────────────────

  it('produces a draft with correctly parsed item/quantity/rate and a plausible trade category', async () => {
    extractExpenseMock.mockResolvedValue({ extraction: CLEAR_EXTRACTION, raw: { ok: true } });

    await service.parseAndStoreDraft(receivedMessage());

    expect(draftSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inbound_message_id: 'msg-uuid-0001',
        project_ref: 'proj-uuid-0001',
        parsed_item: 'cement',
        parsed_quantity: 50,
        parsed_unit: 'bags',
        parsed_rate: 1490,
        parsed_trade_category: 'GENERAL_CONTRACTOR',
        confidence: 'HIGH',
        status: 'PENDING',
      }),
    );
    expect(inboundUpdateMock).toHaveBeenCalledWith({ id: 'msg-uuid-0001' }, { status: 'PARSED' });
  });

  // ─── Ambiguous/non-expense text ────────────────────────────────────────────

  it('stores a low-confidence draft with null fields for ambiguous/non-expense text, and still marks the message PARSED', async () => {
    extractExpenseMock.mockResolvedValue({ extraction: LOW_CONFIDENCE_EXTRACTION, raw: { ok: true } });

    await expect(
      service.parseAndStoreDraft(receivedMessage({ message_text: 'hey is the site open today' })),
    ).resolves.not.toThrow();

    expect(draftSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsed_item: null,
        parsed_quantity: null,
        parsed_unit: null,
        parsed_rate: null,
        parsed_trade_category: null,
        confidence: 'LOW',
        status: 'PENDING',
      }),
    );
    expect(inboundUpdateMock).toHaveBeenCalledWith({ id: 'msg-uuid-0001' }, { status: 'PARSED' });
  });

  it('stores a low-confidence draft without calling the AI at all when message_text is null', async () => {
    await service.parseAndStoreDraft(receivedMessage({ message_text: null }));

    expect(extractExpenseMock).not.toHaveBeenCalled();
    expect(draftSaveMock).toHaveBeenCalledWith(expect.objectContaining({ confidence: 'LOW', status: 'PENDING' }));
    expect(inboundUpdateMock).toHaveBeenCalledWith({ id: 'msg-uuid-0001' }, { status: 'PARSED' });
  });

  // ─── UNMAPPED guard ─────────────────────────────────────────────────────────

  it('never parses an UNMAPPED message (no project_ref) — no draft created', async () => {
    await service.parseAndStoreDraft(receivedMessage({ status: 'UNMAPPED', project_ref: null }));

    expect(extractExpenseMock).not.toHaveBeenCalled();
    expect(draftSaveMock).not.toHaveBeenCalled();
    expect(inboundUpdateMock).not.toHaveBeenCalled();
  });

  it('does nothing for a message that is not RECEIVED even if project_ref happens to be set', async () => {
    await service.parseAndStoreDraft(receivedMessage({ status: 'PARSED' as never }));

    expect(extractExpenseMock).not.toHaveBeenCalled();
    expect(draftSaveMock).not.toHaveBeenCalled();
  });

  // ─── AI call failure — caught, never thrown, left RECEIVED for retry ──────

  it('catches an AI call failure, never throws, and leaves the message at RECEIVED (no draft, no status change)', async () => {
    extractExpenseMock.mockRejectedValue(new Error('Anthropic API returned 500: internal server error'));

    await expect(service.parseAndStoreDraft(receivedMessage())).resolves.toBeUndefined();

    expect(draftSaveMock).not.toHaveBeenCalled();
    expect(inboundUpdateMock).not.toHaveBeenCalled();
  });

  it('catches a draft-save failure, never throws, and does not advance the message to PARSED', async () => {
    extractExpenseMock.mockResolvedValue({ extraction: CLEAR_EXTRACTION, raw: {} });
    draftSaveMock.mockRejectedValue(new Error('db unavailable'));

    await expect(service.parseAndStoreDraft(receivedMessage())).resolves.toBeUndefined();

    expect(inboundUpdateMock).not.toHaveBeenCalled();
  });

  // ─── WHATSAPP INTEGRATION Phase 3 — outbound draft-summary send ──────────

  it('sends a plain-text summary of the parsed draft to the sender after a clear expense is parsed', async () => {
    extractExpenseMock.mockResolvedValue({ extraction: CLEAR_EXTRACTION, raw: { ok: true } });

    await service.parseAndStoreDraft(receivedMessage());

    expect(sendTextMessageMock).toHaveBeenCalledWith(
      '923001234567',
      'Got it: cement, 50 bags @ 1490. Reply YES to confirm, or send a correction.',
    );
  });

  it('sends a clarification request, not a fake summary, for a low-confidence/unparseable draft', async () => {
    extractExpenseMock.mockResolvedValue({ extraction: LOW_CONFIDENCE_EXTRACTION, raw: { ok: true } });

    await service.parseAndStoreDraft(receivedMessage({ message_text: 'hey is the site open today' }));

    const [, sentText] = sendTextMessageMock.mock.calls[0];
    expect(sentText).not.toMatch(/null/);
    expect(sentText).toMatch(/clarify|rephrase/i);
  });

  it('logs and does not throw when the outbound send fails — the draft is already saved by then', async () => {
    extractExpenseMock.mockResolvedValue({ extraction: CLEAR_EXTRACTION, raw: { ok: true } });
    sendTextMessageMock.mockRejectedValue(new Error('WhatsApp send failed (401): invalid token'));

    await expect(service.parseAndStoreDraft(receivedMessage())).resolves.toBeUndefined();

    // The draft/PARSED transition already happened — a send failure never
    // unwinds work that already succeeded.
    expect(draftSaveMock).toHaveBeenCalled();
    expect(inboundUpdateMock).toHaveBeenCalledWith({ id: 'msg-uuid-0001' }, { status: 'PARSED' });
  });

  it('never attempts to send when the AI call itself fails — no draft was ever produced', async () => {
    extractExpenseMock.mockRejectedValue(new Error('Anthropic API returned 500: internal server error'));

    await service.parseAndStoreDraft(receivedMessage());

    expect(sendTextMessageMock).not.toHaveBeenCalled();
  });

  // ─── WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION ──

  it('triggers detectAndSuggest with the saved draft id and the extracted mention', async () => {
    extractExpenseMock.mockResolvedValue({
      extraction: { ...CLEAR_EXTRACTION, mentioned_business_name: 'Al-Rehman Traders' },
      raw: { ok: true },
    });

    await service.parseAndStoreDraft(receivedMessage());

    expect(detectAndSuggestMock).toHaveBeenCalledWith('draft-uuid-0001', 'Al-Rehman Traders');
  });

  it('still triggers detectAndSuggest (with null) when no business is mentioned — the null-guard lives in WhatsappBusinessLinkService, not here', async () => {
    extractExpenseMock.mockResolvedValue({ extraction: CLEAR_EXTRACTION, raw: { ok: true } });

    await service.parseAndStoreDraft(receivedMessage());

    expect(detectAndSuggestMock).toHaveBeenCalledWith('draft-uuid-0001', null);
  });

  it('logs and does not throw when detectAndSuggest fails — the draft/PARSED transition already happened', async () => {
    extractExpenseMock.mockResolvedValue({
      extraction: { ...CLEAR_EXTRACTION, mentioned_business_name: 'Al-Rehman Traders' },
      raw: { ok: true },
    });
    detectAndSuggestMock.mockRejectedValue(new Error('db unavailable'));

    await expect(service.parseAndStoreDraft(receivedMessage())).resolves.toBeUndefined();

    expect(draftSaveMock).toHaveBeenCalled();
    expect(inboundUpdateMock).toHaveBeenCalledWith({ id: 'msg-uuid-0001' }, { status: 'PARSED' });
  });

  it('never calls detectAndSuggest when the AI call itself fails — no draft was ever produced', async () => {
    extractExpenseMock.mockRejectedValue(new Error('Anthropic API returned 500: internal server error'));

    await service.parseAndStoreDraft(receivedMessage());

    expect(detectAndSuggestMock).not.toHaveBeenCalled();
  });

  // ─── buildDraftSummaryText ──────────────────────────────────────────────

  describe('buildDraftSummaryText', () => {
    it('formats item + quantity + unit + rate', () => {
      expect(buildDraftSummaryText(CLEAR_EXTRACTION)).toBe(
        'Got it: cement, 50 bags @ 1490. Reply YES to confirm, or send a correction.',
      );
    });

    it('omits missing quantity/unit/rate gracefully rather than printing null', () => {
      const text = buildDraftSummaryText({
        item: 'cement',
        quantity: null,
        unit: null,
        rate: null,
        trade_category: null,
        confidence: 'MEDIUM',
        mentioned_business_name: null,
      });
      expect(text).toBe('Got it: cement. Reply YES to confirm, or send a correction.');
    });

    it('asks the sender to clarify/rephrase for a LOW-confidence extraction, never a fake summary', () => {
      expect(buildDraftSummaryText(LOW_CONFIDENCE_EXTRACTION)).not.toMatch(/null|Got it/);
    });
  });

  // ─── listDrafts (GET /v1/admin/whatsapp-drafts) ────────────────────────────

  describe('listDrafts', () => {
    it('queries only PENDING drafts, most recent first, with no project_ref filter (default, no regression from Phase 2)', async () => {
      await service.listDrafts();
      expect(draftFindMock).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        order: { created_at: 'DESC' },
      });
    });

    it('filters by project_ref when provided', async () => {
      await service.listDrafts('proj-uuid-0001');
      expect(draftFindMock).toHaveBeenCalledWith({
        where: { project_ref: 'proj-uuid-0001', status: 'PENDING' },
        order: { created_at: 'DESC' },
      });
    });

    // ─── WHATSAPP INTEGRATION Phase 4 — status filter + staleness ─────────

    it('queries CONFIRMED drafts when status=CONFIRMED is passed', async () => {
      await service.listDrafts(undefined, 'CONFIRMED');
      expect(draftFindMock).toHaveBeenCalledWith({
        where: { status: 'CONFIRMED' },
        order: { created_at: 'DESC' },
      });
    });

    it('flags a PENDING draft older than the staleness threshold as stale: true', async () => {
      const oldDraft = {
        id: 'draft-old',
        status: 'PENDING' as const,
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
      };
      draftFindMock.mockResolvedValue([oldDraft]);

      const [result] = await service.listDrafts();
      expect(result.stale).toBe(true);
    });

    it('does not flag a fresh PENDING draft as stale', async () => {
      const freshDraft = {
        id: 'draft-fresh',
        status: 'PENDING' as const,
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1h ago
      };
      draftFindMock.mockResolvedValue([freshDraft]);

      const [result] = await service.listDrafts();
      expect(result.stale).toBe(false);
    });

    it('never flags a non-PENDING draft as stale, no matter how old', async () => {
      const oldConfirmed = {
        id: 'draft-old-confirmed',
        status: 'CONFIRMED' as const,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };
      draftFindMock.mockResolvedValue([oldConfirmed]);

      const [result] = await service.listDrafts(undefined, 'CONFIRMED');
      expect(result.stale).toBe(false);
    });

    it('honors WHATSAPP_DRAFT_STALE_HOURS when configured', async () => {
      const ORIGINAL = process.env.WHATSAPP_DRAFT_STALE_HOURS;
      process.env.WHATSAPP_DRAFT_STALE_HOURS = '1';
      try {
        const twoHoursOld = {
          id: 'draft-2h',
          status: 'PENDING' as const,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        };
        draftFindMock.mockResolvedValue([twoHoursOld]);

        const [result] = await service.listDrafts();
        expect(result.stale).toBe(true);
      } finally {
        process.env.WHATSAPP_DRAFT_STALE_HOURS = ORIGINAL;
      }
    });
  });

  // ─── WHATSAPP INTEGRATION Phase 4 — voidDraft ──────────────────────────────

  describe('voidDraft', () => {
    const PENDING_DRAFT = {
      id: 'draft-uuid-0001',
      inbound_message_id: 'msg-uuid-0001',
      project_ref: 'proj-uuid-0001',
      parsed_item: 'cement',
      status: 'PENDING',
      void_reason: null,
    };

    it('sets status to VOID and stores the reason', async () => {
      draftFindOneByMock.mockResolvedValue(PENDING_DRAFT);

      const result = await service.voidDraft(PENDING_DRAFT.id, 'sender never replied');

      expect(draftUpdateMock).toHaveBeenCalledWith(
        { id: PENDING_DRAFT.id },
        { status: 'VOID', void_reason: 'sender never replied' },
      );
      expect(result.status).toBe('VOID');
      expect(result.void_reason).toBe('sender never replied');
    });

    it('accepts a null reason (optional field)', async () => {
      draftFindOneByMock.mockResolvedValue(PENDING_DRAFT);

      await service.voidDraft(PENDING_DRAFT.id, null);

      expect(draftUpdateMock).toHaveBeenCalledWith({ id: PENDING_DRAFT.id }, { status: 'VOID', void_reason: null });
    });

    it('never deletes the row — no delete/remove call exists on this path', async () => {
      draftFindOneByMock.mockResolvedValue(PENDING_DRAFT);
      await service.voidDraft(PENDING_DRAFT.id, 'reason');
      expect(draftUpdateMock).toHaveBeenCalled(); // update, not delete
    });

    it('404s on a non-existent draft', async () => {
      draftFindOneByMock.mockResolvedValue(null);
      await expect(service.voidDraft('missing-uuid', null)).rejects.toThrow(NotFoundException);
      expect(draftUpdateMock).not.toHaveBeenCalled();
    });

    it('refuses to void a draft that is not PENDING', async () => {
      draftFindOneByMock.mockResolvedValue({ ...PENDING_DRAFT, status: 'CONFIRMED' });
      await expect(service.voidDraft(PENDING_DRAFT.id, null)).rejects.toThrow(BadRequestException);
      expect(draftUpdateMock).not.toHaveBeenCalled();
    });
  });

  // ─── WHATSAPP INTEGRATION Phase 4 — resendDraftPrompt ──────────────────────

  describe('resendDraftPrompt', () => {
    const PENDING_DRAFT = {
      id: 'draft-uuid-0001',
      inbound_message_id: 'msg-uuid-0001',
      project_ref: 'proj-uuid-0001',
      parsed_item: 'cement',
      parsed_quantity: 50,
      parsed_unit: 'bags',
      parsed_rate: 1490,
      parsed_trade_category: 'GENERAL_CONTRACTOR',
      confidence: 'HIGH',
      status: 'PENDING',
      void_reason: null,
    };
    const ORIGINAL_MESSAGE = { id: 'msg-uuid-0001', wa_id: '923001234567' };

    it('calls the outbound client with the same summary text the original send used', async () => {
      draftFindOneByMock.mockResolvedValue(PENDING_DRAFT);
      inboundFindOneByMock.mockResolvedValue(ORIGINAL_MESSAGE);

      const result = await service.resendDraftPrompt(PENDING_DRAFT.id);

      expect(sendTextMessageMock).toHaveBeenCalledWith(
        '923001234567',
        'Got it: cement, 50 bags @ 1490. Reply YES to confirm, or send a correction.',
      );
      expect(result).toEqual({ sent: true });
    });

    it('404s on a non-existent draft', async () => {
      draftFindOneByMock.mockResolvedValue(null);
      await expect(service.resendDraftPrompt('missing-uuid')).rejects.toThrow(NotFoundException);
      expect(sendTextMessageMock).not.toHaveBeenCalled();
    });

    it('refuses to resend for a draft that is not PENDING', async () => {
      draftFindOneByMock.mockResolvedValue({ ...PENDING_DRAFT, status: 'VOID' });
      await expect(service.resendDraftPrompt(PENDING_DRAFT.id)).rejects.toThrow(BadRequestException);
      expect(sendTextMessageMock).not.toHaveBeenCalled();
    });

    // ─── Outbound failure — surfaced to the admin caller, not swallowed ────
    // This IS an explicit admin action waiting on a result (unlike Phase
    // 2/3's fire-and-forget background sends), so a send failure becomes a
    // real error response, not a silent 200.

    it('surfaces an outbound send failure as an error to the caller, after logging it', async () => {
      draftFindOneByMock.mockResolvedValue(PENDING_DRAFT);
      inboundFindOneByMock.mockResolvedValue(ORIGINAL_MESSAGE);
      sendTextMessageMock.mockRejectedValue(new Error('WhatsApp send failed (401): invalid token'));

      await expect(service.resendDraftPrompt(PENDING_DRAFT.id)).rejects.toThrow(BadGatewayException);
    });
  });
});
