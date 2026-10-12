import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { ContractorProject, ContractorProjectStatus } from '@siraat/shared-types';
import { ContractorProjectEntity, type ProjectPhotoRef } from './contractor-project.entity';
import { ContractorUploadLinkEntity } from './contractor-upload-link.entity';
import { StorageService } from '../trust/storage.service';
import { PropertyIntelligenceService } from '../property-intelligence/property-intelligence.service';

export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PENDING_PER_CONTRACTOR = 10;
export const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export interface ProjectFields {
  title: string;
  society_name: string | null;
  city: string | null;
  plot_size: string | null;
  completed_year: number | null;
  description: string | null;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class ContractorPortfolioService {
  private readonly logger = new Logger(ContractorPortfolioService.name);

  constructor(
    @InjectRepository(ContractorProjectEntity) private readonly projects: Repository<ContractorProjectEntity>,
    @InjectRepository(ContractorUploadLinkEntity) private readonly links: Repository<ContractorUploadLinkEntity>,
    private readonly storage: StorageService,
    private readonly piSvc: PropertyIntelligenceService,
  ) {}

  private async requireContractor(id: string) {
    const c = await this.piSvc.findContractorById(id);
    if (!c) throw new NotFoundException(`Contractor ${id} not found`);
    return c;
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  // Step 1 of an upload: a presigned PUT to a server-chosen, unguessable key
  // inside this contractor's own prefix.
  async createUploadUrl(contractorId: string, contentType: string) {
    const ext = PHOTO_TYPES[contentType];
    if (!ext) throw new BadRequestException('Only JPG, PNG or WebP photos are accepted');
    const key = `contractor-portfolio/${contractorId}/${randomUUID()}.${ext}`;
    return { key, upload_url: await this.storage.getPresignedUploadUrl(key, contentType), max_bytes: MAX_PHOTO_BYTES };
  }

  // A presigned PUT cannot enforce limits, so verify what really landed, and
  // that each key belongs to THIS contractor.
  private async verifyPhotos(contractorId: string, keys: string[]): Promise<ProjectPhotoRef[]> {
    const unique = [...new Set(keys)];
    if (unique.length > MAX_PHOTOS) throw new BadRequestException(`At most ${MAX_PHOTOS} photos per project`);
    const pattern = new RegExp(`^contractor-portfolio/${contractorId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);
    const out: ProjectPhotoRef[] = [];
    for (const key of unique) {
      if (!pattern.test(key)) throw new BadRequestException('Invalid photo reference');
      const head = await this.storage.headObject(key);
      if (!head) throw new BadRequestException('A photo was not found. Please upload it again');
      const type = head.contentType?.split(';')[0].trim() ?? '';
      if (!PHOTO_TYPES[type]) throw new BadRequestException('Unsupported photo type');
      if (head.size <= 0 || head.size > MAX_PHOTO_BYTES) {
        throw new BadRequestException(`Each photo must be under ${MAX_PHOTO_BYTES / 1024 / 1024} MB`);
      }
      out.push({ key, content_type: type, size_bytes: head.size });
    }
    return out;
  }

  private async toView(p: ContractorProjectEntity, opts: { admin: boolean; contractorName?: string }): Promise<ContractorProject> {
    const photos = await Promise.all(
      p.photos.map(async (ph) => ({
        url: await this.storage.getPresignedDownloadUrl(ph.key),
        content_type: ph.content_type,
        ...(opts.admin ? { key: ph.key } : {}),
      })),
    );
    return {
      id: p.id,
      contractor_id: p.contractor_id,
      ...(opts.contractorName ? { contractor_name: opts.contractorName } : {}),
      title: p.title,
      society_name: p.society_name,
      city: p.city,
      plot_size: p.plot_size,
      completed_year: p.completed_year,
      description: p.description,
      status: p.status,
      source: p.source,
      created_at: p.created_at.toISOString(),
      photos,
    };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  // Admin-entered: published straight away (the admin is the review step).
  async createByAdmin(contractorId: string, fields: ProjectFields, photoKeys: string[]) {
    await this.requireContractor(contractorId);
    const photos = await this.verifyPhotos(contractorId, photoKeys);
    const saved = await this.projects.save(
      this.projects.create({ ...fields, contractor_id: contractorId, photos, status: 'PUBLISHED', source: 'ADMIN', trust_tag: 'ADMIN_ENTERED' }),
    );
    return this.toView(saved, { admin: true });
  }

  // Contractor-submitted: always UNTRUSTED_DATA and PENDING_REVIEW (Law 8).
  async submitByContractor(token: string, fields: ProjectFields, photoKeys: string[]) {
    const contractor = await this.contractorForToken(token);
    if (photoKeys.length === 0) throw new BadRequestException('Add at least one photo of the project');
    const pending = await this.projects.count({ where: { contractor_id: contractor.id, status: 'PENDING_REVIEW' } });
    if (pending >= MAX_PENDING_PER_CONTRACTOR) {
      throw new ConflictException('You have projects waiting for review. Please wait until they are reviewed');
    }
    const photos = await this.verifyPhotos(contractor.id, photoKeys);
    const saved = await this.projects.save(
      this.projects.create({ ...fields, contractor_id: contractor.id, photos, status: 'PENDING_REVIEW', source: 'CONTRACTOR', trust_tag: 'UNTRUSTED_DATA' }),
    );
    return { id: saved.id, status: saved.status };
  }

  async addPhotos(projectId: string, photoKeys: string[]) {
    const p = await this.projects.findOneBy({ id: projectId });
    if (!p) throw new NotFoundException('Project not found');
    const added = await this.verifyPhotos(p.contractor_id, photoKeys);
    const have = new Set(p.photos.map((x) => x.key));
    const merged = [...p.photos, ...added.filter((x) => !have.has(x.key))];
    if (merged.length > MAX_PHOTOS) throw new BadRequestException(`At most ${MAX_PHOTOS} photos per project`);
    p.photos = merged;
    return this.toView(await this.projects.save(p), { admin: true });
  }

  async removePhoto(projectId: string, key: string) {
    const p = await this.projects.findOneBy({ id: projectId });
    if (!p || !p.photos.some((x) => x.key === key)) throw new NotFoundException('Photo not found');
    p.photos = p.photos.filter((x) => x.key !== key);
    await this.projects.save(p);
    await this.safeDelete(key);
  }

  // ── Review ────────────────────────────────────────────────────────────────

  async setStatus(projectId: string, status: Exclude<ContractorProjectStatus, 'PENDING_REVIEW'>) {
    const p = await this.projects.findOneBy({ id: projectId });
    if (!p) throw new NotFoundException('Project not found');
    if (status === 'PUBLISHED' && p.photos.length === 0) throw new BadRequestException('Add at least one photo before publishing');
    p.status = status;
    return this.toView(await this.projects.save(p), { admin: true });
  }

  async deleteProject(projectId: string) {
    const p = await this.projects.findOneBy({ id: projectId });
    if (!p) throw new NotFoundException('Project not found');
    await this.projects.delete({ id: projectId });
    for (const ph of p.photos) await this.safeDelete(ph.key);
  }

  // Called when a contractor is deleted: remove every project and its files.
  async deleteAllForContractor(contractorId: string): Promise<void> {
    const rows = await this.projects.find({ where: { contractor_id: contractorId } });
    for (const r of rows) for (const ph of r.photos) await this.safeDelete(ph.key);
    await this.projects.delete({ contractor_id: contractorId });
    await this.links.delete({ contractor_id: contractorId });
  }

  private async safeDelete(key: string) {
    try {
      await this.storage.deleteFile(key);
    } catch (err) {
      this.logger.error(`Could not delete ${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async listPublished(contractorId: string): Promise<ContractorProject[]> {
    const rows = await this.projects.find({ where: { contractor_id: contractorId, status: 'PUBLISHED' }, order: { created_at: 'DESC' } });
    return Promise.all(rows.map((r) => this.toView(r, { admin: false })));
  }

  async listForAdmin(contractorId: string): Promise<ContractorProject[]> {
    await this.requireContractor(contractorId);
    const rows = await this.projects.find({ where: { contractor_id: contractorId }, order: { created_at: 'DESC' } });
    return Promise.all(rows.map((r) => this.toView(r, { admin: true })));
  }

  async listPending(): Promise<ContractorProject[]> {
    const rows = await this.projects.find({ where: { status: 'PENDING_REVIEW' }, order: { created_at: 'ASC' } });
    const names = new Map<string, string>();
    for (const id of new Set(rows.map((r) => r.contractor_id))) {
      names.set(id, (await this.piSvc.findContractorById(id))?.name ?? 'Unknown contractor');
    }
    return Promise.all(rows.map((r) => this.toView(r, { admin: true, contractorName: names.get(r.contractor_id) })));
  }

  // ── Contractor upload links ───────────────────────────────────────────────

  // New link revokes any earlier one. The raw token is returned once only.
  async createLink(contractorId: string): Promise<{ token: string }> {
    await this.requireContractor(contractorId);
    await this.links
      .createQueryBuilder()
      .update()
      .set({ revoked_at: () => 'now()' })
      .where('contractor_id = :contractorId AND revoked_at IS NULL', { contractorId })
      .execute();
    const token = randomBytes(24).toString('base64url');
    await this.links.save(this.links.create({ contractor_id: contractorId, token_hash: sha256(token), revoked_at: null }));
    return { token };
  }

  async contractorForToken(token: string) {
    const link = await this.links.findOneBy({ token_hash: sha256(token) });
    if (!link || link.revoked_at) throw new NotFoundException('This upload link is not valid. Ask for a new one');
    return this.requireContractor(link.contractor_id);
  }

  async createUploadUrlForToken(token: string, contentType: string) {
    const c = await this.contractorForToken(token);
    return this.createUploadUrl(c.id, contentType);
  }
}
