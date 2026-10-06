import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SocietyChangesRequestSchema, type SocietyChangesRequest } from '@siraat/shared-types';
import { PropertyIntelligenceService } from './property-intelligence.service';
import { StorageService } from '../trust/storage.service';

@Controller('v1/property-intelligence')
@UseGuards(BearerGuard)
export class PropertyIntelligenceController {
  constructor(
    private readonly piSvc: PropertyIntelligenceService,
    // HOUSE PLANS DIRECTORY Chunk 2 — first public route that needs to serve a
    // file, hence the first place this controller (rather than TrustController)
    // needs StorageService. Available here because PropertyIntelligenceModule
    // already imports TrustModule, which now exports StorageService (Chunk 1).
    private readonly storageSvc: StorageService,
  ) {}

  @Get('societies')
  async listSocieties(
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.piSvc.listSocieties({
      city,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // WHATSAPP LISTING INGESTION — public, read-only. Only ever returns
  // listings still inside their auto-expiry window. `counts` is declared
  // BEFORE any :id-style route so it is never captured as a parameter.
  @Get('listings/counts')
  async countListings() {
    return this.piSvc.countActivePropertyListingsBySociety();
  }

  @Get('listings')
  async listListings(
    @Query('city') city?: string,
    @Query('society_id') society_id?: string,
    @Query('max_price_lac') max_price_lac?: string,
    @Query('min_size_marla') min_size_marla?: string,
    @Query('max_size_marla') max_size_marla?: string,
  ) {
    const num = (v?: string) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
    return this.piSvc.listActivePropertyListings({
      city,
      society_id,
      max_price_lac: num(max_price_lac),
      min_size_marla: num(min_size_marla),
      max_size_marla: num(max_size_marla),
    });
  }

  // Watchlist Chunk 1 — session-based watchlist lives in the browser; this reports
  // what changed for a browser-supplied batch of society IDs since a given date.
  @Post('societies/changes')
  async getSocietyChanges(
    @Body(new ZodValidationPipe(SocietyChangesRequestSchema)) body: SocietyChangesRequest,
  ) {
    return this.piSvc.getSocietyChangesSince(body.society_ids, body.since);
  }

  @Get('properties/:id')
  async getProperty(@Param('id') id: string) {
    const property = await this.piSvc.findPropertyById(id);
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }

  @Get('developers/:id/stats')
  async getDeveloperStats(@Param('id') id: string) {
    const stats = await this.piSvc.getDeveloperStats(id);
    if (!stats) throw new NotFoundException(`Developer ${id} not found`);
    return stats;
  }

  // CONTRACTOR DIRECTORY Chunk 3 — public directory listing. Same guard/auth
  // level as every other route on this controller (BearerGuard is a single
  // shared API key today, not admin-vs-public scoped — see bearer.guard.ts);
  // this just delegates to the same PropertyIntelligenceService.searchContractors()
  // that GET /v1/admin/contractors uses.
  @Get('contractors')
  async searchContractors(
    @Query('trade_category') trade_category?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.piSvc.searchContractors({
      trade_category,
      city,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // CONTRACTOR DIRECTORY Chunk 3 — public profile lookup.
  @Get('contractors/:id')
  async getContractor(@Param('id') id: string) {
    const contractor = await this.piSvc.findContractorById(id);
    if (!contractor) throw new NotFoundException(`Contractor ${id} not found`);
    return contractor;
  }

  // SUPPLIER DIRECTORY Chunk 3 — public directory listing, same
  // delegation/pattern as GET /contractors above.
  @Get('suppliers')
  async searchSuppliers(
    @Query('material_category') material_category?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.piSvc.searchSuppliers({
      material_category,
      city,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // SUPPLIER DIRECTORY Chunk 3 — public profile lookup.
  @Get('suppliers/:id')
  async getSupplier(@Param('id') id: string) {
    const supplier = await this.piSvc.findSupplierById(id);
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  // SUPPLIER DIRECTORY Chunk 3 — linked active material rate submissions for
  // the profile page, via findMaterialRatesBySupplierId (Chunk 1). A distinct
  // literal path from 'suppliers/:id' above, so no route-matching ambiguity.
  @Get('suppliers/:id/material-rates')
  async getSupplierMaterialRates(@Param('id') id: string) {
    return this.piSvc.findMaterialRatesBySupplierId(id);
  }

  // HOUSE PLANS DIRECTORY Chunk 2 — public directory listing, same
  // delegation/pattern as GET /contractors / GET /suppliers above. No
  // TrustService involvement (no verification_status) — this directory was
  // never wired to Trust claims, unlike Contractor/Supplier.
  @Get('house-plans')
  async searchHousePlans(
    @Query('area_marla_min') area_marla_min?: string,
    @Query('area_marla_max') area_marla_max?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('style') style?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.piSvc.searchHousePlans({
      area_marla_min: area_marla_min !== undefined ? Number(area_marla_min) : undefined,
      area_marla_max: area_marla_max !== undefined ? Number(area_marla_max) : undefined,
      bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
      style,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  // HOUSE PLANS DIRECTORY Chunk 2 — public profile lookup.
  @Get('house-plans/:id')
  async getHousePlan(@Param('id') id: string) {
    const plan = await this.piSvc.findHousePlanById(id);
    if (!plan) throw new NotFoundException(`House plan ${id} not found`);
    return plan;
  }

  // HOUSE PLANS DIRECTORY Chunk 2 — preview_image_ref is a private
  // bucket-relative storage key (same convention as Evidence.file_ref), not a
  // publicly servable URL, so the detail/catalog pages fetch a short-lived
  // presigned URL through this route instead — same pattern as
  // GET /v1/trust/evidence/:id/download-url. A plan with no image yet
  // (preview_image_ref === '', the Chunk 2 "no image" sentinel) 404s here
  // rather than presigning an empty key.
  @Get('house-plans/:id/image-url')
  async getHousePlanImageUrl(@Param('id') id: string) {
    const plan = await this.piSvc.findHousePlanById(id);
    if (!plan) throw new NotFoundException(`House plan ${id} not found`);
    if (!plan.preview_image_ref) throw new NotFoundException(`House plan ${id} has no image`);
    const url = await this.storageSvc.getPresignedDownloadUrl(plan.preview_image_ref);
    return { url, expires_in_seconds: 900 };
  }

  // HOUSE PLAN GALLERY — metadata only (type, tier, price, has_file), never
  // the raw storage_ref. Returned for every image regardless of tier so the
  // profile page can render locked placeholders with their price; the file
  // itself is only ever reached through the url route below, which refuses
  // GATED images.
  @Get('house-plans/:id/images')
  async listHousePlanImages(@Param('id') id: string) {
    const plan = await this.piSvc.findHousePlanById(id);
    if (!plan) throw new NotFoundException(`House plan ${id} not found`);
    return { images: await this.piSvc.listHousePlanImages(id) };
  }

  // HOUSE PLAN GALLERY — presigned URL for one gallery image. There is no
  // unlock/entitlement system yet (Step 0 founder direction: tiering ships
  // ahead of the paywall), so a GATED image is refused outright here —
  // 403, not 404, since the image exists and is correctly priced, just not
  // purchasable through Siraat today. Once an entitlement check exists this
  // is the one place it needs to be added.
  @Get('house-plans/:id/images/:imageId/url')
  async getHousePlanImageFileUrl(@Param('id') id: string, @Param('imageId') imageId: string) {
    const image = await this.piSvc.findHousePlanImageById(imageId);
    if (!image || image.house_plan_id !== id) {
      throw new NotFoundException(`Image ${imageId} not found for house plan ${id}`);
    }
    if (image.access_tier === 'GATED') {
      throw new ForbiddenException('This image is gated — unlocking is not yet available.');
    }
    if (!image.storage_ref) throw new NotFoundException(`Image ${imageId} has no file uploaded yet`);
    const url = await this.storageSvc.getPresignedDownloadUrl(image.storage_ref);
    return { url, expires_in_seconds: 900 };
  }
}
