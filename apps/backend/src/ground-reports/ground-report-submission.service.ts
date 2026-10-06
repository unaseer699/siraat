import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroundReportStatus, GroundReportSubmissionEntity } from './ground-report-submission.entity';
import { GroundConditionService } from '../property-intelligence/ground-condition.service';

export interface CreateGroundReportInput {
  society_name_raw: string;
  block: string;
  plot_number: string | null;
  reporter_role: string;
  reporter_phone: string;
  ground_condition: 'SOLID' | 'FILLED' | 'MIXED';
  soil_test_done: boolean;
  foundation_type: 'STANDARD' | 'RAFT' | 'DEEP_STRIP' | 'PILING';
  foundation_depth_ft: number | null;
  extra_cost_lac: number | null;
  build_year: number | null;
  notes: string | null;
}

const digits = (v: string) => v.replace(/\D/g, '');

@Injectable()
export class GroundReportSubmissionService {
  private readonly logger = new Logger(GroundReportSubmissionService.name);

  constructor(
    @InjectRepository(GroundReportSubmissionEntity)
    private readonly repo: Repository<GroundReportSubmissionEntity>,
    private readonly groundSvc: GroundConditionService,
  ) {}

  // Public submit. Always lands as UNTRUSTED_DATA / PENDING_REVIEW (Law 8) —
  // nothing here can create a FACT.
  async submit(input: CreateGroundReportInput): Promise<{ id: string; status: GroundReportStatus }> {
    const block = input.block.trim().toUpperCase();
    const society = input.society_name_raw.trim();
    const phone = digits(input.reporter_phone);

    // One report per reporter per society+block+plot, so a single person
    // cannot inflate a block's report count (and so its confidence).
    const existing = await this.repo
      .createQueryBuilder('s')
      .where('s.reporter_phone = :phone', { phone })
      .andWhere('lower(s.society_name_raw) = lower(:society)', { society })
      .andWhere('s.block = :block', { block })
      .andWhere('s.plot_number IS NOT DISTINCT FROM :plot', { plot: input.plot_number })
      .andWhere("s.status <> 'REJECTED'")
      .getOne();
    if (existing) {
      throw new ConflictException({
        error_code: 'DUPLICATE_REPORT',
        message: 'You have already reported this plot/block — thank you. It is awaiting review or already counted.',
      });
    }

    const saved = await this.repo.save(
      this.repo.create({
        ...input,
        society_name_raw: society,
        block,
        reporter_phone: phone,
        trust_tag: 'UNTRUSTED_DATA',
        status: 'PENDING_REVIEW',
      }),
    );
    return { id: saved.id, status: saved.status };
  }

  list(status: GroundReportStatus = 'PENDING_REVIEW'): Promise<GroundReportSubmissionEntity[]> {
    return this.repo.find({ where: { status }, order: { created_at: 'DESC' }, take: 200 });
  }

  // Approve = a human has judged it plausible. Creates one immutable FACT.
  // Two schemas are involved (property_intelligence fact, data_acquisition
  // submission), so — Law 2 — these are two sequential writes, never one
  // transaction. A failure between them leaves the submission PENDING, and the
  // fact_ref guard below makes a retry idempotent.
  async approve(id: string): Promise<GroundReportSubmissionEntity> {
    const sub = await this.repo.findOneBy({ id });
    if (!sub) throw new NotFoundException(`Ground report ${id} not found`);
    if (sub.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Report ${id} cannot be approved — it is already ${sub.status}.`);
    }
    if (sub.fact_ref) {
      await this.repo.update({ id }, { status: 'APPROVED' });
      return { ...sub, status: 'APPROVED' };
    }

    const fact = await this.groundSvc.createFact({
      society_name_raw: sub.society_name_raw,
      block: sub.block,
      plot_number: sub.plot_number,
      reporter_role: sub.reporter_role,
      ground_condition: sub.ground_condition,
      soil_test_done: sub.soil_test_done,
      foundation_type: sub.foundation_type,
      foundation_depth_ft: sub.foundation_depth_ft === null ? null : Number(sub.foundation_depth_ft),
      extra_cost_lac: sub.extra_cost_lac === null ? null : Number(sub.extra_cost_lac),
      build_year: sub.build_year,
      notes: sub.notes,
      source_ref: sub.id,
    });
    await this.repo.update({ id }, { status: 'APPROVED', fact_ref: fact.id });
    return { ...sub, status: 'APPROVED', fact_ref: fact.id };
  }

  async reject(id: string, reason: string | null): Promise<GroundReportSubmissionEntity> {
    const sub = await this.repo.findOneBy({ id });
    if (!sub) throw new NotFoundException(`Ground report ${id} not found`);
    if (sub.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Report ${id} cannot be rejected — it is already ${sub.status}.`);
    }
    await this.repo.update({ id }, { status: 'REJECTED', review_note: reason });
    return { ...sub, status: 'REJECTED', review_note: reason };
  }
}
