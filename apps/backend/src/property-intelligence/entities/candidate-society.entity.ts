import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'candidate_societies', schema: 'property_intelligence' })
export class CandidateSocietyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  regulator: 'CDA' | 'RDA' | 'TMA' | 'OTHER';

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 20, default: 'NOT_STARTED' })
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ONBOARDED';

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
