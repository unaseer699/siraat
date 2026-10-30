import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PublicProjectEntity, type ProjectStatus } from './entities/public-project.entity';
import { ProjectStatusEventEntity } from './entities/project-status-event.entity';
import { NewsReportEntity } from './entities/news-report.entity';
import { FEEDS, fetchFeed } from './news-feed';
import { classify, matchProjects } from './relevance';

export const STALENESS_THRESHOLD_DAYS = 3;

const DISCLAIMER =
  'Information gathered from official pages and from headlines of ARY, Geo and APP. It is not advice to buy and Siraat has not checked these projects unless a card says so. Dates often move: check the source yourself before you invest.';

export interface RefreshSummary {
  feeds_ok: number;
  feeds_failed: string[];
  headlines_seen: number;
  relevant: number;
  inserted: number;
}

@Injectable()
export class PublicProjectsService {
  private readonly logger = new Logger(PublicProjectsService.name);

  constructor(
    @InjectRepository(PublicProjectEntity) private readonly projects: Repository<PublicProjectEntity>,
    @InjectRepository(ProjectStatusEventEntity) private readonly events: Repository<ProjectStatusEventEntity>,
    @InjectRepository(NewsReportEntity) private readonly reports: Repository<NewsReportEntity>,
  ) {}

  async list(opts: { category?: string; q?: string }) {
    const all = await this.projects.find({ where: { is_active: true }, order: { created_at: 'ASC' } });
    const q = opts.q?.trim().toLowerCase();
    const picked = all.filter(
      (p) =>
        (!opts.category || p.category === opts.category) &&
        (!q || `${p.name} ${p.region} ${p.summary}`.toLowerCase().includes(q)),
    );

    const ids = picked.map((p) => p.id);
    const events = ids.length
      ? await this.events.find({ where: { project_id: In(ids) }, order: { event_date: 'DESC', created_at: 'DESC' } })
      : [];
    const recent = await this.reports.find({ order: { published_at: 'DESC' }, take: 400 });

    const projects = picked.map((p) => {
      const history = events.filter((e) => e.project_id === p.id);
      const latest = history[0] ?? null;
      const target = history.find((e) => e.target_date)?.target_date ?? p.original_target;
      const delayDays =
        p.original_target && target ? Math.max(0, Math.round((Date.parse(target) - Date.parse(p.original_target)) / 86400000)) : 0;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category,
        region: p.region,
        province: p.province,
        agencies: p.agencies,
        summary: p.summary,
        cost_pkr_bn: p.cost_pkr_bn === null ? null : Number(p.cost_pkr_bn),
        status: (latest?.status ?? 'PLANNED') as ProjectStatus,
        status_note: latest?.note ?? null,
        status_date: latest?.event_date ?? null,
        original_target: p.original_target,
        current_target: target,
        delay_days: delayDays,
        source_url: p.source_url,
        source_kind: p.source_kind,
        history: history.map((e) => ({
          status: e.status,
          event_date: e.event_date,
          target_date: e.target_date,
          note: e.note,
          source_url: e.source_url,
          source_kind: e.source_kind,
        })),
        reports: recent
          .filter((r) => r.project_ids.includes(p.id))
          .slice(0, 3)
          .map((r) => this.toReport(r)),
      };
    });

    const latestFetch = recent.reduce<Date | null>((m, r) => (!m || r.fetched_at > m ? r.fetched_at : m), null);
    const ageDays = latestFetch ? (Date.now() - latestFetch.getTime()) / 86400000 : null;
    return {
      state: projects.length > 0 ? ('FULL' as const) : ('NOT_COVERED' as const),
      projects,
      latest_reports: recent.slice(0, 20).map((r) => this.toReport(r)),
      last_refreshed_at: latestFetch ? latestFetch.toISOString() : null,
      is_stale: ageDays === null || ageDays > STALENESS_THRESHOLD_DAYS,
      staleness_threshold_days: STALENESS_THRESHOLD_DAYS,
      disclaimer: DISCLAIMER,
    };
  }

  private toReport(r: NewsReportEntity) {
    return { outlet: r.outlet, title: r.title, url: r.url, published_at: r.published_at ? r.published_at.toISOString() : null };
  }

  async addStatusEvent(
    slug: string,
    e: { status: ProjectStatus; event_date: string; target_date?: string | null; note?: string | null; source_url: string; source_kind?: 'OFFICIAL' | 'MEDIA' },
  ) {
    const project = await this.projects.findOne({ where: { slug } });
    if (!project) throw new NotFoundException(`No project ${slug}`);
    // Append-only: a correction is a new event, history is never overwritten.
    await this.events
      .createQueryBuilder()
      .insert()
      .values({ project_id: project.id, status: e.status, event_date: e.event_date, target_date: e.target_date ?? null, note: e.note ?? null, source_url: e.source_url, source_kind: e.source_kind ?? 'MEDIA' })
      .orIgnore()
      .execute();
    return { ok: true };
  }

  // Daily job. Writes only to market_intelligence tables. One bad feed never
  // stops the others.
  async refreshNews(): Promise<RefreshSummary> {
    const summary: RefreshSummary = { feeds_ok: 0, feeds_failed: [], headlines_seen: 0, relevant: 0, inserted: 0 };
    const projs = await this.projects.find({ where: { is_active: true } });
    const seen = new Set<string>();

    for (const feed of FEEDS) {
      try {
        const items = await fetchFeed(feed);
        summary.feeds_ok += 1;
        summary.headlines_seen += items.length;
        const rows = items
          .filter((i) => !seen.has(i.url) && seen.add(i.url))
          .map((i) => ({ item: i, topics: classify(i.title) }))
          .filter((x) => x.topics.length > 0)
          .map(({ item, topics }) => ({
            outlet: feed.outlet,
            title: item.title.slice(0, 500),
            url: item.url,
            published_at: item.published_at,
            topics,
            project_ids: matchProjects(item.title, projs),
          }));
        summary.relevant += rows.length;
        if (rows.length) {
          const res = await this.reports.createQueryBuilder().insert().values(rows).orIgnore().execute();
          summary.inserted += res.identifiers.filter(Boolean).length;
        }
      } catch (err) {
        summary.feeds_failed.push(`${feed.url}: ${err instanceof Error ? err.message : String(err)}`);
        this.logger.warn(`Feed failed ${feed.url}: ${err instanceof Error ? err.message : err}`);
      }
    }
    this.logger.log(`News refresh: ${JSON.stringify({ ...summary, feeds_failed: summary.feeds_failed.length })}`);
    return summary;
  }
}
