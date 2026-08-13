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

const MOCK_NOC_RESULT = {
  verification: { id: 'ver-mock-001', claim_type: 'NOC' as const, status: 'VERIFIED' as const },
  evidence: [
    { id: 'mock-evidence-001' },
    { id: 'mock-evidence-002' },
  ],
};

const MOCK_SHOW_CAUSE_DISPUTED = {
  verification: { id: 'ver-mock-002', claim_type: 'SHOW_CAUSE_NOTICE' as const, status: 'DISPUTED' as const },
  evidence: [{ id: 'mock-evidence-003' }],
};

const MOCK_ILLEGAL_SCHEME_DISPUTED = {
  verification: { id: 'ver-mock-003', claim_type: 'ILLEGAL_SCHEME_NOTICE' as const, status: 'DISPUTED' as const },
  evidence: [{ id: 'mock-evidence-004' }],
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
  let trustGetVerificationsMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn((data) => data);
    saveMock = jest.fn((entity) => Promise.resolve(savedScore(entity)));
    findOneMock = jest.fn().mockResolvedValue(null); // default: no existing score
    trustGetVerificationsMock = jest
      .fn()
      .mockResolvedValue([MOCK_NOC_RESULT]);

    const module = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: getRepositoryToken(ScoreEntity),
          useValue: { create: createMock, save: saveMock, findOneBy: jest.fn(), findOne: findOneMock },
        },
        {
          provide: TrustService,
          useValue: { getVerifications: trustGetVerificationsMock },
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

  it('derived_from is empty when TrustService returns no verification records', async () => {
    trustGetVerificationsMock.mockResolvedValueOnce([]);
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
    expect(trustGetVerificationsMock).not.toHaveBeenCalled();
  });

  it('computes and saves a new Score when no existing Score is found', async () => {
    findOneMock.mockResolvedValueOnce(null);

    await svc.computeAndSave(baseSociety);

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(trustGetVerificationsMock).toHaveBeenCalledTimes(1);
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

  // ─── Capability 2 — Multi-claim adverse penalty ───────────────────────────

  it('VERIFIED NOC only: score matches pre-change baseline (no regression)', async () => {
    trustGetVerificationsMock.mockResolvedValueOnce([MOCK_NOC_RESULT]);
    const result = await svc.computeAndSave(baseSociety);
    // base_confidence=0.90, 2 evidence items → docBonus=0.03, no stale, no adverse → 0.93
    expect(Number(result.confidence_score)).toBeCloseTo(0.93, 2);
  });

  it('VERIFIED NOC + DISPUTED SHOW_CAUSE_NOTICE scores lower than NOC-only and mentions the notice', async () => {
    trustGetVerificationsMock.mockResolvedValueOnce([MOCK_NOC_RESULT, MOCK_SHOW_CAUSE_DISPUTED]);
    const result = await svc.computeAndSave(baseSociety);
    // base=0.90, docBonus=0.06 (3 evidence items), adverse penalty=0.20 → 0.76
    expect(Number(result.confidence_score)).toBeCloseTo(0.76, 2);
    expect(Number(result.confidence_score)).toBeLessThan(0.93); // lower than NOC-only baseline
    expect(result.reasoning_summary).toMatch(/show-cause notice/i);
  });

  // ─── Capability 7 — Score Breakdown ──────────────────────────────────────────

  it('VERIFIED NOC only: breakdown.regulatory.tone is success and active_issues.count is 0', async () => {
    trustGetVerificationsMock.mockResolvedValueOnce([MOCK_NOC_RESULT]);
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.breakdown.regulatory.tone).toBe('success');
    expect(created.breakdown.regulatory.status).toBe('VERIFIED');
    expect(created.breakdown.active_issues.count).toBe(0);
    expect(created.breakdown.active_issues.tone).toBe('success');
  });

  it('DISPUTED adverse claim: breakdown.active_issues shows danger with correct count and penalty', async () => {
    trustGetVerificationsMock.mockResolvedValueOnce([MOCK_NOC_RESULT, MOCK_SHOW_CAUSE_DISPUTED]);
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.breakdown.active_issues.tone).toBe('danger');
    expect(created.breakdown.active_issues.count).toBe(1);
    expect(created.breakdown.active_issues.penalty_applied).toBeCloseTo(0.20, 4);
  });

  it('breakdown.evidence_strength.count matches the evidence count used in scoring', async () => {
    // MOCK_NOC_RESULT has 2 evidence items
    trustGetVerificationsMock.mockResolvedValueOnce([MOCK_NOC_RESULT]);
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.breakdown.evidence_strength.count).toBe(2);
    // and derived_from should also have 2 items — same source
    expect(created.derived_from).toHaveLength(2);
  });

  it('confidence_score is mathematically consistent with breakdown bonus and penalties', async () => {
    // Uses base society: base_confidence=0.90, is_stale=false, MOCK_NOC_RESULT (2 evidence → bonus=0.03), no adverse
    trustGetVerificationsMock.mockResolvedValueOnce([MOCK_NOC_RESULT]);
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    const { breakdown } = created;
    const reconstructed =
      baseSociety.base_confidence +
      breakdown.evidence_strength.bonus_applied -
      breakdown.data_freshness.penalty_applied -
      breakdown.active_issues.penalty_applied;
    expect(Number(created.confidence_score)).toBeCloseTo(reconstructed, 4);
  });

  it('two adverse claims score lower than one adverse claim', async () => {
    trustGetVerificationsMock.mockResolvedValueOnce([
      MOCK_NOC_RESULT,
      MOCK_SHOW_CAUSE_DISPUTED,
      MOCK_ILLEGAL_SCHEME_DISPUTED,
    ]);
    const result = await svc.computeAndSave(baseSociety);
    // base=0.90, docBonus=0.09 (4 evidence items), 2 adverse penalties=0.40 → 0.59
    expect(Number(result.confidence_score)).toBeCloseTo(0.59, 2);
    expect(Number(result.confidence_score)).toBeLessThan(0.76); // lower than one-adverse-claim
  });

  it('derived_from aggregates evidence from all claims, deduplicated', async () => {
    trustGetVerificationsMock.mockResolvedValueOnce([MOCK_NOC_RESULT, MOCK_SHOW_CAUSE_DISPUTED]);
    await svc.computeAndSave(baseSociety);
    const created = createMock.mock.calls[0][0];
    expect(created.derived_from).toEqual(
      expect.arrayContaining(['mock-evidence-001', 'mock-evidence-002', 'mock-evidence-003']),
    );
    expect(created.derived_from).toHaveLength(3);
  });
});
