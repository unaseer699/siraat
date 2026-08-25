import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export type ConstructionProjectStatus = 'ACTIVE' | 'COMPLETE' | 'ON_HOLD';

// PROJECT COST TRACKER Chunk 1 — an organized, immutable expense ledger per
// project (e.g. "Bahria 1180"). Not a full project-management system: no
// tasks, no baselines, no BOQ.
//
// Every @Column below carries an explicit `type:` — a standing rule as of
// this chunk, after two real crashes this session (Contractor.contact_whatsapp,
// near-miss on HousePlan): a `string | null` union has no usable design:type
// reflect-metadata (TypeScript emits `Object` for it), so TypeORM can't infer
// a column type without being told.
@Entity({ name: 'construction_projects', schema: 'construction_intelligence' })
export class ConstructionProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // UUID string, no SQL FK per Law 2 — optional link to a Society/Property in
  // property_intelligence, a different schema. Most private renovations won't
  // have one.
  @Column({ type: 'uuid', nullable: true })
  property_ref: string | null;

  @Column({ type: 'varchar', length: 255 })
  owner_contact: string;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'varchar', length: 20 })
  status: ConstructionProjectStatus;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
