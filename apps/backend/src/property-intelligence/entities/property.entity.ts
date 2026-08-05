import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'properties', schema: 'property_intelligence' })
export class PropertyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // UUID string reference to property_intelligence.societies — no SQL FK (Law 1)
  @Column('uuid')
  society_id: string;

  // No User entity yet; nullable per Phase 1 addendum
  @Column({ type: 'uuid', nullable: true })
  owner_ref: string | null;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  price: number;

  @Column({ type: 'text' })
  listing_source: string;

  @Column({ type: 'varchar', length: 20, default: 'LISTED' })
  status: 'LISTED' | 'ACTIVE' | 'ARCHIVED';

  @Column({ type: 'varchar', length: 30 })
  property_type: string;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  area_marla: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
