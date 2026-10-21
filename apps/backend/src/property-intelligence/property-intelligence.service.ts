import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { normalizeSizeLabel, sizeCategory, sizeCategoryArea } from '../common/plot-size';
import { compactSocietyName, tidySocietyName } from '../common/society-name';
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
  HousePlanImage,
  HousePlanImageType,
  HousePlanAccessTier,
  PropertyListingSummary,
  PropertyListingListResponse,
  PropertyListingCountsResponse,
  PropertyPlotGroup,
  DealerProfile,
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
import { HousePlanImageEntity } from './entities/house-plan-image.entity';
import { CandidateSocietyEntity } from './entities/candidate-society.entity';
import { ObservationEntity } from './entities/observation.entity';
import { PropertyListingEntity } from './entities/property-listing.entity';

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
  // Registration details — optional so existing callers/mocks are unaffected.
  zone?: string | null;
  road?: string | null;
  area_kanal?: number | string | null;
  owner_name?: string | null;
  address?: string | null;
  contact_phones?: string[];
  email?: string | null;
  website?: string | null;
  details_source_url?: string | null;
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
    zone: e.zone ?? null,
    road: e.road ?? null,
    area_kanal: e.area_kanal === null || e.area_kanal === undefined ? null : Number(e.area_kanal),
    owner_name: e.owner_name ?? null,
    address: e.address ?? null,
    contact_phones: e.contact_phones ?? [],
    email: e.email ?? null,
    website: e.website ?? null,
    details_source_url: e.details_source_url ?? null,
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
    other_phones: e.other_phones ?? [],
    address: e.address ?? null,
    location_url: e.location_url ?? null,
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

function toHousePlanImageResult(e: HousePlanImageEntity): HousePlanImage {
  return {
    id: e.id,
    house_plan_id: e.house_plan_id,
    image_type: e.image_type,
    access_tier: e.access_tier,
    price: Number(e.price),
    display_order: e.display_order,
    has_file: Boolean(e.storage_ref),
    content_type: e.content_type,
  };
}

// ─── WHATSAPP LISTING INGESTION — pure helpers ──────────────────────────────

const DEFAULT_LISTING_STALE_DAYS = 7;

function listingStaleMs(): number {
  const days = Number(process.env.LISTING_STALE_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_LISTING_STALE_DAYS) * 24 * 60 * 60 * 1000;
}

// International digits for a Pakistani number: 0300-123 4567 / +92 300... /
// 92300... all normalize to 923001234567. Anything else is just its digits.
export function normalizeDealerPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
}

export function norm(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type SocietyRef = { id: string; name: string };

function toListingResult(
  e: PropertyListingEntity,
  society: SocietyRef | null = null,
  societyCity: string | null = null,
): PropertyListingSummary {
  const price = e.price_lac === null ? null : Number(e.price_lac);
  const size = e.size_marla === null ? null : Number(e.size_marla);
  return {
    id: e.id,
    society_ref: society?.id ?? e.society_ref,
    society_name: society?.name ?? null,
    society_name_raw: e.society_name_raw,
    city: societyCity ?? e.city,
    block: e.block,
    plot_number: e.plot_number,
    size_label: e.size_label,
    size_marla: size,
    price_lac: price,
    price_per_marla_lac: price !== null && size !== null && size > 0 ? round2(price / size) : null,
    status_raw: e.status_raw,
    contact_phone: e.contact_phone,
    dealer_key: normalizeDealerPhone(e.contact_phone),
    is_siraat_affiliated: e.is_siraat_affiliated,
    record_type: e.record_type,
    published_at: e.published_at.toISOString(),
    last_confirmed_at: e.last_confirmed_at.toISOString(),
    may_be_sold: Date.now() - e.last_confirmed_at.getTime() > listingStaleMs(),
    sold_at: e.sold_at ? e.sold_at.toISOString() : null,
    expires_at: e.expires_at.toISOString(),
  };
}

// Read-time Society resolution for a forwarded header like "Faisal hills":
// a stored society_ref wins; otherwise a case-insensitive containment match
// (either direction) against onboarded Society names. Longest matching name
// wins so "Faisal Hills Phase 2" beats "Faisal". Pure, so every read shares
// exactly one rule.
export function resolveListingSociety(
  listing: { society_ref: string | null; society_name_raw: string },
  societies: SocietyRef[],
): SocietyRef | null {
  if (listing.society_ref) {
    return societies.find((s) => s.id === listing.society_ref) ?? null;
  }
  const raw = norm(listing.society_name_raw);
  if (!raw) return null;
  let best: SocietyRef | null = null;
  for (const s of societies) {
    const name = norm(s.name);
    if (!name) continue;
    if (raw.includes(name) || name.includes(raw)) {
      if (!best || name.length > norm(best.name).length) best = s;
    }
  }
  return best;
}

// Society identity for grouping/filtering: the Society id when resolved,
// else `raw:<lowercased header>`. Matches PropertyListingFacets.society keys.
export function societyKeyOf(e: { society_name_raw: string }, society: SocietyRef | null): string {
  return society ? society.id : `raw:${compactSocietyName(e.society_name_raw)}`;
}

// One physical plot = society + block + plot number. Several dealers
// offering it are several offers under one key.
function plotKeyOf(e: PropertyListingEntity, society: SocietyRef | null): string {
  return `${societyKeyOf(e, society)}|${norm(e.block)}|${norm(e.plot_number)}`;
}

type ListingRow = { e: PropertyListingEntity; society: SocietyRef | null; city: string | null };

// Most common tidy spelling per society key, so "B 17", "B-17" and "B17"
// all read "B-17" wherever the society is shown.
function societyDisplayNames(rows: ListingRow[]): Map<string, string> {
  const tally = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = societyKeyOf(r.e, r.society);
    const name = r.society?.name ?? tidySocietyName(r.e.society_name_raw);
    const m = tally.get(key) ?? new Map<string, number>();
    m.set(name, (m.get(name) ?? 0) + 1);
    tally.set(key, m);
  }
  const out = new Map<string, string>();
  for (const [key, m] of tally) out.set(key, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return out;
}

function groupOffersIntoPlots(
  rows: ListingRow[],
  display: Map<string, string> = societyDisplayNames(rows),
): PropertyPlotGroup[] {
  const map = new Map<string, { e: PropertyListingEntity; society: SocietyRef | null; city: string | null; offers: PropertyListingSummary[] }>();
  for (const r of rows) {
    const key = plotKeyOf(r.e, r.society);
    const offer = toListingResult(r.e, r.society, r.city);
    const g = map.get(key);
    if (g) g.offers.push(offer);
    else map.set(key, { ...r, offers: [offer] });
  }

  return [...map.entries()].map(([key, g]) => {
    const prices = g.offers.map((o) => o.price_lac).filter((p): p is number => p !== null);
    const ppm = g.offers.map((o) => o.price_per_marla_lac).filter((p): p is number => p !== null);
    const sizes = g.offers.map((o) => o.size_marla).filter((x): x is number => x !== null);
    const lastConfirmed = g.offers.reduce((m, o) => (o.last_confirmed_at > m ? o.last_confirmed_at : m), g.offers[0].last_confirmed_at);
    // Cheapest offer first.
    const offers = [...g.offers].sort((x, y) => (x.price_lac ?? Infinity) - (y.price_lac ?? Infinity));
    return {
      key,
      society_ref: g.society?.id ?? g.e.society_ref,
      society_name: g.society?.name ?? null,
      society_name_raw: g.e.society_name_raw,
      society_key: societyKeyOf(g.e, g.society),
      society_display: display.get(societyKeyOf(g.e, g.society)) ?? tidySocietyName(g.e.society_name_raw),
      city: g.city ?? g.e.city,
      block: g.e.block,
      plot_number: g.e.plot_number,
      size_label: g.offers.find((o) => o.size_label)?.size_label ?? null,
      size_marla: sizes.length ? sizes[0] : null,
      size_category: sizeCategory(g.offers.find((o) => o.size_label)?.size_label ?? null, sizes.length ? sizes[0] : null),
      status_raw: g.offers.find((o) => o.status_raw)?.status_raw ?? null,
      min_price_lac: prices.length ? Math.min(...prices) : null,
      max_price_lac: prices.length ? Math.max(...prices) : null,
      min_price_per_marla_lac: ppm.length ? Math.min(...ppm) : null,
      last_confirmed_at: lastConfirmed,
      may_be_sold: g.offers.every((o) => o.may_be_sold),
      offers,
    };
  });
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
    @InjectRepository(HousePlanImageEntity)
    private readonly housePlanImageRepo: Repository<HousePlanImageEntity>,
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
    // WHATSAPP LISTING INGESTION
    @InjectRepository(PropertyListingEntity)
    private readonly listingRepo: Repository<PropertyListingEntity>,
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

  // WHATSAPP LISTING INGESTION — best-effort match of a forwarded, raw
  // society-header string (e.g. "Faisal hills") against the Society
  // directory, used only to populate PropertyListingEntity.society_ref/city
  // when publishing a draft listing. Deliberately loose (substring,
  // case-insensitive) rather than exact — unlike findSocietyByNameAndCity's
  // dedup check, a miss here is NOT an error: a forwarded listing is still
  // published with society_ref left null (see
  // WhatsappListingParsingService.publishDraft) rather than blocked on a
  // perfect match existing. Returns the first match if more than one; no
  // ranking beyond "found something." Kept to a single parameterized LIKE
  // (no CONCAT/reverse-direction OR) — a match attempt must never be the
  // thing that makes Publish fail.
  async findSocietyByNameFuzzy(nameRaw: string): Promise<SocietyResult | null> {
    const trimmed = nameRaw.trim();
    if (!trimmed) return null;

    const entity = await this.societyRepo
      .createQueryBuilder('s')
      .where('s.name ILIKE :pattern', { pattern: `%${trimmed}%` })
      .getOne();
    return entity ? toSocietyResult(entity) : null;
  }

  async findSocietyById(id: string): Promise<SocietyResult | null> {
    const entity = await this.societyRepo.findOneBy({ id });
    return entity ? toSocietyResult(entity) : null;
  }

  // ADMIN EDIT SOCIETY — PATCH /v1/admin/societies/:id. Editable: name, city,
  // price/area ranges, property types, NOC flag + summary, developer link.
  // Deliberately NOT editable here: confidence, affiliation, staleness (they
  // feed scoring/disclosure and must not change casually). Returns null on a
  // bad id so the 404 stays with the caller. A rename that would collide with
  // another society is blocked (same rule as createSociety). Every changed
  // field is logged as an append-only Observation (old -> new).
  async updateSociety(
    id: string,
    data: Partial<{
      name: string;
      city: string;
      min_price: number | null;
      max_price: number | null;
      min_area_marla: number | null;
      max_area_marla: number | null;
      property_types: string[];
      noc_approved: boolean;
      noc_summary: string | null;
      developer_id: string | null;
      zone: string | null;
      road: string | null;
      area_kanal: number | null;
      owner_name: string | null;
      address: string | null;
      contact_phones: string[];
      email: string | null;
      website: string | null;
      details_source_url: string | null;
    }>,
  ): Promise<SocietyResult | null> {
    const entity = await this.societyRepo.findOneBy({ id });
    if (!entity) return null;

    const nextName = data.name ?? entity.name;
    const nextCity = data.city ?? entity.city;
    if (nextName !== entity.name || nextCity !== entity.city) {
      const clash = await this.findSocietyByNameAndCity(nextName, nextCity);
      if (clash && clash.id !== id) {
        throw new BadRequestException(
          `A society named "${nextName}" already exists in ${nextCity} (id: ${clash.id}).`,
        );
      }
    }
    if (data.min_price != null && data.max_price != null && data.min_price > data.max_price) {
      throw new BadRequestException('Min price cannot be greater than max price');
    }
    if (data.min_area_marla != null && data.max_area_marla != null && data.min_area_marla > data.max_area_marla) {
      throw new BadRequestException('Min area cannot be greater than max area');
    }

    const norm = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      if (Array.isArray(v)) return v.join(',');
      return String(v);
    };
    const changes: { field: string; old: string | null; new: string | null }[] = [];
    const record = entity as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const before = norm(record[field]);
      const after = norm(value);
      const same =
        field.endsWith('price') || field.endsWith('marla') || field.endsWith('kanal')
          ? (before === null ? null : Number(before)) === (after === null ? null : Number(after))
          : before === after;
      if (same) continue;
      changes.push({ field, old: before, new: after });
      record[field] = value;
    }
    if (changes.length === 0) return toSocietyResult(entity);

    const saved = await this.societyRepo.save(entity);
    for (const c of changes) {
      void this.logObservation({
        entity_ref: id,
        metric: 'society_edit',
        old_value: c.old,
        new_value: c.new ?? '',
        source_ref: `Edited society ${id} (${c.field})`,
      });
    }
    return toSocietyResult(saved);
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
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<SocietyListResponse> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const qb = this.societyRepo.createQueryBuilder('s');
    if (params.city) {
      qb.andWhere('LOWER(s.city) = LOWER(:city)', { city: params.city });
    }
    // Optional name search. Ignores spaces, hyphens and commas so "b17" finds "B-17".
    const needle = (params.q ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (needle) {
      qb.andWhere("regexp_replace(LOWER(s.name), '[^a-z0-9]', '', 'g') LIKE :needle", { needle: `%${needle}%` });
    }

    const [entities, total_count] = await qb
      .orderBy('s.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Batched verification-status lookup — one query for the whole page
    // instead of one deriveVerificationStatus() call per row (see
    // TrustService.deriveVerificationStatuses' comment for why).
    const statusById = await this.trustSvc.deriveVerificationStatuses(
      'SOCIETY',
      entities.map((e) => e.id),
    );
    const societies = entities.map((e) => ({
      id: e.id,
      name: e.name,
      city: e.city,
      price_range: { min: e.min_price, max: e.max_price },
      area_range: { min: e.min_area_marla, max: e.max_area_marla },
      property_types: e.property_types,
      verification_status: statusById.get(e.id) ?? 'PENDING',
    }));

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

  // DUPLICATE PREVENTION — same reasoning as findSocietyByNameAndCity above:
  // a contractor directory entry is a nationwide identity, not scoped to one
  // city (service_cities is multi-valued), so an exact case-insensitive name
  // match is the right signal here. Returns null (never throws) on a blank
  // name.
  async findContractorByName(name: string): Promise<ContractorSummary | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const entity = await this.contractorRepo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:name)', { name: trimmed })
      .getOne();
    if (!entity) return null;
    return {
      ...toContractorFields(entity),
      verification_status: await this.trustSvc.deriveVerificationStatus('CONTRACTOR', entity.id),
    };
  }

  async createContractor(data: {
    name: string;
    trade_categories: TradeCategory[];
    service_cities: string[];
    contact_phone: string;
    contact_whatsapp: string | null;
    is_siraat_affiliated: boolean;
  }): Promise<ContractorSummary> {
    // Pre-data-population review finding #1 — Contractor had no dedup check
    // at all (only Society did). Same hard-block pattern as createSociety.
    const existing = await this.findContractorByName(data.name);
    if (existing) {
      throw new BadRequestException(
        `A contractor named "${data.name}" already exists (id: ${existing.id}). Use Add Claim on the existing record instead of creating a new one.`,
      );
    }

    const entity = this.contractorRepo.create({ ...data, record_type: 'FACT' });
    const saved = await this.contractorRepo.save(entity);
    return {
      ...toContractorFields(saved),
      verification_status: await this.trustSvc.deriveVerificationStatus('CONTRACTOR', saved.id),
    };
  }

  // Edits keep history: every changed field is logged as an Observation
  // (old and new value), the same way society edits are.
  private async applyDirectoryEdit(
    repoName: 'contractorRepo' | 'supplierRepo',
    metric: 'contractor_edit' | 'supplier_edit',
    id: string,
    data: Record<string, unknown>,
    findByName: (name: string) => Promise<{ id: string } | null>,
  ): Promise<Record<string, unknown> | null> {
    const repo = this[repoName] as unknown as { findOneBy: (w: object) => Promise<object | null>; save: (e: object) => Promise<object> };
    const entity = await repo.findOneBy({ id });
    if (!entity) return null;
    const record = entity as Record<string, unknown>;

    if (typeof data.name === 'string' && data.name.trim().toLowerCase() !== String(record.name).trim().toLowerCase()) {
      const clash = await findByName(data.name);
      if (clash && clash.id !== id) {
        throw new BadRequestException(`"${data.name}" already exists (id: ${clash.id}).`);
      }
    }
    const norm = (v: unknown): string | null => (v === null || v === undefined ? null : Array.isArray(v) ? v.join(',') : String(v));
    const changes: { field: string; old: string | null; new: string | null }[] = [];
    for (const [field, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const before = norm(record[field]);
      const after = norm(value);
      if (before === after) continue;
      changes.push({ field, old: before, new: after });
      record[field] = value;
    }
    if (changes.length === 0) return record;
    const saved = (await repo.save(entity)) as Record<string, unknown>;
    for (const c of changes) {
      void this.logObservation({ entity_ref: id, metric, old_value: c.old, new_value: c.new ?? '', source_ref: `Edited ${metric.split('_')[0]} ${id} (${c.field})` });
    }
    return saved;
  }

  async updateContractor(
    id: string,
    data: Partial<{ name: string; trade_categories: TradeCategory[]; service_cities: string[]; contact_phone: string; contact_whatsapp: string | null; is_siraat_affiliated: boolean }>,
  ): Promise<ContractorSummary | null> {
    const saved = await this.applyDirectoryEdit('contractorRepo', 'contractor_edit', id, data, (n) => this.findContractorByName(n));
    return saved ? this.findContractorById(id) : null;
  }

  async deleteContractor(id: string): Promise<boolean> {
    const result = await this.contractorRepo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async updateSupplier(
    id: string,
    data: Partial<{ name: string; material_categories: MaterialCategory[]; service_cities: string[]; contact_phone: string; contact_whatsapp: string | null; other_phones: string[]; address: string | null; location_url: string | null; is_siraat_affiliated: boolean }>,
  ): Promise<SupplierSummary | null> {
    const saved = await this.applyDirectoryEdit('supplierRepo', 'supplier_edit', id, data, (n) => this.findSupplierByName(n));
    return saved ? this.findSupplierById(id) : null;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const result = await this.supplierRepo.delete({ id });
    return (result.affected ?? 0) > 0;
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

    // Batched verification-status lookup — same reasoning as listSocieties above.
    const statusById = await this.trustSvc.deriveVerificationStatuses(
      'CONTRACTOR',
      entities.map((e) => e.id),
    );
    const contractors = entities.map((e) => ({
      ...toContractorFields(e),
      verification_status: statusById.get(e.id) ?? 'PENDING',
    }));

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

  // DUPLICATE PREVENTION — same reasoning as findContractorByName above.
  async findSupplierByName(name: string): Promise<SupplierSummary | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const entity = await this.supplierRepo
      .createQueryBuilder('s')
      .where('LOWER(s.name) = LOWER(:name)', { name: trimmed })
      .getOne();
    if (!entity) return null;
    return {
      ...toSupplierFields(entity),
      verification_status: await this.trustSvc.deriveVerificationStatus('SUPPLIER', entity.id),
    };
  }

  async createSupplier(data: {
    name: string;
    material_categories: MaterialCategory[];
    service_cities: string[];
    contact_phone: string;
    contact_whatsapp: string | null;
    other_phones?: string[];
    address?: string | null;
    location_url?: string | null;
    is_siraat_affiliated: boolean;
  }): Promise<SupplierSummary> {
    // Pre-data-population review finding #1 — Supplier had no dedup check
    // at all (only Society did). Same hard-block pattern as createSociety.
    const existing = await this.findSupplierByName(data.name);
    if (existing) {
      throw new BadRequestException(
        `A supplier named "${data.name}" already exists (id: ${existing.id}). Use Add Claim on the existing record instead of creating a new one.`,
      );
    }

    const entity = this.supplierRepo.create({ ...data, other_phones: data.other_phones ?? [], address: data.address ?? null, location_url: data.location_url ?? null, record_type: 'FACT' });
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
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<SupplierListResponse> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : DEFAULT_SUPPLIER_PAGE_SIZE;

    const qb = this.supplierRepo.createQueryBuilder('s');
    if (params.q && params.q.trim()) {
      qb.andWhere('s.name ILIKE :q', { q: `%${params.q.trim().replace(/[%_\\]/g, '\\$&')}%` });
    }
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

    // Batched verification-status lookup — same reasoning as listSocieties above.
    const statusById = await this.trustSvc.deriveVerificationStatuses(
      'SUPPLIER',
      entities.map((e) => e.id),
    );
    const suppliers = entities.map((e) => ({
      ...toSupplierFields(e),
      verification_status: statusById.get(e.id) ?? 'PENDING',
    }));

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

  // DUPLICATE PREVENTION — a house-plan title alone ("5 Marla Modern Home")
  // is too weak a signal to hard-block on (many genuinely different plans
  // share a generic title), so this matches on title + area + bedrooms +
  // style together — the same plan re-entered by a second admin, not just a
  // similarly-named one.
  async findHousePlanByTitleAndSpecs(
    title: string,
    areaMarla: number,
    bedrooms: number,
    style: HousePlanStyle,
  ): Promise<HousePlanSummary | null> {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const entity = await this.housePlanRepo
      .createQueryBuilder('h')
      .where('LOWER(h.title) = LOWER(:title)', { title: trimmed })
      .andWhere('h.area_marla = :area', { area: areaMarla })
      .andWhere('h.bedrooms = :bedrooms', { bedrooms })
      .andWhere('h.style = :style', { style })
      .getOne();
    return entity ? toHousePlanResult(entity) : null;
  }

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
    // Pre-data-population review finding #1 — HousePlan had no dedup check.
    const existing = await this.findHousePlanByTitleAndSpecs(data.title, data.area_marla, data.bedrooms, data.style);
    if (existing) {
      throw new BadRequestException(
        `A house plan titled "${data.title}" with the same area/bedrooms/style already exists (id: ${existing.id}).`,
      );
    }

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

  // ─── HOUSE PLAN GALLERY ────────────────────────────────────────────────
  // Same two-step shape as the single preview_image_ref: create the row
  // (type + tier + price) first, attach a file afterward via
  // updateHousePlanImageFile (the upload endpoint), same as
  // updateHousePlanPreviewImage above.

  async createHousePlanImage(
    housePlanId: string,
    data: { image_type: HousePlanImageType; access_tier: HousePlanAccessTier; price: number; display_order?: number },
  ): Promise<HousePlanImage> {
    const entity = this.housePlanImageRepo.create({
      house_plan_id: housePlanId,
      image_type: data.image_type,
      access_tier: data.access_tier,
      price: data.price,
      display_order: data.display_order ?? 0,
      storage_ref: null,
    });
    const saved = await this.housePlanImageRepo.save(entity);
    return toHousePlanImageResult(saved);
  }

  async listHousePlanImages(housePlanId: string): Promise<HousePlanImage[]> {
    const rows = await this.housePlanImageRepo.find({
      where: { house_plan_id: housePlanId },
      order: { display_order: 'ASC', created_at: 'ASC' },
    });
    return rows.map(toHousePlanImageResult);
  }

  async findHousePlanImageById(imageId: string): Promise<HousePlanImageEntity | null> {
    return this.housePlanImageRepo.findOneBy({ id: imageId });
  }

  async updateHousePlanImageFile(imageId: string, storageRef: string, contentType: string): Promise<void> {
    await this.housePlanImageRepo.update({ id: imageId }, { storage_ref: storageRef, content_type: contentType });
  }

  async updateHousePlanImageTier(
    imageId: string,
    data: Partial<{ access_tier: HousePlanAccessTier; price: number; display_order: number }>,
  ): Promise<HousePlanImage | null> {
    const entity = await this.housePlanImageRepo.findOneBy({ id: imageId });
    if (!entity) return null;
    Object.assign(entity, data);
    const saved = await this.housePlanImageRepo.save(entity);
    return toHousePlanImageResult(saved);
  }

  // Returns the deleted row's storage_ref (for the caller's bucket cleanup,
  // same orchestration pattern as AdminService.deleteHousePlan) or null if
  // no such row existed.
  async deleteHousePlanImage(imageId: string): Promise<{ deleted: boolean; storage_ref: string | null }> {
    const entity = await this.housePlanImageRepo.findOneBy({ id: imageId });
    if (!entity) return { deleted: false, storage_ref: null };
    await this.housePlanImageRepo.delete({ id: imageId });
    return { deleted: true, storage_ref: entity.storage_ref };
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

  // ─── WHATSAPP LISTING INGESTION ────────────────────────────────────────
  // Called only from WhatsappListingParsingService.publishDraft (Law 9:
  // public API call, same cross-module composition every other
  // WhatsappModule -> PropertyIntelligenceModule call in this file's own
  // history already uses).
  //
  // DEDUP: the same plot is forwarded repeatedly (several groups, several
  // days). An offer is "the same" when plot (society + block + number) AND
  // dealer phone match an active listing — then it is REFRESHED (latest
  // price/size/status, new last_confirmed_at, expiry pushed out) instead of
  // inserted again. A different dealer's offer on the same plot is a new
  // offer row, grouped with the others at read time.
  async createPropertyListing(data: {
    society_name_raw: string;
    block: string | null;
    plot_number: string;
    size_label: string | null;
    size_marla: number | null;
    price_lac: number | null;
    status_raw: string | null;
    contact_phone: string | null;
    source_ref: string;
    expires_at: Date;
  }): Promise<{ listing: PropertyListingSummary; outcome: 'CREATED' | 'REFRESHED'; is_new_plot: boolean }> {
    // Never let the match attempt block the publish itself — same
    // "a nice-to-have enrichment must not take down the primary action"
    // discipline as logObservation's own try/catch above.
    let matchedSociety: SocietyResult | null = null;
    try {
      matchedSociety = await this.findSocietyByNameFuzzy(data.society_name_raw);
    } catch (err) {
      this.logger.warn(
        `Society fuzzy-match failed for "${data.society_name_raw}" — publishing with society_ref left null: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const societies = await this.societyRepo.find({ select: ['id', 'name'] });
    const candidate = this.listingRepo.create({
      ...data,
      society_ref: matchedSociety?.id ?? null,
      city: matchedSociety?.city ?? null,
      is_siraat_affiliated: false,
      record_type: 'FACT',
      published_at: new Date(),
      last_confirmed_at: new Date(),
      sold_at: null,
    });
    const candidateKey = plotKeyOf(candidate, resolveListingSociety(candidate, societies));
    const candidatePhone = normalizeDealerPhone(data.contact_phone);

    const samePlotRows = await this.listingRepo
      .createQueryBuilder('l')
      .where('l.plot_number = :plot', { plot: data.plot_number })
      .andWhere('l.sold_at IS NULL')
      .andWhere('l.expires_at > :now', { now: new Date() })
      .getMany();

    const samePlot = samePlotRows.filter((r) => plotKeyOf(r, resolveListingSociety(r, societies)) === candidateKey);
    const sameOffer = samePlot.find((r) => normalizeDealerPhone(r.contact_phone) === candidatePhone);

    if (sameOffer) {
      sameOffer.price_lac = data.price_lac;
      sameOffer.size_label = data.size_label ?? sameOffer.size_label;
      sameOffer.size_marla = data.size_marla ?? sameOffer.size_marla;
      sameOffer.status_raw = data.status_raw ?? sameOffer.status_raw;
      sameOffer.contact_phone = data.contact_phone ?? sameOffer.contact_phone;
      sameOffer.last_confirmed_at = new Date();
      sameOffer.expires_at = data.expires_at;
      const refreshed = await this.listingRepo.save(sameOffer);
      return {
        listing: toListingResult(refreshed, resolveListingSociety(refreshed, societies)),
        outcome: 'REFRESHED',
        is_new_plot: false,
      };
    }

    const saved = await this.listingRepo.save(candidate);
    return {
      listing: toListingResult(saved, resolveListingSociety(saved, societies)),
      outcome: 'CREATED',
      is_new_plot: samePlot.length === 0,
    };
  }

  // Active = not sold and inside the auto-expiry window. An expired/sold row
  // is never deleted, just no longer returned (never-delete convention).
  private async loadActiveListings() {
    const [entities, societies] = await Promise.all([
      this.listingRepo
        .createQueryBuilder('l')
        .where('l.expires_at > :now', { now: new Date() })
        .andWhere('l.sold_at IS NULL')
        .orderBy('l.last_confirmed_at', 'DESC')
        .getMany(),
      this.societyRepo.find({ select: ['id', 'name', 'city'] }),
    ]);
    const cityById = new Map(societies.map((s) => [s.id, s.city]));
    const rows = entities.map((e) => {
      const society = resolveListingSociety(e, societies);
      return { e, society, city: society ? cityById.get(society.id) ?? null : e.city };
    });
    return { rows, societies };
  }

  // GET /v1/property-intelligence/listings
  //
  // Society linkage is resolved at READ time (resolveListingSociety), not just
  // from the stored society_ref: daily inventory routinely arrives before its
  // Society is onboarded, and those listings must attach themselves the moment
  // it is. Filtering therefore happens in memory after resolution. That is
  // deliberate at this scale (a 14-day window of forwarded inventory is
  // hundreds of rows, not millions); revisit with a SQL-side join if it grows.
  async listActivePropertyListings(params: {
    city?: string;
    society_id?: string;
    max_price_lac?: number;
    size?: string;
    min_size_marla?: number;
    max_size_marla?: number;
  }): Promise<PropertyListingListResponse> {
    const { rows } = await this.loadActiveListings();
    const wantCity = params.city?.trim().toLowerCase();
    const wantSize = sizeCategory(params.size) ?? undefined;
    const wantSociety = params.society_id?.startsWith('raw:') ? `raw:${compactSocietyName(params.society_id.slice(4))}` : params.society_id;

    // Facets are built from EVERY active plot, before any filter, and count
    // distinct plots (not offers). Spellings of one society and sizes sold
    // under one name (25x50 = 5 Marla) are merged into one option.
    const display = societyDisplayNames(rows);
    const allPlots = groupOffersIntoPlots(rows, display);
    const facetCities = new Set<string>();
    const facetSocieties = new Map<string, { key: string; name: string; count: number }>();
    const facetSizes = new Map<string, { count: number; aliases: Set<string> }>();
    for (const g of allPlots) {
      if (g.city) facetCities.add(g.city);
      if (g.size_category) {
        const f = facetSizes.get(g.size_category) ?? { count: 0, aliases: new Set<string>() };
        f.count += 1;
        if (g.size_label && g.size_label !== g.size_category) f.aliases.add(g.size_label);
        facetSizes.set(g.size_category, f);
      }
      const key = g.society_key;
      const f = facetSocieties.get(key) ?? { key, name: g.society_name ?? g.society_display, count: 0 };
      f.count += 1;
      facetSocieties.set(key, f);
    }

    // `society_id` is a Society id, or `raw:<lowercased name>` for inventory
    // whose Society isn't onboarded yet (see PropertyListingFacets).
    const filtered = rows.filter(({ e, society, city }) => {
      if (wantSociety && societyKeyOf(e, society) !== wantSociety) return false;
      if (wantCity && city?.toLowerCase() !== wantCity) return false;
      if (wantSize && sizeCategory(e.size_label, e.size_marla === null ? null : Number(e.size_marla)) !== wantSize) return false;
      const price = e.price_lac === null ? null : Number(e.price_lac);
      const size = e.size_marla === null ? null : Number(e.size_marla);
      if (params.max_price_lac != null && (price === null || price > params.max_price_lac)) return false;
      if (params.min_size_marla != null && (size === null || size < params.min_size_marla)) return false;
      if (params.max_size_marla != null && (size === null || size > params.max_size_marla)) return false;
      return true;
    });

    const plots = groupOffersIntoPlots(filtered, display);
    return {
      listings: filtered.map((r) => toListingResult(r.e, r.society, r.city)),
      plots,
      total_count: plots.length,
      facets: {
        cities: [...facetCities].sort(),
        societies: [...facetSocieties.values()].sort((x, y) => x.name.localeCompare(y.name)),
        sizes: [...facetSizes.entries()]
          .map(([label, f]) => ({ label, count: f.count, aliases: [...f.aliases].sort() }))
          .sort((x, y) => sizeCategoryArea(x.label) - sizeCategoryArea(y.label)),
      },
    };
  }

  // GET /v1/property-intelligence/listings/counts — Browse card badges
  // (distinct PLOTS per society, not offers).
  async countActivePropertyListingsBySociety(): Promise<PropertyListingCountsResponse> {
    const { rows } = await this.loadActiveListings();
    const counts: Record<string, number> = {};
    for (const g of groupOffersIntoPlots(rows)) {
      if (g.society_ref) counts[g.society_ref] = (counts[g.society_ref] ?? 0) + 1;
    }
    return { counts };
  }

  // GET /v1/property-intelligence/listings/dealer/:key — a dealer's public
  // track record, keyed by normalized phone. Counts ALL their offers ever
  // (including sold/expired) so reliability isn't just "what's live now".
  async getDealerProfile(rawKey: string): Promise<DealerProfile | null> {
    const key = normalizeDealerPhone(rawKey);
    if (!key) return null;
    const variants = [key, key.startsWith('92') ? `0${key.slice(2)}` : key];

    const all = await this.listingRepo
      .createQueryBuilder('l')
      .where("regexp_replace(l.contact_phone, '[^0-9]', '', 'g') IN (:...variants)", { variants })
      .orderBy('l.published_at', 'ASC')
      .getMany();
    if (all.length === 0) return null;

    const societies = await this.societyRepo.find({ select: ['id', 'name', 'city'] });
    const cityById = new Map(societies.map((s) => [s.id, s.city]));
    const now = Date.now();
    const activeRows = all
      .filter((e) => !e.sold_at && e.expires_at.getTime() > now)
      .map((e) => {
        const society = resolveListingSociety(e, societies);
        return { e, society, city: society ? cityById.get(society.id) ?? null : e.city };
      });

    return {
      dealer_key: key,
      contact_phone: all[all.length - 1].contact_phone ?? key,
      active_plots: groupOffersIntoPlots(activeRows),
      total_published: all.length,
      sold_count: all.filter((e) => e.sold_at).length,
      reconfirmed_count: all.filter((e) => e.last_confirmed_at.getTime() - e.published_at.getTime() > 24 * 60 * 60 * 1000).length,
      first_seen_at: all[0].published_at.toISOString(),
      last_confirmed_at: new Date(Math.max(...all.map((e) => e.last_confirmed_at.getTime()))).toISOString(),
    };
  }

  // Admin: every offer, newest first, optionally only live ones — so an
  // admin can mark a plot sold.
  async listPropertyListingsForAdmin(onlyActive: boolean): Promise<PropertyListingSummary[]> {
    const qb = this.listingRepo.createQueryBuilder('l').orderBy('l.last_confirmed_at', 'DESC').limit(500);
    if (onlyActive) {
      qb.where('l.sold_at IS NULL').andWhere('l.expires_at > :now', { now: new Date() });
    }
    const [entities, societies] = await Promise.all([qb.getMany(), this.societyRepo.find({ select: ['id', 'name', 'city'] })]);
    const cityById = new Map(societies.map((s) => [s.id, s.city]));
    return entities.map((e) => {
      const society = resolveListingSociety(e, societies);
      return toListingResult(e, society, society ? cityById.get(society.id) ?? null : e.city);
    });
  }

  // Marks the WHOLE PLOT sold (every dealer's offer on it), not just the one
  // row clicked — a plot is sold or it isn't, whoever listed it.
  async markPlotSold(listingId: string): Promise<{ marked: number } | null> {
    const target = await this.listingRepo.findOneBy({ id: listingId });
    if (!target) return null;
    const societies = await this.societyRepo.find({ select: ['id', 'name'] });
    const key = plotKeyOf(target, resolveListingSociety(target, societies));

    const sameNumber = await this.listingRepo.find({ where: { plot_number: target.plot_number } });
    const ids = sameNumber
      .filter((r) => !r.sold_at && plotKeyOf(r, resolveListingSociety(r, societies)) === key)
      .map((r) => r.id);
    if (ids.length === 0) return { marked: 0 };
    await this.listingRepo.update({ id: In(ids) }, { sold_at: new Date() });
    return { marked: ids.length };
  }

  // Used by a forwarder's "SOLD 7473 7915" WhatsApp message. A bare plot
  // number can legitimately exist in several societies; if a number matches
  // more than one distinct active PLOT it is reported ambiguous and left
  // alone rather than guessed at (marking the wrong plot sold hides a real
  // listing).
  async markPlotsSoldByNumber(numbers: string[]): Promise<{ marked: string[]; ambiguous: string[]; not_found: string[] }> {
    const result = { marked: [] as string[], ambiguous: [] as string[], not_found: [] as string[] };
    const societies = await this.societyRepo.find({ select: ['id', 'name'] });
    for (const n of [...new Set(numbers)]) {
      const rows = await this.listingRepo
        .createQueryBuilder('l')
        .where('l.plot_number = :n', { n })
        .andWhere('l.sold_at IS NULL')
        .andWhere('l.expires_at > :now', { now: new Date() })
        .getMany();
      const keys = new Set(rows.map((r) => plotKeyOf(r, resolveListingSociety(r, societies))));
      if (rows.length === 0) result.not_found.push(n);
      else if (keys.size > 1) result.ambiguous.push(n);
      else {
        await this.listingRepo.update({ id: In(rows.map((r) => r.id)) }, { sold_at: new Date() });
        result.marked.push(n);
      }
    }
    return result;
  }
}
