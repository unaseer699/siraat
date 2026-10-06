import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialRateEntity } from './entities/material-rate.entity';
import { ConstructionEstimateEntity } from './entities/construction-estimate.entity';
import { ObservationEntity } from './entities/observation.entity';
import { ConstructionProjectEntity } from './entities/construction-project.entity';
import { ProjectLayoutEntity } from './entities/project-layout.entity';
import { ProjectForecastService } from './project-forecast.service';
import { ExpenseCategoryRuleEntity } from './entities/expense-category-rule.entity';
import { ProjectSectionEntity } from './entities/project-section.entity';
import { ProjectExpenseEntity } from './entities/project-expense.entity';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
import { ConstructionProjectService } from './construction-project.service';
import { EstimatesService } from './estimates.service';
import { EstimatesController } from './estimates.controller';
import { ConstructionProjectController } from './construction-project.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialRateEntity,
      ConstructionEstimateEntity,
      ObservationEntity,
      // PROJECT COST TRACKER Chunk 1
      ConstructionProjectEntity,
      ProjectSectionEntity,
      ProjectExpenseEntity,
      ExpenseCategoryRuleEntity,
      ProjectLayoutEntity,
    ]),
  ],
  controllers: [EstimatesController, ConstructionProjectController],
  providers: [ConstructionIntelligenceService, ConstructionProjectService, EstimatesService, ProjectForecastService],
  exports: [ConstructionIntelligenceService, ConstructionProjectService, ProjectForecastService],
})
export class ConstructionIntelligenceModule {}
