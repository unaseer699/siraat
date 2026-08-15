import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SocietyResult } from '../property-intelligence/property-intelligence.service';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';
import { TrustService } from '../trust/trust.service';
import { ScoreEntity } from './entities/score.entity';
import type { ScoreBreakdown } from '@siraat/shared-types';

// Tunable business value: penalty applied to confidence_score when society data is stale
const STALENESS_CONFIDENCE_PENALTY = 0.15;
// Per adverse disputed claim (SHOW_CAUSE_NOTICE or ILLEGAL_SCHEME_NOTICE with status DISPUTED)
const ADVERSE_CLAIM_PENALTY = 0.20;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    @InjectRepository(ScoreEntity)
    private readonly repo: Repository<ScoreEntity>,
    private readonly trustSvc: TrustService,
    private readonly propertyIntelSvc: PropertyIntelligenceService,
  ) {}

  async computeAndSave(society: SocietyResult): Promise<ScoreEntity> {
    // Reuse an existing non-stale Score within the staleness window — avoids unbounded growth.
    // Also doubles as the "prior score" baseline for Observation logging below: if we're
    // past this point, `existing` (when present) is the last confidence_score on record.
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

    const docBonus = Math.min((evidenceCount - 1) * 0.03, 0.1);
    const confidenceScore = this.computeConfidence(society, docBonus, adverseClaimCount);

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
      breakdown: this.buildBreakdown(society, evidenceCount, adverseClaimCount, primaryClaim, isVerified, docBonus),
      record_type: 'GENERATED',
    });

    const saved = await this.repo.save(score);

    // Only log when the value genuinely changed — an identical recomputation
    // (e.g. cache expired but nothing about the society actually moved) is noise,
    // not an Observation. Owned by Property Intelligence (the Society's context),
    // not Market Intelligence — logged via its public API, never its schema directly.
    if (existing && Number(existing.confidence_score) !== Number(saved.confidence_score)) {
      try {
        await this.propertyIntelSvc.logObservation({
          entity_ref: society.id,
          metric: 'confidence_score',
          old_value: String(existing.confidence_score),
          new_value: String(saved.confidence_score),
          source_ref: 'ScoringService.computeAndSave',
        });
      } catch (err) {
        // logObservation already swallows its own write failures — this guards the
        // cross-module call boundary itself, so score computation can never fail here.
        this.logger.error('Failed to log confidence_score Observation', err instanceof Error ? err.stack : String(err));
      }
    }

    return saved;
  }

  async findById(id: string): Promise<ScoreEntity | null> {
    return this.repo.findOneBy({ id });
  }

  private computeConfidence(s: SocietyResult, docBonus: number, adverseClaimCount: number): number {
    let score = s.base_confidence;
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

  private buildBreakdown(
    s: SocietyResult,
    evidenceCount: number,
    adverseClaimCount: number,
    primaryClaim: { verification: { claim_type: string; status: string } } | undefined,
    isVerified: boolean,
    docBonus: number,
  ): ScoreBreakdown {
    // regulatory
    let regulatoryStatus: ScoreBreakdown['regulatory']['status'];
    let regulatoryTone: ScoreBreakdown['regulatory']['tone'];
    let regulatoryLabel: string;
    if (!primaryClaim) {
      regulatoryStatus = 'NONE';
      regulatoryTone = 'neutral';
      regulatoryLabel = 'No regulatory clearance on record';
    } else if (isVerified) {
      regulatoryStatus = 'VERIFIED';
      regulatoryTone = 'success';
      regulatoryLabel = s.noc_summary ?? 'NOC Verified';
    } else if (primaryClaim.verification.claim_type === 'PLANNING_APPROVAL') {
      regulatoryStatus = 'PLANNING_APPROVAL';
      regulatoryTone = 'warning';
      regulatoryLabel = s.noc_summary ?? 'Planning approval — verification pending';
    } else {
      regulatoryStatus = 'PENDING';
      regulatoryTone = 'warning';
      regulatoryLabel = s.noc_summary ?? 'Approval pending';
    }

    // data_freshness checked_date: e.g. "12 Aug 2026"
    const checkedDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return {
      regulatory: { status: regulatoryStatus, label: regulatoryLabel, tone: regulatoryTone },
      active_issues: {
        count: adverseClaimCount,
        penalty_applied: parseFloat((adverseClaimCount * ADVERSE_CLAIM_PENALTY).toFixed(4)),
        label:
          adverseClaimCount === 0
            ? 'No active notices'
            : `${adverseClaimCount} active show-cause notice${adverseClaimCount !== 1 ? 's' : ''}`,
        tone: adverseClaimCount === 0 ? 'success' : 'danger',
      },
      evidence_strength: {
        count: evidenceCount,
        bonus_applied: parseFloat(docBonus.toFixed(4)),
        label: `${evidenceCount} independent document${evidenceCount !== 1 ? 's' : ''}`,
        tone: evidenceCount === 0 ? 'danger' : evidenceCount <= 2 ? 'neutral' : 'success',
      },
      data_freshness: {
        is_stale: s.is_stale,
        penalty_applied: s.is_stale ? STALENESS_CONFIDENCE_PENALTY : 0,
        checked_date: checkedDate,
        tone: s.is_stale ? 'warning' : 'success',
      },
    };
  }
}
