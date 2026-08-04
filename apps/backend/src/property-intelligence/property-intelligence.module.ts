import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocietyEntity } from './entities/society.entity';
import { PropertyIntelligenceService } from './property-intelligence.service';

@Module({
  imports: [TypeOrmModule.forFeature([SocietyEntity])],
  providers: [PropertyIntelligenceService],
  exports: [PropertyIntelligenceService],
})
export class PropertyIntelligenceModule {}
