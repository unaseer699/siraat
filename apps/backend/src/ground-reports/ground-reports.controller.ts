import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GroundReportSubmissionService } from './ground-report-submission.service';

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v ?? null), z.string().trim().max(max).nullable());

export const CreateGroundReportBodySchema = z.object({
  society_name_raw: z.string().trim().min(2).max(255),
  block: z.string().trim().min(1).max(20),
  plot_number: optionalText(20),
  reporter_role: z.enum(['OWNER', 'BUILDER', 'CONTRACTOR', 'OTHER']),
  reporter_phone: z.string().trim().regex(/^\+?[\d\s()-]{10,20}$/, 'Enter a valid phone number'),
  ground_condition: z.enum(['SOLID', 'FILLED', 'MIXED']),
  soil_test_done: z.boolean().default(false),
  foundation_type: z.enum(['STANDARD', 'RAFT', 'DEEP_STRIP', 'PILING']),
  foundation_depth_ft: z.number().min(0).max(100).nullable().default(null),
  extra_cost_lac: z.number().min(0).max(100000).nullable().default(null),
  build_year: z.number().int().min(1990).max(new Date().getFullYear()).nullable().default(null),
  notes: optionalText(1000),
});
export type CreateGroundReportBody = z.infer<typeof CreateGroundReportBodySchema>;

// Public (visitor-facing) submission — rate-limited like listing alerts.
@Controller('v1/ground-reports')
@UseGuards(BearerGuard)
export class GroundReportsController {
  constructor(private readonly svc: GroundReportSubmissionService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(CreateGroundReportBodySchema)) body: CreateGroundReportBody) {
    return this.svc.submit(body);
  }
}
