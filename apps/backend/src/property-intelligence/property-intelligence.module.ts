import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocietyEntity } from './entities/society.entity';
import { PropertyEntity } from './entities/property.entity';
import { DeveloperEntity } from './entities/developer.entity';
import { CandidateSocietyEntity } from './entities/candidate-society.entity';
import { PropertyIntelligenceService } from './property-intelligence.service';
import { PropertyIntelligenceController } from './property-intelligence.controller';
import { TrustModule } from '../trust/trust.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocietyEntity, PropertyEntity, DeveloperEntity, CandidateSocietyEntity]),
    TrustModule,
  ],
  controllers: [PropertyIntelligenceController],
  providers: [PropertyIntelligenceService],
  exports: [PropertyIntelligenceService],
})
export class PropertyIntelligenceModule {}
