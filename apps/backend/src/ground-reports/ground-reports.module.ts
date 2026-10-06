import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroundReportSubmissionEntity } from './ground-report-submission.entity';
import { GroundReportSubmissionService } from './ground-report-submission.service';
import { GroundReportsController } from './ground-reports.controller';
import { PropertyIntelligenceModule } from '../property-intelligence/property-intelligence.module';
import { TrustModule } from '../trust/trust.module';

// GROUND-CONDITION REPORTS — owns the untrusted submission queue
// (data_acquisition). Reaches the FACT table only through
// GroundConditionService's public API (Law 9).
@Module({
  imports: [TypeOrmModule.forFeature([GroundReportSubmissionEntity]), PropertyIntelligenceModule, TrustModule],
  controllers: [GroundReportsController],
  providers: [GroundReportSubmissionService],
  exports: [GroundReportSubmissionService],
})
export class GroundReportsModule {}
