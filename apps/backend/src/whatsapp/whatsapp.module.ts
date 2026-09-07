import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

// WHATSAPP INTEGRATION Phase 1 — imported by both AppModule (for the public
// webhook controller below) and AdminModule (so AdminController can delegate
// the whatsapp-mappings admin routes to WhatsappService, same pattern as
// TrustModule/ConstructionIntelligenceModule).
@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappInboundMessageEntity, WhatsappProjectMappingEntity]),
  ],
  controllers: [WhatsappWebhookController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
