import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Schemes that a regulator (today only CDA) publishes as having NO approved
// layout plan / NOC. Deliberately NOT stored in `societies`: societies drive
// search, compare, scoring and the Verified badge, and nothing here may ever
// leak into those. Each row is a FACT that "the regulator lists this name" -
// not a Siraat finding - so it always carries source_url and listed_as_of.
// `name` is CDA's own wording; corrections create new rows, never overwrite
// history (a scheme that gets approved is soft-removed with is_active=false).
@Entity({ name: 'illegal_schemes', schema: 'property_intelligence' })
export class IllegalSchemeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 300, unique: true })
  name_key: string;

  @Column({ type: 'varchar', length: 10, default: 'CDA' })
  regulator: string;

  @Column({ type: 'varchar', length: 100, default: 'Islamabad' })
  city: string;

  @Column({ type: 'text' })
  source_url: string;

  @Column({ type: 'date' })
  listed_as_of: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
