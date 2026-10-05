import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import type { HousePlanImageType, HousePlanAccessTier } from '@siraat/shared-types';

// HOUSE PLAN GALLERY — one row per tagged image (floor plan / front elevation /
// side elevation / 3D render) belonging to a house_plans row. Plain
// house_plan_id column + a DB-level FK (added in the matching migration),
// not a TypeORM @ManyToOne relation — same reason Contractor/Supplier avoid
// ORM relations elsewhere in this codebase: callers that only need the id
// (admin upload/delete routes) shouldn't have to pull a relation in to get it.
// This FK is same-context (house_plans is also property_intelligence), so it
// does not fall under Law 1's cross-context ban.
//
// storage_ref is nullable: an admin can create the image row (type + tier +
// price) before a file is actually uploaded — same two-step shape as
// HousePlanEntity.preview_image_ref (create plan, then upload-image).
@Index(['house_plan_id'])
@Entity({ name: 'house_plan_images', schema: 'property_intelligence' })
export class HousePlanImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  house_plan_id: string;

  @Column({ type: 'varchar', length: 20 })
  image_type: HousePlanImageType;

  @Column({ type: 'varchar', length: 10, default: 'FREE' })
  access_tier: HousePlanAccessTier;

  // Every image carries a price tag, free or gated — "no bait and switch"
  // (Step 0 founder direction). FREE images are typically 0.00 but the
  // column allows a non-zero value if a FREE promo price is ever wanted.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'text', nullable: true })
  storage_ref: string | null;

  // MIME type of the uploaded file. 3D renders are often a multi-page PDF
  // walkthrough rather than a single image, so the gallery needs this to
  // choose img vs. a PDF viewer at render time rather than guessing from
  // the filename. Set together with storage_ref on upload; null until then.
  @Column({ type: 'varchar', length: 100, nullable: true })
  content_type: string | null;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @CreateDateColumn()
  created_at: Date;
}
