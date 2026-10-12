import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorProjectEntity } from './contractor-project.entity';
import { ContractorUploadLinkEntity } from './contractor-upload-link.entity';
import { ContractorPortfolioService } from './contractor-portfolio.service';
import { ContractorPortfolioAdminController, ContractorPortfolioController } from './contractor-portfolio.controller';
import { PropertyIntelligenceModule } from '../property-intelligence/property-intelligence.module';
import { TrustModule } from '../trust/trust.module';

// CONTRACTOR PORTFOLIO — owns project/photo rows; reaches contractors only
// through PropertyIntelligenceService's public API (Law 9).
@Module({
  imports: [TypeOrmModule.forFeature([ContractorProjectEntity, ContractorUploadLinkEntity]), PropertyIntelligenceModule, TrustModule],
  controllers: [ContractorPortfolioController, ContractorPortfolioAdminController],
  providers: [ContractorPortfolioService],
  exports: [ContractorPortfolioService],
})
export class ContractorPortfolioModule {}
