import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import type {
  UnapprovedScheme,
  UnapprovedSchemeListResponse,
  UnapprovedSchemeCheckResponse,
} from '@siraat/shared-types';
import { IllegalSchemeEntity } from './entities/illegal-scheme.entity';
import { matchScheme } from './illegal-scheme-match';

export const UNAPPROVED_STALENESS_DAYS = 90;

export const UNAPPROVED_DISCLAIMER =
  'This is the regulator\'s own published list of schemes without an approved layout plan or NOC. ' +
  'It is not a Siraat finding, may be out of date, and a name missing from it does not mean a scheme is approved. ' +
  'Confirm with CDA before buying.';

function toDto(e: IllegalSchemeEntity): UnapprovedScheme {
  return {
    id: e.id,
    name: e.name,
    location: e.location,
    regulator: e.regulator,
    city: e.city,
    source_url: e.source_url,
    listed_as_of: e.listed_as_of,
  };
}

export function isListStale(listedAsOf: string | null, now = new Date()): boolean {
  if (!listedAsOf) return false;
  const ms = now.getTime() - new Date(listedAsOf).getTime();
  return ms > UNAPPROVED_STALENESS_DAYS * 86_400_000;
}

@Injectable()
export class IllegalSchemesService {
  constructor(
    @InjectRepository(IllegalSchemeEntity)
    private readonly repo: Repository<IllegalSchemeEntity>,
  ) {}

  private async latestListedAsOf(): Promise<{ listed_as_of: string | null; source_url: string | null }> {
    const latest = await this.repo.findOne({ where: { is_active: true }, order: { listed_as_of: 'DESC' } });
    return { listed_as_of: latest?.listed_as_of ?? null, source_url: latest?.source_url ?? null };
  }

  async list(params: { q?: string; page?: number; limit?: number }): Promise<UnapprovedSchemeListResponse> {
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
    const page = Math.max(params.page ?? 1, 1);
    const q = params.q?.trim();
    const like = q ? ILike(`%${q.replace(/[%_]/g, '')}%`) : null;
    const [rows, total] = await this.repo.findAndCount({
      where: like
        ? [
            { is_active: true, name: like },
            { is_active: true, location: like },
          ]
        : { is_active: true },
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const meta = await this.latestListedAsOf();
    return {
      state: total > 0 ? 'FULL' : 'NOT_COVERED',
      schemes: rows.map(toDto),
      total_count: total,
      page,
      total_pages: Math.max(Math.ceil(total / limit), 1),
      listed_as_of: meta.listed_as_of,
      source_url: meta.source_url,
      is_stale: isListStale(meta.listed_as_of),
      staleness_threshold_days: UNAPPROVED_STALENESS_DAYS,
      disclaimer: UNAPPROVED_DISCLAIMER,
    };
  }

  async check(name: string): Promise<UnapprovedSchemeCheckResponse> {
    const all = await this.repo.find({ where: { is_active: true } });
    const exact: IllegalSchemeEntity[] = [];
    const similar: IllegalSchemeEntity[] = [];
    for (const e of all) {
      const m = matchScheme(name, e.name);
      if (m === 'EXACT') exact.push(e);
      else if (m === 'SIMILAR') similar.push(e);
    }
    const hits = exact.length > 0 ? exact : similar;
    const meta = await this.latestListedAsOf();
    return {
      state: 'FULL',
      match: exact.length > 0 ? 'EXACT' : similar.length > 0 ? 'SIMILAR' : 'NONE',
      matches: hits.slice(0, 5).map(toDto),
      listed_as_of: meta.listed_as_of,
      source_url: meta.source_url,
      is_stale: isListStale(meta.listed_as_of),
      staleness_threshold_days: UNAPPROVED_STALENESS_DAYS,
      disclaimer: UNAPPROVED_DISCLAIMER,
    };
  }
}
