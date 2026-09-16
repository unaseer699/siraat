import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { PropertyIntelligenceModule } from './property-intelligence/property-intelligence.module';
import { MarketIntelligenceModule } from './market-intelligence/market-intelligence.module';
import { TrustModule } from './trust/trust.module';
import { ConstructionIntelligenceModule } from './construction-intelligence/construction-intelligence.module';
import { AdminModule } from './admin/admin.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
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
      // No explicit `ssl` option needed for Neon: TypeORM passes `url` straight through to pg as
      // `connectionString`, and pg's own connection-string parsing already turns the URL's
      // `sslmode=require` into a verified TLS connection (confirmed against a live Neon database).
      extra: { options: '-c client_encoding=UTF8' },
    }),
    // In-memory rate limiting — no Redis needed at current scale
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PropertyIntelligenceModule,
    MarketIntelligenceModule,
    TrustModule,
    ConstructionIntelligenceModule,
    AdminModule,
    // WHATSAPP INTEGRATION Phase 1 — public webhook controller
    // (WhatsappWebhookController) lives here at the top level; AdminModule
    // separately imports WhatsappModule too for the whatsapp-mappings
    // admin routes (module singleton — no duplicate provider instances).
    WhatsappModule,
  ],
})
export class AppModule {}
