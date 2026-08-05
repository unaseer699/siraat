import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationEntity } from './entities/verification.entity';
import { EvidenceEntity } from './entities/evidence.entity';
import { EvidenceSubmissionEntity } from './entities/evidence-submission.entity';
import { TrustService } from './trust.service';
import { TrustController } from './trust.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationEntity, EvidenceEntity, EvidenceSubmissionEntity])],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
