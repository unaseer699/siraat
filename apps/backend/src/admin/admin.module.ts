import { Module } from '@nestjs/common';
import { PropertyIntelligenceModule } from '../property-intelligence/property-intelligence.module';
import { TrustModule } from '../trust/trust.module';
import { ConstructionIntelligenceModule } from '../construction-intelligence/construction-intelligence.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    // CLEANUP — TypeOrmModule.forFeature([CandidateSocietyEntity]) removed:
    // AdminService no longer holds its own repository for this table.
    // CandidateSociety CRUD lives entirely on PropertyIntelligenceService
    // now (PropertyIntelligenceModule owns the one repository provider for
    // it), matching every other directory entity's CRUD ownership.
    PropertyIntelligenceModule,
    TrustModule,
    ConstructionIntelligenceModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
