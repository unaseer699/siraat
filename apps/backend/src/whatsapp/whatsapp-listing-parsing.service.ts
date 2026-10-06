import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappDraftListingEntity, type WhatsappDraftListingStatus } from './entities/whatsapp-draft-listing.entity';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';

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
  // convention as WhatsappParsingService.listDrafts.
  async listDrafts(status: WhatsappDraftListingStatus = 'PENDING_REVIEW'): Promise<WhatsappDraftListingEntity[]> {
    return this.draftRepo.find({ where: { status }, order: { created_at: 'DESC' } });
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

    const listing = await this.propertyIntelSvc.createPropertyListing({
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
