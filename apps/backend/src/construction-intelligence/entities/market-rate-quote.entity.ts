import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// One quoted market price for one item on one date. FACT: a correction adds a
// new row that supersedes the old one (the old row flips to CORRECTED), it
// never edits history. Days with no quote are filled at read time from the
// latest earlier quote (a GENERATED, carried-forward value).
@Index(['item_key', 'rate_date'])
@Entity({ name: 'market_rate_quotes', schema: 'construction_intelligence' })
export class MarketRateQuoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  rate_date: string;

  @Column({ type: 'varchar', length: 30 })
  item_key: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rate: number;

  @Column({ type: 'varchar', length: 10 })
  unit: string;

  @Column({ type: 'varchar', length: 20, default: 'WHATSAPP' })
  source: string;

  @Column({ type: 'uuid', nullable: true })
  source_ref: string | null;

  @Column({ type: 'varchar', length: 12, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  supersedes_id: string | null;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
