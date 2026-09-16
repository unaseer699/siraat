import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappSuggestedBusinessLinkEntity } from './entities/whatsapp-suggested-business-link.entity';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';

export interface ApproveSuggestedLinkInput {
  contractor_id: string | null;
  supplier_id: string | null;
}

// WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION
// (REVIEW-GATED). Detection, never linking — see
// WhatsappSuggestedBusinessLinkEntity's own comment. Fuzzy matching and the
// eventual link both go through PropertyIntelligenceService/TrustService's
// existing public methods only (Law 9: no reach into their repos, and no
// second contractor/supplier lookup or Verification-creation path invented
// here).
@Injectable()
export class WhatsappBusinessLinkService {
  private readonly logger = new Logger(WhatsappBusinessLinkService.name);

  constructor(
    @InjectRepository(WhatsappSuggestedBusinessLinkEntity)
    private readonly linkRepo: Repository<WhatsappSuggestedBusinessLinkEntity>,
    private readonly piSvc: PropertyIntelligenceService,
    private readonly trustSvc: TrustService,
  ) {}

  // Called from WhatsappParsingService.parseAndStoreDraft right after the
  // draft itself is saved (its own try/catch there covers this too, but this
  // method never throws on its own — a lookup/save failure here must never
  // be confused with a failed parse, and must never block the message's
  // PARSED transition).
  async detectAndSuggest(draftExpenseId: string, mentionedBusinessName: string | null): Promise<void> {
    const trimmed = mentionedBusinessName?.trim();
    if (!trimmed) return;

    try {
      const [contractors, suppliers] = await Promise.all([
        this.piSvc.searchContractorsByName(trimmed),
        this.piSvc.searchSuppliersByName(trimmed),
      ]);

      // A name can't plausibly BE both a contractor and a supplier —
      // contractor checked first (arbitrary but deterministic; FOR FOUNDER
      // REVIEW if this priority ever produces a wrong-directory suggestion
      // in practice). Either way this is only ever a suggestion, never an
      // auto-applied link.
      const matched_contractor_id = contractors[0]?.id ?? null;
      const matched_supplier_id = matched_contractor_id ? null : (suppliers[0]?.id ?? null);

      const entity = this.linkRepo.create({
        draft_expense_id: draftExpenseId,
        mentioned_name: trimmed,
        matched_contractor_id,
        matched_supplier_id,
        status: 'PENDING_REVIEW',
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
      });
      await this.linkRepo.save(entity);
    } catch (err) {
      this.logger.error(
        `Failed to record business-mention suggestion for draft id=${draftExpenseId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // GET /v1/admin/whatsapp-suggested-links — PENDING_REVIEW only, most recent first.
  async listPendingSuggestions(): Promise<WhatsappSuggestedBusinessLinkEntity[]> {
    return this.linkRepo.find({
      where: { status: 'PENDING_REVIEW' },
      order: { created_at: 'DESC' },
    });
  }

  private async findPendingOrThrow(id: string): Promise<WhatsappSuggestedBusinessLinkEntity> {
    const suggestion = await this.linkRepo.findOneBy({ id });
    if (!suggestion) throw new NotFoundException(`WhatsApp suggested business link ${id} not found`);
    if (suggestion.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Suggestion ${id} cannot be reviewed again — it is already ${suggestion.status}.`,
      );
    }
    return suggestion;
  }

  // POST /v1/admin/whatsapp-suggested-links/:id/approve — the ONLY place in
  // this codebase's WhatsApp integration that creates a real Trust-side link
  // for a contractor/supplier from a WhatsApp mention, and only on this
  // explicit admin action. Reuses TrustService.createVerification — the same
  // mechanism AdminService.addClaim already uses for contractor/supplier
  // claims — rather than inventing a new Trust-model concept. status is
  // always PENDING here, never VERIFIED: this only records that the
  // business was mentioned in a real project expense, which is evidence,
  // not a verified claim. Trust's verification-is-human-only law means only
  // the existing, separate addClaim/promote flow ever sets VERIFIED.
  async approve(id: string, override: ApproveSuggestedLinkInput): Promise<WhatsappSuggestedBusinessLinkEntity> {
    if (override.contractor_id && override.supplier_id) {
      throw new BadRequestException('Provide at most one of contractor_id/supplier_id, not both.');
    }

    const suggestion = await this.findPendingOrThrow(id);

    // An override REPLACES the auto-match entirely — it must not partially
    // fall back to the suggestion's own matched_contractor_id/matched_supplier_id
    // (e.g. overriding with a supplier_id when the auto-match was a
    // contractor must not silently re-link the original contractor).
    const hasOverride = override.contractor_id != null || override.supplier_id != null;
    const contractorId = hasOverride ? override.contractor_id : suggestion.matched_contractor_id;
    const supplierId = hasOverride ? override.supplier_id : suggestion.matched_supplier_id;
    if (!contractorId && !supplierId) {
      throw new BadRequestException(
        'No matched contractor/supplier to link and no override was provided — pass contractor_id or supplier_id.',
      );
    }

    const subjectType = contractorId ? ('CONTRACTOR' as const) : ('SUPPLIER' as const);
    const subjectId = (contractorId ?? supplierId) as string;

    const subject =
      subjectType === 'CONTRACTOR'
        ? await this.piSvc.findContractorById(subjectId)
        : await this.piSvc.findSupplierById(subjectId);
    if (!subject) {
      throw new NotFoundException(
        `${subjectType === 'CONTRACTOR' ? 'Contractor' : 'Supplier'} ${subjectId} not found`,
      );
    }

    await this.trustSvc.createVerification({
      subject_type: subjectType,
      subject_id: subjectId,
      claim: `Mentioned as "${suggestion.mentioned_name}" in a WhatsApp project-expense message`,
      claim_type: 'OTHER',
      status: 'PENDING',
      evidence_refs: [],
    });

    const reviewed_at = new Date();
    const updated = {
      status: 'APPROVED' as const,
      matched_contractor_id: subjectType === 'CONTRACTOR' ? subjectId : null,
      matched_supplier_id: subjectType === 'SUPPLIER' ? subjectId : null,
      reviewed_by: null,
      reviewed_at,
    };
    await this.linkRepo.update({ id }, updated);

    return { ...suggestion, ...updated };
  }

  // POST /v1/admin/whatsapp-suggested-links/:id/reject — never creates any
  // link. `reason` optional, same convention as WhatsappParsingService.voidDraft.
  async reject(id: string, reason: string | null): Promise<WhatsappSuggestedBusinessLinkEntity> {
    const suggestion = await this.findPendingOrThrow(id);

    const reviewed_at = new Date();
    const updated = { status: 'REJECTED' as const, review_note: reason, reviewed_by: null, reviewed_at };
    await this.linkRepo.update({ id }, updated);

    return { ...suggestion, ...updated };
  }
}
