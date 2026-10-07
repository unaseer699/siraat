import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { MarketRateQuoteEntity } from './entities/market-rate-quote.entity';
import { MarketRateBaselineEntity } from './entities/market-rate-baseline.entity';
import { MARKET_RATE_ITEMS, MarketRateItem } from './market-rate-catalog';

export interface CurrentMarketRate {
  key: string;
  label: string;
  unit: string;
  rate: number;
  rate_date: string;
  carried_forward: boolean;
  age_days: number;
  // FACT id of the quote this value comes from (derived_from for a carried one).
  quote_id: string;
}

export interface RateBaseline {
  key: string;
  rate: number | null;
  source: 'REFERENCE' | 'FIRST_QUOTE' | 'ADMIN' | null;
  set_date: string | null;
}

export interface DailyRateRow {
  date: string;
  rates: Record<string, { rate: number; carried_forward: boolean; quote_id: string } | null>;
}

export function todayInKarachi(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

@Injectable()
export class MarketRateService {
  constructor(
    @InjectRepository(MarketRateQuoteEntity)
    private readonly repo: Repository<MarketRateQuoteEntity>,
    @Optional()
    @InjectRepository(MarketRateBaselineEntity)
    private readonly baseRepo?: Repository<MarketRateBaselineEntity>,
  ) {}

  // Baseline per item: the reference-house rate where known, otherwise the
  // stored first-quote / admin figure.
  async baselines(): Promise<Record<string, RateBaseline>> {
    let rows: MarketRateBaselineEntity[] = [];
    try {
      rows = (await this.baseRepo?.find()) ?? [];
    } catch {
      rows = [];
    }
    const out: Record<string, RateBaseline> = {};
    for (const item of MARKET_RATE_ITEMS) {
      const row = rows.find((r) => r.item_key === item.key);
      if (row) out[item.key] = { key: item.key, rate: Number(row.rate), source: row.source, set_date: row.set_date };
      else if (item.ref_rate !== null) out[item.key] = { key: item.key, rate: item.ref_rate, source: 'REFERENCE', set_date: null };
      else out[item.key] = { key: item.key, rate: null, source: null, set_date: null };
    }
    return out;
  }

  async setBaseline(item: MarketRateItem, rate: number, setDate: string = todayInKarachi()): Promise<void> {
    if (!this.baseRepo) return;
    await this.baseRepo.save(this.baseRepo.create({ item_key: item.key, rate, source: 'ADMIN', set_date: setDate }));
  }

  // The latest ACTIVE quote strictly before `date`, used to reject typos.
  async previousRate(itemKey: string, date: string): Promise<number | null> {
    const q = await this.repo.findOne({
      where: { item_key: itemKey, status: 'ACTIVE', rate_date: LessThanOrEqual(addDays(date, -1)) },
      order: { rate_date: 'DESC', created_at: 'DESC' },
    });
    return q ? Number(q.rate) : null;
  }

  // Records one quote. A second quote for the same item and date supersedes
  // the first (the old row becomes CORRECTED); returns the previous rate so a
  // caller can show the change.
  async recordQuote(input: {
    rate_date: string;
    item: MarketRateItem;
    rate: number;
    source: 'WHATSAPP' | 'ADMIN';
    source_ref?: string | null;
  }): Promise<{ quote: MarketRateQuoteEntity; previous_rate: number | null }> {
    const prior = await this.repo.findOne({
      where: { item_key: input.item.key, rate_date: input.rate_date, status: 'ACTIVE' },
    });
    const before = await this.repo.findOne({
      where: { item_key: input.item.key, rate_date: LessThanOrEqual(addDays(input.rate_date, -1)), status: 'ACTIVE' },
      order: { rate_date: 'DESC', created_at: 'DESC' },
    });
    const quote = await this.repo.manager.transaction(async (m) => {
      if (prior) await m.update(MarketRateQuoteEntity, { id: prior.id }, { status: 'CORRECTED' });
      return m.save(
        m.create(MarketRateQuoteEntity, {
          rate_date: input.rate_date,
          item_key: input.item.key,
          rate: input.rate,
          unit: input.item.unit,
          source: input.source,
          source_ref: input.source_ref ?? null,
          status: 'ACTIVE',
          supersedes_id: prior?.id ?? null,
          record_type: 'FACT',
        }),
      );
    });
    if (input.item.ref_rate === null && this.baseRepo) {
      try {
        if (!(await this.baseRepo.findOneBy({ item_key: input.item.key }))) {
          await this.baseRepo.save(
            this.baseRepo.create({ item_key: input.item.key, rate: input.rate, source: 'FIRST_QUOTE', set_date: input.rate_date }),
          );
        }
      } catch {
        // The quote itself is saved; the baseline is recorded on the next quote once the table exists.
      }
    }
    const prev = prior ?? before;
    return { quote, previous_rate: prev ? Number(prev.rate) : null };
  }

  // Today's rate per item: the latest quote on or before `asOf`. When there is
  // no quote for `asOf` itself, the earlier rate carries forward.
  async currentRates(asOf: string = todayInKarachi()): Promise<CurrentMarketRate[]> {
    const out: CurrentMarketRate[] = [];
    for (const item of MARKET_RATE_ITEMS) {
      const q = await this.repo.findOne({
        where: { item_key: item.key, status: 'ACTIVE', rate_date: LessThanOrEqual(asOf) },
        order: { rate_date: 'DESC', created_at: 'DESC' },
      });
      if (!q) continue;
      out.push({
        key: item.key,
        label: item.label,
        unit: item.unit,
        rate: Number(q.rate),
        rate_date: q.rate_date,
        carried_forward: q.rate_date < asOf,
        age_days: Math.max(daysBetween(q.rate_date, asOf), 0),
        quote_id: q.id,
      });
    }
    return out;
  }

  // Day-by-day grid for the last `days` days ending at `asOf`, with gaps
  // filled from the previous quote.
  async history(days: number, asOf: string = todayInKarachi()): Promise<DailyRateRow[]> {
    const from = addDays(asOf, -(days - 1));
    const quotes = await this.repo.find({ where: { status: 'ACTIVE' }, order: { rate_date: 'ASC', created_at: 'ASC' } });
    const rows: DailyRateRow[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      const rates: DailyRateRow['rates'] = {};
      for (const item of MARKET_RATE_ITEMS) {
        let latest: MarketRateQuoteEntity | null = null;
        for (const q of quotes) {
          if (q.item_key === item.key && q.rate_date <= date) latest = q;
        }
        rates[item.key] = latest
          ? { rate: Number(latest.rate), carried_forward: latest.rate_date < date, quote_id: latest.id }
          : null;
      }
      rows.push({ date, rates });
    }
    return rows.reverse();
  }
}
