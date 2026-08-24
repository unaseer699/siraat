import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import type { HousePlanStyle } from '@siraat/shared-types';

// HOUSE PLANS DIRECTORY Chunk 1 — standalone catalog entity, not linked to any
// Society/Property (founder decision, Phase 1 scope). Directory only: no
// payment, no full-resolution download — matching Contractor/Supplier's
// find-and-verify-only scope.
//
// Every @Column below carries an explicit `type:` — same rule Contractor and
// Supplier follow, after a real DataTypeNotSupportedError crash from a
// nullable-string column with no explicit type (a `string | null` union has
// no usable design:type reflect-metadata, so TypeORM can't infer a column
// type without being told). contact_whatsapp here is a required plain string
// (not nullable), so it isn't exposed to that exact failure mode, but is
// still explicitly typed per the same rule — no field left to inference.
@Entity({ name: 'house_plans', schema: 'property_intelligence' })
export class HousePlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  area_marla: number;

  @Column({ type: 'int' })
  bedrooms: number;

  @Column({ type: 'varchar', length: 20 })
  style: HousePlanStyle;

  // Storage key, bucket-relative — same convention as Evidence.file_ref (no
  // bucket name prefix; see StorageService.getPresignedDownloadUrl's
  // defensive strip for the bug this convention exists to avoid).
  @Column({ type: 'text' })
  preview_image_ref: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  contact_whatsapp: string;

  // Same field/rule as Developer/Contractor/Supplier — never affects
  // verification or scoring, always disclosed when true.
  @Column({ type: 'boolean', default: false })
  is_siraat_affiliated: boolean;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
