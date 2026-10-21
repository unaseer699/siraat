import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { ConstructionProjectService } from './construction-project.service';
import { ExpenseAttachmentService } from './expense-attachment.service';
import { ProjectDocumentService } from './project-document.service';
import { ProjectForecastService } from './project-forecast.service';
import { PublicBuildsService } from './public-builds.service';

// PROJECT COST TRACKER Chunk 2 fix — a genuinely public route, matching the
// pattern every other "public" page in this app follows (its own route
// under the domain namespace, not borrowed from /admin). This is a second
// route hitting the same ConstructionProjectService.getProjectWithSectionsAndExpenses
// that GET /v1/admin/projects/:id (AdminController) already uses — that
// admin route stays as-is for the admin management page, this doesn't
// replace it.
@Controller('v1/construction-intelligence')
@UseGuards(BearerGuard)
export class ConstructionProjectController {
  constructor(
    private readonly cpSvc: ConstructionProjectService,
    private readonly docs: ProjectDocumentService,
    private readonly bills: ExpenseAttachmentService,
    private readonly forecastSvc: ProjectForecastService,
    private readonly publicBuilds: PublicBuildsService,
  ) {}

  // REAL BUILDS — anonymised summaries of owner-opted-in projects. Never 404s:
  // NOT_COVERED when nothing is shared.
  @Get('public-builds')
  listPublicBuilds() {
    return this.publicBuilds.list();
  }

  @Get('public-builds/:id')
  getPublicBuild(@Param('id') id: string) {
    return this.publicBuilds.get(id);
  }

  @Get('public-builds/:id/expenses')
  getPublicBuildExpenses(@Param('id') id: string) {
    return this.publicBuilds.expenses(id);
  }

  @Get('projects/:id')
  async getProject(@Param('id') id: string) {
    const result = await this.cpSvc.getProjectWithSectionsAndExpenses(id);
    if (!result) throw new NotFoundException(`Project ${id} not found`);
    return result;
  }

  // Drawings and reports the admin has chosen to show the project owner.
  // Download links are short-lived presigned URLs.
  @Get('projects/:id/documents')
  async getDocuments(@Param('id') id: string) {
    return this.docs.list(id, { ownerView: true });
  }

  // Bills and invoices the admin has chosen to show the owner.
  @Get('projects/:id/bills')
  async getBills(@Param('id') id: string) {
    const project = await this.cpSvc.findProjectById(id);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return this.bills.list(id, { ownerView: true });
  }

  // Forecast for the owner dashboard. Only a confirmed layout is shown; an
  // unconfirmed one reports NOT_COVERED so draft numbers never reach the owner.
  @Get('projects/:id/forecast')
  async getForecast(@Param('id') id: string) {
    const project = await this.cpSvc.findProjectById(id);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    const fc = await this.forecastSvc.forecast(id);
    if (fc.state !== 'FULL') return { state: 'NOT_COVERED' as const };
    return { ...fc, layout: fc.layout ? { total_area_sqft: fc.layout.total_area_sqft, finish_level: fc.layout.finish_level } : null };
  }
}
