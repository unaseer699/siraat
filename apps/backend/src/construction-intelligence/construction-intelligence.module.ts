import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialRateEntity } from './entities/material-rate.entity';
import { ConstructionEstimateEntity } from './entities/construction-estimate.entity';
import { ObservationEntity } from './entities/observation.entity';
import { ConstructionIntelligenceService } from './construction-intelligence.service';
import { EstimatesService } from './estimates.service';
import { EstimatesController } from './estimates.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaterialRateEntity, ConstructionEstimateEntity, ObservationEntity]),
  ],
  controllers: [EstimatesController],
  providers: [ConstructionIntelligenceService, EstimatesService],
  exports: [ConstructionIntelligenceService],
})
export class ConstructionIntelligenceModule {}
