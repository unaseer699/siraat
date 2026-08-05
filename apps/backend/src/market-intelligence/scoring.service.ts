import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SocietyResult } from '../property-intelligence/property-intelligence.service';
import { ScoreEntity } from './entities/score.entity';

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(ScoreEntity)
    private readonly repo: Repository<ScoreEntity>,
  ) {}

  async computeAndSave(society: SocietyResult): Promise<ScoreEntity> {
    const confidenceScore = this.computeConfidence(society);

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
      derived_from: [...society.source_document_ids], // copied at computation time
      affiliation_disclosure: affiliationDisclosure,
      reasoning_summary: this.buildReasoning(society, confidenceScore),
      record_type: 'GENERATED',
    });

    return this.repo.save(score);
  }

  async findById(id: string): Promise<ScoreEntity | null> {
    return this.repo.findOneBy({ id });
  }

  private computeConfidence(s: SocietyResult): number {
    // Base from the FACT record stored on the society
    let score = s.base_confidence;
    // Each cited document beyond the first adds a small bonus, capped at +0.10
    const docBonus = Math.min((s.source_document_ids.length - 1) * 0.03, 0.1);
    score += docBonus;
    // Stale data reduces trust
    if (s.is_stale) score -= 0.15;
    // Affiliation never influences confidence (Law 6)
    return parseFloat(Math.max(0, Math.min(1, score)).toFixed(4));
  }

  private buildReasoning(s: SocietyResult, score: number): string {
    const parts: string[] = [];
    if (s.noc_approved) parts.push('NOC approved');
    const n = s.source_document_ids.length;
    parts.push(`${n} independent source${n !== 1 ? 's' : ''} cited`);
    if (s.is_stale) parts.push('data is stale — confidence reduced');
    if (s.noc_summary) parts.push(s.noc_summary);
    return `Confidence ${Math.round(score * 100)}%: ${parts.join('. ')}.`;
  }
}
