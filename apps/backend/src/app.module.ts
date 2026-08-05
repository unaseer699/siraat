import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { PropertyIntelligenceModule } from './property-intelligence/property-intelligence.module';
import { MarketIntelligenceModule } from './market-intelligence/market-intelligence.module';
import { TrustModule } from './trust/trust.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://siraat:siraat_local_dev@localhost:5432/siraat',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    // In-memory rate limiting — no Redis needed at current scale
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PropertyIntelligenceModule,
    MarketIntelligenceModule,
    TrustModule,
  ],
})
export class AppModule {}
