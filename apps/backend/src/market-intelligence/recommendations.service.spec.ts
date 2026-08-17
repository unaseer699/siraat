import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecommendationsService } from './recommendations.service';
import {
  PropertyIntelligenceService,
  type SocietyResult,
} from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';
import { ConstructionIntelligenceService } from '../construction-intelligence/construction-intelligence.service';
import { ScoringService } from './scoring.service';
import type { ScoreEntity } from './entities/score.entity';
import { NotCoveredRequestEntity } from './entities/not-covered-request.entity';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockSociety: SocietyResult = {
  id: 'a1b2c3d4-0001-0001-0001-000000000001',
  name: 'Park View City',
  city: 'Islamabad',
  min_price: 18000000,
  max_price: 30000000,
  min_area_marla: 10,
  max_area_marla: 20,
  property_types: ['PLOT'],
  noc_approved: true,
  base_confidence: 0.915,
  is_siraat_affiliated: false,
  affiliation_disclosure: null,
  noc_summary: 'NOC approved by CDA',
  source_document_ids: ['doc_noc_pvc_001'],
  is_stale: false,
  staleness_threshold_days: 30,
  record_type: 'FACT',
  developer_id: null,
};

const affiliatedSociety: SocietyResult = {
  id: 'a1b2c3d4-9999-9999-9999-000000000099',
  name: 'Zoraiz Heights',
  city: 'Islamabad',
  min_price: 20000000,
  max_price: 35000000,
  min_area_marla: 10,
  max_area_marla: 10,
  property_types: ['PLOT'],
  noc_approved: true,
  base_confidence: 0.80,
  is_siraat_affiliated: true,
  affiliation_disclosure: 'Siraat Pakistan Pvt Ltd is an investor in this project',
  noc_summary: 'NOC approved. Siraat-affiliated development.',
  source_document_ids: ['doc_zoraiz_001'],
  is_stale: false,
  staleness_threshold_days: 30,
  record_type: 'FACT',
  developer_id: null,
};

function makeScore(society: SocietyResult, override?: Partial<ScoreEntity>): ScoreEntity {
  return {
    id: 'score-uuid-' + society.id.slice(-3),
    subject_type: 'SOCIETY',
    subject_id: society.id,
    confidence_score: society.base_confidence,
    is_stale: society.is_stale,
    staleness_threshold_days: society.staleness_threshold_days,
    derived_from: [...society.source_document_ids],
    affiliation_disclosure: society.is_siraat_affiliated
      ? (society.affiliation_disclosure ?? 'Siraat-affiliated partner')
      : null,
    reasoning_summary: `Confidence ${Math.round(society.base_confidence * 100)}%: NOC approved. 1 source cited.`,
    breakdown: null,
    computed_at: new Date('2026-08-05T10:00:00Z'),
    record_type: 'GENERATED',
    ...override,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('RecommendationsService', () => {
  let svc: RecommendationsService;
  let piSvc: jest.Mocked<
    Pick<
      PropertyIntelligenceService,
      'findMatchingSocieties' | 'findSocietyById' | 'listDistinctCities' | 'findDeveloperById'
    >
  >;
  let scoreSvc: jest.Mocked<Pick<ScoringService, 'computeAndSave' | 'findById'>>;
  let trustSvc: jest.Mocked<
    Pick<TrustService, 'findEvidenceByIds' | 'countVerifiedSocietySubjects' | 'countEvidence'>
  >;
  let ciSvc: jest.Mocked<Pick<ConstructionIntelligenceService, 'countDistinctMaterials'>>;
  let notCoveredCountMock: jest.Mock;
  let notCoveredCreateMock: jest.Mock;
  let notCoveredSaveMock: jest.Mock;

  beforeEach(async () => {
    piSvc = {
      findMatchingSocieties: jest.fn().mockResolvedValue([mockSociety]),
      findSocietyById: jest.fn().mockResolvedValue(mockSociety),
      listDistinctCities: jest.fn().mockResolvedValue([]),
      findDeveloperById: jest.fn().mockResolvedValue(null),
    };
    scoreSvc = {
      computeAndSave: jest.fn().mockImplementation((s: SocietyResult) =>
        Promise.resolve(makeScore(s)),
      ),
      findById: jest.fn().mockResolvedValue(makeScore(mockSociety)),
    };
    trustSvc = {
      findEvidenceByIds: jest.fn().mockResolvedValue([]),
      countVerifiedSocietySubjects: jest.fn().mockResolvedValue(0),
      countEvidence: jest.fn().mockResolvedValue(0),
    };
    ciSvc = {
      countDistinctMaterials: jest.fn().mockResolvedValue(0),
    };
    notCoveredCountMock = jest.fn().mockResolvedValue(0);
    notCoveredCreateMock = jest.fn((data) => data);
    notCoveredSaveMock = jest.fn().mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PropertyIntelligenceService, useValue: piSvc },
        { provide: ScoringService, useValue: scoreSvc },
        { provide: TrustService, useValue: trustSvc },
        { provide: ConstructionIntelligenceService, useValue: ciSvc },
        {
          provide: getRepositoryToken(NotCoveredRequestEntity),
          useValue: {
            count: notCoveredCountMock,
            create: notCoveredCreateMock,
            save: notCoveredSaveMock,
          },
        },
      ],
    }).compile();

    svc = module.get(RecommendationsService);
  });

  // ─── Capability 1 tests (must still pass) ──────────────────────────────────

  it('returns FULL state for Islamabad plot query', async () => {
    const result = await svc.getRecommendations({
      query_text: '10 Marla plot in Islamabad under 2.5 Crore',
    });
    expect(result.state).toBe('FULL');
    if (result.state === 'FULL') {
      expect(result.recommendations).toHaveLength(1);
      const rec = result.recommendations[0];
      expect(rec.confidence_score).toBeGreaterThanOrEqual(0);
      expect(rec.confidence_score).toBeLessThanOrEqual(1);
      expect(typeof rec.is_stale).toBe('boolean');
      expect(typeof rec.staleness_threshold_days).toBe('number');
      expect('affiliation_disclosure' in rec).toBe(true);
    }
  });

  it('returns NOT_COVERED for Lahore (uncovered city)', async () => {
    const result = await svc.getRecommendations({ query_text: 'house in Lahore' });
    expect(result.state).toBe('NOT_COVERED');
    expect(piSvc.findMatchingSocieties).not.toHaveBeenCalled();
    expect(scoreSvc.computeAndSave).not.toHaveBeenCalled();
  });

  it('returns DEGRADED_SUCCESS when no societies match filters', async () => {
    piSvc.findMatchingSocieties.mockResolvedValue([]);
    const result = await svc.getRecommendations({
      query_text: 'plot in Islamabad',
      filters: { min_price: 999999999 },
    });
    expect(result.state).toBe('DEGRADED_SUCCESS');
  });

  // ─── Capability 2 — recommendation IDs are Score UUIDs ────────────────────

  it('recommendation id comes from the persisted Score', async () => {
    const result = await svc.getRecommendations({ query_text: 'plot in Islamabad' });
    if (result.state === 'FULL') {
      const score = makeScore(mockSociety);
      expect(result.recommendations[0].id).toBe(score.id);
    }
  });

  it('derived_from in recommendation matches Score.derived_from, not empty', async () => {
    const result = await svc.getRecommendations({ query_text: 'plot in Islamabad' });
    if (result.state === 'FULL') {
      expect(result.recommendations[0].derived_from).toEqual(['doc_noc_pvc_001']);
    }
  });

  // ─── Capability 2 — affiliation disclosure end-to-end ─────────────────────

  it('affiliated society → affiliation_disclosure is non-null in recommendation list', async () => {
    piSvc.findMatchingSocieties.mockResolvedValue([affiliatedSociety]);
    scoreSvc.computeAndSave.mockImplementation((s: SocietyResult) =>
      Promise.resolve(makeScore(s)),
    );
    const result = await svc.getRecommendations({ query_text: 'plot in Islamabad' });
    if (result.state === 'FULL') {
      const disclosure = result.recommendations[0].affiliation_disclosure;
      expect(disclosure).not.toBeNull();
      expect(typeof disclosure).toBe('string');
    }
  });

  it('non-affiliated society → affiliation_disclosure is exactly null (not empty string)', async () => {
    const result = await svc.getRecommendations({ query_text: 'plot in Islamabad' });
    if (result.state === 'FULL') {
      expect(result.recommendations[0].affiliation_disclosure).toBeNull();
    }
  });

  // ─── Capability 2 — GET /recommendations/{id} ─────────────────────────────

  it('getRecommendationDetail returns full detail shape with reasoning_summary', async () => {
    const score = makeScore(mockSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);

    const detail = await svc.getRecommendationDetail(score.id);

    expect(detail.id).toBe(score.id);
    expect(detail.confidence_score).toBeGreaterThanOrEqual(0);
    expect(detail.confidence_score).toBeLessThanOrEqual(1);
    expect(detail.derived_from).toEqual(['doc_noc_pvc_001']);
    expect(detail.affiliation_disclosure).toBeNull();
    expect(detail.reasoning_summary).toBeTruthy();
    expect(typeof detail.computed_at).toBe('string');
    expect(detail.record_type).toBe('GENERATED');
  });

  it('getRecommendationDetail for affiliated society → disclosure is non-null', async () => {
    const score = makeScore(affiliatedSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(affiliatedSociety);

    const detail = await svc.getRecommendationDetail(score.id);

    expect(detail.affiliation_disclosure).toBe(
      'Siraat Pakistan Pvt Ltd is an investor in this project',
    );
  });

  it('getRecommendationDetail throws 404 for unknown id', async () => {
    scoreSvc.findById.mockResolvedValue(null);
    await expect(svc.getRecommendationDetail('non-existent-id')).rejects.toThrow(NotFoundException);
  });

  // ─── DEVELOPER-SOCIETY LINK Chunk 1 ────────────────────────────────────────

  it('getRecommendationDetail returns developer_id: null and developer_name: null when the society has no linked developer', async () => {
    const score = makeScore(mockSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);

    const detail = await svc.getRecommendationDetail(score.id);

    expect(detail.developer_id).toBeNull();
    expect(detail.developer_name).toBeNull();
    expect(piSvc.findDeveloperById).not.toHaveBeenCalled();
  });

  it('getRecommendationDetail resolves developer_id and developer_name when the society has a linked developer', async () => {
    const societyWithDeveloper = { ...mockSociety, developer_id: 'dev-a-uuid' };
    const score = makeScore(societyWithDeveloper);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(societyWithDeveloper);
    piSvc.findDeveloperById.mockResolvedValue({
      id: 'dev-a-uuid',
      name: 'Zameen Developers',
      project_history: [],
      is_siraat_affiliated: false,
    });

    const detail = await svc.getRecommendationDetail(score.id);

    expect(piSvc.findDeveloperById).toHaveBeenCalledWith('dev-a-uuid');
    expect(detail.developer_id).toBe('dev-a-uuid');
    expect(detail.developer_name).toBe('Zameen Developers');
  });

  // ─── SAVE/SHARE Chunk 1 — GET /recommendations/{id}/export ────────────────

  it('getRecommendationExport returns a valid HTML file for an existing recommendation id', async () => {
    const score = makeScore(mockSociety, {
      breakdown: {
        regulatory: { status: 'VERIFIED', label: 'NOC approved by CDA', tone: 'success' },
        active_issues: { count: 0, penalty_applied: 0, label: 'No active issues', tone: 'success' },
        evidence_strength: { count: 1, bonus_applied: 0, label: '1 source cited', tone: 'neutral' },
        data_freshness: { is_stale: false, penalty_applied: 0, checked_date: '5 August 2026', tone: 'success' },
      },
    });
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);

    const result = await svc.getRecommendationExport(score.id);

    expect(result.filename).toMatch(/^siraat-report-.+\.html$/);
    expect(result.html).toContain('<!doctype html>');
    expect(result.html).toContain(mockSociety.name);
    expect(result.html).toContain(`${Math.round(mockSociety.base_confidence * 100)}%`);
    // The 4 breakdown categories must all be present when a breakdown exists
    expect(result.html).toContain('Regulatory Status');
    expect(result.html).toContain('Active Issues');
    expect(result.html).toContain('Evidence Strength');
    expect(result.html).toContain('Data Freshness');
  });

  it('getRecommendationExport throws 404 for a non-existent recommendation id', async () => {
    scoreSvc.findById.mockResolvedValue(null);
    await expect(svc.getRecommendationExport('non-existent-id')).rejects.toThrow(NotFoundException);
  });

  it('getRecommendationExport includes the affiliation disclosure when present — must never be silently dropped', async () => {
    const score = makeScore(affiliatedSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(affiliatedSociety);

    const result = await svc.getRecommendationExport(score.id);

    expect(result.html).toContain('AFFILIATION DISCLOSURE');
    expect(result.html).toContain('Siraat Pakistan Pvt Ltd is an investor in this project');
  });

  it('getRecommendationExport omits the disclosure block entirely for a non-affiliated society', async () => {
    const score = makeScore(mockSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);

    const result = await svc.getRecommendationExport(score.id);

    expect(result.html).not.toContain('AFFILIATION DISCLOSURE');
  });

  it('getRecommendationExport lists every evidence citation by source_ref', async () => {
    const score = makeScore(mockSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);
    trustSvc.findEvidenceByIds.mockResolvedValue([
      { id: 'e1b2c3d4-0001-0001-0001-000000000001', type: 'document', source_ref: 'CDA Portal — NOC No. CDA/D-16/2021/PVC' } as any,
      { id: 'e1b2c3d4-0001-0001-0001-000000000002', type: 'document', source_ref: 'CDA Portal — Layout Plan Approval 2022' } as any,
    ]);

    const result = await svc.getRecommendationExport(score.id);

    expect(result.html).toContain('CDA Portal — NOC No. CDA/D-16/2021/PVC');
    expect(result.html).toContain('CDA Portal — Layout Plan Approval 2022');
  });

  it('getRecommendationExport HTML-escapes untrusted text (e.g. evidence source_ref) rather than injecting it raw', async () => {
    const score = makeScore(mockSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);
    trustSvc.findEvidenceByIds.mockResolvedValue([
      { id: 'e1b2c3d4-0001-0001-0001-000000000003', type: 'document', source_ref: '<script>alert(1)</script>' } as any,
    ]);

    const result = await svc.getRecommendationExport(score.id);

    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  // ─── Capability 3 — evidence_summaries in recommendation detail ───────────

  it('getRecommendationDetail returns resolved evidence_summaries with human-readable source_ref', async () => {
    const score = makeScore(mockSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);
    trustSvc.findEvidenceByIds.mockResolvedValue([
      { id: 'e1b2c3d4-0001-0001-0001-000000000001', type: 'document', source_ref: 'CDA Portal — NOC No. CDA/D-16/2021/PVC' } as any,
      { id: 'e1b2c3d4-0001-0001-0001-000000000002', type: 'document', source_ref: 'CDA Portal — Layout Plan Approval 2022' } as any,
    ]);

    const detail = await svc.getRecommendationDetail(score.id);

    expect(detail.evidence_summaries).toHaveLength(2);
    expect(detail.evidence_summaries[0].source_ref).toBe('CDA Portal — NOC No. CDA/D-16/2021/PVC');
    expect(detail.evidence_summaries[0].type).toBe('document');
    expect(detail.evidence_summaries[1].source_ref).toBe('CDA Portal — Layout Plan Approval 2022');
  });

  it('getRecommendationDetail returns empty evidence_summaries when TrustService finds no evidence', async () => {
    const score = makeScore(mockSociety);
    scoreSvc.findById.mockResolvedValue(score);
    piSvc.findSocietyById.mockResolvedValue(mockSociety);
    trustSvc.findEvidenceByIds.mockResolvedValue([]);

    const detail = await svc.getRecommendationDetail(score.id);

    expect(detail.evidence_summaries).toEqual([]);
  });

  // ─── Capability 4 — NOT_COVERED demand_count ──────────────────────────────

  it('NOT_COVERED returns demand_count of 1 for a fresh uncovered location', async () => {
    notCoveredCountMock.mockResolvedValue(0);
    const result = await svc.getRecommendations({ query_text: 'plot in Lahore' });
    expect(result.state).toBe('NOT_COVERED');
    if (result.state === 'NOT_COVERED') {
      expect(result.demand_count).toBe(1);
    }
  });

  it('NOT_COVERED demand_count increments correctly across repeated searches for the same location', async () => {
    notCoveredCountMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const r1 = await svc.getRecommendations({ query_text: 'plot in Lahore' });
    const r2 = await svc.getRecommendations({ query_text: 'plot in Lahore' });
    const r3 = await svc.getRecommendations({ query_text: 'plot in Lahore' });

    expect(r1.state).toBe('NOT_COVERED');
    expect(r2.state).toBe('NOT_COVERED');
    expect(r3.state).toBe('NOT_COVERED');
    if (r1.state === 'NOT_COVERED') expect(r1.demand_count).toBe(1);
    if (r2.state === 'NOT_COVERED') expect(r2.demand_count).toBe(2);
    if (r3.state === 'NOT_COVERED') expect(r3.demand_count).toBe(3);
  });

  it('NOT_COVERED fires a fire-and-forget insert into not_covered_requests', async () => {
    notCoveredCountMock.mockResolvedValue(0);
    await svc.getRecommendations({ query_text: 'apartment in Karachi' });
    // Allow microtask queue to flush
    await Promise.resolve();
    expect(notCoveredSaveMock).toHaveBeenCalled();
  });

  it('covered city queries do NOT log not_covered_requests', async () => {
    await svc.getRecommendations({ query_text: 'plot in Islamabad' });
    expect(notCoveredCountMock).not.toHaveBeenCalled();
    expect(notCoveredSaveMock).not.toHaveBeenCalled();
  });

  // ─── getSocietyScore — GET /v1/market-intelligence/societies/{id}/score ───

  it('getSocietyScore returns a valid Score response for an existing society', async () => {
    const result = await svc.getSocietyScore(mockSociety.id);

    expect(piSvc.findSocietyById).toHaveBeenCalledWith(mockSociety.id);
    expect(result.society_id).toBe(mockSociety.id);
    expect(result.society_name).toBe(mockSociety.name);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0);
    expect(result.confidence_score).toBeLessThanOrEqual(1);
    expect(typeof result.is_stale).toBe('boolean');
    expect(typeof result.staleness_threshold_days).toBe('number');
    expect('affiliation_disclosure' in result).toBe(true);
    expect(result.derived_from).toEqual(['doc_noc_pvc_001']);
    expect(result.reasoning_summary).toBeTruthy();
  });

  it('getSocietyScore includes price_range/area_range sourced from the Society entity, not the Score', async () => {
    const result = await svc.getSocietyScore(mockSociety.id);

    expect(result.price_range).toEqual({ min: mockSociety.min_price, max: mockSociety.max_price });
    expect(result.area_range).toEqual({
      min: mockSociety.min_area_marla,
      max: mockSociety.max_area_marla,
    });
  });

  it('getSocietyScore returns null price_range/area_range bounds when the Society has no data for them', async () => {
    piSvc.findSocietyById.mockResolvedValue({ ...mockSociety, min_price: null, max_price: null });

    const result = await svc.getSocietyScore(mockSociety.id);

    expect(result.price_range).toEqual({ min: null, max: null });
  });

  it('getSocietyScore returns 404 (NotFoundException) for a non-existent society id', async () => {
    piSvc.findSocietyById.mockResolvedValue(null);

    await expect(svc.getSocietyScore('non-existent-uuid')).rejects.toThrow(NotFoundException);
    expect(scoreSvc.computeAndSave).not.toHaveBeenCalled();
  });

  it('getSocietyScore delegates to ScoringService.computeAndSave — reuses the existing staleness-window cache rather than computing fresh each call', async () => {
    const cachedScore = makeScore(mockSociety);
    scoreSvc.computeAndSave.mockResolvedValue(cachedScore);

    const first = await svc.getSocietyScore(mockSociety.id);
    const second = await svc.getSocietyScore(mockSociety.id);

    // Both calls resolve through computeAndSave (which owns the staleness-window cache
    // check — see ScoringService's "returns existing non-stale Score" test) — no separate
    // scoring path is introduced by this endpoint.
    expect(scoreSvc.computeAndSave).toHaveBeenCalledTimes(2);
    expect(scoreSvc.computeAndSave).toHaveBeenCalledWith(mockSociety);
    expect(first.confidence_score).toBe(second.confidence_score);
    expect(first.society_id).toBe(second.society_id);
  });

  // ─── HOME PAGE Chunk 1 — GET /v1/market-intelligence/platform-stats ──────

  describe('getPlatformStats', () => {
    it('returns correct counts against seeded test data', async () => {
      trustSvc.countVerifiedSocietySubjects.mockResolvedValue(3);
      trustSvc.countEvidence.mockResolvedValue(11);
      piSvc.listDistinctCities.mockResolvedValue(['Islamabad', 'Rawalpindi']);
      ciSvc.countDistinctMaterials.mockResolvedValue(5);

      const result = await svc.getPlatformStats();

      expect(result).toEqual({
        verified_societies_count: 3,
        total_evidence_count: 11,
        cities_covered: ['Islamabad', 'Rawalpindi'],
        construction_materials_tracked: 5,
      });
    });

    it('returns zeros and an empty array gracefully when no data exists yet — never errors on an empty database', async () => {
      trustSvc.countVerifiedSocietySubjects.mockResolvedValue(0);
      trustSvc.countEvidence.mockResolvedValue(0);
      piSvc.listDistinctCities.mockResolvedValue([]);
      ciSvc.countDistinctMaterials.mockResolvedValue(0);

      const result = await svc.getPlatformStats();

      expect(result).toEqual({
        verified_societies_count: 0,
        total_evidence_count: 0,
        cities_covered: [],
        construction_materials_tracked: 0,
      });
    });

    it('sources each figure from its own context — no direct cross-schema query', async () => {
      await svc.getPlatformStats();

      expect(trustSvc.countVerifiedSocietySubjects).toHaveBeenCalled();
      expect(trustSvc.countEvidence).toHaveBeenCalled();
      expect(piSvc.listDistinctCities).toHaveBeenCalled();
      expect(ciSvc.countDistinctMaterials).toHaveBeenCalled();
    });
  });
});
