import { Module } from '@nestjs/common';
import { PropertyIntelligenceModule } from '../property-intelligence/property-intelligence.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [PropertyIntelligenceModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class MarketIntelligenceModule {}
