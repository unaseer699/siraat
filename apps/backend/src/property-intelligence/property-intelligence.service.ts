import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, MoreThan, Repository } from 'typeorm';
import type { ParsedIntent, TradeCategory, MaterialCategory, HousePlanStyle } from '@siraat/shared-types';
import type {
  PropertyDetail,
  DeveloperProfile,
  DeveloperStats,
  LinkedSociety,
  SocietyListResponse,
  SocietyChangesResponse,
  SocietyChangeSummary,
  ContractorSummary,
  ContractorListResponse,
  SupplierSummary,
  SupplierListResponse,
  HousePlanSummary,
  HousePlanListResponse,
} from '@siraat/shared-types';
import { TrustService } from '../trust/trust.service';
import {
  ConstructionIntelligenceService,
  type MaterialRateResult,
} from '../construction-intelligence/construction-intelligence.service';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';
import { ContractorEntity } from './entities/contractor.entity';
import { SupplierEntity } from './entities/supplier.entity';
import { HousePlanEntity } from './entities/house-plan.entity';
import { CandidateSocietyEntity } from './entities/candidate-society.entity';
import { ObservationEntity } from './entities/observation.entity';

// Watchlist Chunk 1: caps how many societies /societies/changes will check in one
// request — an unbounded society_ids[] would mean an unbounded fan-out of per-society
// Trust calls below. Rejected outright with a clear error rather than silently truncated.
const MAX_CHANGES_BATCH_SIZE = 20;

// DEVELOPER-SOCIETY LINK Chunk 3: caps GET /admin/developers?search= results —
// a broad query (e.g. a single letter) must never dump the whole developers table.
const DEVELOPER_SEARCH_LIMIT = 10;

// CONTRACTOR DIRECTORY Chunk 1 — same default page size as Browse Societies
// (listSocieties below), kept as a named constant since searchContractors
// references it in more than one place.
const DEFAULT_CONTRACTOR_PAGE_SIZE = 20;

// SUPPLIER DIRECTORY Chunk 1 — same convention as DEFAULT_CONTRACTOR_PAGE_SIZE.
const DEFAULT_SUPPLIER_PAGE_SIZE = 20;

// SUPPLIER DIRECTORY Chunk 2b — same cap/rationale as DEVELOPER_SEARCH_LIMIT
// above, for the supplier name search-as-you-type field.
const SUPPLIER_SEARCH_LIMIT = 10;

// PROJECT COST TRACKER Chunk 2 — same cap/rationale, for the contractor name
// search-as-you-type field on the project expense form.
const CONTRACTOR_SEARCH_LIMIT = 10;

// HOUSE PLANS DIRECTORY Chunk 1 — same default page size/convention as
// Browse Societies and the Contractor/Supplier directories.
const DEFAULT_HOUSE_PLAN_PAGE_SIZE = 20;

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
  developer_id: string | null;
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
    developer_id: e.developer_id,
  };
}

// ─── CONTRACTOR DIRECTORY Chunk 1 ────────────────────────────────────────────

// Fields straight off the entity — verification_status is spliced in
// separately at each call site below (a TrustService call, so it can't live
// in this plain sync helper).
function toContractorFields(e: ContractorEntity) {
  return {
    id: e.id,
    name: e.name,
    trade_categories: e.trade_categories,
    service_cities: e.service_cities,
    contact_phone: e.contact_phone,
    contact_whatsapp: e.contact_whatsapp,
    is_siraat_affiliated: e.is_siraat_affiliated,
    record_type: e.record_type,
  };
}

// ─── SUPPLIER DIRECTORY Chunk 1/3 ────────────────────────────────────────────
// Fields straight off the entity — verification_status is spliced in
// separately at each call site below, same as toContractorFields above.
// SupplierResult/SupplierSearchResult (Chunk 1, local-only) were retired in
// Chunk 3 in favor of the shared-types SupplierSummary/SupplierListResponse,
// same migration ContractorResult/ContractorSearchResult went through when
// their public route landed.

function toSupplierFields(e: SupplierEntity) {
  return {
    id: e.id,
    name: e.name,
    material_categories: e.material_categories,
    service_cities: e.service_cities,
    contact_phone: e.contact_phone,
    contact_whatsapp: e.contact_whatsapp,
    is_siraat_affiliated: e.is_siraat_affiliated,
    record_type: e.record_type,
  };
}

// ─── HOUSE PLANS DIRECTORY Chunk 1 ──────────────────────────────────────────
// Standalone catalog, not linked to any Society/Property — no TrustService
// involvement (no verification_status field), unlike Contractor/Supplier.
// area_marla is a `decimal` column, which pg/TypeORM returns as a string —
// same Number() conversion PropertyEntity.area_marla and SocietyEntity.
// base_confidence go through in toSocietyResult/findPropertyById above.

function toHousePlanResult(e: HousePlanEntity): HousePlanSummary {
  return {
    id: e.id,
    title: e.title,
    area_marla: Number(e.area_marla),
    bedrooms: e.bedrooms,
    style: e.style,
    preview_image_ref: e.preview_image_ref,
    description: e.description,
    contact_whatsapp: e.contact_whatsapp,
    is_siraat_affiliated: e.is_siraat_affiliated,
    record_type: e.record_type,
  };
}

@Injectable()
export class PropertyIntelligenceService {
  private readonly logger = new Logger(PropertyIntelligenceService.name);

  constructor(
    @InjectRepository(SocietyEntity)
    private readonly societyRepo: Repository<SocietyEntity>,
    @InjectRepository(PropertyEntity)
    private readonly propertyRepo: Repository<PropertyEntity>,
    @InjectRepository(DeveloperEntity)
    private readonly developerRepo: Repository<DeveloperEntity>,
    @InjectRepository(ContractorEntity)
    private readonly contractorRepo: Repository<ContractorEntity>,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(HousePlanEntity)
    private readonly housePlanRepo: Repository<HousePlanEntity>,
    // ADMIN CRUD PHASE 1 Chunk 1 — AdminService already holds its own
    // CandidateSocietyEntity repo (listCandidateSocieties, the
    // createSocietyWithFirstClaim onboarding lookup) via AdminModule's own
    // TypeOrmModule.forFeature; this is a second repository provider for the
    // same table, added here specifically for update/delete so those methods
    // live on PropertyIntelligenceService alongside every other directory
    // entity's CRUD, not bolted onto AdminService's existing repo access.
    @InjectRepository(CandidateSocietyEntity)
    private readonly candidateRepo: Repository<CandidateSocietyEntity>,
    @InjectRepository(ObservationEntity)
    private readonly observationRepo: Repository<ObservationEntity>,
    private readonly trustSvc: TrustService,
    private readonly ciSvc: ConstructionIntelligenceService,
  ) {}

  // Fire-and-forget, append-only state-change ledger (Law 3: FACT, immutable).
  // Never throws — an Observation write failure must never fail the operation
  // that triggered it (e.g. Score computation), so failures are logged and
  // swallowed here rather than propagated to the caller.
  async logObservation(data: {
    entity_ref: string;
    metric: string;
    old_value: string | null;
    new_value: string;
    source_ref: string;
  }): Promise<void> {
    try {
      const observation = this.observationRepo.create({ ...data, record_type: 'FACT' });
      await this.observationRepo.save(observation);
    } catch (err) {
      this.logger.error(
        `Failed to log Observation (metric=${data.metric}, entity_ref=${data.entity_ref})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // DUPLICATE SOCIETY PREVENTION — exact case-insensitive name+city match.
  // The single source of truth for "would this be considered a duplicate,"
  // used both by createSociety's hard block below and (wrapped into a list
  // by AdminService) the admin's live duplicate-check search endpoint —
  // one rule, not reimplemented per call site. Returns null (never throws)
  // when either input is blank: an incomplete pair can't be a real match.
  async findSocietyByNameAndCity(name: string, city: string): Promise<SocietyResult | null> {
    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    if (!trimmedName || !trimmedCity) return null;

    const entity = await this.societyRepo
      .createQueryBuilder('s')
      .where('LOWER(s.name) = LOWER(:name)', { name: trimmedName })
      .andWhere('LOWER(s.city) = LOWER(:city)', { city: trimmedCity })
      .getOne();
    return entity ? toSocietyResult(entity) : null;
  }

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
    // Optional — most societies still onboard without a known developer.
    // Never required; a plain UUID reference, no SQL FK per Law 2.
    developer_id: string | null;
  }): Promise<SocietyResult> {
    // DUPLICATE SOCIETY PREVENTION — two identical "AGOCHS, Phase-II" rows
    // were once accidentally created 5 minutes apart via this exact form,
    // splitting real evidence across two disconnected records. City is part
    // of the match deliberately: a name like "Park View City" can plausibly
    // exist in two different cities, and that is not a duplicate.
    const existing = await this.findSocietyByNameAndCity(data.name, data.city);
    if (existing) {
      throw new BadRequestException(
        `A society named "${data.name}" already exists in ${data.city} (id: ${existing.id}). Use Add Claim on the existing record instead of creating a new one.`,
      );
    }

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

  // DEVELOPER-SOCIETY LINK Chunk 1 — powers linked_societies on the Developer
  // Profile endpoint (getDeveloperStats below).
  async findSocietiesByDeveloperId(developerId: string): Promise<SocietyResult[]> {
    const entities = await this.societyRepo.findBy({ developer_id: developerId });
    return entities.map(toSocietyResult);
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

  // Browse Societies — paginated listing with a per-society verification_status
  // derived from Trust claims (Law 9: cross-module call, no reach into Trust's schema).
  async listSocieties(params: {
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<SocietyListResponse> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const qb = this.societyRepo.createQueryBuilder('s');
    if (params.city) {
      qb.andWhere('LOWER(s.city) = LOWER(:city)', { city: params.city });
    }

    const [entities, total_count] = await qb
      .orderBy('s.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const societies = await Promise.all(
      entities.map(async (e) => ({
        id: e.id,
        name: e.name,
        city: e.city,
        price_range: { min: e.min_price, max: e.max_price },
        area_range: { min: e.min_area_marla, max: e.max_area_marla },
        property_types: e.property_types,
        verification_status: await this.trustSvc.deriveVerificationStatus('SOCIETY', e.id),
      })),
    );

    return {
      societies,
      total_count,
      page,
      total_pages: Math.ceil(total_count / limit),
    };
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

  // DEVELOPER-SOCIETY LINK Chunk 3 — powers the admin new-society developer
  // search-as-you-type field. Case-insensitive substring match; a blank/whitespace
  // query returns [] rather than the whole table.
  async searchDevelopers(query: string): Promise<{ id: string; name: string }[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results = await this.developerRepo.find({
      where: { name: ILike(`%${trimmed}%`) },
      order: { name: 'ASC' },
      take: DEVELOPER_SEARCH_LIMIT,
    });
    return results.map((d) => ({ id: d.id, name: d.name }));
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

  // ─── DEVELOPER PROFILE Chunk 1 / DEVELOPER-SOCIETY LINK Chunk 1 ────────────

  // linked_societies now comes from findSocietiesByDeveloperId (SocietyEntity.
  // developer_id, added in DEVELOPER-SOCIETY LINK Chunk 1) — real, not hardcoded.
  // Each linked society's verification_status is derived the same way Browse
  // derives it (via TrustService, not re-implemented here).
  async getDeveloperStats(id: string): Promise<DeveloperStats | null> {
    const dev = await this.developerRepo.findOneBy({ id });
    if (!dev) return null;

    const [verification_status, verifications, linkedSocietyRows] = await Promise.all([
      this.trustSvc.deriveVerificationStatus('DEVELOPER', id),
      this.trustSvc.getVerifications('DEVELOPER', id),
      this.findSocietiesByDeveloperId(id),
    ]);

    const evidence_count = verifications.reduce((sum, v) => sum + v.evidence.length, 0);

    const linked_societies: LinkedSociety[] = await Promise.all(
      linkedSocietyRows.map(async (s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        verification_status: await this.trustSvc.deriveVerificationStatus('SOCIETY', s.id),
      })),
    );

    return {
      developer_id: dev.id,
      developer_name: dev.name,
      verification_status,
      project_history: dev.project_history,
      linked_societies,
      evidence_count,
      is_siraat_affiliated: dev.is_siraat_affiliated,
    };
  }

  // ─── CONTRACTOR DIRECTORY Chunk 1 — Schema & Core Service ──────────────────
  // Standalone entity, organized the same way Developer is (methods live
  // directly on this service — no dedicated ContractorService). A directory
  // (find + verify) only; no booking/payment/in-app-transaction fields.

  async createContractor(data: {
    name: string;
    trade_categories: TradeCategory[];
    service_cities: string[];
    contact_phone: string;
    contact_whatsapp: string | null;
    is_siraat_affiliated: boolean;
  }): Promise<ContractorSummary> {
    const entity = this.contractorRepo.create({ ...data, record_type: 'FACT' });
    const saved = await this.contractorRepo.save(entity);
    return {
      ...toContractorFields(saved),
      verification_status: await this.trustSvc.deriveVerificationStatus('CONTRACTOR', saved.id),
    };
  }

  // CONTRACTOR DIRECTORY Chunk 3 — also backs the public GET
  // /property-intelligence/contractors/:id profile route; the admin addClaim
  // existence check just discards the extra verification_status field.
  async findContractorById(id: string): Promise<ContractorSummary | null> {
    const entity = await this.contractorRepo.findOneBy({ id });
    if (!entity) return null;
    return {
      ...toContractorFields(entity),
      verification_status: await this.trustSvc.deriveVerificationStatus('CONTRACTOR', entity.id),
    };
  }

  // Paginated the same way listSocieties (Browse Societies) is: page/limit
  // default and clamp the same way, order alphabetically, getManyAndCount.
  // CONTRACTOR DIRECTORY Chunk 3 — also backs the public GET
  // /property-intelligence/contractors route (same delegation as GET /admin/contractors).
  async searchContractors(params: {
    trade_category?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<ContractorListResponse> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : DEFAULT_CONTRACTOR_PAGE_SIZE;

    const qb = this.contractorRepo.createQueryBuilder('c');
    if (params.trade_category) {
      // Same array-containment pattern as findMatchingSocieties' property_type filter.
      qb.andWhere(':category = ANY(c.trade_categories)', { category: params.trade_category });
    }
    if (params.city) {
      // service_cities is multi-valued (unlike Society's single city column), so the
      // case-insensitive match from listSocieties becomes an EXISTS/unnest membership test.
      qb.andWhere('EXISTS (SELECT 1 FROM unnest(c.service_cities) AS sc WHERE LOWER(sc) = LOWER(:city))', {
        city: params.city,
      });
    }

    const [entities, total_count] = await qb
      .orderBy('c.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Same per-row TrustService derivation + Promise.all shape as listSocieties above.
    const contractors = await Promise.all(
      entities.map(async (e) => ({
        ...toContractorFields(e),
        verification_status: await this.trustSvc.deriveVerificationStatus('CONTRACTOR', e.id),
      })),
    );

    return {
      contractors,
      total_count,
      page,
      total_pages: Math.ceil(total_count / limit),
    };
  }

  // PROJECT COST TRACKER Chunk 2 — search-as-you-type by name, same
  // shape/ILike pattern as searchDevelopers/searchSuppliersByName; powers the
  // contractor picker on the admin project expense form (GET
  // /v1/admin/contractors/search?q=).
  async searchContractorsByName(query: string): Promise<{ id: string; name: string }[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results = await this.contractorRepo.find({
      where: { name: ILike(`%${trimmed}%`) },
      order: { name: 'ASC' },
      take: CONTRACTOR_SEARCH_LIMIT,
    });
    return results.map((c) => ({ id: c.id, name: c.name }));
  }

  // ─── SUPPLIER DIRECTORY Chunk 1 — Schema & Core Service ────────────────────
  // Standalone entity, organized the same way Developer/Contractor are
  // (methods live directly on this service — no dedicated SupplierService).
  // A directory (find + verify) only; no booking/payment/in-app-transaction
  // fields.

  async createSupplier(data: {
    name: string;
    material_categories: MaterialCategory[];
    service_cities: string[];
    contact_phone: string;
    contact_whatsapp: string | null;
    is_siraat_affiliated: boolean;
  }): Promise<SupplierSummary> {
    const entity = this.supplierRepo.create({ ...data, record_type: 'FACT' });
    const saved = await this.supplierRepo.save(entity);
    return {
      ...toSupplierFields(saved),
      verification_status: await this.trustSvc.deriveVerificationStatus('SUPPLIER', saved.id),
    };
  }

  // SUPPLIER DIRECTORY Chunk 3 — also backs the public GET
  // /property-intelligence/suppliers/:id profile route; the admin addClaim
  // existence check just discards the extra verification_status field.
  async findSupplierById(id: string): Promise<SupplierSummary | null> {
    const entity = await this.supplierRepo.findOneBy({ id });
    if (!entity) return null;
    return {
      ...toSupplierFields(entity),
      verification_status: await this.trustSvc.deriveVerificationStatus('SUPPLIER', entity.id),
    };
  }

  // Paginated the same way searchContractors is: page/limit default and
  // clamp the same way, order alphabetically, getManyAndCount.
  // SUPPLIER DIRECTORY Chunk 3 — also backs the public GET
  // /property-intelligence/suppliers route (same delegation as GET /admin/suppliers).
  async searchSuppliers(params: {
    material_category?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<SupplierListResponse> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : DEFAULT_SUPPLIER_PAGE_SIZE;

    const qb = this.supplierRepo.createQueryBuilder('s');
    if (params.material_category) {
      // Same array-containment pattern as searchContractors' trade_category filter.
      qb.andWhere(':category = ANY(s.material_categories)', { category: params.material_category });
    }
    if (params.city) {
      // service_cities is multi-valued, same EXISTS/unnest membership test as
      // searchContractors' city filter.
      qb.andWhere('EXISTS (SELECT 1 FROM unnest(s.service_cities) AS sc WHERE LOWER(sc) = LOWER(:city))', {
        city: params.city,
      });
    }

    const [entities, total_count] = await qb
      .orderBy('s.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Same per-row TrustService derivation + Promise.all shape as searchContractors above.
    const suppliers = await Promise.all(
      entities.map(async (e) => ({
        ...toSupplierFields(e),
        verification_status: await this.trustSvc.deriveVerificationStatus('SUPPLIER', e.id),
      })),
    );

    return {
      suppliers,
      total_count,
      page,
      total_pages: Math.ceil(total_count / limit),
    };
  }

  // SUPPLIER DIRECTORY Chunk 2b — search-as-you-type by name, same shape and
  // ILike pattern as searchDevelopers above; powers the supplier picker on
  // the admin material-rate form (GET /v1/admin/suppliers/search?q=).
  async searchSuppliersByName(query: string): Promise<{ id: string; name: string }[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results = await this.supplierRepo.find({
      where: { name: ILike(`%${trimmed}%`) },
      order: { name: 'ASC' },
      take: SUPPLIER_SEARCH_LIMIT,
    });
    return results.map((s) => ({ id: s.id, name: s.name }));
  }

  // Batched name lookup for a known set of supplier IDs — powers
  // AdminService.listMaterialRates()'s supplier_name enrichment (GET
  // /v1/admin/material-rates): construction_intelligence's MaterialRateEntity
  // only carries a bare supplier_id UUID (Law 1: no cross-context FK), so the
  // name has to be resolved back here rather than joined at the DB level.
  // One query for the whole page of rates rather than one findSupplierById()
  // per row.
  async findSuppliersByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return [];
    const results = await this.supplierRepo.find({
      where: { id: In(ids) },
      select: ['id', 'name'],
    });
    return results.map((s) => ({ id: s.id, name: s.name }));
  }

  // Cross-module read (Law 9: public API call via the injected
  // ConstructionIntelligenceService, not a reach into construction_intelligence's
  // schema — same pattern as this service's TrustService calls elsewhere).
  // Powers the supplier profile page's "active material rate submissions" list.
  async findMaterialRatesBySupplierId(supplierId: string): Promise<MaterialRateResult[]> {
    return this.ciSvc.findRatesBySupplierId(supplierId);
  }

  // ─── HOUSE PLANS DIRECTORY Chunk 1 — Schema & Core Service ─────────────────
  // Standalone entity, organized the same way Developer/Contractor/Supplier
  // are (methods live directly on this service — no dedicated
  // HousePlanService). A directory catalog only; no payment or
  // full-resolution download.

  async createHousePlan(data: {
    title: string;
    area_marla: number;
    bedrooms: number;
    style: HousePlanStyle;
    preview_image_ref: string;
    description: string;
    contact_whatsapp: string;
    is_siraat_affiliated: boolean;
  }): Promise<HousePlanSummary> {
    const entity = this.housePlanRepo.create({ ...data, record_type: 'FACT' });
    const saved = await this.housePlanRepo.save(entity);
    return toHousePlanResult(saved);
  }

  async findHousePlanById(id: string): Promise<HousePlanSummary | null> {
    const entity = await this.housePlanRepo.findOneBy({ id });
    return entity ? toHousePlanResult(entity) : null;
  }

  // Paginated the same way searchContractors/searchSuppliers are: page/limit
  // default and clamp the same way, order alphabetically, getManyAndCount.
  async searchHousePlans(params: {
    area_marla_min?: number;
    area_marla_max?: number;
    bedrooms?: number;
    style?: string;
    page?: number;
    limit?: number;
  }): Promise<HousePlanListResponse> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : DEFAULT_HOUSE_PLAN_PAGE_SIZE;

    const qb = this.housePlanRepo.createQueryBuilder('h');
    if (params.area_marla_min != null) {
      qb.andWhere('h.area_marla >= :areaMin', { areaMin: params.area_marla_min });
    }
    if (params.area_marla_max != null) {
      qb.andWhere('h.area_marla <= :areaMax', { areaMax: params.area_marla_max });
    }
    if (params.bedrooms != null) {
      qb.andWhere('h.bedrooms = :bedrooms', { bedrooms: params.bedrooms });
    }
    if (params.style) {
      qb.andWhere('h.style = :style', { style: params.style });
    }

    const [entities, total_count] = await qb
      .orderBy('h.title', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      house_plans: entities.map(toHousePlanResult),
      total_count,
      page,
      total_pages: Math.ceil(total_count / limit),
    };
  }

  // Backs POST /v1/admin/house-plans/:id/upload-image — persists the storage
  // key returned by StorageService.uploadFile as this plan's preview_image_ref.
  async updateHousePlanPreviewImage(id: string, previewImageRef: string): Promise<void> {
    await this.housePlanRepo.update({ id }, { preview_image_ref: previewImageRef });
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — PATCH /v1/admin/house-plans/:id. Deliberately
  // excludes preview_image_ref from the update shape — that field is only
  // ever set by updateHousePlanPreviewImage above (the upload endpoint).
  // Returns null (not a thrown error) on a bad id — same convention as
  // findHousePlanById — so the 404 decision stays with the caller
  // (AdminService), which already owns every other NotFoundException in
  // this admin surface.
  async updateHousePlan(
    id: string,
    data: Partial<{
      title: string;
      area_marla: number;
      bedrooms: number;
      style: HousePlanStyle;
      description: string;
      contact_whatsapp: string;
      is_siraat_affiliated: boolean;
    }>,
  ): Promise<HousePlanSummary | null> {
    const entity = await this.housePlanRepo.findOneBy({ id });
    if (!entity) return null;
    Object.assign(entity, data);
    const saved = await this.housePlanRepo.save(entity);
    return toHousePlanResult(saved);
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — DELETE /v1/admin/house-plans/:id. Only
  // removes the catalog row — the stored preview image (if any) is cleaned
  // up by AdminService.deleteHousePlan, which owns StorageService and calls
  // this after that cleanup. Returns whether a row was actually deleted (not
  // a thrown error) so, again, the 404 decision stays with the caller.
  async deleteHousePlan(id: string): Promise<boolean> {
    const result = await this.housePlanRepo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  // ADMIN CRUD PHASE 1 Chunk 1 — Candidate Societies are a todo-list (the
  // original 146-list of known-but-not-yet-onboarded societies), with no
  // Verification claims or Observation history pointing at them — unlike
  // Society/Developer/Contractor/Supplier, plain update/delete is safe here.
  // Same null/boolean-on-miss convention as the House Plan methods above.

  async updateCandidateSociety(
    id: string,
    data: Partial<{
      name: string;
      regulator: CandidateSocietyEntity['regulator'];
      city: string;
      status: CandidateSocietyEntity['status'];
    }>,
  ): Promise<CandidateSocietyEntity | null> {
    const entity = await this.candidateRepo.findOneBy({ id });
    if (!entity) return null;
    Object.assign(entity, data);
    return this.candidateRepo.save(entity);
  }

  async deleteCandidateSociety(id: string): Promise<boolean> {
    const result = await this.candidateRepo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  // CLEANUP — consolidates CandidateSocietyEntity repository ownership onto
  // this service (was previously also directly injected into AdminService,
  // via AdminModule's own TypeOrmModule.forFeature registration). Backs GET
  // /v1/admin/candidate-societies — same optional-status-filter shape
  // AdminService.listCandidateSocieties had when it owned the repo directly.
  async listCandidateSocieties(status?: string): Promise<CandidateSocietyEntity[]> {
    if (status) {
      return this.candidateRepo.findBy({ status: status as CandidateSocietyEntity['status'] });
    }
    return this.candidateRepo.find();
  }

  // CLEANUP — same consolidation as listCandidateSocieties above. Backs
  // createSocietyWithFirstClaim's post-onboarding sync: marks the
  // CandidateSociety matching this exact name ONBOARDED, if one exists.
  // Returns whether a match was found (and marked) rather than the entity
  // itself, since the only caller needs just the boolean for its
  // candidate_marked_onboarded response field.
  async markCandidateSocietyOnboarded(name: string): Promise<boolean> {
    const candidate = await this.candidateRepo.findOneBy({ name });
    if (!candidate) return false;
    candidate.status = 'ONBOARDED';
    await this.candidateRepo.save(candidate);
    return true;
  }

  // ─── WATCHLIST Chunk 1 — Society Changes ───────────────────────────────────

  // Read side of this context's own Observation ledger — entityRefs here is
  // typically just [societyId], but kept array-shaped for symmetry with
  // TrustService.getObservationsSince and any future multi-entity_ref use.
  async getObservationsSince(entityRefs: string[], since: Date): Promise<ObservationEntity[]> {
    if (entityRefs.length === 0) return [];
    return this.observationRepo.find({
      where: { entity_ref: In(entityRefs), recorded_at: MoreThan(since) },
      order: { recorded_at: 'DESC' },
    });
  }

  // Given society IDs the browser's local watchlist is tracking, report what
  // changed since a given date. Aggregates across Property Intelligence's own
  // Observation ledger (direct Society changes) and Trust's (Verification
  // status changes for that Society's claims) — read via TrustService's public
  // API (Law 9: no reach into trust.observations directly), the same
  // cross-module pattern ScoringService already uses. Material rate
  // Observations are never included — they aren't Society-scoped.
  async getSocietyChangesSince(societyIds: string[], since: string): Promise<SocietyChangesResponse> {
    if (societyIds.length > MAX_CHANGES_BATCH_SIZE) {
      throw new BadRequestException(
        `Cannot check more than ${MAX_CHANGES_BATCH_SIZE} societies at once (received ${societyIds.length})`,
      );
    }

    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) {
      throw new BadRequestException(`'since' is not a valid date: ${since}`);
    }

    const changes = await Promise.all(
      societyIds.map((societyId) => this.buildSocietyChangeSummary(societyId, sinceDate)),
    );

    return { changes: changes.filter((c): c is SocietyChangeSummary => c !== null) };
  }

  private async buildSocietyChangeSummary(
    societyId: string,
    since: Date,
  ): Promise<SocietyChangeSummary | null> {
    const society = await this.societyRepo.findOneBy({ id: societyId });
    if (!society) return null; // Unknown society id — dropped from the batch, not an error.

    const ownObservations = await this.getObservationsSince([societyId], since);

    const verifications = await this.trustSvc.getVerifications('SOCIETY', societyId);
    const verificationIds = verifications.map((v) => v.verification.id);
    const trustObservations = await this.trustSvc.getObservationsSince(verificationIds, since);

    const observations = [...ownObservations, ...trustObservations]
      .sort((a, b) => b.recorded_at.getTime() - a.recorded_at.getTime())
      .map((o) => ({
        metric: o.metric,
        old_value: o.old_value,
        new_value: o.new_value,
        recorded_at: o.recorded_at.toISOString(),
      }));

    return {
      society_id: societyId,
      society_name: society.name,
      has_changes: observations.length > 0,
      observations,
    };
  }
}
