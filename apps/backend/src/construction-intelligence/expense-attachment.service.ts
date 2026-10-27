import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { StorageService } from '../trust/storage.service';
import { ExpenseAttachmentEntity } from './entities/expense-attachment.entity';
import { ProjectExpenseEntity } from './entities/project-expense.entity';
import { ProjectSectionEntity } from './entities/project-section.entity';

export interface ExpenseAttachmentResult {
  id: string;
  expense_ref: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  visible_to_owner: boolean;
  created_at: string;
  download_url: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

@Injectable()
export class ExpenseAttachmentService {
  private readonly logger = new Logger(ExpenseAttachmentService.name);

  constructor(
    @InjectRepository(ExpenseAttachmentEntity)
    private readonly repo: Repository<ExpenseAttachmentEntity>,
    @InjectRepository(ProjectExpenseEntity)
    private readonly expenseRepo: Repository<ProjectExpenseEntity>,
    @InjectRepository(ProjectSectionEntity)
    private readonly sectionRepo: Repository<ProjectSectionEntity>,
    private readonly storage: StorageService,
  ) {}

  async requestUpload(projectId: string, data: { filename: string; content_type: string }) {
    if (!ALLOWED_TYPES.includes(data.content_type)) {
      throw new BadRequestException('Only PDF, PNG, JPEG or WebP files can be attached');
    }
    const safe = data.filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
    const key = `projects/${projectId}/bills/${randomUUID()}-${safe}`;
    const upload_url = await this.storage.getPresignedUploadUrl(key, data.content_type);
    return { upload_url, key, content_type: data.content_type };
  }

  async attach(
    projectId: string,
    expenseId: string,
    data: { key: string; filename: string; content_type: string; visible_to_owner: boolean },
  ): Promise<ExpenseAttachmentResult> {
    if (!data.key.startsWith(`projects/${projectId}/bills/`)) {
      throw new BadRequestException('File key does not belong to this project');
    }
    if (!ALLOWED_TYPES.includes(data.content_type)) {
      throw new BadRequestException('Only PDF, PNG, JPEG or WebP files can be attached');
    }
    const expense = await this.expenseRepo.findOneBy({ id: expenseId });
    const section = expense ? await this.sectionRepo.findOneBy({ id: expense.section_ref }) : null;
    if (!expense || !section || section.project_ref !== projectId) {
      throw new NotFoundException(`Expense ${expenseId} not found in project ${projectId}`);
    }
    const head = await this.storage.headObject(data.key);
    if (!head) throw new BadRequestException('Uploaded file was not found; upload it again');
    if (head.size > MAX_BYTES) {
      await this.storage.deleteFile(data.key).catch(() => undefined);
      throw new BadRequestException('File is larger than 10 MB');
    }
    const row = await this.repo.save(
      this.repo.create({
        project_ref: projectId,
        expense_ref: expenseId,
        storage_ref: data.key,
        filename: data.filename.slice(0, 200),
        content_type: data.content_type,
        size_bytes: String(head.size),
        visible_to_owner: data.visible_to_owner,
      }),
    );
    return this.toResult(row);
  }

  // Server-side variant for bills that arrive as bytes (WhatsApp photos).
  async attachFromBuffer(
    projectId: string,
    expenseId: string,
    data: { data: Buffer; content_type: string; filename: string; visible_to_owner: boolean },
  ): Promise<ExpenseAttachmentResult> {
    if (!ALLOWED_TYPES.includes(data.content_type)) {
      throw new BadRequestException('Only PDF, PNG, JPEG or WebP files can be attached');
    }
    if (data.data.length > MAX_BYTES) throw new BadRequestException('File is larger than 10 MB');
    const expense = await this.expenseRepo.findOneBy({ id: expenseId });
    const section = expense ? await this.sectionRepo.findOneBy({ id: expense.section_ref }) : null;
    if (!expense || !section || section.project_ref !== projectId) {
      throw new NotFoundException(`Expense ${expenseId} not found in project ${projectId}`);
    }
    const safe = data.filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
    const key = `projects/${projectId}/bills/${randomUUID()}-${safe}`;
    await this.storage.uploadFile(key, data.data, data.content_type);
    const row = await this.repo.save(
      this.repo.create({
        project_ref: projectId,
        expense_ref: expenseId,
        storage_ref: key,
        filename: data.filename.slice(0, 200),
        content_type: data.content_type,
        size_bytes: String(data.data.length),
        visible_to_owner: data.visible_to_owner,
      }),
    );
    return this.toResult(row);
  }

  async list(projectId: string, opts: { ownerView: boolean }): Promise<ExpenseAttachmentResult[]> {
    const rows = await this.repo.find({
      where: opts.ownerView ? { project_ref: projectId, visible_to_owner: true } : { project_ref: projectId },
      order: { created_at: 'ASC' },
    });
    return Promise.all(rows.map((r) => this.toResult(r)));
  }

  async setVisibility(projectId: string, id: string, visible: boolean): Promise<void> {
    const res = await this.repo.update({ id, project_ref: projectId }, { visible_to_owner: visible });
    if (!res.affected) throw new NotFoundException('Bill not found');
  }

  async remove(projectId: string, id: string): Promise<void> {
    const row = await this.repo.findOneBy({ id, project_ref: projectId });
    if (!row) throw new NotFoundException('Bill not found');
    await this.repo.delete({ id });
    await this.storage.deleteFile(row.storage_ref).catch((e) => this.logger.warn(`Storage cleanup failed: ${e}`));
  }

  private async toResult(r: ExpenseAttachmentEntity): Promise<ExpenseAttachmentResult> {
    return {
      id: r.id,
      expense_ref: r.expense_ref,
      filename: r.filename,
      content_type: r.content_type,
      size_bytes: Number(r.size_bytes),
      visible_to_owner: r.visible_to_owner,
      created_at: r.created_at.toISOString(),
      download_url: await this.storage.getPresignedDownloadUrl(r.storage_ref),
    };
  }
}
