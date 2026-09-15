import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  WhatsappConfirmationService,
  CONFIRMATION_WHITELIST,
  isConfirmationReply,
} from './whatsapp-confirmation.service';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';
import { ConstructionProjectService } from '../construction-intelligence/construction-project.service';

// WHATSAPP INTEGRATION Phase 3 — CONFIRM/CORRECT LOOP.

// ─── Fixtures ──────────────────────────────────────────────────────────────

const PROJECT_REF = 'proj-uuid-0001';

function pendingDraft(overrides: Partial<WhatsappDraftExpenseEntity> = {}): WhatsappDraftExpenseEntity {
  return {
    id: 'draft-uuid-0001',
    inbound_message_id: 'msg-uuid-original',
    project_ref: PROJECT_REF,
    parsed_item: 'cement',
    parsed_quantity: 50,
    parsed_unit: 'bags',
    parsed_rate: 1490,
    parsed_trade_category: 'GENERAL_CONTRACTOR',
    confidence: 'HIGH',
    raw_ai_response: { ok: true },
    status: 'PENDING',
    void_reason: null,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function replyMessage(overrides: Partial<WhatsappInboundMessageEntity> = {}): WhatsappInboundMessageEntity {
  return {
    id: 'msg-uuid-reply',
    wa_message_id: 'wamid.REPLY001',
    wa_id: '923001234567',
    message_type: 'text',
    message_text: 'yes',
    wa_timestamp: new Date('2026-01-02'),
    raw_payload: {},
    project_ref: PROJECT_REF,
    status: 'RECEIVED',
    created_at: new Date('2026-01-02'),
    ...overrides,
  };
}

const PROJECT_WITH_SECTIONS = {
  id: PROJECT_REF,
  name: 'Test Project',
  property_ref: null,
  owner_contact: 'owner',
  start_date: '2026-01-01',
  status: 'ACTIVE' as const,
  record_type: 'FACT' as const,
  sections: [{ id: 'section-uuid-0001', project_ref: PROJECT_REF, category: 'GENERAL_CONTRACTOR', display_order: 0, record_type: 'FACT' as const, expenses: [], subtotal: 0 }],
  total: 0,
};

describe('WhatsappConfirmationService', () => {
  let service: WhatsappConfirmationService;

  let draftFindOneMock: jest.Mock;
  let draftUpdateMock: jest.Mock;
  let inboundFindOneByMock: jest.Mock;
  let extractExpenseMock: jest.Mock;
  let sendTextMessageMock: jest.Mock;
  let getProjectMock: jest.Mock;
  let createSectionMock: jest.Mock;
  let createExpenseMock: jest.Mock;

  beforeEach(async () => {
    draftFindOneMock = jest.fn().mockResolvedValue(null);
    draftUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });
    inboundFindOneByMock = jest.fn().mockResolvedValue(null);
    extractExpenseMock = jest.fn();
    sendTextMessageMock = jest.fn().mockResolvedValue(undefined);
    getProjectMock = jest.fn().mockResolvedValue(PROJECT_WITH_SECTIONS);
    createSectionMock = jest.fn();
    createExpenseMock = jest.fn().mockResolvedValue({
      id: 'expense-uuid-0001',
      section_ref: 'section-uuid-0001',
      expense_date: '2026-01-01',
      description: 'cement',
      vendor_name: 'WhatsApp submission (vendor not captured)',
      vendor_contact: null,
      linked_contractor_id: null,
      linked_supplier_id: null,
      amount: 74500,
      quantity: 50,
      unit: 'BAG',
      rate: 1490,
      record_type: 'FACT',
      status: 'ACTIVE',
      supersedes_id: null,
      void_reason: null,
    });

    const module = await Test.createTestingModule({
      providers: [
        WhatsappConfirmationService,
        {
          provide: getRepositoryToken(WhatsappDraftExpenseEntity),
          useValue: { findOne: draftFindOneMock, update: draftUpdateMock },
        },
        {
          provide: getRepositoryToken(WhatsappInboundMessageEntity),
          useValue: { findOneBy: inboundFindOneByMock },
        },
        { provide: WhatsappAiClient, useValue: { extractExpense: extractExpenseMock } },
        { provide: WhatsappOutboundClient, useValue: { sendTextMessage: sendTextMessageMock } },
        {
          provide: ConstructionProjectService,
          useValue: {
            getProjectWithSectionsAndExpenses: getProjectMock,
            createSection: createSectionMock,
            createExpense: createExpenseMock,
          },
        },
      ],
    }).compile();

    service = module.get(WhatsappConfirmationService);
  });

  // ─── Confirmation whitelist ─────────────────────────────────────────────
  // FOR FOUNDER REVIEW — see CONFIRMATION_WHITELIST: yes, y, confirm,
  // confirmed, correct, ok, okay.

  describe('isConfirmationReply', () => {
    it.each(CONFIRMATION_WHITELIST)('recognizes "%s" as a confirmation (case-insensitive)', (word) => {
      expect(isConfirmationReply(word)).toBe(true);
      expect(isConfirmationReply(word.toUpperCase())).toBe(true);
    });

    it('does not use the AI parser to interpret confirmation intent — "yeah I guess" is not whitelisted, so it falls through to correction', () => {
      expect(isConfirmationReply('yeah I guess')).toBe(false);
    });

    it('rejects a message that merely contains a whitelisted word without being exactly it', () => {
      expect(isConfirmationReply('yes but check the price again')).toBe(false);
    });

    it('rejects null/empty text', () => {
      expect(isConfirmationReply(null)).toBe(false);
      expect(isConfirmationReply('')).toBe(false);
    });

    it('tolerates trailing punctuation on an otherwise exact match', () => {
      expect(isConfirmationReply('Yes!')).toBe(true);
      expect(isConfirmationReply('confirm.')).toBe(true);
    });
  });

  // ─── findMatchingPendingDraft ───────────────────────────────────────────

  describe('findMatchingPendingDraft', () => {
    it('matches via WhatsApp native reply-threading (context.id -> original message -> its PENDING draft)', async () => {
      const draft = pendingDraft();
      inboundFindOneByMock.mockResolvedValue({ id: 'msg-uuid-original' });
      draftFindOneMock.mockResolvedValue(draft);

      const result = await service.findMatchingPendingDraft(replyMessage(), 'wamid.HASHABC123');

      expect(inboundFindOneByMock).toHaveBeenCalledWith({ wa_message_id: 'wamid.HASHABC123' });
      expect(draftFindOneMock).toHaveBeenCalledWith({
        where: { inbound_message_id: 'msg-uuid-original', status: 'PENDING' },
        order: { created_at: 'DESC' },
      });
      expect(result).toBe(draft);
    });

    it('falls back to the sender\'s most recent PENDING draft for their project when there is no context.id', async () => {
      const draft = pendingDraft();
      draftFindOneMock.mockResolvedValue(draft);

      const result = await service.findMatchingPendingDraft(replyMessage(), null);

      expect(inboundFindOneByMock).not.toHaveBeenCalled();
      expect(draftFindOneMock).toHaveBeenCalledWith({
        where: { project_ref: PROJECT_REF, status: 'PENDING' },
        order: { created_at: 'DESC' },
      });
      expect(result).toBe(draft);
    });

    it('returns null gracefully when there is no PENDING draft to match against — no crash', async () => {
      draftFindOneMock.mockResolvedValue(null);

      const result = await service.findMatchingPendingDraft(replyMessage(), null);

      expect(result).toBeNull();
    });

    it('returns null when the message has no mapped project and no context.id match', async () => {
      const result = await service.findMatchingPendingDraft(replyMessage({ project_ref: null }), null);
      expect(result).toBeNull();
      expect(draftFindOneMock).not.toHaveBeenCalled();
    });
  });

  // ─── handleReply — confirmation ─────────────────────────────────────────

  describe('handleReply — confirmation', () => {
    it('creates a real Expense linked to the project/section, moves the draft to CONFIRMED, and sends a confirmation reply', async () => {
      const draft = pendingDraft();

      await service.handleReply(draft, replyMessage({ message_text: 'yes' }));

      expect(getProjectMock).toHaveBeenCalledWith(PROJECT_REF);
      expect(createSectionMock).not.toHaveBeenCalled(); // matching section already exists
      expect(createExpenseMock).toHaveBeenCalledWith(
        'section-uuid-0001',
        expect.objectContaining({
          description: 'cement',
          quantity: 50,
          unit: 'BAG',
          rate: 1490,
          // WHATSAPP INTEGRATION Phase 5 — DASHBOARD WIRING: the one call
          // site that tags an Expense as WhatsApp-sourced.
          source: 'WHATSAPP',
        }),
      );
      expect(draftUpdateMock).toHaveBeenCalledWith({ id: draft.id }, { status: 'CONFIRMED' });
      expect(sendTextMessageMock).toHaveBeenCalledWith('923001234567', expect.stringContaining('Recorded'));
    });

    it('accepts "confirm" and "correct" as confirmations too', async () => {
      await service.handleReply(pendingDraft(), replyMessage({ message_text: 'confirm' }));
      expect(draftUpdateMock).toHaveBeenCalledWith(expect.anything(), { status: 'CONFIRMED' });

      draftUpdateMock.mockClear();
      await service.handleReply(pendingDraft(), replyMessage({ message_text: 'CORRECT' }));
      expect(draftUpdateMock).toHaveBeenCalledWith(expect.anything(), { status: 'CONFIRMED' });
    });

    it('creates a new section when the project has none for the draft\'s trade category', async () => {
      getProjectMock.mockResolvedValue({ ...PROJECT_WITH_SECTIONS, sections: [] });
      createSectionMock.mockResolvedValue({ id: 'section-uuid-new', project_ref: PROJECT_REF, category: 'GENERAL_CONTRACTOR', display_order: 0, record_type: 'FACT' });

      await service.handleReply(pendingDraft(), replyMessage({ message_text: 'yes' }));

      expect(createSectionMock).toHaveBeenCalledWith(PROJECT_REF, { category: 'GENERAL_CONTRACTOR', display_order: 0 });
      expect(createExpenseMock).toHaveBeenCalledWith('section-uuid-new', expect.anything());
    });

    it('defaults to MISCELLANEOUS when the draft has no trade category', async () => {
      getProjectMock.mockResolvedValue({ ...PROJECT_WITH_SECTIONS, sections: [] });
      createSectionMock.mockResolvedValue({ id: 'section-uuid-misc', project_ref: PROJECT_REF, category: 'MISCELLANEOUS', display_order: 0, record_type: 'FACT' });

      await service.handleReply(pendingDraft({ parsed_trade_category: null }), replyMessage({ message_text: 'yes' }));

      expect(createSectionMock).toHaveBeenCalledWith(PROJECT_REF, { category: 'MISCELLANEOUS', display_order: 0 });
    });

    it('does not confirm and asks for detail instead when the draft is missing quantity/rate — never fabricates data', async () => {
      const draft = pendingDraft({ parsed_quantity: null });

      await service.handleReply(draft, replyMessage({ message_text: 'yes' }));

      expect(createExpenseMock).not.toHaveBeenCalled();
      expect(draftUpdateMock).not.toHaveBeenCalled();
      expect(sendTextMessageMock).toHaveBeenCalledWith('923001234567', expect.stringContaining("don't have enough detail"));
    });

    // ─── Outbound send failure — must not block or fail the flow ──────────

    it('still creates the Expense and CONFIRMS the draft even when the outbound confirmation reply fails to send', async () => {
      sendTextMessageMock.mockRejectedValue(new Error('WhatsApp send failed (401): invalid token'));
      const draft = pendingDraft();

      await expect(service.handleReply(draft, replyMessage({ message_text: 'yes' }))).resolves.toBeUndefined();

      expect(createExpenseMock).toHaveBeenCalled();
      expect(draftUpdateMock).toHaveBeenCalledWith({ id: draft.id }, { status: 'CONFIRMED' });
    });
  });

  // ─── handleReply — correction (ambiguous / non-whitelisted reply) ───────

  describe('handleReply — correction', () => {
    it('re-parses an ambiguous reply as a correction, updates the SAME draft, sends an updated summary, and leaves it PENDING', async () => {
      const draft = pendingDraft();
      extractExpenseMock.mockResolvedValue({
        extraction: {
          item: 'cement',
          quantity: 60,
          unit: 'bags',
          rate: 1490,
          trade_category: 'GENERAL_CONTRACTOR',
          confidence: 'HIGH',
        },
        raw: { ok: true },
      });

      await service.handleReply(draft, replyMessage({ message_text: 'actually it was 60 bags' }));

      expect(extractExpenseMock).toHaveBeenCalledWith('actually it was 60 bags');
      expect(createExpenseMock).not.toHaveBeenCalled();
      // Same draft id updated — never a second draft for the same thread.
      expect(draftUpdateMock).toHaveBeenCalledWith(
        { id: draft.id },
        expect.objectContaining({ parsed_quantity: 60, status: 'PENDING' }),
      );
      expect(sendTextMessageMock).toHaveBeenCalledWith(
        '923001234567',
        expect.stringContaining('Reply YES to confirm'),
      );
    });

    it('"yeah I guess" (near-yes, not whitelisted) falls through to the correction path rather than confirming', async () => {
      const draft = pendingDraft();
      extractExpenseMock.mockResolvedValue({
        extraction: {
          item: null,
          quantity: null,
          unit: null,
          rate: null,
          trade_category: null,
          confidence: 'LOW',
        },
        raw: { ok: true },
      });

      await service.handleReply(draft, replyMessage({ message_text: 'yeah I guess' }));

      expect(createExpenseMock).not.toHaveBeenCalled();
      expect(extractExpenseMock).toHaveBeenCalledWith('yeah I guess');
      expect(draftUpdateMock).toHaveBeenCalledWith({ id: draft.id }, expect.objectContaining({ status: 'PENDING' }));
    });

    it('logs and does not throw when the re-parse AI call fails — the draft is left unchanged', async () => {
      extractExpenseMock.mockRejectedValue(new Error('Anthropic API returned 500'));

      await expect(
        service.handleReply(pendingDraft(), replyMessage({ message_text: 'actually 60 bags' })),
      ).resolves.toBeUndefined();

      expect(draftUpdateMock).not.toHaveBeenCalled();
    });

    it('logs and does not throw when the outbound updated-summary reply fails to send', async () => {
      sendTextMessageMock.mockRejectedValue(new Error('network unreachable'));
      extractExpenseMock.mockResolvedValue({
        extraction: {
          item: 'cement',
          quantity: 60,
          unit: 'bags',
          rate: 1490,
          trade_category: 'GENERAL_CONTRACTOR',
          confidence: 'HIGH',
        },
        raw: {},
      });
      const draft = pendingDraft();

      await expect(
        service.handleReply(draft, replyMessage({ message_text: 'actually 60 bags' })),
      ).resolves.toBeUndefined();

      // The correction itself still landed even though the reply couldn't be sent.
      expect(draftUpdateMock).toHaveBeenCalledWith({ id: draft.id }, expect.objectContaining({ parsed_quantity: 60 }));
    });
  });
});
