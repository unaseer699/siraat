import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { GroundReportAttachment, GroundReportStatus, GroundReportSubmissionEntity } from './ground-report-submission.entity';
import { StorageService } from '../trust/storage.service';
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
  // Keys issued by createUploadUrl (web) — verified against the bucket below.
  attachment_keys?: string[];
  source?: 'WEB' | 'WHATSAPP';
}

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};
const KEY_PATTERN = /^ground-reports\/[0-9a-f-]{36}\.(jpg|png|webp|heic|pdf)$/;

const digits = (v: string) => v.replace(/\D/g, '');

@Injectable()
export class GroundReportSubmissionService {
  private readonly logger = new Logger(GroundReportSubmissionService.name);

  constructor(
    @InjectRepository(GroundReportSubmissionEntity)
    private readonly repo: Repository<GroundReportSubmissionEntity>,
    private readonly groundSvc: GroundConditionService,
    private readonly storage: StorageService,
  ) {}

  // Step 1 of a web upload: hand the browser a short-lived presigned PUT to a
  // server-chosen, unguessable key. The file is UNTRUSTED until an admin has
  // reviewed the report it is attached to.
  async createUploadUrl(contentType: string): Promise<{ key: string; upload_url: string; max_bytes: number }> {
    const ext = ALLOWED_ATTACHMENT_TYPES[contentType];
    if (!ext) throw new BadRequestException('Only JPG, PNG, WebP, HEIC photos or PDF files are accepted');
    const key = `ground-reports/${randomUUID()}.${ext}`;
    return { key, upload_url: await this.storage.getPresignedUploadUrl(key, contentType), max_bytes: MAX_ATTACHMENT_BYTES };
  }

  // A presigned PUT cannot enforce limits, so check what really landed.
  private async verifyAttachments(keys: string[]): Promise<GroundReportAttachment[]> {
    if (keys.length > MAX_ATTACHMENTS) throw new BadRequestException(`At most ${MAX_ATTACHMENTS} files per report`);
    const out: GroundReportAttachment[] = [];
    for (const key of new Set(keys)) {
      if (!KEY_PATTERN.test(key)) throw new BadRequestException('Invalid attachment reference');
      const head = await this.storage.headObject(key);
      if (!head) throw new BadRequestException('An uploaded file was not found — please upload it again');
      const type = head.contentType?.split(';')[0].trim() ?? '';
      if (!ALLOWED_ATTACHMENT_TYPES[type]) throw new BadRequestException('Unsupported file type');
      if (head.size <= 0 || head.size > MAX_ATTACHMENT_BYTES) {
        throw new BadRequestException(`Each file must be under ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`);
      }
      out.push({ key, content_type: type, size_bytes: head.size });
    }
    return out;
  }

  // WhatsApp route: attach a file the SERVER downloaded and stored itself to
  // the sender's most recent pending report (last 2 hours, under the cap).
  async attachToRecentReport(
    reporterPhone: string,
    file: GroundReportAttachment,
  ): Promise<{ count: number } | null> {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sub = await this.repo
      .createQueryBuilder('s')
      .where('s.reporter_phone = :phone', { phone: digits(reporterPhone) })
      .andWhere("s.status = 'PENDING_REVIEW'")
      .andWhere('s.created_at > :since', { since })
      .orderBy('s.created_at', 'DESC')
      .getOne();
    if (!sub || sub.attachments.length >= MAX_ATTACHMENTS) return null;
    sub.attachments = [...sub.attachments, file];
    await this.repo.save(sub);
    return { count: sub.attachments.length };
  }

  async hasRecentAttachableReport(reporterPhone: string): Promise<boolean> {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sub = await this.repo
      .createQueryBuilder('s')
      .where('s.reporter_phone = :phone', { phone: digits(reporterPhone) })
      .andWhere("s.status = 'PENDING_REVIEW'")
      .andWhere('s.created_at > :since', { since })
      .getOne();
    return !!sub && sub.attachments.length < MAX_ATTACHMENTS;
  }

  async getAttachmentUrl(id: string, index: number): Promise<{ url: string; content_type: string; expires_in_seconds: number }> {
    const sub = await this.repo.findOneBy({ id });
    const file = sub?.attachments[index];
    if (!sub || !file) throw new NotFoundException('Attachment not found');
    return {
      url: await this.storage.getPresignedDownloadUrl(file.key),
      content_type: file.content_type,
      expires_in_seconds: 900,
    };
  }

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

    const attachments = await this.verifyAttachments(input.attachment_keys ?? []);
    const { attachment_keys: _keys, ...rest } = input;
    void _keys;
    const saved = await this.repo.save(
      this.repo.create({
        ...rest,
        attachments,
        source: input.source ?? 'WEB',
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
      evidence_count: sub.attachments.length,
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
