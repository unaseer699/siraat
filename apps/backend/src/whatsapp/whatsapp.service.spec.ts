import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  WhatsappService,
  extractInboundMessages,
  maskPhone,
} from './whatsapp.service';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';

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

  let mappingFindOneByMock: jest.Mock;
  let mappingCreateMock: jest.Mock;
  let mappingSaveMock: jest.Mock;
  let mappingFindMock: jest.Mock;
  let mappingDeleteMock: jest.Mock;

  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;

    inboundFindOneByMock = jest.fn().mockResolvedValue(null);
    inboundCreateMock = jest.fn((data) => data);
    inboundSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'msg-new-uuid', ...entity }),
    );

    mappingFindOneByMock = jest.fn().mockResolvedValue(null);
    mappingCreateMock = jest.fn((data) => data);
    mappingSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'map-new-uuid', created_at: new Date(), ...entity }),
    );
    mappingFindMock = jest.fn().mockResolvedValue([]);
    mappingDeleteMock = jest.fn().mockResolvedValue({ affected: 1 });

    const module = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: getRepositoryToken(WhatsappInboundMessageEntity),
          useValue: {
            findOneBy: inboundFindOneByMock,
            create: inboundCreateMock,
            save: inboundSaveMock,
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
      });
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
});
