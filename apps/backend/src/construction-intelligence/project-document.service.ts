import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { StorageService } from '../trust/storage.service';
import { ProjectDocumentEntity, ProjectDocumentKind } from './entities/project-document.entity';

export interface ProjectDocumentResult {
  id: string;
  kind: ProjectDocumentKind;
  title: string;
  content_type: string;
  size_bytes: number;
  visible_to_owner: boolean;
  created_at: string;
  download_url: string | null;
}

const MAX_BYTES = 30 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

@Injectable()
export class ProjectDocumentService {
  private readonly logger = new Logger(ProjectDocumentService.name);

  constructor(
    @InjectRepository(ProjectDocumentEntity)
    private readonly repo: Repository<ProjectDocumentEntity>,
    private readonly storage: StorageService,
  ) {}

  async requestUpload(projectId: string, data: { filename: string; content_type: string }) {
    if (!ALLOWED_TYPES.includes(data.content_type)) {
      throw new BadRequestException('Only PDF, PNG or JPEG files can be attached');
    }
    const safe = data.filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
    const key = `projects/${projectId}/documents/${randomUUID()}-${safe}`;
    const upload_url = await this.storage.getPresignedUploadUrl(key, data.content_type);
    return { upload_url, key, content_type: data.content_type };
  }

  async finalize(
    projectId: string,
    data: { key: string; content_type: string; kind: ProjectDocumentKind; title: string; visible_to_owner: boolean },
  ): Promise<ProjectDocumentResult> {
    if (!data.key.startsWith(`projects/${projectId}/documents/`)) {
      throw new BadRequestException('File key does not belong to this project');
    }
    const head = await this.storage.headObject(data.key);
    if (!head) throw new BadRequestException('Uploaded file was not found; upload it again');
    if (head.size > MAX_BYTES) {
      await this.storage.deleteFile(data.key).catch(() => undefined);
      throw new BadRequestException('File is larger than 30 MB');
    }
    const row = await this.repo.save(
      this.repo.create({
        project_ref: projectId,
        kind: data.kind,
        title: data.title,
        storage_ref: data.key,
        content_type: data.content_type,
        size_bytes: String(head.size),
        visible_to_owner: data.visible_to_owner,
      }),
    );
    return this.toResult(row, true);
  }

  async list(projectId: string, opts: { ownerView: boolean }): Promise<ProjectDocumentResult[]> {
    const rows = await this.repo.find({
      where: opts.ownerView ? { project_ref: projectId, visible_to_owner: true } : { project_ref: projectId },
      order: { created_at: 'ASC' },
    });
    return Promise.all(rows.map((r) => this.toResult(r, true)));
  }

  async setVisibility(projectId: string, docId: string, visible: boolean): Promise<void> {
    const res = await this.repo.update({ id: docId, project_ref: projectId }, { visible_to_owner: visible });
    if (!res.affected) throw new NotFoundException('Document not found');
  }

  async setKind(projectId: string, docId: string, kind: ProjectDocumentKind): Promise<void> {
    const res = await this.repo.update({ id: docId, project_ref: projectId }, { kind });
    if (!res.affected) throw new NotFoundException('Document not found');
  }

  async remove(projectId: string, docId: string): Promise<void> {
    const row = await this.repo.findOneBy({ id: docId, project_ref: projectId });
    if (!row) throw new NotFoundException('Document not found');
    await this.repo.delete({ id: docId });
    await this.storage.deleteFile(row.storage_ref).catch((e) => this.logger.warn(`Storage cleanup failed: ${e}`));
  }

  async getForExtraction(projectId: string, docId: string): Promise<{ doc: ProjectDocumentEntity; bytes: Buffer }> {
    const doc = await this.repo.findOneBy({ id: docId, project_ref: projectId });
    if (!doc) throw new NotFoundException('Document not found');
    return { doc, bytes: await this.storage.getObjectBuffer(doc.storage_ref) };
  }

  private async toResult(r: ProjectDocumentEntity, withUrl: boolean): Promise<ProjectDocumentResult> {
    return {
      id: r.id,
      kind: r.kind as ProjectDocumentKind,
      title: r.title,
      content_type: r.content_type,
      size_bytes: Number(r.size_bytes),
      visible_to_owner: r.visible_to_owner,
      created_at: r.created_at.toISOString(),
      download_url: withUrl ? await this.storage.getPresignedDownloadUrl(r.storage_ref) : null,
    };
  }
}
