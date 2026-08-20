import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialRateEntity, MaterialRateSourceTier } from './entities/material-rate.entity';
import { ObservationEntity } from './entities/observation.entity';
import { computeMaterialRateIsStale, stalenessThresholdDaysFor } from './staleness';

export interface CreateMaterialRateInput {
  material_name: string;
  unit: string;
  price: number;
  city: string;
  source_tier: MaterialRateSourceTier;
  source_name: string;
  source_contact: string | null;
  recorded_date: string;
  // SUPPLIER DIRECTORY Chunk 1 — optional at the type level (rather than
  // required) so existing callers that don't yet know about suppliers (e.g.
  // AdminService.createMaterialRate's current CreateMaterialRateBody, wired
  // up in a later chunk) still compile unchanged. Required at runtime for
  // SUPPLIER_VERIFIED — see createMaterialRate below.
  supplier_id?: string | null;
}

export interface MaterialRateResult {
  id: string;
  material_name: string;
  unit: string;
  price: number;
  city: string;
  source_tier: MaterialRateSourceTier;
  source_name: string;
  source_contact: string | null;
  supplier_id: string | null;
  recorded_date: string;
  record_type: 'FACT';
  is_stale: boolean;
  staleness_threshold_days: number;
}

function toResult(e: MaterialRateEntity): MaterialRateResult {
  return {
    id: e.id,
    material_name: e.material_name,
    unit: e.unit,
    price: Number(e.price),
    city: e.city,
    source_tier: e.source_tier,
    source_name: e.source_name,
    source_contact: e.source_contact,
    supplier_id: e.supplier_id,
    recorded_date: e.recorded_date,
    record_type: e.record_type,
    is_stale: e.is_stale,
    staleness_threshold_days: stalenessThresholdDaysFor(e.source_tier),
  };
}

@Injectable()
export class ConstructionIntelligenceService {
  private readonly logger = new Logger(ConstructionIntelligenceService.name);

  constructor(
    @InjectRepository(MaterialRateEntity)
    private readonly rateRepo: Repository<MaterialRateEntity>,
    @InjectRepository(ObservationEntity)
    private readonly obsRepo: Repository<ObservationEntity>,
  ) {}

  // Fire-and-forget, append-only state-change ledger (Law 3: FACT, immutable).
  // Never throws — an Observation write failure must never fail the rate entry
  // that triggered it, so failures are logged and swallowed here.
  async logObservation(data: {
    entity_ref: string;
    metric: string;
    old_value: string | null;
    new_value: string;
    source_ref: string;
  }): Promise<void> {
    try {
      const observation = this.obsRepo.create({ ...data, record_type: 'FACT' });
      await this.obsRepo.save(observation);
    } catch (err) {
      this.logger.error(
        `Failed to log Observation (metric=${data.metric}, entity_ref=${data.entity_ref})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async createMaterialRate(data: CreateMaterialRateInput): Promise<MaterialRateResult> {
    // SUPPLIER DIRECTORY Chunk 1 — supplier_id is now the required link for
    // SUPPLIER_VERIFIED rates (replaces the old source_contact requirement:
    // source_name/source_contact are optional fallback fields for this tier
    // now that a real supplier link exists). MARKET_REFERENCE is unchanged —
    // supplier_id stays optional/null, source_name/source_contact remain the
    // primary fields for that tier.
    if (data.source_tier === 'SUPPLIER_VERIFIED' && !data.supplier_id) {
      throw new BadRequestException(
        'supplier_id is required when source_tier is SUPPLIER_VERIFIED',
      );
    }

    // Most recent prior rate for this exact material/city combo, looked up before
    // inserting the new row — the baseline for Observation logging below.
    const priorRate = await this.rateRepo
      .createQueryBuilder('r')
      .where('LOWER(r.material_name) = LOWER(:material_name)', { material_name: data.material_name })
      .andWhere('LOWER(r.city) = LOWER(:city)', { city: data.city })
      .orderBy('r.recorded_date', 'DESC')
      .getOne();

    const entity = this.rateRepo.create({
      ...data,
      supplier_id: data.supplier_id ?? null,
      record_type: 'FACT',
      is_stale: computeMaterialRateIsStale(data.recorded_date, data.source_tier),
    });
    const saved = await this.rateRepo.save(entity);

    // Only log when a prior rate existed AND the price actually changed — a
    // re-entry at the same price is not a meaningful Observation.
    if (priorRate && Number(priorRate.price) !== Number(data.price)) {
      await this.logObservation({
        entity_ref: saved.id,
        metric: 'material_price',
        old_value: String(priorRate.price),
        new_value: String(data.price),
        source_ref: data.source_name,
      });
    }

    return toResult(saved);
  }

  async listMaterialRates(filters: { city?: string; material?: string }): Promise<MaterialRateResult[]> {
    const qb = this.rateRepo.createQueryBuilder('r');
    if (filters.city) {
      qb.andWhere('LOWER(r.city) = LOWER(:city)', { city: filters.city });
    }
    if (filters.material) {
      qb.andWhere('LOWER(r.material_name) LIKE LOWER(:material)', { material: `%${filters.material}%` });
    }
    const entities = await qb.orderBy('r.recorded_date', 'DESC').getMany();
    return entities.map(toResult);
  }

  // Raw entities (not the mapped/rounded MaterialRateResult) for the estimate
  // calculator — it needs recorded_date and source_tier to recompute freshness
  // at request time rather than trust each row's write-time is_stale snapshot.
  async listRawRatesForCity(city: string): Promise<MaterialRateEntity[]> {
    return this.rateRepo
      .createQueryBuilder('r')
      .where('LOWER(r.city) = LOWER(:city)', { city })
      .getMany();
  }

  // SUPPLIER DIRECTORY Chunk 1 — powers PropertyIntelligenceService's
  // findMaterialRatesBySupplierId (cross-module public-API call, Law 9: no
  // reach into this schema from property_intelligence — same pattern as
  // PropertyIntelligenceService already using TrustService's public methods).
  // Feeds the supplier profile page's "active material rate submissions" list.
  async findRatesBySupplierId(supplierId: string): Promise<MaterialRateResult[]> {
    const entities = await this.rateRepo.find({
      where: { supplier_id: supplierId },
      order: { recorded_date: 'DESC' },
    });
    return entities.map(toResult);
  }

  // Platform stats (Home page) — distinct material_name values logged so far.
  async countDistinctMaterials(): Promise<number> {
    const result = await this.rateRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.material_name)', 'count')
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }
}
