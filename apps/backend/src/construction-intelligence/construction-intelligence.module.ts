import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialRateEntity } from './entities/material-rate.entity';
import { ConstructionEstimateEntity } from './entities/construction-estimate.entity';
import { ObservationEntity } from './entities/observation.entity';
import { ConstructionProjectEntity } from './entities/construction-project.entity';
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
    ]),
  ],
  controllers: [EstimatesController, ConstructionProjectController],
  providers: [ConstructionIntelligenceService, ConstructionProjectService, EstimatesService],
  exports: [ConstructionIntelligenceService, ConstructionProjectService],
})
export class ConstructionIntelligenceModule {}
