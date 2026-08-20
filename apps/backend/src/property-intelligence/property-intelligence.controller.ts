import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SocietyChangesRequestSchema, type SocietyChangesRequest } from '@siraat/shared-types';
import { PropertyIntelligenceService } from './property-intelligence.service';

@Controller('v1/property-intelligence')
@UseGuards(BearerGuard)
export class PropertyIntelligenceController {
  constructor(private readonly piSvc: PropertyIntelligenceService) {}

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
}
