import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// The rate a market quote is compared against to measure price movement.
// Items with a known reference-house rate need no row; the others get one from
// their first quote (FIRST_QUOTE) unless an admin sets the true figure (ADMIN).
// Configuration, not a FACT: it can be edited, and every change is visible in
// updated_at.
@Entity({ name: 'market_rate_baselines', schema: 'construction_intelligence' })
export class MarketRateBaselineEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  item_key: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rate: number;

  @Column({ type: 'varchar', length: 20 })
  source: 'FIRST_QUOTE' | 'ADMIN';

  @Column({ type: 'date' })
  set_date: string;

  @UpdateDateColumn()
  updated_at: Date;
}
