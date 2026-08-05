import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyIntelligenceModule } from '../property-intelligence/property-intelligence.module';
import { TrustModule } from '../trust/trust.module';
import { ScoreEntity } from './entities/score.entity';
import { NotCoveredRequestEntity } from './entities/not-covered-request.entity';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { ScoringService } from './scoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreEntity, NotCoveredRequestEntity]),
    PropertyIntelligenceModule,
    TrustModule,
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, ScoringService],
})
export class MarketIntelligenceModule {}
