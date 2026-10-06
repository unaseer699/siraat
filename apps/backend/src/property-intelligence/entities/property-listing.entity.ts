import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// WHATSAPP LISTING INGESTION — the published, public-facing record. Created
// only by WhatsappListingParsingService.publishDraft, from exactly one
// WhatsappDraftListingEntity row an admin has reviewed and approved — the
// admin's Publish click IS the human-review step Law 8 requires before
// UNTRUSTED_DATA can become a FACT; there is nothing further derived from
// it, so record_type is always 'FACT', never 'GENERATED'.
//
// `property_intelligence` schema (Law 1: zero cross-context FKs).
// society_ref is a plain uuid string, nullable — a forwarded society/block
// name is matched against SocietyEntity by name at publish time, best
// effort, but a forwarded message naming a society not yet in the directory
// is still published (confirmed priority: get the inventory searchable now,
// not blocked on every society existing first). source_ref points back at
// the originating WhatsappDraftListingEntity.id (data_acquisition schema) —
// also a plain uuid string, never a SQL FK, and per Law 3, a GENERATED
// record elsewhere must never cite this FACT via source_ref pointing the
// other way without going through the same rule.
@Entity({ name: 'property_listings', schema: 'property_intelligence' })
export class PropertyListingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  society_ref: string | null;

  @Column({ type: 'text' })
  society_name_raw: string;

  // Snapshot of the matched Society's city at publish time, if matched —
  // null otherwise. Lets search filter by city even when society_ref is
  // null (no directory match yet).
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  block: string | null;

  @Column({ type: 'varchar', length: 20 })
  plot_number: string;

  // Displayed/filterable size as the market writes it ("25x50", "1 Kanal").
  @Column({ type: 'varchar', length: 20, nullable: true })
  size_label: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  size_marla: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_lac: number | null;

  @Column({ type: 'text', nullable: true })
  status_raw: string | null;

  // Optional dealer contact number (see WhatsappDraftListingEntity.contact_phone).
  @Column({ type: 'varchar', length: 32, nullable: true })
  contact_phone: string | null;

  // The WhatsappDraftListingEntity.id this was published from — kept even
  // though that row also stores listing_ref back to this one, so a listing
  // can always be traced to its source without a join through the draft
  // table's own listing_ref column.
  @Column({ type: 'uuid' })
  source_ref: string;

  // Same field/rule as Contractor/Supplier/HousePlan — never affects
  // scoring, always disclosed when true. Always false for a WhatsApp-sourced
  // listing today (no affiliated-forwarder concept exists yet), kept for
  // schema consistency with the rest of the directory.
  @Column({ type: 'boolean', default: false })
  is_siraat_affiliated: boolean;

  @Column({ type: 'varchar', length: 10, default: 'FACT' })
  record_type: 'FACT';

  @Column({ type: 'timestamptz', default: () => 'now()' })
  published_at: Date;

  // Auto-expiry (confirmed default: ~14 days) — daily inventory goes stale
  // fast (a plot can sell or be withdrawn within days), so a listing is only
  // ever surfaced in search while now() < expires_at (see
  // PropertyIntelligenceService's future listing-search query) rather than
  // requiring an admin to manually take every sold plot down.
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  // Set when the plot is marked sold (admin action or a forwarder's "SOLD"
  // message) — a sold plot is excluded from every public read immediately.
  @Column({ type: 'timestamptz', nullable: true })
  sold_at: Date | null;

  // Refreshed whenever a dealer re-forwards the same plot (dedup refresh),
  // so freshness reflects the latest confirmation, not the first sighting.
  @Column({ type: 'timestamptz', default: () => 'now()' })
  last_confirmed_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
