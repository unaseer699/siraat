import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GroundBlockSummary, GroundConditionsResponse } from '@siraat/shared-types';
import { GroundConditionFactEntity } from './entities/ground-condition-fact.entity';
import { SocietyEntity } from './entities/society.entity';
import { PropertyIntelligenceService, norm, resolveListingSociety, societyKeyOf } from './property-intelligence.service';

// A block's ground rarely changes year to year, so a report stays useful far
// longer than a plot price: stale after two years.
const STALENESS_DAYS = 730;
const MIN_REPORTS_FOR_FULL = 3;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

@Injectable()
export class GroundConditionService {
  private readonly logger = new Logger(GroundConditionService.name);

  constructor(
    @InjectRepository(GroundConditionFactEntity)
    private readonly factRepo: Repository<GroundConditionFactEntity>,
    @InjectRepository(SocietyEntity)
    private readonly societyRepo: Repository<SocietyEntity>,
    private readonly piSvc: PropertyIntelligenceService,
  ) {}

  // Called by the review flow on APPROVE only. Never updates an existing row.
  async createFact(data: {
    society_name_raw: string;
    block: string;
    plot_number: string | null;
    reporter_role: string;
    ground_condition: GroundConditionFactEntity['ground_condition'];
    soil_test_done: boolean;
    foundation_type: GroundConditionFactEntity['foundation_type'];
    foundation_depth_ft: number | null;
    extra_cost_lac: number | null;
    build_year: number | null;
    notes: string | null;
    evidence_count: number;
    source_ref: string;
  }): Promise<GroundConditionFactEntity> {
    let societyRef: string | null = null;
    try {
      societyRef = (await this.piSvc.findSocietyByNameFuzzy(data.society_name_raw))?.id ?? null;
    } catch (err) {
      this.logger.warn(`Society match failed for "${data.society_name_raw}": ${err instanceof Error ? err.message : String(err)}`);
    }
    const fact = this.factRepo.create({
      ...data,
      block: data.block.trim().toUpperCase(),
      society_ref: societyRef,
      is_siraat_affiliated: false,
      record_type: 'FACT',
      verified_at: new Date(),
    });
    return this.factRepo.save(fact);
  }

  // society_key = a Society id or `raw:<lowercased name>` (same keys the plot
  // listings use). Facts are matched at read time, so a report filed before
  // its Society was onboarded attaches as soon as it exists.
  async getForSociety(societyKey: string): Promise<GroundConditionsResponse> {
    const [facts, societies] = await Promise.all([
      this.factRepo.find(),
      this.societyRepo.find({ select: ['id', 'name'] }),
    ]);
    const mine = facts.filter((f) => societyKeyOf(f, resolveListingSociety(f, societies)) === societyKey);
    if (mine.length === 0) return { state: 'NOT_COVERED', society_key: societyKey, blocks: [] };

    const byBlock = new Map<string, GroundConditionFactEntity[]>();
    for (const f of mine) {
      const k = norm(f.block);
      byBlock.set(k, [...(byBlock.get(k) ?? []), f]);
    }
    const blocks = [...byBlock.values()]
      .map((rows) => this.summarize(rows))
      .sort((a, b) => a.block.localeCompare(b.block));
    return {
      state: blocks.some((b) => b.state === 'FULL') ? 'FULL' : 'DEGRADED_SUCCESS',
      society_key: societyKey,
      blocks,
    };
  }

  private summarize(rows: GroundConditionFactEntity[]): GroundBlockSummary {
    const n = rows.length;
    const count = (pred: (r: GroundConditionFactEntity) => boolean) => rows.filter(pred).length;
    const filled = count((r) => r.ground_condition === 'FILLED');
    const deep = count((r) => r.foundation_type === 'DEEP_STRIP' || r.foundation_type === 'PILING');
    const concerning = count(
      (r) => r.ground_condition === 'FILLED' || r.foundation_type === 'DEEP_STRIP' || r.foundation_type === 'PILING',
    );
    const depths = rows.map((r) => (r.foundation_depth_ft === null ? null : Number(r.foundation_depth_ft))).filter((x): x is number => x !== null);
    const costs = rows.map((r) => (r.extra_cost_lac === null ? null : Number(r.extra_cost_lac))).filter((x): x is number => x !== null);

    const newest = rows.reduce((m, r) => (r.verified_at > m ? r.verified_at : m), rows[0].verified_at);
    const ageDays = (Date.now() - newest.getTime()) / 86_400_000;
    const recency = ageDays <= 365 ? 1 : ageDays <= 1095 ? 0.7 : 0.4;

    const share = concerning / n;
    const risk = n < MIN_REPORTS_FOR_FULL ? null : share >= 0.5 ? 'HIGHER' : share >= 0.2 ? 'MODERATE' : 'LOWER';
    const affiliated = rows.some((r) => r.is_siraat_affiliated);

    return {
      block: rows[0].block.toUpperCase(),
      state: n >= MIN_REPORTS_FOR_FULL ? 'FULL' : 'DEGRADED_SUCCESS',
      report_count: n,
      solid_count: count((r) => r.ground_condition === 'SOLID'),
      filled_count: filled,
      mixed_count: count((r) => r.ground_condition === 'MIXED'),
      deep_foundation_count: deep,
      soil_test_count: count((r) => r.soil_test_done),
      evidence_report_count: count((r) => r.evidence_count > 0),
      extra_cost_report_count: costs.length,
      depth_ft_min: depths.length ? Math.min(...depths) : null,
      depth_ft_median: median(depths),
      depth_ft_max: depths.length ? Math.max(...depths) : null,
      extra_cost_lac_median: median(costs),
      reported_risk: risk,
      latest_report_year: newest.getFullYear(),
      record_type: 'GENERATED',
      derived_from: rows.map((r) => r.id),
      // More independent reports -> more confidence, discounted for age.
      // Affiliation never enters this number (Law 6).
      confidence_score: Math.round(Math.min(1, n / 10) * recency * 100) / 100,
      is_stale: ageDays > STALENESS_DAYS,
      staleness_threshold_days: STALENESS_DAYS,
      affiliation_disclosure: affiliated ? 'Includes one or more reports from a Siraat-affiliated source.' : null,
    };
  }
}
