import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PropertyListingSummary } from '@siraat/shared-types';
import { ListingAlertSubscriptionEntity } from './entities/listing-alert-subscription.entity';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { maskPhone } from './whatsapp-phone.util';

// WHATSAPP LISTING INGESTION — "tell me when a plot like this appears".
//
// DELIVERY CAVEAT (Meta policy, not a code choice): a business can send
// free-form text only within 24h of the recipient's last message. A web
// visitor who subscribes has not messaged us, so production alerts need an
// approved template — set WHATSAPP_ALERT_TEMPLATE (+ optional
// WHATSAPP_ALERT_TEMPLATE_LANG, default "en") to a template with one body
// variable. Without it, alerts fall back to plain text, which only reaches
// subscribers inside the 24h window; failures are logged, never thrown.
const MAX_ACTIVE_SUBSCRIPTIONS_PER_NUMBER = 5;
const MAX_ALERTS_PER_DAY = 3;

export interface CreateAlertInput {
  phone: string;
  society_key: string | null;
  city: string | null;
  max_price_lac: number | null;
  min_size_marla: number | null;
}

export function toWaId(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
}

@Injectable()
export class WhatsappListingAlertService {
  private readonly logger = new Logger(WhatsappListingAlertService.name);

  constructor(
    @InjectRepository(ListingAlertSubscriptionEntity)
    private readonly subRepo: Repository<ListingAlertSubscriptionEntity>,
    private readonly outbound: WhatsappOutboundClient,
  ) {}

  async subscribe(input: CreateAlertInput): Promise<{ id: string; confirmation_sent: boolean }> {
    const waId = toWaId(input.phone);
    if (!waId) throw new BadRequestException('Enter a valid WhatsApp number');
    if (!input.society_key && !input.city && input.max_price_lac == null && input.min_size_marla == null) {
      throw new BadRequestException('Choose at least one filter (society, city, price or size) for the alert');
    }

    const activeCount = await this.subRepo.count({ where: { wa_id: waId, active: true } });
    if (activeCount >= MAX_ACTIVE_SUBSCRIPTIONS_PER_NUMBER) {
      throw new BadRequestException(`A number can have at most ${MAX_ACTIVE_SUBSCRIPTIONS_PER_NUMBER} active alerts`);
    }

    const saved = await this.subRepo.save(
      this.subRepo.create({
        wa_id: waId,
        society_key: input.society_key,
        city: input.city,
        max_price_lac: input.max_price_lac,
        min_size_marla: input.min_size_marla,
        active: true,
        daily_count: 0,
        daily_count_date: null,
        last_notified_at: null,
      }),
    );

    const sent = await this.send(
      waId,
      'Siraat plot alerts: you are subscribed. We will message you when a matching plot is listed. Reply STOP any time to unsubscribe.',
    );
    return { id: saved.id, confirmation_sent: sent };
  }

  // Inbound "STOP" from a subscriber. Returns how many alerts were switched off.
  async unsubscribeAll(waId: string): Promise<number> {
    const res = await this.subRepo.update({ wa_id: waId, active: true }, { active: false });
    return res.affected ?? 0;
  }

  // Fire-and-forget from publish (never awaited by the caller, never throws).
  async notifyForNewPlot(listing: PropertyListingSummary): Promise<void> {
    try {
      const subs = await this.subRepo.find({ where: { active: true } });
      const society_key = listing.society_ref ?? `raw:${listing.society_name_raw.trim().toLowerCase()}`;
      const today = new Date().toISOString().slice(0, 10);

      for (const sub of subs) {
        if (sub.society_key && sub.society_key !== society_key) continue;
        if (sub.city && sub.city.toLowerCase() !== (listing.city ?? '').toLowerCase()) continue;
        const maxPrice = sub.max_price_lac === null ? null : Number(sub.max_price_lac);
        const minSize = sub.min_size_marla === null ? null : Number(sub.min_size_marla);
        if (maxPrice !== null && (listing.price_lac === null || listing.price_lac > maxPrice)) continue;
        if (minSize !== null && (listing.size_marla === null || listing.size_marla < minSize)) continue;

        const sentToday = sub.daily_count_date === today ? sub.daily_count : 0;
        if (sentToday >= MAX_ALERTS_PER_DAY) continue;

        const ok = await this.send(sub.wa_id, this.buildText(listing));
        if (ok) {
          await this.subRepo.update(
            { id: sub.id },
            { daily_count: sentToday + 1, daily_count_date: today, last_notified_at: new Date() },
          );
        }
      }
    } catch (err) {
      this.logger.error('Listing alert fan-out failed', err instanceof Error ? err.stack : String(err));
    }
  }

  private buildText(l: PropertyListingSummary): string {
    const where = [l.block ? `Block ${l.block}` : null, `Plot ${l.plot_number}`, l.society_name ?? l.society_name_raw]
      .filter(Boolean)
      .join(', ');
    const price = l.price_lac === null ? 'price on request' : `PKR ${l.price_lac} Lac`;
    const size = l.size_marla === null ? '' : `, ${l.size_marla} Marla`;
    const site = process.env.PUBLIC_SITE_URL ? ` ${process.env.PUBLIC_SITE_URL.replace(/\/$/, '')}/plots` : '';
    return `New plot: ${where} - ${price}${size}.${site} Reply STOP to unsubscribe.`;
  }

  private async send(waId: string, text: string): Promise<boolean> {
    try {
      const template = process.env.WHATSAPP_ALERT_TEMPLATE;
      if (template) {
        await this.outbound.sendTemplateMessage(waId, template, process.env.WHATSAPP_ALERT_TEMPLATE_LANG ?? 'en', text);
      } else {
        await this.outbound.sendTextMessage(waId, text);
      }
      return true;
    } catch (err) {
      this.logger.warn(`Alert send to ${maskPhone(waId)} failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
