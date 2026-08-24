import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';
import { ContractorEntity } from './entities/contractor.entity';
import { SupplierEntity } from './entities/supplier.entity';
import { HousePlanEntity } from './entities/house-plan.entity';
import { CandidateSocietyEntity } from './entities/candidate-society.entity';
import { ObservationEntity } from './entities/observation.entity';
import { PropertyIntelligenceService } from './property-intelligence.service';
import { PropertyIntelligenceController } from './property-intelligence.controller';
import { TrustModule } from '../trust/trust.module';
import { ConstructionIntelligenceModule } from '../construction-intelligence/construction-intelligence.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SocietyEntity,
      PropertyEntity,
      DeveloperEntity,
      ContractorEntity,
      SupplierEntity,
      HousePlanEntity,
      CandidateSocietyEntity,
      ObservationEntity,
    ]),
    TrustModule,
    // SUPPLIER DIRECTORY Chunk 1 — PropertyIntelligenceService injects
    // ConstructionIntelligenceService directly for findMaterialRatesBySupplierId,
    // the same cross-module "public API call" pattern already used for
    // TrustService above (Law 9: no reach into another module's schema).
    ConstructionIntelligenceModule,
  ],
  controllers: [PropertyIntelligenceController],
  providers: [PropertyIntelligenceService],
  exports: [PropertyIntelligenceService],
})
export class PropertyIntelligenceModule {}
