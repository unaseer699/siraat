import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateSocietyEntity } from '../property-intelligence/entities/candidate-society.entity';
import { PropertyIntelligenceModule } from '../property-intelligence/property-intelligence.module';
import { TrustModule } from '../trust/trust.module';
import { ConstructionIntelligenceModule } from '../construction-intelligence/construction-intelligence.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateSocietyEntity]),
    PropertyIntelligenceModule,
    TrustModule,
    ConstructionIntelligenceModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
