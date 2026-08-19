import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import type { TradeCategory } from '@siraat/shared-types';

// CONTRACTOR DIRECTORY Chunk 1 — standalone entity, not a Developer subtype
// (founder decision). Directory (find + verify) only: no booking, payment, or
// in-app transaction fields belong here.
@Entity({ name: 'contractors', schema: 'property_intelligence' })
export class ContractorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  // e.g. ['TILE_WORK', 'PAINTER'] for a multi-trade contractor
  @Column({ type: 'text', array: true, default: '{}' })
  trade_categories: TradeCategory[];

  @Column({ type: 'text', array: true, default: '{}' })
  service_cities: string[];

  @Column({ length: 50 })
  contact_phone: string;

  // Explicit `type: 'text'` required — a `string | null` union has no usable
  // design:type reflect-metadata (TypeScript emits `Object`), so TypeORM can't
  // infer the column type without it. Same pattern as SocietyEntity's
  // affiliation_disclosure/noc_summary and MaterialRateEntity's source_contact.
  @Column({ type: 'text', nullable: true })
  contact_whatsapp: string | null;

  // Same field/rule as DeveloperEntity — never affects verification or
  // scoring, always disclosed when true.
  @Column({ type: 'boolean', default: false })
  is_siraat_affiliated: boolean;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
