import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WhatsappBusinessLinkService } from './whatsapp-business-link.service';
import { WhatsappSuggestedBusinessLinkEntity } from './entities/whatsapp-suggested-business-link.entity';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';

// WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION
// (REVIEW-GATED).

const PENDING_SUGGESTION = {
  id: 'link-uuid-0001',
  draft_expense_id: 'draft-uuid-0001',
  mentioned_name: 'Al-Rehman Traders',
  matched_contractor_id: 'contractor-uuid-0001',
  matched_supplier_id: null,
  status: 'PENDING_REVIEW' as const,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  created_at: new Date('2026-01-01'),
};

describe('WhatsappBusinessLinkService', () => {
  let service: WhatsappBusinessLinkService;

  let linkCreateMock: jest.Mock;
  let linkSaveMock: jest.Mock;
  let linkFindMock: jest.Mock;
  let linkFindOneByMock: jest.Mock;
  let linkUpdateMock: jest.Mock;

  let searchContractorsByNameMock: jest.Mock;
  let searchSuppliersByNameMock: jest.Mock;
  let findContractorByIdMock: jest.Mock;
  let findSupplierByIdMock: jest.Mock;

  let createVerificationMock: jest.Mock;

  beforeEach(async () => {
    linkCreateMock = jest.fn((data) => data);
    linkSaveMock = jest.fn((entity) => Promise.resolve({ id: 'link-uuid-0001', ...entity }));
    linkFindMock = jest.fn().mockResolvedValue([]);
    linkFindOneByMock = jest.fn().mockResolvedValue(null);
    linkUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });

    searchContractorsByNameMock = jest.fn().mockResolvedValue([]);
    searchSuppliersByNameMock = jest.fn().mockResolvedValue([]);
    findContractorByIdMock = jest.fn().mockResolvedValue({ id: 'contractor-uuid-0001', name: 'Al-Rehman Traders' });
    findSupplierByIdMock = jest.fn().mockResolvedValue({ id: 'supplier-uuid-0001', name: 'Al-Rehman Traders' });

    createVerificationMock = jest.fn().mockResolvedValue({ id: 'verification-uuid-0001', status: 'PENDING' });

    const module = await Test.createTestingModule({
      providers: [
        WhatsappBusinessLinkService,
        {
          provide: getRepositoryToken(WhatsappSuggestedBusinessLinkEntity),
          useValue: {
            create: linkCreateMock,
            save: linkSaveMock,
            find: linkFindMock,
            findOneBy: linkFindOneByMock,
            update: linkUpdateMock,
          },
        },
        {
          provide: PropertyIntelligenceService,
          useValue: {
            searchContractorsByName: searchContractorsByNameMock,
            searchSuppliersByName: searchSuppliersByNameMock,
            findContractorById: findContractorByIdMock,
            findSupplierById: findSupplierByIdMock,
          },
        },
        {
          provide: TrustService,
          useValue: { createVerification: createVerificationMock },
        },
      ],
    }).compile();

    service = module.get(WhatsappBusinessLinkService);
  });

  // ─── detectAndSuggest ───────────────────────────────────────────────────

  describe('detectAndSuggest', () => {
    it('produces a PENDING_REVIEW suggestion with matched_contractor_id populated for a real, existing contractor', async () => {
      searchContractorsByNameMock.mockResolvedValue([{ id: 'contractor-uuid-0001', name: 'Al-Rehman Traders' }]);

      await service.detectAndSuggest('draft-uuid-0001', 'Al-Rehman Traders');

      expect(searchContractorsByNameMock).toHaveBeenCalledWith('Al-Rehman Traders');
      expect(linkSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          draft_expense_id: 'draft-uuid-0001',
          mentioned_name: 'Al-Rehman Traders',
          matched_contractor_id: 'contractor-uuid-0001',
          matched_supplier_id: null,
          status: 'PENDING_REVIEW',
        }),
      );
    });

    it('produces a PENDING_REVIEW suggestion with matched_supplier_id populated when only a supplier matches', async () => {
      searchSuppliersByNameMock.mockResolvedValue([{ id: 'supplier-uuid-0001', name: 'Bilal Steel Suppliers' }]);

      await service.detectAndSuggest('draft-uuid-0001', 'Bilal Steel Suppliers');

      expect(linkSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ matched_contractor_id: null, matched_supplier_id: 'supplier-uuid-0001' }),
      );
    });

    it('prefers a contractor match over a supplier match when both directories somehow match', async () => {
      searchContractorsByNameMock.mockResolvedValue([{ id: 'contractor-uuid-0001', name: 'Ali Traders' }]);
      searchSuppliersByNameMock.mockResolvedValue([{ id: 'supplier-uuid-9999', name: 'Ali Traders' }]);

      await service.detectAndSuggest('draft-uuid-0001', 'Ali Traders');

      expect(linkSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({ matched_contractor_id: 'contractor-uuid-0001', matched_supplier_id: null }),
      );
    });

    it('produces a PENDING_REVIEW suggestion with both matched IDs null when no directory match is found — still surfaced, not discarded', async () => {
      await service.detectAndSuggest('draft-uuid-0001', 'Some Unknown Business');

      expect(linkSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mentioned_name: 'Some Unknown Business',
          matched_contractor_id: null,
          matched_supplier_id: null,
          status: 'PENDING_REVIEW',
        }),
      );
    });

    it('produces no suggestion row at all when no business is mentioned (null)', async () => {
      await service.detectAndSuggest('draft-uuid-0001', null);
      expect(linkSaveMock).not.toHaveBeenCalled();
      expect(searchContractorsByNameMock).not.toHaveBeenCalled();
    });

    it('produces no suggestion row for a blank/whitespace-only mention', async () => {
      await service.detectAndSuggest('draft-uuid-0001', '   ');
      expect(linkSaveMock).not.toHaveBeenCalled();
    });

    it('logs and does not throw when the fuzzy-match lookup fails', async () => {
      searchContractorsByNameMock.mockRejectedValue(new Error('db unavailable'));

      await expect(service.detectAndSuggest('draft-uuid-0001', 'Al-Rehman Traders')).resolves.toBeUndefined();
      expect(linkSaveMock).not.toHaveBeenCalled();
    });
  });

  // ─── listPendingSuggestions ─────────────────────────────────────────────

  describe('listPendingSuggestions', () => {
    it('queries only PENDING_REVIEW suggestions, most recent first', async () => {
      await service.listPendingSuggestions();
      expect(linkFindMock).toHaveBeenCalledWith({
        where: { status: 'PENDING_REVIEW' },
        order: { created_at: 'DESC' },
      });
    });
  });

  // ─── approve ────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('creates the real Trust-side link using the auto-matched contractor id, marks the suggestion APPROVED, exactly once', async () => {
      linkFindOneByMock.mockResolvedValue(PENDING_SUGGESTION);

      const result = await service.approve(PENDING_SUGGESTION.id, { contractor_id: null, supplier_id: null });

      expect(findContractorByIdMock).toHaveBeenCalledWith('contractor-uuid-0001');
      expect(createVerificationMock).toHaveBeenCalledTimes(1);
      expect(createVerificationMock).toHaveBeenCalledWith({
        subject_type: 'CONTRACTOR',
        subject_id: 'contractor-uuid-0001',
        claim: expect.stringContaining('Al-Rehman Traders'),
        claim_type: 'OTHER',
        status: 'PENDING',
        evidence_refs: [],
      });
      expect(linkUpdateMock).toHaveBeenCalledWith(
        { id: PENDING_SUGGESTION.id },
        expect.objectContaining({ status: 'APPROVED' }),
      );
      expect(result.status).toBe('APPROVED');
    });

    it('uses an override contractor_id instead of the auto-match when provided, and creates the link exactly once', async () => {
      linkFindOneByMock.mockResolvedValue(PENDING_SUGGESTION);
      findContractorByIdMock.mockResolvedValue({ id: 'contractor-uuid-override', name: 'Different Contractor' });

      const result = await service.approve(PENDING_SUGGESTION.id, {
        contractor_id: 'contractor-uuid-override',
        supplier_id: null,
      });

      expect(findContractorByIdMock).toHaveBeenCalledWith('contractor-uuid-override');
      expect(createVerificationMock).toHaveBeenCalledTimes(1);
      expect(createVerificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject_type: 'CONTRACTOR', subject_id: 'contractor-uuid-override' }),
      );
      expect(result.matched_contractor_id).toBe('contractor-uuid-override');
    });

    it('uses an override supplier_id when the auto-match was a contractor but the admin picks a supplier instead', async () => {
      linkFindOneByMock.mockResolvedValue(PENDING_SUGGESTION); // matched_contractor_id set

      const result = await service.approve(PENDING_SUGGESTION.id, {
        contractor_id: null,
        supplier_id: 'supplier-uuid-override',
      });

      expect(findSupplierByIdMock).toHaveBeenCalledWith('supplier-uuid-override');
      expect(createVerificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject_type: 'SUPPLIER', subject_id: 'supplier-uuid-override' }),
      );
      expect(result.matched_contractor_id).toBeNull();
      expect(result.matched_supplier_id).toBe('supplier-uuid-override');
    });

    it('rejects both contractor_id and supplier_id overrides provided together', async () => {
      linkFindOneByMock.mockResolvedValue(PENDING_SUGGESTION);

      await expect(
        service.approve(PENDING_SUGGESTION.id, { contractor_id: 'a', supplier_id: 'b' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createVerificationMock).not.toHaveBeenCalled();
    });

    it('rejects when there is no auto-match and no override was provided', async () => {
      linkFindOneByMock.mockResolvedValue({
        ...PENDING_SUGGESTION,
        matched_contractor_id: null,
        matched_supplier_id: null,
      });

      await expect(
        service.approve(PENDING_SUGGESTION.id, { contractor_id: null, supplier_id: null }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createVerificationMock).not.toHaveBeenCalled();
    });

    it('404s when the resolved contractor no longer exists', async () => {
      linkFindOneByMock.mockResolvedValue(PENDING_SUGGESTION);
      findContractorByIdMock.mockResolvedValue(null);

      await expect(
        service.approve(PENDING_SUGGESTION.id, { contractor_id: null, supplier_id: null }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(createVerificationMock).not.toHaveBeenCalled();
    });

    it('404s on a non-existent suggestion', async () => {
      linkFindOneByMock.mockResolvedValue(null);

      await expect(
        service.approve('missing-uuid', { contractor_id: null, supplier_id: null }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to re-approve a suggestion that is not PENDING_REVIEW — never a second link', async () => {
      linkFindOneByMock.mockResolvedValue({ ...PENDING_SUGGESTION, status: 'APPROVED' });

      await expect(
        service.approve(PENDING_SUGGESTION.id, { contractor_id: null, supplier_id: null }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createVerificationMock).not.toHaveBeenCalled();
    });
  });

  // ─── reject ─────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('marks the suggestion REJECTED and never creates any link', async () => {
      linkFindOneByMock.mockResolvedValue(PENDING_SUGGESTION);

      const result = await service.reject(PENDING_SUGGESTION.id, 'not a real business');

      expect(createVerificationMock).not.toHaveBeenCalled();
      expect(linkUpdateMock).toHaveBeenCalledWith(
        { id: PENDING_SUGGESTION.id },
        expect.objectContaining({ status: 'REJECTED', review_note: 'not a real business' }),
      );
      expect(result.status).toBe('REJECTED');
    });

    it('accepts a null reason (optional field)', async () => {
      linkFindOneByMock.mockResolvedValue(PENDING_SUGGESTION);

      await service.reject(PENDING_SUGGESTION.id, null);

      expect(linkUpdateMock).toHaveBeenCalledWith(
        { id: PENDING_SUGGESTION.id },
        expect.objectContaining({ status: 'REJECTED', review_note: null }),
      );
    });

    it('404s on a non-existent suggestion', async () => {
      linkFindOneByMock.mockResolvedValue(null);
      await expect(service.reject('missing-uuid', null)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to re-reject a suggestion that is not PENDING_REVIEW', async () => {
      linkFindOneByMock.mockResolvedValue({ ...PENDING_SUGGESTION, status: 'REJECTED' });
      await expect(service.reject(PENDING_SUGGESTION.id, null)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
