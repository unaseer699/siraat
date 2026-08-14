import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EstimateRequest, EstimateResponse, EstimateLineItem, CoreMaterialKey } from '@siraat/shared-types';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
import { ConstructionEstimateEntity } from './entities/construction-estimate.entity';
import { MaterialRateEntity } from './entities/material-rate.entity';
import { computeMaterialRateIsStale } from './staleness';
import {
  CORE_MATERIAL_KEYS,
  CORE_MATERIAL_LABELS,
  GREY_STRUCTURE_RATIO_PER_MARLA,
  QUALITY_TIER_MULTIPLIER,
  ESTIMATE_STALENESS_THRESHOLD_DAYS,
  matchCoreMaterialKey,
  round2,
} from './material-catalog';

@Injectable()
export class EstimatesService {
  constructor(
    private readonly ciSvc: ConstructionIntelligenceService,
    @InjectRepository(ConstructionEstimateEntity)
    private readonly estimateRepo: Repository<ConstructionEstimateEntity>,
  ) {}

  async getEstimate(req: EstimateRequest): Promise<EstimateResponse> {
    const rates = await this.ciSvc.listRawRatesForCity(req.city);

    if (rates.length === 0) {
      return {
        state: 'NOT_COVERED',
        city: req.city,
        message: `Siraat does not yet have material rate data for ${req.city}.`,
        demand_count: null,
      };
    }

    // Reuse a cached estimate within the staleness window — same pattern as
    // ScoringService.computeAndSave. Trade-off accepted there too: a fresher
    // material rate entered mid-window won't be picked up until the cached
    // estimate itself expires.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ESTIMATE_STALENESS_THRESHOLD_DAYS);
    const existing = await this.estimateRepo
      .createQueryBuilder('e')
      .where('LOWER(e.city) = LOWER(:city)', { city: req.city })
      .andWhere('e.area_marla = :area', { area: req.area_marla })
      .andWhere('e.quality_tier = :tier', { tier: req.quality_tier })
      .andWhere('e.is_stale = false')
      .orderBy('e.computed_at', 'DESC')
      .getOne();
    if (existing && existing.computed_at > cutoff) {
      return this.toResponse(existing);
    }

    return this.computeAndSave(req, rates);
  }

  private async computeAndSave(
    req: EstimateRequest,
    rates: MaterialRateEntity[],
  ): Promise<EstimateResponse> {
    const now = new Date();
    const multiplier = QUALITY_TIER_MULTIPLIER[req.quality_tier];

    const lineItems: EstimateLineItem[] = [];
    const missingMaterials: string[] = [];
    const derivedFrom: string[] = [];

    for (const key of CORE_MATERIAL_KEYS) {
      const ratio = GREY_STRUCTURE_RATIO_PER_MARLA[key];
      const quantity = round2(ratio.quantity * req.area_marla * multiplier);
      const best = this.selectBestRate(rates, key, now);

      if (!best) {
        missingMaterials.push(CORE_MATERIAL_LABELS[key]);
        lineItems.push({
          material_key: key,
          material_name: CORE_MATERIAL_LABELS[key],
          quantity,
          unit: ratio.unit,
          unit_rate: null,
          subtotal: null,
          source_tier: null,
          source_name: null,
          recorded_date: null,
          is_stale: true,
        });
        continue;
      }

      const unitRate = Number(best.price);
      const subtotal = round2(quantity * unitRate);
      derivedFrom.push(best.id);
      lineItems.push({
        material_key: key,
        material_name: CORE_MATERIAL_LABELS[key],
        quantity,
        unit: ratio.unit,
        unit_rate: unitRate,
        subtotal,
        source_tier: best.source_tier,
        source_name: best.source_name,
        recorded_date: best.recorded_date,
        is_stale: false,
      });
    }

    const freshCount = CORE_MATERIAL_KEYS.length - missingMaterials.length;
    const supplierVerifiedCount = lineItems.filter((li) => li.source_tier === 'SUPPLIER_VERIFIED').length;
    // Simple, documented formula (not a black box): coverage across the 5 core
    // materials is the base signal, with a small bonus for higher-tier sourcing —
    // same shape as ScoringService's evidence-count docBonus.
    const confidenceScore = parseFloat(
      Math.max(
        0,
        Math.min(1, freshCount / CORE_MATERIAL_KEYS.length + Math.min(supplierVerifiedCount * 0.02, 0.1)),
      ).toFixed(4),
    );

    const isFull = missingMaterials.length === 0;
    const totalEstimate = isFull ? round2(lineItems.reduce((sum, li) => sum + (li.subtotal ?? 0), 0)) : null;
    const partialSubtotal = isFull
      ? null
      : round2(lineItems.reduce((sum, li) => sum + (li.subtotal ?? 0), 0));

    const entity = this.estimateRepo.create({
      city: req.city,
      area_marla: req.area_marla,
      quality_tier: req.quality_tier,
      state: isFull ? 'FULL' : 'DEGRADED_SUCCESS',
      line_items: lineItems,
      total_estimate: totalEstimate,
      partial_subtotal: partialSubtotal,
      missing_materials: missingMaterials,
      confidence_score: confidenceScore,
      is_stale: !isFull,
      staleness_threshold_days: ESTIMATE_STALENESS_THRESHOLD_DAYS,
      derived_from: derivedFrom,
      // Always null — see ConstructionEstimateEntity.affiliation_disclosure comment.
      affiliation_disclosure: null,
      record_type: 'GENERATED',
      extended_attributes: null,
    });
    const saved = await this.estimateRepo.save(entity);
    return this.toResponse(saved);
  }

  // MOST RECENT non-stale rate for the material, preferring SUPPLIER_VERIFIED
  // over MARKET_REFERENCE when both exist. Staleness is recomputed here (not
  // read off the stored MaterialRate.is_stale flag) so freshness reflects "as of
  // now", not "as of the day the rate was entered".
  private selectBestRate(
    rates: MaterialRateEntity[],
    key: CoreMaterialKey,
    now: Date,
  ): MaterialRateEntity | null {
    const fresh = rates.filter(
      (r) => matchCoreMaterialKey(r.material_name) === key && !computeMaterialRateIsStale(r.recorded_date, r.source_tier, now),
    );
    if (fresh.length === 0) return null;

    const supplierVerified = fresh.filter((r) => r.source_tier === 'SUPPLIER_VERIFIED');
    const pool = supplierVerified.length > 0 ? supplierVerified : fresh;
    return pool.reduce((latest, r) => (r.recorded_date > latest.recorded_date ? r : latest));
  }

  private toResponse(e: ConstructionEstimateEntity): EstimateResponse {
    const shared = {
      id: e.id,
      city: e.city,
      area_marla: Number(e.area_marla),
      quality_tier: e.quality_tier,
      line_items: e.line_items,
      confidence_score: Number(e.confidence_score),
      staleness_threshold_days: e.staleness_threshold_days,
      affiliation_disclosure: e.affiliation_disclosure,
      derived_from: e.derived_from,
      record_type: e.record_type,
      computed_at: e.computed_at.toISOString(),
    };

    if (e.state === 'FULL') {
      return {
        ...shared,
        state: 'FULL',
        is_stale: false,
        total_estimate: Number(e.total_estimate),
      };
    }

    return {
      ...shared,
      state: 'DEGRADED_SUCCESS',
      is_stale: true,
      total_estimate: null,
      partial_subtotal: e.partial_subtotal === null ? null : Number(e.partial_subtotal),
      missing_materials: e.missing_materials,
    };
  }
}
