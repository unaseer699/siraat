import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import type { MaterialCategory } from '@siraat/shared-types';

// SUPPLIER DIRECTORY Chunk 1 — standalone entity, same organization as
// Contractor (property_intelligence schema, no dedicated SupplierService).
// A directory (find + verify) only: no booking, payment, or in-app
// transaction fields belong here.
//
// Every @Column below carries an explicit `type:` — ContractorEntity had a
// real startup crash (DataTypeNotSupportedError) from a nullable string
// column with no explicit type: a `string | null` union has no usable
// design:type reflect-metadata (TypeScript emits `Object` for it), so
// TypeORM can't infer a column type without being told. Not repeating that
// here, including on fields where it happens to be safe to omit.
@Entity({ name: 'suppliers', schema: 'property_intelligence' })
export class SupplierEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // e.g. ['STEEL'] or ['STEEL', 'CEMENT'] for a multi-category supplier
  @Column({ type: 'text', array: true, default: '{}' })
  material_categories: MaterialCategory[];

  @Column({ type: 'text', array: true, default: '{}' })
  service_cities: string[];

  @Column({ type: 'varchar', length: 50 })
  contact_phone: string;

  @Column({ type: 'text', nullable: true })
  contact_whatsapp: string | null;

  // Same field/rule as Developer/Contractor — never affects verification or
  // scoring, always disclosed when true.
  @Column({ type: 'boolean', default: false })
  is_siraat_affiliated: boolean;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
