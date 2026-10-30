import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PublicProjectEntity } from './entities/public-project.entity';
import { ProjectStatusEventEntity } from './entities/project-status-event.entity';
import { NewsReportEntity } from './entities/news-report.entity';
import { PublicProjectsController, PublicProjectsAdminController } from './public-projects.controller';
import { PublicProjectsService } from './public-projects.service';
import { PublicProjectsScheduler } from './public-projects.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([PublicProjectEntity, ProjectStatusEventEntity, NewsReportEntity])],
  controllers: [PublicProjectsController, PublicProjectsAdminController],
  providers: [PublicProjectsService, PublicProjectsScheduler],
})
export class PublicProjectsModule {}
