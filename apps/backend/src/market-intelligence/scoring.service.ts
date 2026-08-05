import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SocietyResult } from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';
import { ScoreEntity } from './entities/score.entity';

// Tunable business value: penalty applied to confidence_score when society data is stale
const STALENESS_CONFIDENCE_PENALTY = 0.15;

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(ScoreEntity)
    private readonly repo: Repository<ScoreEntity>,
    private readonly trustSvc: TrustService,
  ) {}

  async computeAndSave(society: SocietyResult): Promise<ScoreEntity> {
    // Reuse an existing non-stale Score within the staleness window — avoids unbounded growth
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - society.staleness_threshold_days);
    const existing = await this.repo.findOne({
      where: { subject_type: 'SOCIETY', subject_id: society.id, is_stale: false },
      order: { computed_at: 'DESC' },
    });
    if (existing && existing.computed_at > cutoff) {
      return existing;
    }

    // Read evidence from Trust — source of truth for confidence (replaces Society.source_document_ids)
    const trustData = await this.trustSvc.getVerification('SOCIETY', society.id);
    const evidenceIds = trustData?.evidence.map((e) => e.id) ?? [];
    const evidenceCount = evidenceIds.length;
    const isVerified = trustData?.verification.status === 'VERIFIED';

    const confidenceScore = this.computeConfidence(society, evidenceCount);

    // Law 6: affiliation_disclosure non-null IFF is_siraat_affiliated; never influences score
    const affiliationDisclosure = society.is_siraat_affiliated
      ? (society.affiliation_disclosure ?? 'Siraat-affiliated partner')
      : null;

    const score = this.repo.create({
      subject_type: 'SOCIETY',
      subject_id: society.id,
      confidence_score: confidenceScore,
      is_stale: society.is_stale,
      staleness_threshold_days: society.staleness_threshold_days,
      derived_from: evidenceIds, // Evidence IDs from Trust (FACT records)
      affiliation_disclosure: affiliationDisclosure,
      reasoning_summary: this.buildReasoning(society, confidenceScore, evidenceCount, isVerified),
      record_type: 'GENERATED',
    });

    return this.repo.save(score);
  }

  async findById(id: string): Promise<ScoreEntity | null> {
    return this.repo.findOneBy({ id });
  }

  private computeConfidence(s: SocietyResult, evidenceCount: number): number {
    let score = s.base_confidence;
    // Each evidence item beyond the first adds a small bonus, capped at +0.10
    const docBonus = Math.min((evidenceCount - 1) * 0.03, 0.1);
    score += docBonus;
    // Stale data reduces trust
    if (s.is_stale) score -= STALENESS_CONFIDENCE_PENALTY;
    // Affiliation never influences confidence (Law 6)
    return parseFloat(Math.max(0, Math.min(1, score)).toFixed(4));
  }

  private buildReasoning(
    s: SocietyResult,
    score: number,
    evidenceCount: number,
    isVerified: boolean,
  ): string {
    const parts: string[] = [];
    if (isVerified) parts.push('Trust verification confirmed');
    else if (s.noc_approved) parts.push('NOC approved (trust verification pending)');
    parts.push(`${evidenceCount} evidence item${evidenceCount !== 1 ? 's' : ''} on record`);
    if (s.is_stale) parts.push('data is stale — confidence reduced');
    if (s.noc_summary) parts.push(s.noc_summary);
    return `Confidence ${Math.round(score * 100)}%: ${parts.join('. ')}.`;
  }
}
