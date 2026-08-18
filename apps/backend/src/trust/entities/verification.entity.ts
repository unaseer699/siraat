import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

// CONTRACTOR DIRECTORY Chunk 1 — added 'CONTRACTOR'. The whole point of this
// column being a plain string (no SQL FK, Law 1) is that Trust's Verification/
// Evidence pattern is subject-type-agnostic; widening this union is the only
// change needed to reuse it for a new subject type.
export type VerificationSubjectType = 'SOCIETY' | 'DEVELOPER' | 'CONTRACTOR';

@Index(['subject_type', 'subject_id'])
@Entity({ name: 'verifications', schema: 'trust' })
export class VerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  subject_type: VerificationSubjectType;

  // UUID string reference — never a SQL FK (Law 1: zero cross-context FKs)
  @Column('uuid')
  subject_id: string;

  @Column({ type: 'text' })
  claim: string;

  @Column({ type: 'varchar', length: 40, default: 'NOC' })
  claim_type: 'NOC' | 'PLANNING_APPROVAL' | 'COMPLETION_CERTIFICATE'
            | 'SHOW_CAUSE_NOTICE' | 'ILLEGAL_SCHEME_NOTICE'
            | 'TRANSFER_DEED' | 'MORTGAGE_DEED' | 'OTHER';

  @Column({ type: 'varchar', length: 20 })
  status: 'VERIFIED' | 'DISPUTED' | 'PENDING';

  // Evidence UUIDs — resolved in application code (no cross-schema SQL join, Law 2)
  @Column({ type: 'text', array: true, default: '{}' })
  evidence_refs: string[];

  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;
}
