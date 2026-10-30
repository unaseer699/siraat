import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import type { ProjectStatus } from './public-project.entity';

// Append-only. The current status of a project is its latest event.
@Entity({ name: 'project_status_events', schema: 'market_intelligence' })
export class ProjectStatusEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Same-context reference to public_projects.
  @Column({ type: 'uuid' })
  project_id: string;

  @Column({ type: 'varchar', length: 30 })
  status: ProjectStatus;

  @Column({ type: 'date', nullable: true })
  target_date: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'date' })
  event_date: string;

  @Column({ type: 'text' })
  source_url: string;

  @Column({ type: 'varchar', length: 10, default: 'MEDIA' })
  source_kind: 'OFFICIAL' | 'MEDIA';

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
