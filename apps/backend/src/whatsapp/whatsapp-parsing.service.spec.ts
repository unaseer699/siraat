import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsappParsingService } from './whatsapp-parsing.service';
import { WhatsappAiClient } from './whatsapp-ai.client';
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
};

const LOW_CONFIDENCE_EXTRACTION = {
  item: null,
  quantity: null,
  unit: null,
  rate: null,
  trade_category: null,
  confidence: 'LOW' as const,
};

describe('WhatsappParsingService', () => {
  let service: WhatsappParsingService;
  let extractExpenseMock: jest.Mock;
  let draftCreateMock: jest.Mock;
  let draftSaveMock: jest.Mock;
  let draftFindMock: jest.Mock;
  let inboundUpdateMock: jest.Mock;

  beforeEach(async () => {
    extractExpenseMock = jest.fn();
    draftCreateMock = jest.fn((data) => data);
    draftSaveMock = jest.fn((entity) => Promise.resolve({ id: 'draft-uuid-0001', ...entity }));
    draftFindMock = jest.fn().mockResolvedValue([]);
    inboundUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });

    const module = await Test.createTestingModule({
      providers: [
        WhatsappParsingService,
        {
          provide: getRepositoryToken(WhatsappInboundMessageEntity),
          useValue: { update: inboundUpdateMock },
        },
        {
          provide: getRepositoryToken(WhatsappDraftExpenseEntity),
          useValue: { create: draftCreateMock, save: draftSaveMock, find: draftFindMock },
        },
        {
          provide: WhatsappAiClient,
          useValue: { extractExpense: extractExpenseMock },
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

  // ─── listDrafts (GET /v1/admin/whatsapp-drafts) ────────────────────────────

  describe('listDrafts', () => {
    it('queries only PENDING drafts, most recent first, with no project_ref filter', async () => {
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
  });
});
