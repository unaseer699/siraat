import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScoringService } from './scoring.service';
import { ScoreEntity } from './entities/score.entity';
import { TrustService } from '../trust/trust.service';
import type { SocietyResult } from '../property-intelligence/property-intelligence.service';

const baseSociety: SocietyResult = {
  id: 'a1b2c3d4-0001-0001-0001-000000000001',
  name: 'Park View City',
  city: 'Islamabad',
  min_price: 18000000,
  max_price: 30000000,
  min_area_marla: 10,
  max_area_marla: 20,
  property_types: ['PLOT'],
  noc_approved: true,
  base_confidence: 0.90,
  is_siraat_affiliated: false,
  affiliation_disclosure: null,
  noc_summary: 'NOC approved by CDA',
  source_document_ids: ['doc_001', 'doc_002'], // kept on SocietyResult for backward compat; ScoringService ignores this
  is_stale: false,
  staleness_threshold_days: 30,
  record_type: 'FACT',
};

const affiliatedSociety: SocietyResult = {
  ...baseSociety,
  id: 'a1b2c3d4-9999-9999-9999-000000000099',
  name: 'Zoraiz Heights',
  is_siraat_affiliated: true,
  affiliation_disclosure: 'Siraat Pakistan Pvt Ltd is an investor in this project',
};

const MOCK_EVIDENCE_RESULT = {
  verification: { id: 'ver-mock-001', status: 'VERIFIED' as const },
  evidence: [
    { id: 'mock-evidence-001' },
    { id: 'mock-evidence-002' },
  ],
};

const savedScore = (data: Partial<ScoreEntity>) => ({
  id: 'score-uuid-001',
  computed_at: new Date(),
  record_type: 'GENERATED' as const,
  ...data,
});

describe('ScoringService', () => {
  let svc: ScoringService;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let findOneMock: jest.Mock;
  let trustGetVerificationMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn((data) => data);
    saveMock = jest.fn((entity) => Promise.resolve(savedScore(entity)));
    findOneMock = jest.fn().mockResolvedValue(null); // default: no existing score
    trustGetVerificationMock = jest
      .fn()
      .mockResolvedValue(MOCK_EVIDENCE_RESULT);

    const module = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: getRepositoryToken(ScoreEntity),
          useValue: { create: createMock, save: saveMock, findOneBy: jest.fn(), findOne: findOneMock },
        },
        {
          provide: TrustService,
          useValue: { getVerification: trustGetVerificationMock },
        },
      ],
    }).compile();

    svc = module.get(ScoringService);
  });

  it('confidence_score is within 0.0–1.0', async () => {
    const result = await svc.computeAndSave(baseSociety);
    expect(Number(result.confidence_score)).toBeGreaterThanOrEqual(0);
    expect(Number(result.confidence_score)).toBeLessThanOrEqual(1);
  });

  it('record_type is always GENERATED', async () => {
    const result = await svc.computeAndSave(baseSociety);
    expect(result.record_type).toBe('GENERATED');
  });

  it('derived_from comes from TrustService evidence IDs, not society.source_document_ids', async () => {
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.derived_from).toEqual(['mock-evidence-001', 'mock-evidence-002']);
  });

  it('derived_from is empty when TrustService returns null (no verification record)', async () => {
    trustGetVerificationMock.mockResolvedValueOnce(null);
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.derived_from).toEqual([]);
  });

  it('non-affiliated society → affiliation_disclosure is null', async () => {
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.affiliation_disclosure).toBeNull();
  });

  it('affiliated society → affiliation_disclosure is non-null string', async () => {
    await svc.computeAndSave(affiliatedSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.affiliation_disclosure).toBe(
      'Siraat Pakistan Pvt Ltd is an investor in this project',
    );
  });

  it('affiliated society with null affiliation_disclosure falls back to generic text', async () => {
    await svc.computeAndSave({ ...affiliatedSociety, affiliation_disclosure: null });
    const created = createMock.mock.calls[0][0];
    expect(created.affiliation_disclosure).toBe('Siraat-affiliated partner');
  });

  it('stale society has lower confidence than identical fresh society', async () => {
    const fresh = await svc.computeAndSave(baseSociety);
    createMock.mockClear();
    await svc.computeAndSave({ ...baseSociety, is_stale: true });
    const staleCreated = createMock.mock.calls[0][0];
    expect(Number(staleCreated.confidence_score)).toBeLessThan(Number(fresh.confidence_score));
  });

  it('reasoning_summary is non-empty and mentions confidence percentage', async () => {
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.reasoning_summary).toBeTruthy();
    expect(created.reasoning_summary).toMatch(/\d+%/);
  });

  // ─── Capability 5 — Score reuse ───────────────────────────────────────────

  it('returns existing non-stale Score within staleness window without inserting a new row', async () => {
    const recentScore = savedScore({
      subject_id: baseSociety.id,
      subject_type: 'SOCIETY',
      is_stale: false,
      computed_at: new Date(), // just computed — within any staleness window
    });
    findOneMock.mockResolvedValueOnce(recentScore);

    const result = await svc.computeAndSave(baseSociety);

    expect(result).toBe(recentScore);
    expect(saveMock).not.toHaveBeenCalled();
    expect(trustGetVerificationMock).not.toHaveBeenCalled();
  });

  it('computes and saves a new Score when no existing Score is found', async () => {
    findOneMock.mockResolvedValueOnce(null);

    await svc.computeAndSave(baseSociety);

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(trustGetVerificationMock).toHaveBeenCalledTimes(1);
  });

  it('computes a new Score when existing Score is beyond the staleness window', async () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - (baseSociety.staleness_threshold_days + 1));
    const oldScore = savedScore({
      subject_id: baseSociety.id,
      subject_type: 'SOCIETY',
      is_stale: false,
      computed_at: staleDate,
    });
    findOneMock.mockResolvedValueOnce(oldScore);

    await svc.computeAndSave(baseSociety);

    expect(saveMock).toHaveBeenCalledTimes(1); // new row created
  });
});
