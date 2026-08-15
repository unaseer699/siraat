import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import type { SocietyVerificationStatus } from '@siraat/shared-types';
import { VerificationEntity } from './entities/verification.entity';
import { EvidenceEntity } from './entities/evidence.entity';
import { EvidenceSubmissionEntity } from './entities/evidence-submission.entity';
import { ObservationEntity } from './entities/observation.entity';

export type ClaimType =
  | 'NOC'
  | 'PLANNING_APPROVAL'
  | 'COMPLETION_CERTIFICATE'
  | 'SHOW_CAUSE_NOTICE'
  | 'ILLEGAL_SCHEME_NOTICE'
  | 'TRANSFER_DEED'
  | 'MORTGAGE_DEED'
  | 'OTHER';

// Adverse claim types whose unresolved (DISPUTED) status overrides an otherwise-VERIFIED
// primary claim — mirrors ScoringService's ADVERSE_CLAIM_PENALTY concept for confidence_score.
const ADVERSE_CLAIM_TYPES: ClaimType[] = ['SHOW_CAUSE_NOTICE', 'ILLEGAL_SCHEME_NOTICE'];

export interface VerificationResult {
  verification: VerificationEntity;
  evidence: EvidenceEntity[];
}

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    @InjectRepository(VerificationEntity)
    private readonly verRepo: Repository<VerificationEntity>,
    @InjectRepository(EvidenceEntity)
    private readonly eviRepo: Repository<EvidenceEntity>,
    @InjectRepository(EvidenceSubmissionEntity)
    private readonly subRepo: Repository<EvidenceSubmissionEntity>,
    @InjectRepository(ObservationEntity)
    private readonly obsRepo: Repository<ObservationEntity>,
  ) {}

  // Fire-and-forget, append-only state-change ledger (Law 3: FACT, immutable).
  // Never throws — an Observation write failure must never fail the Verification
  // write that triggered it, so failures are logged and swallowed here.
  async logObservation(data: {
    entity_ref: string;
    metric: string;
    old_value: string | null;
    new_value: string;
    source_ref: string;
  }): Promise<void> {
    try {
      const observation = this.obsRepo.create({ ...data, record_type: 'FACT' });
      await this.obsRepo.save(observation);
    } catch (err) {
      this.logger.error(
        `Failed to log Observation (metric=${data.metric}, entity_ref=${data.entity_ref})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async getVerifications(
    subjectType: 'SOCIETY' | 'DEVELOPER',
    subjectId: string,
  ): Promise<VerificationResult[]> {
    const verifications = await this.verRepo.find({
      where: { subject_type: subjectType, subject_id: subjectId },
    });
    return Promise.all(
      verifications.map(async (verification) => {
        // Application-level join — never a cross-schema SQL join (Law 2)
        const evidence =
          verification.evidence_refs.length > 0
            ? await this.eviRepo.findBy({ id: In(verification.evidence_refs) })
            : [];
        return { verification, evidence };
      }),
    );
  }

  /** @deprecated Use getVerifications() instead. Returns only the primary claim (NOC or PLANNING_APPROVAL first, else the first record). */
  async getVerification(
    subjectType: 'SOCIETY' | 'DEVELOPER',
    subjectId: string,
  ): Promise<VerificationResult | null> {
    const all = await this.getVerifications(subjectType, subjectId);
    if (all.length === 0) return null;
    return (
      all.find(
        (r) =>
          r.verification.claim_type === 'NOC' ||
          r.verification.claim_type === 'PLANNING_APPROVAL',
      ) ?? all[0]
    );
  }

  async getEvidenceById(id: string): Promise<EvidenceEntity | null> {
    return this.eviRepo.findOneBy({ id });
  }

  /**
   * Derives a single overall verification_status from every claim on a subject.
   * Reused by Browse Societies (property-intelligence) — the one place this precedence
   * should live; do not re-derive it inline elsewhere. Order matters: an unresolved
   * adverse claim (DISPUTED SHOW_CAUSE_NOTICE / ILLEGAL_SCHEME_NOTICE) always wins over
   * an otherwise-VERIFIED primary claim.
   */
  async deriveVerificationStatus(
    subjectType: 'SOCIETY' | 'DEVELOPER',
    subjectId: string,
  ): Promise<SocietyVerificationStatus> {
    const all = await this.getVerifications(subjectType, subjectId);
    if (all.length === 0) return 'PENDING';

    const hasDisputedAdverseClaim = all.some(
      (r) =>
        ADVERSE_CLAIM_TYPES.includes(r.verification.claim_type) && r.verification.status === 'DISPUTED',
    );
    if (hasDisputedAdverseClaim) return 'DISPUTED';

    // Primary claim: NOC or PLANNING_APPROVAL first, else the first record (same
    // precedence as the deprecated getVerification() and ScoringService.computeAndSave()).
    const primaryClaim =
      all.find(
        (r) => r.verification.claim_type === 'NOC' || r.verification.claim_type === 'PLANNING_APPROVAL',
      ) ?? all[0];

    return primaryClaim.verification.status === 'VERIFIED' ? 'VERIFIED' : 'PARTIAL';
  }

  // ─── Platform stats (Home page) ────────────────────────────────────────────

  // Distinct SOCIETY subject_ids carrying at least one VERIFIED claim — a society
  // with both a VERIFIED NOC and a DISPUTED show-cause notice still counts once.
  async countVerifiedSocietySubjects(): Promise<number> {
    const result = await this.verRepo
      .createQueryBuilder('v')
      .select('COUNT(DISTINCT v.subject_id)', 'count')
      .where('v.subject_type = :type', { type: 'SOCIETY' })
      .andWhere('v.status = :status', { status: 'VERIFIED' })
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  async countEvidence(): Promise<number> {
    return this.eviRepo.count();
  }

  async findEvidenceByIds(ids: string[]): Promise<EvidenceEntity[]> {
    if (ids.length === 0) return [];
    return this.eviRepo.findBy({ id: In(ids) });
  }

  // Used internally and in tests; no public POST endpoint this capability
  async createVerification(data: {
    subject_type: 'SOCIETY' | 'DEVELOPER';
    subject_id: string;
    claim: string;
    claim_type: ClaimType;
    status: 'VERIFIED' | 'DISPUTED' | 'PENDING';
    evidence_refs: string[];
  }): Promise<VerificationEntity> {
    if (!data.claim_type) {
      throw new BadRequestException('claim_type is required for every Verification');
    }
    if (data.status === 'VERIFIED' && data.evidence_refs.length === 0) {
      throw new BadRequestException('VERIFIED status requires at least one evidence reference');
    }
    const entity = this.verRepo.create({
      ...data,
      verified_at: data.status === 'VERIFIED' ? new Date() : null,
    });
    const saved = await this.verRepo.save(entity);

    // Brand-new Verification — always a change from "no record" (old_value: null).
    await this.logObservation({
      entity_ref: saved.id,
      metric: 'verification_status',
      old_value: null,
      new_value: saved.status,
      source_ref: saved.claim,
    });

    return saved;
  }

  // ─── Capability 4: Evidence Submission flywheel ───────────────────────────

  async submitEvidence(dto: {
    linked_to: string;
    type: 'document' | 'photo' | 'receipt' | 'inspection_report';
    source_ref: string;
    file_ref: string;
  }): Promise<{ submission_id: string; status: 'pending_review' }> {
    // Resolve or create a PENDING Verification for this subject
    const existing = await this.verRepo.findOne({
      where: { subject_type: 'SOCIETY', subject_id: dto.linked_to },
    });
    if (!existing) {
      const pending = this.verRepo.create({
        subject_type: 'SOCIETY',
        subject_id: dto.linked_to,
        claim: 'Pending verification',
        claim_type: 'OTHER',
        status: 'PENDING',
        evidence_refs: [],
        verified_at: null,
      });
      await this.verRepo.save(pending);
    }

    const submission = this.subRepo.create({
      linked_to: dto.linked_to,
      type: dto.type,
      source_ref: dto.source_ref,
      file_ref: dto.file_ref,
      status: 'pending_review',
      submitted_by: null,
      record_type: 'FACT',
      data_classification: 'UNTRUSTED_DATA',
      reviewed_at: null,
    });
    const saved = await this.subRepo.save(submission);
    return { submission_id: saved.id, status: 'pending_review' };
  }

  async listPendingSubmissions(): Promise<EvidenceSubmissionEntity[]> {
    return this.subRepo.findBy({ status: 'pending_review' });
  }

  // Manual founder-only review method — no public endpoint in this capability
  async reviewSubmission(id: string, decision: 'accepted' | 'rejected'): Promise<void> {
    const submission = await this.subRepo.findOneBy({ id });
    if (!submission) throw new NotFoundException(`Submission ${id} not found`);

    if (decision === 'accepted') {
      await this.createAndLinkEvidence(submission.linked_to, {
        type: submission.type,
        file_ref: submission.file_ref,
        source_ref: submission.source_ref,
      });
    }

    submission.status = decision === 'accepted' ? 'accepted' : 'rejected';
    submission.reviewed_at = new Date();
    await this.subRepo.save(submission);
  }

  // Creates a standalone FACT Evidence row without linking it to any Verification.
  // Used by admin scripts that collect evidence IDs before calling createVerification().
  async createEvidenceRecord(data: {
    type: 'document' | 'photo' | 'receipt' | 'inspection_report';
    file_ref: string;
    source_ref: string;
  }): Promise<EvidenceEntity> {
    const evidence = this.eviRepo.create({ ...data, record_type: 'FACT' });
    return this.eviRepo.save(evidence);
  }

  // Shared by reviewSubmission() and the admin-add-society script.
  // Creates a FACT Evidence row and appends its id to the Verification's evidence_refs.
  async createAndLinkEvidence(
    subjectId: string,
    data: {
      type: 'document' | 'photo' | 'receipt' | 'inspection_report';
      file_ref: string;
      source_ref: string;
    },
  ): Promise<EvidenceEntity> {
    const evidence = this.eviRepo.create({ ...data, record_type: 'FACT' });
    const saved = await this.eviRepo.save(evidence);

    const verification = await this.verRepo.findOne({
      where: { subject_type: 'SOCIETY', subject_id: subjectId },
    });
    if (verification) {
      verification.evidence_refs = [...verification.evidence_refs, saved.id];
      await this.verRepo.save(verification);
    }

    return saved;
  }

  /**
   * @deprecated Use promoteVerificationToVerified(verificationId) instead. Looks up the
   * first Verification matching subject_id, which can promote the wrong record when a
   * subject has multiple Verification rows (e.g. multiple claims). Kept for backward
   * compatibility only.
   */
  async promoteToVerified(subjectId: string): Promise<VerificationEntity> {
    const verification = await this.verRepo.findOne({
      where: { subject_type: 'SOCIETY', subject_id: subjectId },
    });
    if (!verification) {
      throw new NotFoundException(`No verification record found for society ${subjectId}`);
    }
    if (verification.evidence_refs.length === 0) {
      throw new BadRequestException('Cannot promote to VERIFIED with zero evidence references');
    }
    verification.status = 'VERIFIED';
    verification.verified_at = new Date();
    return this.verRepo.save(verification);
  }

  // Admin-only: promote a specific Verification (by its own id) to VERIFIED.
  // ID-scoped so callers that already hold a Verification's id (e.g. from createVerification())
  // never risk promoting an unrelated record for the same subject_id.
  // Throws if no evidence has been linked yet (reuses the same invariant as createVerification).
  async promoteVerificationToVerified(verificationId: string): Promise<VerificationEntity> {
    const verification = await this.verRepo.findOneBy({ id: verificationId });
    if (!verification) {
      throw new NotFoundException(`No verification record found with id ${verificationId}`);
    }
    if (verification.evidence_refs.length === 0) {
      throw new BadRequestException('Cannot promote to VERIFIED with zero evidence references');
    }
    const oldStatus = verification.status;
    verification.status = 'VERIFIED';
    verification.verified_at = new Date();
    const saved = await this.verRepo.save(verification);

    // Skip if it was already VERIFIED — no real state change, would just be noise.
    if (oldStatus !== saved.status) {
      await this.logObservation({
        entity_ref: saved.id,
        metric: 'verification_status',
        old_value: oldStatus,
        new_value: saved.status,
        source_ref: saved.claim,
      });
    }

    return saved;
  }
}
