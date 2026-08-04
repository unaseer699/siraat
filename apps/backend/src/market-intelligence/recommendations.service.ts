import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RecommendationRequest, RecommendationResponse } from '@siraat/shared-types';
import {
  PropertyIntelligenceService,
  type SocietyResult,
} from '../property-intelligence/property-intelligence.service';
import { parseIntent } from './intent/intent-parser';

const COVERED_CITIES = new Set(['Islamabad', 'Rawalpindi']);

@Injectable()
export class RecommendationsService {
  constructor(private readonly piSvc: PropertyIntelligenceService) {}

  async getRecommendations(req: RecommendationRequest): Promise<RecommendationResponse> {
    const intent = parseIntent(req.query_text, req.filters as Record<string, unknown> | undefined);

    if (intent.city && !COVERED_CITIES.has(intent.city)) {
      return {
        state: 'NOT_COVERED',
        recommendations: [],
        message: `Siraat does not yet have verified data for ${intent.city}. We're growing coverage.`,
        demand_count: null,
      };
    }

    const societies = await this.piSvc.findMatchingSocieties(intent);

    if (societies.length === 0) {
      return {
        state: 'DEGRADED_SUCCESS',
        recommendations: [],
        missing_evidence: ['MATCHING_SOCIETY_RECORD'],
        confidence_score: 0.1,
        is_stale: true,
        staleness_threshold_days: 30,
        affiliation_disclosure: null,
      };
    }

    const recommendations = societies.map((s) => this.toRecommendation(s, intent.max_price));

    const hasStale = recommendations.some((r) => r.is_stale);
    if (hasStale) {
      return {
        state: 'DEGRADED_SUCCESS',
        recommendations,
        missing_evidence: ['FRESH_PRICE_VERIFICATION'],
        confidence_score: Math.min(...recommendations.map((r) => r.confidence_score)),
        is_stale: true,
        staleness_threshold_days: 30,
        affiliation_disclosure: recommendations[0].affiliation_disclosure,
      };
    }

    return { state: 'FULL', recommendations };
  }

  private toRecommendation(s: SocietyResult, targetPrice: number | null) {
    const midPrice =
      s.min_price && s.max_price
        ? (Number(s.min_price) + Number(s.max_price)) / 2
        : Number(s.min_price ?? s.max_price ?? 0);

    return {
      id: randomUUID(),
      title: `${s.min_area_marla ? s.min_area_marla + ' Marla ' : ''}${s.property_types[0] ?? 'Property'}`,
      society_id: s.id,
      society_name: s.name,
      price: targetPrice && targetPrice < midPrice ? targetPrice : midPrice,
      confidence_score: s.base_confidence,
      is_stale: s.is_stale,
      staleness_threshold_days: s.staleness_threshold_days,
      affiliation_disclosure: s.is_siraat_affiliated
        ? (s.affiliation_disclosure ?? 'Siraat-affiliated partner')
        : null,
      recommendation_summary: s.noc_summary ?? `Society in ${s.city}.`,
      derived_from: s.source_document_ids,
      record_type: 'GENERATED' as const,
    };
  }
}
