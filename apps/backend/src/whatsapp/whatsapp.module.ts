import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappParsingService } from './whatsapp-parsing.service';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

// WHATSAPP INTEGRATION Phase 1 — imported by both AppModule (for the public
// webhook controller below) and AdminModule (so AdminController can delegate
// the whatsapp-mappings admin routes to WhatsappService, same pattern as
// TrustModule/ConstructionIntelligenceModule).
//
// WHATSAPP INTEGRATION Phase 2 — AI PARSING. WhatsappParsingService is
// exported too, so AdminService (via AdminModule's existing WhatsappModule
// import) can delegate GET /v1/admin/whatsapp-drafts to it directly, the
// same way it already delegates to WhatsappService for the mapping routes.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappInboundMessageEntity,
      WhatsappProjectMappingEntity,
      WhatsappDraftExpenseEntity,
    ]),
  ],
  controllers: [WhatsappWebhookController],
  providers: [WhatsappService, WhatsappParsingService, WhatsappAiClient],
  exports: [WhatsappService, WhatsappParsingService],
})
export class WhatsappModule {}
