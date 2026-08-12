import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SocietyResult } from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';
import { ScoreEntity } from './entities/score.entity';

// Tunable business value: penalty applied to confidence_score when society data is stale
const STALENESS_CONFIDENCE_PENALTY = 0.15;
// Per adverse disputed claim (SHOW_CAUSE_NOTICE or ILLEGAL_SCHEME_NOTICE with status DISPUTED)
const ADVERSE_CLAIM_PENALTY = 0.20;

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

    // Read all claims from Trust — aggregate across every claim for this subject
    const allVerifications = await this.trustSvc.getVerifications('SOCIETY', society.id);

    // Deduplicated evidence IDs from every claim
    const evidenceIds = [
      ...new Set(allVerifications.flatMap((r) => r.evidence.map((e) => e.id))),
    ];
    const evidenceCount = evidenceIds.length;

    // Primary claim determines isVerified (NOC or PLANNING_APPROVAL first, else first record)
    const primaryClaim =
      allVerifications.find(
        (r) =>
          r.verification.claim_type === 'NOC' ||
          r.verification.claim_type === 'PLANNING_APPROVAL',
      ) ?? allVerifications[0];
    const isVerified = primaryClaim !== undefined && primaryClaim.verification.status === 'VERIFIED';

    // Adverse claims: disputed show-cause or illegal-scheme notices reduce confidence
    const adverseClaimCount = allVerifications.filter(
      (r) =>
        (r.verification.claim_type === 'SHOW_CAUSE_NOTICE' ||
          r.verification.claim_type === 'ILLEGAL_SCHEME_NOTICE') &&
        r.verification.status === 'DISPUTED',
    ).length;

    const confidenceScore = this.computeConfidence(society, evidenceCount, adverseClaimCount);

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
      derived_from: evidenceIds, // Evidence IDs from ALL claims, deduplicated (FACT records)
      affiliation_disclosure: affiliationDisclosure,
      reasoning_summary: this.buildReasoning(society, confidenceScore, evidenceCount, isVerified, adverseClaimCount),
      record_type: 'GENERATED',
    });

    return this.repo.save(score);
  }

  async findById(id: string): Promise<ScoreEntity | null> {
    return this.repo.findOneBy({ id });
  }

  private computeConfidence(s: SocietyResult, evidenceCount: number, adverseClaimCount: number): number {
    let score = s.base_confidence;
    // Each evidence item beyond the first adds a small bonus, capped at +0.10
    const docBonus = Math.min((evidenceCount - 1) * 0.03, 0.1);
    score += docBonus;
    // Stale data reduces trust
    if (s.is_stale) score -= STALENESS_CONFIDENCE_PENALTY;
    // Each adverse disputed claim (SHOW_CAUSE_NOTICE / ILLEGAL_SCHEME_NOTICE) stacks a penalty
    score -= adverseClaimCount * ADVERSE_CLAIM_PENALTY;
    // Affiliation never influences confidence (Law 6)
    return parseFloat(Math.max(0, Math.min(1, score)).toFixed(4));
  }

  private buildReasoning(
    s: SocietyResult,
    score: number,
    evidenceCount: number,
    isVerified: boolean,
    adverseClaimCount: number,
  ): string {
    const parts: string[] = [];
    if (isVerified) parts.push('Trust verification confirmed');
    else if (s.noc_approved) parts.push('NOC approved (trust verification pending)');
    parts.push(`${evidenceCount} evidence item${evidenceCount !== 1 ? 's' : ''} on record`);
    if (s.is_stale) parts.push('data is stale — confidence reduced');
    if (adverseClaimCount > 0) {
      parts.push(`⚠ ${adverseClaimCount} active show-cause notice${adverseClaimCount !== 1 ? 's' : ''} reduces confidence`);
    }
    if (s.noc_summary) parts.push(s.noc_summary);
    return `Confidence ${Math.round(score * 100)}%: ${parts.join('. ')}.`;
  }
}
