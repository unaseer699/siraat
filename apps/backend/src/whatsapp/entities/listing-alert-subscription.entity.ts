import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// WHATSAPP LISTING INGESTION — a visitor's "tell me when a plot like this
// appears" subscription. `data_acquisition` schema (Law 1): society_key is a
// plain string (a Society id, or `raw:<name>` for a not-yet-onboarded
// society — see PropertyListingFacets), never a SQL FK. Not a FACT/GENERATED
// record — operational configuration, deactivated (never deleted) on STOP.
@Entity({ name: 'listing_alert_subscriptions', schema: 'data_acquisition' })
export class ListingAlertSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Subscriber's WhatsApp number, digits only, international (92...).
  @Index()
  @Column({ type: 'varchar', length: 32 })
  wa_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  society_key: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  max_price_lac: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  min_size_marla: number | null;

  @Index()
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // Daily send cap bookkeeping (see WhatsappListingAlertService).
  @Column({ type: 'int', default: 0 })
  daily_count: number;

  @Column({ type: 'date', nullable: true })
  daily_count_date: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_notified_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
