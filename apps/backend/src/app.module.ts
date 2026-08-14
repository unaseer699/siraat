import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { PropertyIntelligenceModule } from './property-intelligence/property-intelligence.module';
import { MarketIntelligenceModule } from './market-intelligence/market-intelligence.module';
import { TrustModule } from './trust/trust.module';
import { ConstructionIntelligenceModule } from './construction-intelligence/construction-intelligence.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    // Must be first — other modules read process.env values at module init time
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://siraat:siraat_local_dev@localhost:5432/siraat',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      // Explicit UTF-8 guards against PGCLIENTENCODING env var or system-level Postgres installs
      // overriding pg's default on Windows, which would cause the server to transcode multi-byte
      // characters (e.g. em-dash U+2014) into replacement characters before sending over the wire.
      extra: { options: '-c client_encoding=UTF8' },
    }),
    // In-memory rate limiting — no Redis needed at current scale
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PropertyIntelligenceModule,
    MarketIntelligenceModule,
    TrustModule,
    ConstructionIntelligenceModule,
    AdminModule,
  ],
})
export class AppModule {}
