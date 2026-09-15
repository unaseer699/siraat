import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  WhatsappService,
  extractInboundMessages,
  maskPhone,
} from './whatsapp.service';
import { WhatsappParsingService } from './whatsapp-parsing.service';
import { WhatsappConfirmationService } from './whatsapp-confirmation.service';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const VERIFY_TOKEN = 'test-verify-token-abc123';
const APP_SECRET = 'test-app-secret-xyz789';

const MAPPING: WhatsappProjectMappingEntity = {
  id: 'map-0000-0000-0000-000000000001',
  wa_id: '923001234567',
  project_ref: 'proj-0000-0000-0000-00000000000a',
  created_by: 'founder@siraat.pk',
  created_at: new Date('2026-01-01'),
};

function metaPayload(overrides: { messages?: unknown[] } = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001111', phone_number_id: 'pnid' },
              contacts: [{ profile: { name: 'Ali' }, wa_id: '923001234567' }],
              messages:
                overrides.messages ??
                [
                  {
                    from: '923001234567',
                    id: 'wamid.HASHABC123',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Cement 10 bags 85000' },
                  },
                ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

function signBody(body: unknown, secret = APP_SECRET): { raw: Buffer; signature: string } {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  return { raw, signature };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('WhatsappService', () => {
  let service: WhatsappService;

  let inboundFindOneByMock: jest.Mock;
  let inboundCreateMock: jest.Mock;
  let inboundSaveMock: jest.Mock;
  let inboundFindMock: jest.Mock;
  let inboundUpdateMock: jest.Mock;

  let mappingFindOneByMock: jest.Mock;
  let mappingCreateMock: jest.Mock;
  let mappingSaveMock: jest.Mock;
  let mappingFindMock: jest.Mock;
  let mappingDeleteMock: jest.Mock;

  let parseAndStoreDraftMock: jest.Mock;
  let findMatchingPendingDraftMock: jest.Mock;
  let handleReplyMock: jest.Mock;

  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;

    inboundFindOneByMock = jest.fn().mockResolvedValue(null);
    inboundCreateMock = jest.fn((data) => data);
    inboundSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'msg-new-uuid', ...entity }),
    );
    inboundFindMock = jest.fn().mockResolvedValue([]);
    inboundUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });

    mappingFindOneByMock = jest.fn().mockResolvedValue(null);
    mappingCreateMock = jest.fn((data) => data);
    mappingSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'map-new-uuid', created_at: new Date(), ...entity }),
    );
    mappingFindMock = jest.fn().mockResolvedValue([]);
    mappingDeleteMock = jest.fn().mockResolvedValue({ affected: 1 });

    parseAndStoreDraftMock = jest.fn().mockResolvedValue(undefined);
    // WHATSAPP INTEGRATION Phase 3 — default: no matching PENDING draft, so
    // existing Phase 2 tests (which never set this up) keep exercising the
    // "fresh parse" branch exactly as before.
    findMatchingPendingDraftMock = jest.fn().mockResolvedValue(null);
    handleReplyMock = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: getRepositoryToken(WhatsappInboundMessageEntity),
          useValue: {
            findOneBy: inboundFindOneByMock,
            create: inboundCreateMock,
            save: inboundSaveMock,
            find: inboundFindMock,
            update: inboundUpdateMock,
          },
        },
        {
          provide: getRepositoryToken(WhatsappProjectMappingEntity),
          useValue: {
            findOneBy: mappingFindOneByMock,
            create: mappingCreateMock,
            save: mappingSaveMock,
            find: mappingFindMock,
            delete: mappingDeleteMock,
          },
        },
        // WHATSAPP INTEGRATION Phase 2 — mocked here (not the real service)
        // so these tests stay focused on WhatsappService's own trigger logic
        // (does it call parseAndStoreDraft, with what, when); the parsing
        // logic itself is covered by whatsapp-parsing.service.spec.ts.
        {
          provide: WhatsappParsingService,
          useValue: { parseAndStoreDraft: parseAndStoreDraftMock },
        },
        // WHATSAPP INTEGRATION Phase 3 — same reasoning: mocked here so
        // these tests stay focused on WhatsappService's routing logic (does
        // it check for a matching draft, and dispatch to the right place);
        // the confirm/correct logic itself is covered by
        // whatsapp-confirmation.service.spec.ts.
        {
          provide: WhatsappConfirmationService,
          useValue: { findMatchingPendingDraft: findMatchingPendingDraftMock, handleReply: handleReplyMock },
        },
      ],
    }).compile();

    service = module.get(WhatsappService);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  // ─── [SECURITY] verifyToken — constant-time, GET handshake ────────────────

  describe('verifyToken', () => {
    it('returns true for the exact matching token', () => {
      expect(service.verifyToken(VERIFY_TOKEN)).toBe(true);
    });

    it('returns false for a wrong token', () => {
      expect(service.verifyToken('wrong-token')).toBe(false);
    });

    it('returns false for a missing token', () => {
      expect(service.verifyToken(undefined)).toBe(false);
    });

    it('returns false when WHATSAPP_VERIFY_TOKEN is unset', () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
      expect(service.verifyToken(VERIFY_TOKEN)).toBe(false);
    });
  });

  // ─── [SECURITY] verifySignature — HMAC-SHA256 over the raw body ──────────

  describe('verifySignature', () => {
    it('returns true for a correctly computed signature over the raw body', () => {
      const { raw, signature } = signBody({ hello: 'world' });
      expect(service.verifySignature(raw, signature)).toBe(true);
    });

    it('returns false for a signature computed with the wrong secret', () => {
      const { raw, signature } = signBody({ hello: 'world' }, 'a-different-secret');
      expect(service.verifySignature(raw, signature)).toBe(false);
    });

    it('returns false when the header is missing', () => {
      const { raw } = signBody({ hello: 'world' });
      expect(service.verifySignature(raw, undefined)).toBe(false);
    });

    it('returns false when the raw body is missing (e.g. JSON body used instead of raw bytes)', () => {
      const { signature } = signBody({ hello: 'world' });
      expect(service.verifySignature(undefined, signature)).toBe(false);
    });

    it('returns false when the raw body was tampered with after signing', () => {
      const { signature } = signBody({ hello: 'world' });
      const tamperedRaw = Buffer.from(JSON.stringify({ hello: 'tampered' }), 'utf8');
      expect(service.verifySignature(tamperedRaw, signature)).toBe(false);
    });

    it('returns false when WHATSAPP_APP_SECRET is unset', () => {
      delete process.env.WHATSAPP_APP_SECRET;
      const { raw, signature } = signBody({ hello: 'world' });
      expect(service.verifySignature(raw, signature)).toBe(false);
    });
  });

  // ─── extractInboundMessages — Meta payload parsing ─────────────────────────

  describe('extractInboundMessages', () => {
    it('parses sender wa_id, message text, message id, and timestamp from a text message', () => {
      const [msg] = extractInboundMessages(metaPayload());
      expect(msg).toEqual({
        id: 'wamid.HASHABC123',
        from: '923001234567',
        type: 'text',
        text: 'Cement 10 bags 85000',
        timestamp: new Date(1700000000 * 1000),
        rawPayload: expect.objectContaining({ id: 'wamid.HASHABC123' }),
        contextId: null,
      });
    });

    // ─── WHATSAPP INTEGRATION Phase 3 — native reply-threading ─────────────

    it('extracts context.id when the sender used WhatsApp\'s native reply feature', () => {
      const payload = metaPayload({
        messages: [
          {
            from: '923001234567',
            id: 'wamid.REPLY001',
            timestamp: '1700000100',
            type: 'text',
            text: { body: 'yes' },
            context: { from: '15550001111', id: 'wamid.HASHABC123' },
          },
        ],
      });
      const [msg] = extractInboundMessages(payload);
      expect(msg.contextId).toBe('wamid.HASHABC123');
    });

    it('leaves contextId null when there is no context object (not a native reply)', () => {
      const [msg] = extractInboundMessages(metaPayload());
      expect(msg.contextId).toBeNull();
    });

    it('returns an empty array for a `statuses` change (delivery/read receipt, no messages key)', () => {
      const statusPayload = {
        entry: [
          {
            changes: [
              { value: { statuses: [{ id: 'wamid.X', status: 'delivered' }] }, field: 'messages' },
            ],
          },
        ],
      };
      expect(extractInboundMessages(statusPayload)).toEqual([]);
    });

    it('returns an empty array for a malformed/empty payload rather than throwing', () => {
      expect(extractInboundMessages(null)).toEqual([]);
      expect(extractInboundMessages({})).toEqual([]);
      expect(extractInboundMessages({ entry: 'not-an-array' })).toEqual([]);
    });

    it('skips one malformed message entry without dropping the rest of the batch', () => {
      const payload = metaPayload({
        messages: [
          { from: '923001234567', id: 'wamid.GOOD', timestamp: '1700000000', type: 'text', text: { body: 'ok' } },
          { from: '923001234567' /* missing id/timestamp/type */ },
        ],
      });
      const messages = extractInboundMessages(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('wamid.GOOD');
    });

    it('leaves text null for a non-text message type', () => {
      const payload = metaPayload({
        messages: [
          { from: '923001234567', id: 'wamid.IMG', timestamp: '1700000000', type: 'image' },
        ],
      });
      const [msg] = extractInboundMessages(payload);
      expect(msg.type).toBe('image');
      expect(msg.text).toBeNull();
    });
  });

  // ─── maskPhone ────────────────────────────────────────────────────────────

  describe('maskPhone', () => {
    it('shows only the last 4 digits', () => {
      expect(maskPhone('923001234567')).toBe('********4567');
    });

    it('masks entirely when 4 digits or fewer', () => {
      expect(maskPhone('123')).toBe('***');
    });
  });

  // ─── processInboundMessage ──────────────────────────────────────────────

  describe('processInboundMessage', () => {
    const [MSG] = extractInboundMessages(metaPayload());

    it('stores the message with status RECEIVED and the mapped project_ref for a mapped number', async () => {
      mappingFindOneByMock.mockResolvedValue(MAPPING);

      const result = await service.processInboundMessage(MSG);

      expect(result.stored).toBe(true);
      expect(inboundSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RECEIVED', project_ref: MAPPING.project_ref }),
      );
    });

    it('stores the message with status UNMAPPED and project_ref null for an unmapped number — never dropped', async () => {
      mappingFindOneByMock.mockResolvedValue(null);

      const result = await service.processInboundMessage(MSG);

      expect(result.stored).toBe(true);
      expect(inboundSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'UNMAPPED', project_ref: null }),
      );
    });

    it('is idempotent: a message id already stored is a no-op, no new save', async () => {
      inboundFindOneByMock.mockResolvedValue({ id: 'existing-row', wa_message_id: MSG.id });

      const result = await service.processInboundMessage(MSG);

      expect(result.stored).toBe(false);
      expect(result.duplicate).toBe(true);
      expect(inboundSaveMock).not.toHaveBeenCalled();
    });

    it('treats a unique-violation race on save (concurrent duplicate delivery) as a no-op, not an error', async () => {
      inboundSaveMock.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

      const result = await service.processInboundMessage(MSG);

      expect(result.stored).toBe(false);
      expect(result.duplicate).toBe(true);
    });

    it('rethrows a non-idempotency database error', async () => {
      inboundSaveMock.mockRejectedValueOnce(new Error('db unavailable'));

      await expect(service.processInboundMessage(MSG)).rejects.toThrow('db unavailable');
    });

    // ─── WHATSAPP INTEGRATION Phase 2 — AI parsing trigger ───────────────────

    it('triggers fire-and-forget parsing for a mapped (RECEIVED) message', async () => {
      mappingFindOneByMock.mockResolvedValue(MAPPING);

      const result = await service.processInboundMessage(MSG);

      expect(parseAndStoreDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RECEIVED', project_ref: MAPPING.project_ref }),
      );
      // Fire-and-forget: processInboundMessage resolves without waiting on
      // the parsing call's own promise.
      expect(result.stored).toBe(true);
    });

    it('never triggers parsing for an UNMAPPED message — nothing to parse against', async () => {
      mappingFindOneByMock.mockResolvedValue(null);

      await service.processInboundMessage(MSG);

      expect(parseAndStoreDraftMock).not.toHaveBeenCalled();
    });

    it('does not trigger parsing on a duplicate (idempotent no-op)', async () => {
      inboundFindOneByMock.mockResolvedValue({ id: 'existing-row', wa_message_id: MSG.id });

      await service.processInboundMessage(MSG);

      expect(parseAndStoreDraftMock).not.toHaveBeenCalled();
    });

    // ─── WHATSAPP INTEGRATION Phase 3 — confirm/correct routing ────────────

    const PENDING_DRAFT: WhatsappDraftExpenseEntity = {
      id: 'draft-uuid-0001',
      inbound_message_id: 'some-earlier-msg-uuid',
      project_ref: MAPPING.project_ref,
      parsed_item: 'cement',
      parsed_quantity: 50,
      parsed_unit: 'bags',
      parsed_rate: 1490,
      parsed_trade_category: 'GENERAL_CONTRACTOR',
      confidence: 'HIGH',
      raw_ai_response: {},
      status: 'PENDING',
      void_reason: null,
      created_at: new Date('2026-01-01'),
    };

    it('routes to confirmationSvc.handleReply (not fresh parsing) when a matching PENDING draft exists', async () => {
      mappingFindOneByMock.mockResolvedValue(MAPPING);
      findMatchingPendingDraftMock.mockResolvedValue(PENDING_DRAFT);

      const result = await service.processInboundMessage(MSG);

      expect(findMatchingPendingDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RECEIVED' }),
        MSG.contextId,
      );
      expect(handleReplyMock).toHaveBeenCalledWith(
        PENDING_DRAFT,
        expect.objectContaining({ status: 'RECEIVED' }),
      );
      expect(parseAndStoreDraftMock).not.toHaveBeenCalled();
      expect(result.stored).toBe(true);
    });

    it('falls back to fresh parsing when no matching PENDING draft is found', async () => {
      mappingFindOneByMock.mockResolvedValue(MAPPING);
      findMatchingPendingDraftMock.mockResolvedValue(null);

      await service.processInboundMessage(MSG);

      expect(parseAndStoreDraftMock).toHaveBeenCalled();
      expect(handleReplyMock).not.toHaveBeenCalled();
    });

    it('never checks for a matching draft for an UNMAPPED message', async () => {
      mappingFindOneByMock.mockResolvedValue(null);

      await service.processInboundMessage(MSG);

      expect(findMatchingPendingDraftMock).not.toHaveBeenCalled();
    });
  });

  // ─── Admin mapping CRUD ───────────────────────────────────────────────────

  describe('createMapping', () => {
    it('creates a mapping for a new wa_id', async () => {
      const result = await service.createMapping({
        wa_id: '923001234567',
        project_ref: 'proj-uuid',
        created_by: 'founder@siraat.pk',
      });

      expect(result.wa_id).toBe('923001234567');
      expect(mappingSaveMock).toHaveBeenCalled();
    });

    it('throws ConflictException when the wa_id already has a mapping', async () => {
      mappingFindOneByMock.mockResolvedValue(MAPPING);

      await expect(
        service.createMapping({ wa_id: MAPPING.wa_id, project_ref: 'other-proj', created_by: 'x' }),
      ).rejects.toThrow(ConflictException);
      expect(mappingSaveMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException on a unique-violation race at save time', async () => {
      mappingSaveMock.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

      await expect(
        service.createMapping({ wa_id: '923009999999', project_ref: 'proj-uuid', created_by: 'x' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listMappings', () => {
    it('returns whatever the repository returns', async () => {
      mappingFindMock.mockResolvedValue([MAPPING]);
      await expect(service.listMappings()).resolves.toEqual([MAPPING]);
    });
  });

  describe('deleteMapping', () => {
    it('deletes an existing mapping', async () => {
      await service.deleteMapping(MAPPING.id);
      expect(mappingDeleteMock).toHaveBeenCalledWith({ id: MAPPING.id });
    });

    it('throws NotFoundException when the mapping does not exist', async () => {
      mappingDeleteMock.mockResolvedValue({ affected: 0 });
      await expect(service.deleteMapping('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE ─────────────────────

  describe('listUnmappedMessages', () => {
    it('queries only UNMAPPED messages, most recent first', async () => {
      await service.listUnmappedMessages();
      expect(inboundFindMock).toHaveBeenCalledWith({
        where: { status: 'UNMAPPED' },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findMappingById', () => {
    it('returns whatever the repository finds', async () => {
      mappingFindOneByMock.mockResolvedValue(MAPPING);
      await expect(service.findMappingById(MAPPING.id)).resolves.toEqual(MAPPING);
      expect(mappingFindOneByMock).toHaveBeenCalledWith({ id: MAPPING.id });
    });

    it('returns null when no mapping exists for that id', async () => {
      mappingFindOneByMock.mockResolvedValue(null);
      await expect(service.findMappingById('missing-uuid')).resolves.toBeNull();
    });
  });

  describe('reprocessUnmappedMessages', () => {
    const OTHER_SENDER_MSG = {
      id: 'msg-other-sender',
      wa_message_id: 'wamid.OTHER',
      wa_id: '923005555555',
      status: 'UNMAPPED',
      project_ref: null,
    };

    it('flips only this sender\'s still-UNMAPPED messages to RECEIVED with the new project_ref, and routes each through the same mapped-message logic', async () => {
      const unmappedForSender = [
        { id: 'msg-unmapped-1', wa_id: MAPPING.wa_id, status: 'UNMAPPED', project_ref: null },
        { id: 'msg-unmapped-2', wa_id: MAPPING.wa_id, status: 'UNMAPPED', project_ref: null },
      ];
      inboundFindMock.mockResolvedValue(unmappedForSender);

      const result = await service.reprocessUnmappedMessages(MAPPING.wa_id, MAPPING.project_ref);

      // Scoped to exactly this sender's UNMAPPED rows — not a blanket query.
      expect(inboundFindMock).toHaveBeenCalledWith({ where: { wa_id: MAPPING.wa_id, status: 'UNMAPPED' } });

      expect(inboundUpdateMock).toHaveBeenCalledWith(
        { id: 'msg-unmapped-1' },
        { status: 'RECEIVED', project_ref: MAPPING.project_ref },
      );
      expect(inboundUpdateMock).toHaveBeenCalledWith(
        { id: 'msg-unmapped-2' },
        { status: 'RECEIVED', project_ref: MAPPING.project_ref },
      );
      expect(inboundUpdateMock).toHaveBeenCalledTimes(2);

      // Routed through the exact same logic a freshly-arrived RECEIVED
      // message goes through (Phase 3's matched-draft-or-fresh-parse
      // branching) — here, no matching draft, so it falls to fresh parsing.
      expect(parseAndStoreDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'msg-unmapped-1', status: 'RECEIVED', project_ref: MAPPING.project_ref }),
      );
      expect(parseAndStoreDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'msg-unmapped-2', status: 'RECEIVED', project_ref: MAPPING.project_ref }),
      );

      expect(result).toEqual({ reprocessed: 2 });
    });

    it('never touches another sender\'s messages — the query is scoped by wa_id', async () => {
      inboundFindMock.mockResolvedValue([]); // this wa_id has none

      await service.reprocessUnmappedMessages(MAPPING.wa_id, MAPPING.project_ref);

      expect(inboundFindMock).toHaveBeenCalledWith({ where: { wa_id: MAPPING.wa_id, status: 'UNMAPPED' } });
      expect(inboundUpdateMock).not.toHaveBeenCalled();
      // Sanity: OTHER_SENDER_MSG is never referenced by this call at all —
      // the query itself, not a post-hoc filter, is what scopes this.
      expect(OTHER_SENDER_MSG.wa_id).not.toBe(MAPPING.wa_id);
    });

    it('never re-touches an already-RECEIVED/PARSED message — the repository query only ever returns UNMAPPED rows', async () => {
      // find() is mocked to return only what a real `status: 'UNMAPPED'`
      // WHERE clause would — an already-RECEIVED/PARSED row for this sender
      // simply never appears in the result set to begin with.
      inboundFindMock.mockResolvedValue([]);

      const result = await service.reprocessUnmappedMessages(MAPPING.wa_id, MAPPING.project_ref);

      expect(result).toEqual({ reprocessed: 0 });
      expect(inboundUpdateMock).not.toHaveBeenCalled();
      expect(parseAndStoreDraftMock).not.toHaveBeenCalled();
    });

    it('routes a reprocessed message to confirmationSvc.handleReply when it matches a PENDING draft, same as a fresh mapped message would', async () => {
      inboundFindMock.mockResolvedValue([{ id: 'msg-unmapped-1', wa_id: MAPPING.wa_id, status: 'UNMAPPED', project_ref: null }]);
      const draft = { id: 'draft-uuid-0001', status: 'PENDING' };
      findMatchingPendingDraftMock.mockResolvedValue(draft);

      await service.reprocessUnmappedMessages(MAPPING.wa_id, MAPPING.project_ref);

      // No native context.id exists for a reprocessed old message.
      expect(findMatchingPendingDraftMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'msg-unmapped-1' }), null);
      expect(handleReplyMock).toHaveBeenCalledWith(draft, expect.objectContaining({ id: 'msg-unmapped-1' }));
      expect(parseAndStoreDraftMock).not.toHaveBeenCalled();
    });
  });
});
