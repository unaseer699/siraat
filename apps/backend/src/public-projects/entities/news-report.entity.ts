import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// "Outlet X published headline Y at URL Z". Headline and link only, never the
// article text. A FACT about what was published, not a claim that it is true.
@Entity({ name: 'news_reports', schema: 'market_intelligence' })
export class NewsReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  outlet: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', unique: true })
  url: string;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  topics: string[];

  // UUID references to public_projects whose keywords the headline matched.
  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  project_ids: string[];

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn({ type: 'timestamptz' })
  fetched_at: Date;
}
