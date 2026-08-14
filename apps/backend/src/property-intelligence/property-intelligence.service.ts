import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ParsedIntent } from '@siraat/shared-types';
import type { PropertyDetail, DeveloperProfile } from '@siraat/shared-types';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';

export interface SocietyResult {
  id: string;
  name: string;
  city: string;
  min_price: number | null;
  max_price: number | null;
  min_area_marla: number | null;
  max_area_marla: number | null;
  property_types: string[];
  noc_approved: boolean;
  base_confidence: number;
  is_siraat_affiliated: boolean;
  affiliation_disclosure: string | null;
  noc_summary: string | null;
  source_document_ids: string[];
  is_stale: boolean;
  staleness_threshold_days: number;
  record_type: 'FACT' | 'GENERATED';
}

function toSocietyResult(e: SocietyEntity): SocietyResult {
  return {
    id: e.id,
    name: e.name,
    city: e.city,
    min_price: e.min_price,
    max_price: e.max_price,
    min_area_marla: e.min_area_marla,
    max_area_marla: e.max_area_marla,
    property_types: e.property_types,
    noc_approved: e.noc_approved,
    base_confidence: Number(e.base_confidence),
    is_siraat_affiliated: e.is_siraat_affiliated,
    affiliation_disclosure: e.affiliation_disclosure,
    noc_summary: e.noc_summary,
    source_document_ids: e.source_document_ids,
    is_stale: e.is_stale,
    staleness_threshold_days: e.staleness_threshold_days,
    record_type: e.record_type,
  };
}

@Injectable()
export class PropertyIntelligenceService {
  constructor(
    @InjectRepository(SocietyEntity)
    private readonly societyRepo: Repository<SocietyEntity>,
    @InjectRepository(PropertyEntity)
    private readonly propertyRepo: Repository<PropertyEntity>,
    @InjectRepository(DeveloperEntity)
    private readonly developerRepo: Repository<DeveloperEntity>,
  ) {}

  async createSociety(data: {
    name: string;
    city: string;
    min_price: number | null;
    max_price: number | null;
    min_area_marla: number | null;
    max_area_marla: number | null;
    property_types: string[];
    noc_approved: boolean;
    base_confidence: number;
    is_siraat_affiliated: boolean;
    affiliation_disclosure: string | null;
    noc_summary: string | null;
  }): Promise<SocietyResult> {
    const entity = this.societyRepo.create({
      ...data,
      source_document_ids: [],
      is_stale: false,
      staleness_threshold_days: 30,
      record_type: 'FACT',
    });
    const saved = await this.societyRepo.save(entity);
    return toSocietyResult(saved);
  }

  async findSocietyById(id: string): Promise<SocietyResult | null> {
    const entity = await this.societyRepo.findOneBy({ id });
    return entity ? toSocietyResult(entity) : null;
  }

  async findMatchingSocieties(criteria: ParsedIntent): Promise<SocietyResult[]> {
    const qb = this.societyRepo.createQueryBuilder('s');

    if (criteria.city) {
      qb.andWhere('LOWER(s.city) = LOWER(:city)', { city: criteria.city });
    }
    if (criteria.max_price != null) {
      qb.andWhere('s.min_price <= :max_price', { max_price: criteria.max_price });
    }
    if (criteria.min_price != null) {
      qb.andWhere('s.max_price >= :min_price', { min_price: criteria.min_price });
    }
    if (criteria.property_type) {
      qb.andWhere(':ptype = ANY(s.property_types)', { ptype: criteria.property_type });
    }
    if (criteria.max_area_marla != null) {
      qb.andWhere('s.min_area_marla <= :max_area', { max_area: criteria.max_area_marla });
    }
    if (criteria.min_area_marla != null) {
      qb.andWhere('s.max_area_marla >= :min_area', { min_area: criteria.min_area_marla });
    }

    const entities = await qb.limit(10).getMany();
    return entities.map(toSocietyResult);
  }

  // Platform stats (Home page) — distinct city values across all onboarded Societies.
  async listDistinctCities(): Promise<string[]> {
    const rows = await this.societyRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.city', 'city')
      .getRawMany<{ city: string }>();
    return rows.map((r) => r.city).sort();
  }

  async findPropertyById(id: string): Promise<PropertyDetail | null> {
    const property = await this.propertyRepo.findOneBy({ id });
    if (!property) return null;

    // Cross-module call to get society summary — no direct SQL join (Law 2)
    const society = await this.societyRepo.findOneBy({ id: property.society_id });

    return {
      id: property.id,
      society_id: property.society_id,
      society: society
        ? {
            id: society.id,
            name: society.name,
            city: society.city,
            noc_approved: society.noc_approved,
          }
        : null,
      owner_ref: property.owner_ref,
      address: property.address,
      price: Number(property.price),
      listing_source: property.listing_source,
      status: property.status,
      property_type: property.property_type,
      area_marla: Number(property.area_marla),
    };
  }

  async findDeveloperById(id: string): Promise<DeveloperProfile | null> {
    const dev = await this.developerRepo.findOneBy({ id });
    if (!dev) return null;
    return {
      id: dev.id,
      name: dev.name,
      project_history: dev.project_history,
      is_siraat_affiliated: dev.is_siraat_affiliated,
    };
  }
}
