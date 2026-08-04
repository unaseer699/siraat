import { Test } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import {
  PropertyIntelligenceService,
  type SocietyResult,
} from '../property-intelligence/property-intelligence.service';

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

describe('RecommendationsService', () => {
  let svc: RecommendationsService;
  let piSvc: jest.Mocked<Pick<PropertyIntelligenceService, 'findMatchingSocieties'>>;

  beforeEach(async () => {
    piSvc = { findMatchingSocieties: jest.fn().mockResolvedValue([mockSociety]) };

    const module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PropertyIntelligenceService, useValue: piSvc },
      ],
    }).compile();

    svc = module.get(RecommendationsService);
  });

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
  });

  it('returns DEGRADED_SUCCESS when no societies match filters', async () => {
    piSvc.findMatchingSocieties.mockResolvedValue([]);
    const result = await svc.getRecommendations({
      query_text: 'plot in Islamabad',
      filters: { min_price: 999999999 },
    });
    expect(result.state).toBe('DEGRADED_SUCCESS');
  });
});
