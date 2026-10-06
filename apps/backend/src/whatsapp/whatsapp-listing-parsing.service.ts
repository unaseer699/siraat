import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappDraftListingEntity, type WhatsappDraftListingStatus } from './entities/whatsapp-draft-listing.entity';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { WhatsappListingAlertService } from './whatsapp-listing-alert.service';

// Review flags shown next to a pending draft. BLOCKING flags keep a draft out
// of "publish all clean"; INFO flags are shown but don't block.
export type ListingDraftFlag = 'MISSING_PRICE' | 'PRICE_OUTLIER' | 'MISSING_SIZE' | 'REFRESH';
const BLOCKING_FLAGS: ListingDraftFlag[] = ['MISSING_PRICE', 'PRICE_OUTLIER'];
// A draft's price per marla must sit within [LOW, HIGH] x the median of live
// listings in the same society+block (needs MIN_SAMPLES to be meaningful).
const OUTLIER_LOW = 0.6;
const OUTLIER_HIGH = 1.6;
const OUTLIER_MIN_SAMPLES = 3;

export type WhatsappDraftListingWithFlags = WhatsappDraftListingEntity & { flags: ListingDraftFlag[] };

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function sameSociety(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

// WHATSAPP LISTING INGESTION — auto-expiry default (confirmed: "~14 days"
// per the scoping discussion). Same configurable-via-env, read-once-per-call
// pattern as WhatsappParsingService's DEFAULT_STALE_HOURS.
const DEFAULT_LISTING_EXPIRY_DAYS = 14;

function resolveExpiryDate(): Date {
  const days = Number(process.env.WHATSAPP_LISTING_EXPIRY_DAYS);
  const resolvedDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_LISTING_EXPIRY_DAYS;
  return new Date(Date.now() + resolvedDays * 24 * 60 * 60 * 1000);
}

// Turns one LISTING_RECEIVED inbound message into N WhatsappDraftListingEntity
// rows (one per plot — see the entity's own comment on why a multi-plot line
// is split before storage, not after). Deliberately a separate service from
// WhatsappParsingService (construction expenses) even though the shape
// rhymes closely — a listing draft has no confirm-reply loop, a different
// AI extraction (array, not single object), and publishes into a different
// module's table (property_intelligence, not construction_intelligence) —
// mirroring this codebase's standing "one concern, one service" rule
// (Law 9) rather than overloading WhatsappParsingService with a second,
// unrelated draft type.
@Injectable()
export class WhatsappListingParsingService {
  private readonly logger = new Logger(WhatsappListingParsingService.name);

  constructor(
    @InjectRepository(WhatsappInboundMessageEntity)
    private readonly inboundRepo: Repository<WhatsappInboundMessageEntity>,
    @InjectRepository(WhatsappDraftListingEntity)
    private readonly draftRepo: Repository<WhatsappDraftListingEntity>,
    private readonly aiClient: WhatsappAiClient,
    // Law 9: public API call into PropertyIntelligenceModule, same
    // cross-module pattern WhatsappConfirmationService already uses to
    // resolve a confirmed project's city via PropertyIntelligenceService.
    private readonly propertyIntelSvc: PropertyIntelligenceService,
    private readonly outbound: WhatsappOutboundClient,
    private readonly alertSvc: WhatsappListingAlertService,
  ) {}

  // Fire-and-forget entry point, called from WhatsappService.routeReceivedMessage
  // exactly like WhatsappParsingService.parseAndStoreDraft — never awaited by
  // its caller, never throws back into it. A listing message carries no
  // reply-back requirement (confirmed: the founder has already verified it
  // before forwarding, so there's no "did I understand this right?" loop to
  // close over WhatsApp), so unlike parseAndStoreDraft there is no outbound
  // send here at all — the only follow-up is the admin review queue.
  async parseAndStoreListingDrafts(message: WhatsappInboundMessageEntity): Promise<void> {
    if (message.status !== 'LISTING_RECEIVED') return;

    const text = message.message_text;
    if (!text || text.trim().length === 0) {
      this.logger.warn(`WhatsApp listing message id=${message.id} has no text body — nothing to parse`);
      await this.inboundRepo.update({ id: message.id }, { status: 'LISTING_PARSED' });
      return;
    }

    // A forwarder replying "SOLD 7473 7915" marks those plots sold — no AI
    // call, no drafts. See PropertyIntelligenceService.markPlotsSoldByNumber
    // for why an ambiguous number is reported, not guessed.
    if (/^\s*sold\b/i.test(text)) {
      await this.handleSoldMessage(message, text);
      return;
    }

    try {
      const outcome = await this.aiClient.extractListings(text);

      if (outcome.listings.length === 0) {
        this.logger.log(`WhatsApp listing message id=${message.id} produced no plot extractions`);
      }

      for (const listing of outcome.listings) {
        const draft = this.draftRepo.create({
          inbound_message_id: message.id,
          society_name_raw: listing.society_name_raw,
          block: listing.block,
          plot_number: listing.plot_number,
          size_raw: listing.size_raw,
          size_marla: listing.size_marla,
          price_lac: listing.price_lac,
          status_raw: listing.status_raw,
          contact_phone: listing.contact_phone,
          raw_line: listing.raw_line,
          raw_ai_response: outcome.raw,
          status: 'PENDING_REVIEW',
        });
        await this.draftRepo.save(draft);
      }

      await this.inboundRepo.update({ id: message.id }, { status: 'LISTING_PARSED' });
      this.logger.log(
        `Parsed WhatsApp listing message id=${message.id} into ${outcome.listings.length} draft plot(s)`,
      );
    } catch (err) {
      // Same RETRY APPROACH as WhatsappParsingService.parseAndStoreDraft —
      // left at LISTING_RECEIVED (not flipped to any "FAILED" state) so it
      // stays queryable for a future retry job, no new column required.
      this.logger.error(
        `Failed to parse WhatsApp listing message id=${message.id} — left at status LISTING_RECEIVED for retry`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // GET /v1/admin/whatsapp-listing-drafts — defaults to PENDING_REVIEW, same
  // convention as WhatsappParsingService.listDrafts. PENDING drafts also carry
  // review `flags` so a reviewer can skim hundreds and only open the odd ones.
  async listDrafts(status: WhatsappDraftListingStatus = 'PENDING_REVIEW'): Promise<WhatsappDraftListingWithFlags[]> {
    const drafts = await this.draftRepo.find({ where: { status }, order: { created_at: 'DESC' } });
    if (status !== 'PENDING_REVIEW' || drafts.length === 0) {
      return drafts.map((d) => ({ ...d, flags: [] }));
    }

    const active = (await this.propertyIntelSvc.listActivePropertyListings({})).listings;

    // price-per-marla baseline per society+block, from live offers.
    const baselineFor = (societyRaw: string, block: string | null): number | null => {
      const samples = active
        .filter(
          (l) =>
            l.price_per_marla_lac !== null &&
            (l.block ?? '').toLowerCase() === (block ?? '').toLowerCase() &&
            (sameSociety(societyRaw, l.society_name_raw) || (l.society_name !== null && sameSociety(societyRaw, l.society_name))),
        )
        .map((l) => l.price_per_marla_lac as number);
      return samples.length >= OUTLIER_MIN_SAMPLES ? median(samples) : null;
    };

    return drafts.map((d) => {
      const flags: ListingDraftFlag[] = [];
      const price = d.price_lac === null ? null : Number(d.price_lac);
      const size = d.size_marla === null ? null : Number(d.size_marla);
      if (price === null) flags.push('MISSING_PRICE');
      if (size === null) flags.push('MISSING_SIZE');
      if (price !== null && size !== null && size > 0) {
        const base = baselineFor(d.society_name_raw, d.block);
        const ppm = price / size;
        if (base !== null && (ppm < base * OUTLIER_LOW || ppm > base * OUTLIER_HIGH)) flags.push('PRICE_OUTLIER');
      }
      const alreadyLive = active.some(
        (l) =>
          l.plot_number === d.plot_number &&
          (l.block ?? '').toLowerCase() === (d.block ?? '').toLowerCase() &&
          (sameSociety(d.society_name_raw, l.society_name_raw) || (l.society_name !== null && sameSociety(d.society_name_raw, l.society_name))),
      );
      if (alreadyLive) flags.push('REFRESH');
      return { ...d, flags };
    });
  }

  // POST /v1/admin/whatsapp-listing-drafts/publish-clean — publishes every
  // pending draft with no BLOCKING flag (price present and not an outlier).
  // Missing size / refreshes don't block. Failures are collected, not fatal.
  async publishClean(): Promise<{ published: number; skipped: number; failed: number }> {
    const pending = await this.listDrafts('PENDING_REVIEW');
    let published = 0;
    let skipped = 0;
    let failed = 0;
    for (const d of pending) {
      if (d.flags.some((f) => BLOCKING_FLAGS.includes(f))) {
        skipped += 1;
        continue;
      }
      try {
        await this.publishDraft(d.id);
        published += 1;
      } catch (err) {
        failed += 1;
        this.logger.error(`Bulk publish failed for draft ${d.id}`, err instanceof Error ? err.stack : String(err));
      }
    }
    return { published, skipped, failed };
  }

  private async handleSoldMessage(message: WhatsappInboundMessageEntity, text: string): Promise<void> {
    try {
      const numbers = text.match(/\b\d{3,6}\b/g) ?? [];
      const result = numbers.length
        ? await this.propertyIntelSvc.markPlotsSoldByNumber(numbers)
        : { marked: [], ambiguous: [], not_found: [] };
      await this.inboundRepo.update({ id: message.id }, { status: 'LISTING_PARSED' });

      const parts: string[] = [];
      if (result.marked.length) parts.push(`Marked sold: ${result.marked.join(', ')}`);
      if (result.ambiguous.length) parts.push(`Several societies have plot ${result.ambiguous.join(', ')} - mark it sold from the admin page`);
      if (result.not_found.length) parts.push(`No live listing for: ${result.not_found.join(', ')}`);
      if (!numbers.length) parts.push('No plot numbers found - send like: SOLD 7473 7915');
      try {
        await this.outbound.sendTextMessage(message.wa_id, parts.join('. ') + '.');
      } catch (err) {
        this.logger.warn(`SOLD confirmation send failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to process SOLD message id=${message.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // POST /v1/admin/whatsapp-listing-drafts/:id/publish — the single admin
  // action that promotes UNTRUSTED_DATA to a real FACT (Law 8), replacing
  // the confirm-reply loop the expense flow uses, since the founder already
  // verified the source message before forwarding it.
  // contactPhone: undefined = keep the draft's own number; null = publish
  // with no number; string = the admin's corrected number.
  async publishDraft(id: string, contactPhone?: string | null): Promise<WhatsappDraftListingEntity> {
    const draft = await this.draftRepo.findOneBy({ id });
    if (!draft) throw new NotFoundException(`WhatsApp listing draft ${id} not found`);
    if (draft.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Draft ${id} cannot be published — it is already ${draft.status}.`,
      );
    }

    const { listing, is_new_plot } = await this.propertyIntelSvc.createPropertyListing({
      society_name_raw: draft.society_name_raw,
      block: draft.block,
      plot_number: draft.plot_number,
      size_marla: draft.size_marla,
      price_lac: draft.price_lac,
      status_raw: draft.status_raw,
      contact_phone: contactPhone === undefined ? draft.contact_phone : contactPhone,
      source_ref: draft.id,
      expires_at: resolveExpiryDate(),
    });

    await this.draftRepo.update({ id }, { status: 'PUBLISHED', listing_ref: listing.id });

    // Alert subscribers only for a genuinely NEW plot — a dealer re-forwarding
    // a plot we already list is a refresh, not news. Fire-and-forget.
    if (is_new_plot) void this.alertSvc.notifyForNewPlot(listing);
    return { ...draft, status: 'PUBLISHED', listing_ref: listing.id };
  }

  // POST /v1/admin/whatsapp-listing-drafts/:id/reject — never creates a
  // PropertyListing, never deletes the draft row (Law 3-style corrections-
  // not-deletion discipline, same as WhatsappParsingService.voidDraft).
  async rejectDraft(id: string, note: string | null): Promise<WhatsappDraftListingEntity> {
    const draft = await this.draftRepo.findOneBy({ id });
    if (!draft) throw new NotFoundException(`WhatsApp listing draft ${id} not found`);
    if (draft.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Draft ${id} cannot be rejected — it is already ${draft.status}.`,
      );
    }

    await this.draftRepo.update({ id }, { status: 'REJECTED', review_note: note });
    return { ...draft, status: 'REJECTED', review_note: note };
  }
}
