import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';
import { WhatsappSuggestedBusinessLinkEntity } from './entities/whatsapp-suggested-business-link.entity';
import { WhatsappListingForwarderEntity } from './entities/whatsapp-listing-forwarder.entity';
import { WhatsappDraftListingEntity } from './entities/whatsapp-draft-listing.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappParsingService } from './whatsapp-parsing.service';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappMarketRateService } from './whatsapp-market-rate.service';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { WhatsappConfirmationService } from './whatsapp-confirmation.service';
import { WhatsappBusinessLinkService } from './whatsapp-business-link.service';
import { WhatsappListingForwarderService } from './whatsapp-listing-forwarder.service';
import { WhatsappListingParsingService } from './whatsapp-listing-parsing.service';
import { WhatsappListingAlertService } from './whatsapp-listing-alert.service';
import { WhatsappProjectResolverService } from './whatsapp-project-resolver.service';
import { WhatsappExpenseBatchService } from './whatsapp-expense-batch.service';
import { WhatsappExpenseBatchEntity } from './entities/whatsapp-expense-batch.entity';
import { WhatsappGroundReportService } from './whatsapp-ground-report.service';
import { GroundReportsModule } from '../ground-reports/ground-reports.module';
import { ListingAlertsController } from './listing-alerts.controller';
import { ListingAlertSubscriptionEntity } from './entities/listing-alert-subscription.entity';
import { WhatsappAccountEntity } from './entities/whatsapp-account.entity';
import { WhatsappBillService } from './whatsapp-bill.service';
import { WhatsappSelfServeService } from './whatsapp-self-serve.service';
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
      WhatsappListingForwarderEntity,
      WhatsappDraftListingEntity,
      ListingAlertSubscriptionEntity,
      WhatsappExpenseBatchEntity,
      WhatsappAccountEntity,
    ]),
    ConstructionIntelligenceModule,
    PropertyIntelligenceModule,
    TrustModule,
    GroundReportsModule,
  ],
  controllers: [WhatsappWebhookController, ListingAlertsController],
  providers: [
    WhatsappService,
    WhatsappParsingService,
    WhatsappAiClient,
    WhatsappOutboundClient,
    WhatsappConfirmationService,
    WhatsappBusinessLinkService,
    WhatsappListingForwarderService,
    WhatsappListingParsingService,
    WhatsappListingAlertService,
    WhatsappGroundReportService,
    WhatsappExpenseBatchService,
    WhatsappProjectResolverService,
    WhatsappMarketRateService,
    WhatsappSelfServeService,
    WhatsappBillService,
  ],
  exports: [
    WhatsappSelfServeService,
    WhatsappOutboundClient,
    WhatsappService,
    WhatsappParsingService,
    WhatsappBusinessLinkService,
    WhatsappListingForwarderService,
    WhatsappListingParsingService,
  ],
})
export class WhatsappModule {}
