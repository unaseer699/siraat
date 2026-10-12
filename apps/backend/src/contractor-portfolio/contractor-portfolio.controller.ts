import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContractorPortfolioService } from './contractor-portfolio.service';

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v ?? null), z.string().trim().max(max).nullable());

const ProjectBodySchema = z.object({
  title: z.string().trim().min(2).max(150),
  society_name: optionalText(150),
  city: optionalText(100),
  plot_size: optionalText(50),
  completed_year: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.number().int().min(1990).max(new Date().getFullYear()).nullable(),
  ),
  description: optionalText(1000),
  photo_keys: z.array(z.string().max(200)).max(8).default([]),
});
type ProjectBody = z.infer<typeof ProjectBodySchema>;
const UploadUrlSchema = z.object({ content_type: z.string().trim().min(3).max(100) });
type UploadUrlBody = z.infer<typeof UploadUrlSchema>;
const PhotoKeysSchema = z.object({ photo_keys: z.array(z.string().max(200)).min(1).max(8) });
type PhotoKeysBody = z.infer<typeof PhotoKeysSchema>;
const StatusSchema = z.object({ status: z.enum(['PUBLISHED', 'REJECTED']) });
type StatusBody = z.infer<typeof StatusSchema>;

const fieldsOf = ({ photo_keys: _k, ...fields }: ProjectBody) => fields;

// PUBLIC: published portfolio, and the contractor's private upload link.
@Controller('v1/contractor-portfolio')
@UseGuards(BearerGuard)
export class ContractorPortfolioController {
  constructor(private readonly svc: ContractorPortfolioService) {}

  @Get('contractors/:id/projects')
  listPublished(@Param('id') id: string) {
    return this.svc.listPublished(id).then((projects) => ({ projects }));
  }

  @Get('links/:token')
  async link(@Param('token') token: string) {
    const c = await this.svc.contractorForToken(token);
    return { contractor_id: c.id, contractor_name: c.name };
  }

  @Post('links/:token/upload-url')
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  uploadUrl(@Param('token') token: string, @Body(new ZodValidationPipe(UploadUrlSchema)) body: UploadUrlBody) {
    return this.svc.createUploadUrlForToken(token, body.content_type);
  }

  @Post('links/:token/projects')
  @UseGuards(ThrottlerGuard)
  @HttpCode(201)
  submit(@Param('token') token: string, @Body(new ZodValidationPipe(ProjectBodySchema)) body: ProjectBody) {
    return this.svc.submitByContractor(token, fieldsOf(body), body.photo_keys);
  }
}

// ADMIN (under v1/admin so the frontend proxy requires the admin session).
@Controller('v1/admin/contractor-portfolio')
@UseGuards(BearerGuard)
export class ContractorPortfolioAdminController {
  constructor(private readonly svc: ContractorPortfolioService) {}

  @Get('pending')
  pending() {
    return this.svc.listPending().then((projects) => ({ projects }));
  }

  @Get('contractors/:id/projects')
  list(@Param('id') id: string) {
    return this.svc.listForAdmin(id).then((projects) => ({ projects }));
  }

  @Post('contractors/:id/upload-link')
  @HttpCode(200)
  createLink(@Param('id') id: string) {
    return this.svc.createLink(id);
  }

  @Post('contractors/:id/upload-url')
  @HttpCode(200)
  uploadUrl(@Param('id') id: string, @Body(new ZodValidationPipe(UploadUrlSchema)) body: UploadUrlBody) {
    return this.svc.createUploadUrl(id, body.content_type);
  }

  @Post('contractors/:id/projects')
  @HttpCode(201)
  create(@Param('id') id: string, @Body(new ZodValidationPipe(ProjectBodySchema)) body: ProjectBody) {
    return this.svc.createByAdmin(id, fieldsOf(body), body.photo_keys);
  }

  @Post('projects/:projectId/photos')
  @HttpCode(200)
  addPhotos(@Param('projectId') projectId: string, @Body(new ZodValidationPipe(PhotoKeysSchema)) body: PhotoKeysBody) {
    return this.svc.addPhotos(projectId, body.photo_keys);
  }

  @Delete('projects/:projectId/photos')
  @HttpCode(204)
  async removePhoto(@Param('projectId') projectId: string, @Query('key') key: string) {
    await this.svc.removePhoto(projectId, key);
  }

  @Post('projects/:projectId/status')
  @HttpCode(200)
  setStatus(@Param('projectId') projectId: string, @Body(new ZodValidationPipe(StatusSchema)) body: StatusBody) {
    return this.svc.setStatus(projectId, body.status);
  }

  @Delete('projects/:projectId')
  @HttpCode(204)
  async remove(@Param('projectId') projectId: string) {
    await this.svc.deleteProject(projectId);
  }
}
