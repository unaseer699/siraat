import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationEntity } from './entities/verification.entity';
import { EvidenceEntity } from './entities/evidence.entity';
import { EvidenceSubmissionEntity } from './entities/evidence-submission.entity';
import { ObservationEntity } from './entities/observation.entity';
import { TrustService } from './trust.service';
import { TrustController } from './trust.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VerificationEntity,
      EvidenceEntity,
      EvidenceSubmissionEntity,
      ObservationEntity,
    ]),
  ],
  controllers: [TrustController],
  providers: [TrustService, StorageService],
  // StorageService exported (previously TrustService-only) so AdminModule can
  // inject it for the HOUSE PLANS DIRECTORY Chunk 1 image-upload endpoint —
  // AdminModule already imports TrustModule.
  exports: [TrustService, StorageService],
})
export class TrustModule {}
