import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialRateEntity, MaterialRateSourceTier } from './entities/material-rate.entity';
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
    recorded_date: e.recorded_date,
    record_type: e.record_type,
    is_stale: e.is_stale,
    staleness_threshold_days: stalenessThresholdDaysFor(e.source_tier),
  };
}

@Injectable()
export class ConstructionIntelligenceService {
  constructor(
    @InjectRepository(MaterialRateEntity)
    private readonly rateRepo: Repository<MaterialRateEntity>,
  ) {}

  async createMaterialRate(data: CreateMaterialRateInput): Promise<MaterialRateResult> {
    if (data.source_tier === 'SUPPLIER_VERIFIED' && !data.source_contact) {
      throw new BadRequestException(
        'source_contact is required when source_tier is SUPPLIER_VERIFIED',
      );
    }

    const entity = this.rateRepo.create({
      ...data,
      record_type: 'FACT',
      is_stale: computeMaterialRateIsStale(data.recorded_date, data.source_tier),
    });
    const saved = await this.rateRepo.save(entity);
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

  // Platform stats (Home page) — distinct material_name values logged so far.
  async countDistinctMaterials(): Promise<number> {
    const result = await this.rateRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.material_name)', 'count')
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }
}
