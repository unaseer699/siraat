import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Index(['subject_type', 'subject_id'])
@Entity({ name: 'verifications', schema: 'trust' })
export class VerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  subject_type: 'SOCIETY' | 'DEVELOPER';

  // UUID string reference — never a SQL FK (Law 1: zero cross-context FKs)
  @Column('uuid')
  subject_id: string;

  @Column({ type: 'text' })
  claim: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'VERIFIED' | 'DISPUTED' | 'PENDING';

  // Evidence UUIDs — resolved in application code (no cross-schema SQL join, Law 2)
  @Column({ type: 'text', array: true, default: '{}' })
  evidence_refs: string[];

  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;
}
