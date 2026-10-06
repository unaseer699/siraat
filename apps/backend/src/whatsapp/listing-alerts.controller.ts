import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { BearerGuard } from '../auth/bearer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WhatsappListingAlertService } from './whatsapp-listing-alert.service';

// Public (visitor-facing) alert signup. Rate-limited by the global
// ThrottlerModule so it can't be used to spam arbitrary numbers.
const CreateListingAlertBodySchema = z.object({
  phone: z.string().trim().regex(/^\+?[\d\s()-]{10,20}$/, 'Enter a valid WhatsApp number'),
  society_key: z.string().trim().min(1).max(255).nullable().default(null),
  city: z.string().trim().min(1).max(100).nullable().default(null),
  max_price_lac: z.number().positive().nullable().default(null),
  min_size_marla: z.number().positive().nullable().default(null),
});
type CreateListingAlertBody = z.infer<typeof CreateListingAlertBodySchema>;

@Controller('v1/listing-alerts')
@UseGuards(BearerGuard)
export class ListingAlertsController {
  constructor(private readonly alerts: WhatsappListingAlertService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(CreateListingAlertBodySchema)) body: CreateListingAlertBody) {
    return this.alerts.subscribe(body);
  }
}
