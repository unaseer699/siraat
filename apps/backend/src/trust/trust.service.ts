import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { VerificationEntity } from './entities/verification.entity';
import { EvidenceEntity } from './entities/evidence.entity';
import { EvidenceSubmissionEntity } from './entities/evidence-submission.entity';

export interface VerificationResult {
  verification: VerificationEntity;
  evidence: EvidenceEntity[];
}

@Injectable()
export class TrustService {
  constructor(
    @InjectRepository(VerificationEntity)
    private readonly verRepo: Repository<VerificationEntity>,
    @InjectRepository(EvidenceEntity)
    private readonly eviRepo: Repository<EvidenceEntity>,
    @InjectRepository(EvidenceSubmissionEntity)
    private readonly subRepo: Repository<EvidenceSubmissionEntity>,
  ) {}

  async getVerification(
    subjectType: 'SOCIETY' | 'DEVELOPER',
    subjectId: string,
  ): Promise<VerificationResult | null> {
    const verification = await this.verRepo.findOne({
      where: { subject_type: subjectType, subject_id: subjectId },
    });
    if (!verification) return null;

    // Application-level join — never a cross-schema SQL join (Law 2)
    const evidence =
      verification.evidence_refs.length > 0
        ? await this.eviRepo.findBy({ id: In(verification.evidence_refs) })
        : [];

    return { verification, evidence };
  }

  async getEvidenceById(id: string): Promise<EvidenceEntity | null> {
    return this.eviRepo.findOneBy({ id });
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
    status: 'VERIFIED' | 'DISPUTED' | 'PENDING';
    evidence_refs: string[];
  }): Promise<VerificationEntity> {
    if (data.status === 'VERIFIED' && data.evidence_refs.length === 0) {
      throw new BadRequestException('VERIFIED status requires at least one evidence reference');
    }
    const entity = this.verRepo.create({
      ...data,
      verified_at: data.status === 'VERIFIED' ? new Date() : null,
    });
    return this.verRepo.save(entity);
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
      const evidence = this.eviRepo.create({
        type: submission.type,
        file_ref: submission.file_ref,
        source_ref: submission.source_ref,
        record_type: 'FACT',
      });
      const savedEvidence = await this.eviRepo.save(evidence);

      const verification = await this.verRepo.findOne({
        where: { subject_type: 'SOCIETY', subject_id: submission.linked_to },
      });
      if (verification) {
        verification.evidence_refs = [...verification.evidence_refs, savedEvidence.id];
        await this.verRepo.save(verification);
      }
    }

    submission.status = decision === 'accepted' ? 'accepted' : 'rejected';
    submission.reviewed_at = new Date();
    await this.subRepo.save(submission);
  }
}
