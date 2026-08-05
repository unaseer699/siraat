import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { VerificationEntity } from './entities/verification.entity';
import { EvidenceEntity } from './entities/evidence.entity';

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
}
