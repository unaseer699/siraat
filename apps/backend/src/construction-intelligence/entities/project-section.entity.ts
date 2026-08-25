import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import type { TradeCategory } from '@siraat/shared-types';

// PROJECT COST TRACKER Chunk 1 — a named cost category within a
// ConstructionProject (e.g. "Wood Work", "Tile Work"), matching how the real
// source sheet lists sections. Every @Column explicitly typed — see
// ConstructionProjectEntity's comment for why.
@Entity({ name: 'project_sections', schema: 'construction_intelligence' })
export class ProjectSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // UUID string, no SQL FK per Law 2 — references ConstructionProjectEntity.id,
  // which lives in this same schema, but stays a plain reference per the same
  // Law that governs cross-schema refs (kept consistent rather than special-cased).
  @Column({ type: 'uuid' })
  project_ref: string;

  // One of TRADE_CATEGORIES (shared-types) — stored as plain varchar, not
  // constrained at the DB level (same convention as MaterialRateEntity.source_tier).
  @Column({ type: 'varchar', length: 30 })
  category: TradeCategory;

  // Preserves display order, matching how the real sheet lists sections.
  @Column({ type: 'int' })
  display_order: number;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @CreateDateColumn()
  created_at: Date;
}
