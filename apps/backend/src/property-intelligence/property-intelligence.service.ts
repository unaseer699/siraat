import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import type { ParsedIntent } from '@siraat/shared-types';
import type {
  PropertyDetail,
  DeveloperProfile,
  DeveloperStats,
  SocietyListResponse,
  SocietyChangesResponse,
  SocietyChangeSummary,
} from '@siraat/shared-types';
import { TrustService } from '../trust/trust.service';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';
import { ObservationEntity } from './entities/observation.entity';

// Watchlist Chunk 1: caps how many societies /societies/changes will check in one
// request — an unbounded society_ids[] would mean an unbounded fan-out of per-society
// Trust calls below. Rejected outright with a clear error rather than silently truncated.
const MAX_CHANGES_BATCH_SIZE = 20;

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
  private readonly logger = new Logger(PropertyIntelligenceService.name);

  constructor(
    @InjectRepository(SocietyEntity)
    private readonly societyRepo: Repository<SocietyEntity>,
    @InjectRepository(PropertyEntity)
    private readonly propertyRepo: Repository<PropertyEntity>,
    @InjectRepository(DeveloperEntity)
    private readonly developerRepo: Repository<DeveloperEntity>,
    @InjectRepository(ObservationEntity)
    private readonly observationRepo: Repository<ObservationEntity>,
    private readonly trustSvc: TrustService,
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

  // ─── DEVELOPER PROFILE Chunk 1 ──────────────────────────────────────────────

  // linked_societies is always [] — no data path currently associates a Developer
  // with specific Societies (SocietyEntity has no developer_id field; flagged and
  // deferred during the navigation audit). Do not infer/guess this association;
  // populate it only once it actually exists in the data model.
  async getDeveloperStats(id: string): Promise<DeveloperStats | null> {
    const dev = await this.developerRepo.findOneBy({ id });
    if (!dev) return null;

    const [verification_status, verifications] = await Promise.all([
      this.trustSvc.deriveVerificationStatus('DEVELOPER', id),
      this.trustSvc.getVerifications('DEVELOPER', id),
    ]);

    const evidence_count = verifications.reduce((sum, v) => sum + v.evidence.length, 0);

    return {
      developer_id: dev.id,
      developer_name: dev.name,
      verification_status,
      project_history: dev.project_history,
      linked_societies: [],
      evidence_count,
      is_siraat_affiliated: dev.is_siraat_affiliated,
    };
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
