import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyIntelligenceModule } from './property-intelligence/property-intelligence.module';
import { MarketIntelligenceModule } from './market-intelligence/market-intelligence.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://siraat:siraat_local_dev@localhost:5432/siraat',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    PropertyIntelligenceModule,
    MarketIntelligenceModule,
  ],
})
export class AppModule {}
