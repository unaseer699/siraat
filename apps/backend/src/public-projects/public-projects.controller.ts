import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PROJECT_STATUSES } from './entities/public-project.entity';
import { PublicProjectsService } from './public-projects.service';

const StatusEventSchema = z.object({
  status: z.enum(PROJECT_STATUSES),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  source_url: z.string().url(),
  source_kind: z.enum(['OFFICIAL', 'MEDIA']).optional(),
});

@Controller('v1/public-projects')
@UseGuards(BearerGuard)
export class PublicProjectsController {
  constructor(private readonly svc: PublicProjectsService) {}

  @Get()
  list(@Query('category') category?: string, @Query('q') q?: string) {
    return this.svc.list({ category, q });
  }
}

@Controller('v1/admin/public-projects')
@UseGuards(BearerGuard)
export class PublicProjectsAdminController {
  constructor(private readonly svc: PublicProjectsService) {}

  // Same job the 08:00 schedule runs, for a manual run.
  @Post('refresh')
  refresh() {
    return this.svc.refreshNews();
  }

  @Post(':slug/events')
  addEvent(@Param('slug') slug: string, @Body(new ZodValidationPipe(StatusEventSchema)) body: z.infer<typeof StatusEventSchema>) {
    return this.svc.addStatusEvent(slug, body);
  }
}
