import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { ConstructionProjectService } from './construction-project.service';

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
  constructor(private readonly cpSvc: ConstructionProjectService) {}

  @Get('projects/:id')
  async getProject(@Param('id') id: string) {
    const result = await this.cpSvc.getProjectWithSectionsAndExpenses(id);
    if (!result) throw new NotFoundException(`Project ${id} not found`);
    return result;
  }
}
