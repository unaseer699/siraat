import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationDetail,
  SocietyScoreResponse,
  PlatformStatsResponse,
} from '@siraat/shared-types';
import {
  PropertyIntelligenceService,
  type SocietyResult,
} from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';
import { ConstructionIntelligenceService } from '../construction-intelligence/construction-intelligence.service';
import { ScoringService } from './scoring.service';
import type { ScoreEntity } from './entities/score.entity';
import { parseIntent } from './intent/intent-parser';
import { NotCoveredRequestEntity } from './entities/not-covered-request.entity';
import { exportFilename, renderRecommendationExportHtml } from './recommendation-export.template';

const COVERED_CITIES = new Set(['Islamabad', 'Rawalpindi']);

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly piSvc: PropertyIntelligenceService,
    private readonly scoreSvc: ScoringService,
    private readonly trustSvc: TrustService,
    private readonly ciSvc: ConstructionIntelligenceService,
    @InjectRepository(NotCoveredRequestEntity)
    private readonly notCoveredRepo: Repository<NotCoveredRequestEntity>,
  ) {}

  async getRecommendations(req: RecommendationRequest): Promise<RecommendationResponse> {
    const intent = parseIntent(req.query_text, req.filters as Record<string, unknown> | undefined);

    if (intent.city && !COVERED_CITIES.has(intent.city)) {
      const location = intent.city;
      const demandCount = await this.notCoveredRepo.count({ where: { location_queried: location } });
      // Fire-and-forget — do not block the response
      this.notCoveredRepo
        .save(this.notCoveredRepo.create({ location_queried: location, requested_by: null }))
        .catch(() => {});
      return {
        state: 'NOT_COVERED',
        recommendations: [],
        message: `Siraat does not yet have verified data for ${intent.city}. We're growing coverage.`,
        demand_count: demandCount + 1,
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

    // Compute and persist a Score for each matching society (FACT→GENERATED boundary)
    const scores = await Promise.all(societies.map((s) => this.scoreSvc.computeAndSave(s)));

    const recommendations = societies.map((s, i) =>
      this.toRecommendationItem(s, scores[i], intent.max_price),
    );

    const hasStale = recommendations.some((r) => r.is_stale);
    if (hasStale) {
      // Top-level confidence/staleness omitted — per-item fields are authoritative when recs present
      return {
        state: 'DEGRADED_SUCCESS',
        recommendations,
        missing_evidence: ['FRESH_PRICE_VERIFICATION'],
      };
    }

    return { state: 'FULL', recommendations };
  }

  async getRecommendationDetail(id: string): Promise<RecommendationDetail> {
    const score = await this.scoreSvc.findById(id);
    if (!score) throw new NotFoundException(`Recommendation ${id} not found`);

    const society = await this.piSvc.findSocietyById(score.subject_id);
    if (!society) throw new NotFoundException(`Society ${score.subject_id} not found`);

    const evidenceItems = await this.trustSvc.findEvidenceByIds(score.derived_from);
    const evidenceSummaries = evidenceItems.map((e) => ({
      id: e.id,
      type: e.type,
      source_ref: e.source_ref,
    }));

    const price = this.midPrice(society);

    return {
      id: score.id,
      title: `${society.min_area_marla ? society.min_area_marla + ' Marla ' : ''}${society.property_types[0] ?? 'Property'}`,
      society_id: society.id,
      society_name: society.name,
      price,
      confidence_score: Number(score.confidence_score),
      is_stale: score.is_stale,
      staleness_threshold_days: score.staleness_threshold_days,
      affiliation_disclosure: score.affiliation_disclosure,
      recommendation_summary: society.noc_summary ?? `Society in ${society.city}.`,
      reasoning_summary: score.reasoning_summary,
      derived_from: score.derived_from,
      evidence_summaries: evidenceSummaries,
      record_type: 'GENERATED',
      computed_at: score.computed_at.toISOString(),
      breakdown: score.breakdown ?? null,
    };
  }

  // GET /v1/market-intelligence/recommendations/{id}/export — a downloadable
  // report standing in for account-based "save" (no User/Identity system yet).
  // Reuses getRecommendationDetail() verbatim: same 404 behavior, same data,
  // just a different output format.
  async getRecommendationExport(id: string): Promise<{ filename: string; html: string }> {
    const detail = await this.getRecommendationDetail(id);
    return {
      filename: exportFilename(detail),
      html: renderRecommendationExportHtml(detail),
    };
  }

  // Fetches a Score directly by society id — no search/recommendation involved.
  // Shared by the Society Profile breakdown and the Comparison feature.
  async getSocietyScore(societyId: string): Promise<SocietyScoreResponse> {
    const society = await this.piSvc.findSocietyById(societyId);
    if (!society) throw new NotFoundException(`Society ${societyId} not found`);

    // Reuses the existing staleness-window caching logic — no new scoring code.
    const score = await this.scoreSvc.computeAndSave(society);

    return {
      society_id: society.id,
      society_name: society.name,
      confidence_score: Number(score.confidence_score),
      is_stale: score.is_stale,
      staleness_threshold_days: score.staleness_threshold_days,
      affiliation_disclosure: score.affiliation_disclosure,
      derived_from: score.derived_from,
      reasoning_summary: score.reasoning_summary,
      breakdown: score.breakdown ?? null,
      // FACT fields already on the Society entity — not derived from the Score.
      price_range: { min: this.toNullableNumber(society.min_price), max: this.toNullableNumber(society.max_price) },
      area_range: {
        min: this.toNullableNumber(society.min_area_marla),
        max: this.toNullableNumber(society.max_area_marla),
      },
    };
  }

  // GET /v1/market-intelligence/platform-stats — Home page headline numbers.
  // Each count is a simple aggregate on its own context's schema (Law 1/2: no
  // cross-context FK, no cross-schema query) fetched via that context's own
  // service rather than a direct repository reach-across (Law 9).
  async getPlatformStats(): Promise<PlatformStatsResponse> {
    const [verifiedSocietiesCount, totalEvidenceCount, citiesCovered, materialsTracked] =
      await Promise.all([
        this.trustSvc.countVerifiedSocietySubjects(),
        this.trustSvc.countEvidence(),
        this.piSvc.listDistinctCities(),
        this.ciSvc.countDistinctMaterials(),
      ]);

    return {
      verified_societies_count: verifiedSocietiesCount,
      total_evidence_count: totalEvidenceCount,
      cities_covered: citiesCovered,
      construction_materials_tracked: materialsTracked,
    };
  }

  // Decimal columns come back from the driver as strings — normalize while preserving null.
  private toNullableNumber(v: number | null): number | null {
    return v === null || v === undefined ? null : Number(v);
  }

  private toRecommendationItem(s: SocietyResult, score: ScoreEntity, targetPrice: number | null) {
    const mid = this.midPrice(s);
    return {
      id: score.id,
      title: `${s.min_area_marla ? s.min_area_marla + ' Marla ' : ''}${s.property_types[0] ?? 'Property'}`,
      society_id: s.id,
      society_name: s.name,
      price: targetPrice && targetPrice < mid ? targetPrice : mid,
      confidence_score: Number(score.confidence_score),
      is_stale: score.is_stale,
      staleness_threshold_days: score.staleness_threshold_days,
      affiliation_disclosure: score.affiliation_disclosure,
      recommendation_summary: s.noc_summary ?? `Society in ${s.city}.`,
      derived_from: score.derived_from,
      record_type: 'GENERATED' as const,
    };
  }

  private midPrice(s: SocietyResult): number {
    return s.min_price && s.max_price
      ? (Number(s.min_price) + Number(s.max_price)) / 2
      : Number(s.min_price ?? s.max_price ?? 0);
  }
}
