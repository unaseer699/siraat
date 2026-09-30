import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { BoqRequest, BoqResponse, BoqLineItem, BoqItemKey } from '@siraat/shared-types';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
import { ConstructionEstimateEntity } from './entities/construction-estimate.entity';
import { MaterialRateEntity } from './entities/material-rate.entity';
import { computeMaterialRateIsStale } from './staleness';
import {
  BOQ_ITEM_KEYS,
  BOQ_ITEM_LABELS,
  BOQ_ITEM_UNITS,
  BOQ_MAJOR_ITEM_KEYS,
  BOQ_UNAVAILABLE_ITEM_NOTES,
  ESTIMATE_STALENESS_THRESHOLD_DAYS,
  computeBoqQuantity,
  isBoqItemAvailable,
  matchBoqItemKey,
  rateUnitFactor,
  round2,
  toSqft,
} from './boq-catalog';

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(
    private readonly ciSvc: ConstructionIntelligenceService,
    @InjectRepository(ConstructionEstimateEntity)
    private readonly estimateRepo: Repository<ConstructionEstimateEntity>,
  ) {}

  async getEstimate(req: BoqRequest): Promise<BoqResponse> {
    const areaSqft = round2(toSqft(req.area, req.area_unit));

    // Reuse a cached estimate within the staleness window — same pattern as
    // ScoringService.computeAndSave. Trade-off accepted there too: a fresher
    // material rate entered mid-window won't be picked up until the cached
    // estimate itself expires. Keyed on the CONVERTED sqft figure (not the
    // raw area/area_unit the user typed) so "10 marla" and "2250 sqft" hit
    // the same cache row.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ESTIMATE_STALENESS_THRESHOLD_DAYS);
    const existing = await this.estimateRepo
      .createQueryBuilder('e')
      .where('LOWER(e.city) = LOWER(:city)', { city: req.city })
      .andWhere('e.area_sqft = :areaSqft', { areaSqft })
      .andWhere('e.floors = :floors', { floors: req.floors })
      .andWhere('e.basement = :basement', { basement: req.basement })
      .andWhere('e.finish_level = :finishLevel', { finishLevel: req.finish_level })
      .andWhere('e.is_stale = false')
      .orderBy('e.computed_at', 'DESC')
      .getOne();
    if (existing && existing.computed_at > cutoff) {
      return this.toResponse(existing);
    }

    // Quantities never depend on rate coverage (pure geometry/ratio math), so
    // — unlike the retired grey-structure-only estimate — there is no
    // "nothing to compute" condition here; rates are looked up per line item
    // below, independently of whether any exist at all for this city.
    const rates = await this.ciSvc.listRawRatesForCity(req.city);
    return this.computeAndSave(req, areaSqft, rates);
  }

  private async computeAndSave(
    req: BoqRequest,
    areaSqft: number,
    rates: MaterialRateEntity[],
  ): Promise<BoqResponse> {
    const now = new Date();

    const lineItems: BoqLineItem[] = [];
    const missingMajorItems: string[] = [];
    const derivedFrom: string[] = [];

    for (const key of BOQ_ITEM_KEYS) {
      const isMajor = (BOQ_MAJOR_ITEM_KEYS as readonly BoqItemKey[]).includes(key);
      const itemName = BOQ_ITEM_LABELS[key];
      const unit = BOQ_ITEM_UNITS[key];

      // Step 0 Tier C — no standard ratio exists for this item anywhere.
      // Never looked up against a rate: there's no quantity to price.
      if (!isBoqItemAvailable(key)) {
        lineItems.push({
          item_key: key,
          item_name: itemName,
          unit,
          quantity: null,
          unit_rate: null,
          subtotal: null,
          source_tier: null,
          source_name: null,
          recorded_date: null,
          is_stale: false,
          is_major: isMajor,
          available: false,
          notes: BOQ_UNAVAILABLE_ITEM_NOTES[key] ?? null,
        });
        continue;
      }

      const quantity = computeBoqQuantity(key, areaSqft, req.floors, req.basement, req.finish_level)!;
      const best = this.selectBestRate(rates, key, now);

      if (!best) {
        if (isMajor) missingMajorItems.push(itemName);
        lineItems.push({
          item_key: key,
          item_name: itemName,
          unit,
          quantity,
          unit_rate: null,
          subtotal: null,
          source_tier: null,
          source_name: null,
          recorded_date: null,
          // A line's is_stale describes its rate. With no rate there is nothing
          // to be stale; "no rate" is already told by unit_rate: null and, for
          // a major item, by missing_major_items plus the estimate-level is_stale.
          is_stale: false,
          is_major: isMajor,
          available: true,
          notes: null,
        });
        continue;
      }

      // Price per BOQ unit. For example, a steel rate per ton is divided by
      // 1000 to price a quantity in kg. The factor is 1 when the units match.
      // The subtotal uses the unrounded per-unit price, so rounding the
      // displayed rate never shifts the line total.
      const pricePerBoqUnit = Number(best.rate.price) / best.factor;
      const unitRate = round2(pricePerBoqUnit);
      const subtotal = round2(quantity * pricePerBoqUnit);
      derivedFrom.push(best.rate.id);
      lineItems.push({
        item_key: key,
        item_name: itemName,
        unit,
        quantity,
        unit_rate: unitRate,
        subtotal,
        source_tier: best.rate.source_tier,
        source_name: best.rate.source_name,
        recorded_date: best.rate.recorded_date,
        is_stale: false,
        is_major: isMajor,
        available: true,
        notes: null,
      });
    }

    const freshMajorCount = BOQ_MAJOR_ITEM_KEYS.length - missingMajorItems.length;
    const supplierVerifiedCount = lineItems.filter((li) => li.source_tier === 'SUPPLIER_VERIFIED').length;
    // Simple, documented formula (not a black box): coverage across the 6
    // major items is the base signal, with a small bonus for higher-tier
    // sourcing — same shape as ScoringService's evidence-count docBonus.
    const confidenceScore = parseFloat(
      Math.max(
        0,
        Math.min(1, freshMajorCount / BOQ_MAJOR_ITEM_KEYS.length + Math.min(supplierVerifiedCount * 0.02, 0.1)),
      ).toFixed(4),
    );

    const isFull = missingMajorItems.length === 0;
    // Sums every line item that has a subtotal (major AND non-major, e.g.
    // Excavation once priced) — the "major" gate only decides WHETHER a
    // grand total is shown at all, not which subtotals it includes.
    const summedSubtotal = round2(lineItems.reduce((sum, li) => sum + (li.subtotal ?? 0), 0));
    const totalEstimate = isFull ? summedSubtotal : null;
    const partialSubtotal = isFull ? null : summedSubtotal;

    const entity = this.estimateRepo.create({
      city: req.city,
      area: req.area,
      area_unit: req.area_unit,
      area_sqft: areaSqft,
      floors: req.floors,
      basement: req.basement,
      finish_level: req.finish_level,
      state: isFull ? 'FULL' : 'DEGRADED_SUCCESS',
      line_items: lineItems,
      total_estimate: totalEstimate,
      partial_subtotal: partialSubtotal,
      missing_major_items: missingMajorItems,
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

  // MOST RECENT non-stale rate for the item, preferring SUPPLIER_VERIFIED
  // over MARKET_REFERENCE when both exist. Staleness is recomputed here (not
  // read off the stored MaterialRate.is_stale flag) so freshness reflects "as
  // of now", not "as of the day the rate was entered". A rate whose unit is
  // neither the BOQ unit nor a listed conversion (RATE_UNIT_CONVERSIONS) is
  // treated exactly like no rate at all. It is logged, never guessed at.
  // Never called for a Tier C item (available=false).
  private selectBestRate(
    rates: MaterialRateEntity[],
    key: BoqItemKey,
    now: Date,
  ): { rate: MaterialRateEntity; factor: number } | null {
    const usable: { rate: MaterialRateEntity; factor: number }[] = [];
    for (const r of rates) {
      if (matchBoqItemKey(r.material_name) !== key) continue;
      if (computeMaterialRateIsStale(r.recorded_date, r.source_tier, now)) continue;
      const factor = rateUnitFactor(key, r.unit);
      if (factor === null) {
        this.logger.warn(
          `Skipped rate ${r.id} ("${r.material_name}", ${r.city}) for ${key}: rate unit "${r.unit}" ` +
            `has no listed conversion to BOQ unit "${BOQ_ITEM_UNITS[key]}". Item shown as "Rate not yet ` +
            `available". If "${r.unit}" is a genuine fixed equivalent, add it to RATE_UNIT_CONVERSIONS ` +
            `(boq-catalog.ts) — see REVIEW_BACKLOG #20.`,
        );
        continue;
      }
      usable.push({ rate: r, factor });
    }
    if (usable.length === 0) return null;

    const supplierVerified = usable.filter((u) => u.rate.source_tier === 'SUPPLIER_VERIFIED');
    const pool = supplierVerified.length > 0 ? supplierVerified : usable;
    return pool.reduce((latest, u) => (u.rate.recorded_date > latest.rate.recorded_date ? u : latest));
  }

  private toResponse(e: ConstructionEstimateEntity): BoqResponse {
    const shared = {
      id: e.id,
      city: e.city,
      area: Number(e.area),
      area_unit: e.area_unit,
      area_sqft: Number(e.area_sqft),
      floors: e.floors,
      basement: e.basement,
      finish_level: e.finish_level,
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
      missing_major_items: e.missing_major_items,
    };
  }
}
