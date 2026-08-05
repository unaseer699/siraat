import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import {
  PropertyIntelligenceService,
  type SocietyResult,
} from '../property-intelligence/property-intelligence.service';
import { ScoringService } from './scoring.service';
import type { ScoreEntity } from './entities/score.entity';

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
    computed_at: new Date('2026-08-05T10:00:00Z'),
    record_type: 'GENERATED',
    ...override,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('RecommendationsService', () => {
  let svc: RecommendationsService;
  let piSvc: jest.Mocked<Pick<PropertyIntelligenceService, 'findMatchingSocieties' | 'findSocietyById'>>;
  let scoreSvc: jest.Mocked<Pick<ScoringService, 'computeAndSave' | 'findById'>>;

  beforeEach(async () => {
    piSvc = {
      findMatchingSocieties: jest.fn().mockResolvedValue([mockSociety]),
      findSocietyById: jest.fn().mockResolvedValue(mockSociety),
    };
    scoreSvc = {
      computeAndSave: jest.fn().mockImplementation((s: SocietyResult) =>
        Promise.resolve(makeScore(s)),
      ),
      findById: jest.fn().mockResolvedValue(makeScore(mockSociety)),
    };

    const module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PropertyIntelligenceService, useValue: piSvc },
        { provide: ScoringService, useValue: scoreSvc },
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
});
