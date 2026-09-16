import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';
import { WhatsappSuggestedBusinessLinkEntity } from './entities/whatsapp-suggested-business-link.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappParsingService } from './whatsapp-parsing.service';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { WhatsappConfirmationService } from './whatsapp-confirmation.service';
import { WhatsappBusinessLinkService } from './whatsapp-business-link.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { ConstructionIntelligenceModule } from '../construction-intelligence/construction-intelligence.module';
import { PropertyIntelligenceModule } from '../property-intelligence/property-intelligence.module';
import { TrustModule } from '../trust/trust.module';

// WHATSAPP INTEGRATION Phase 1 — imported by both AppModule (for the public
// webhook controller below) and AdminModule (so AdminController can delegate
// the whatsapp-mappings admin routes to WhatsappService, same pattern as
// TrustModule/ConstructionIntelligenceModule).
//
// WHATSAPP INTEGRATION Phase 2 — AI PARSING. WhatsappParsingService is
// exported too, so AdminService (via AdminModule's existing WhatsappModule
// import) can delegate GET /v1/admin/whatsapp-drafts to it directly, the
// same way it already delegates to WhatsappService for the mapping routes.
//
// WHATSAPP INTEGRATION Phase 3 — CONFIRM/CORRECT LOOP. ConstructionIntelligenceModule
// is imported so WhatsappConfirmationService can reuse ConstructionProjectService's
// existing Section/Expense creation path (Law 9: no duplicated Expense-
// creation logic) rather than owning a second one. WhatsappOutboundClient
// and WhatsappConfirmationService are not exported — nothing outside this
// module calls them directly (WhatsappService.processInboundMessage is the
// only trigger point, same as WhatsappParsingService in Phase 2).
//
// WHATSAPP INTEGRATION Phase 6a — MARKET OBSERVATIONS. PropertyIntelligenceModule
// added so WhatsappConfirmationService can resolve a confirmed project's city
// via PropertyIntelligenceService.findPropertyById (Law 9: public API call,
// same composition pattern PropertyIntelligenceModule itself already uses to
// reach ConstructionIntelligenceModule) — no cycle, PropertyIntelligenceModule
// never imports WhatsappModule.
//
// WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION.
// TrustModule added so WhatsappBusinessLinkService can call
// TrustService.createVerification (same public-API-call pattern, no cycle —
// TrustModule is a leaf module with no imports of its own).
// WhatsappBusinessLinkService is exported so AdminService can inject it
// directly for the review-queue endpoints, same as WhatsappParsingService.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappInboundMessageEntity,
      WhatsappProjectMappingEntity,
      WhatsappDraftExpenseEntity,
      WhatsappSuggestedBusinessLinkEntity,
    ]),
    ConstructionIntelligenceModule,
    PropertyIntelligenceModule,
    TrustModule,
  ],
  controllers: [WhatsappWebhookController],
  providers: [
    WhatsappService,
    WhatsappParsingService,
    WhatsappAiClient,
    WhatsappOutboundClient,
    WhatsappConfirmationService,
    WhatsappBusinessLinkService,
  ],
  exports: [WhatsappService, WhatsappParsingService, WhatsappBusinessLinkService],
})
export class WhatsappModule {}
