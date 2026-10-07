import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketRateService, todayInKarachi } from '../construction-intelligence/market-rate.service';
import { MARKET_RATE_ITEMS } from '../construction-intelligence/market-rate-catalog';
import { parseMarketRateMessage } from '../construction-intelligence/market-rate-parser';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { maskPhone } from './whatsapp-phone.util';

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

// Handles the founder's daily "Market Rates" message: stores each rate as a
// FACT quote, then replies with what was saved, what changed, and which items
// are being carried forward from earlier days.
@Injectable()
export class WhatsappMarketRateService {
  private readonly logger = new Logger(WhatsappMarketRateService.name);

  constructor(
    private readonly rates: MarketRateService,
    private readonly outbound: WhatsappOutboundClient,
    @InjectRepository(WhatsappInboundMessageEntity)
    private readonly inboundRepo: Repository<WhatsappInboundMessageEntity>,
  ) {}

  async handle(message: WhatsappInboundMessageEntity): Promise<string> {
    const text = message.message_text ?? '';
    const parsed = parseMarketRateMessage(text);
    const today = todayInKarachi();
    const date = parsed.rate_date ?? today;
    let reply: string;
    try {
      if (parsed.rate_date && parsed.rate_date > today) {
        reply = `Rates not saved: ${fmtDate(parsed.rate_date)} is in the future. Check the date and send again.`;
      } else if (parsed.lines.length === 0) {
        reply = this.helpText(parsed.rejected.map((r) => `• ${r.raw}: ${r.reason}`));
      } else {
        const saved: string[] = [];
        const refused: { raw: string; reason: string }[] = [];
        for (const l of parsed.lines) {
          const prev = await this.rates.previousRate(l.item.key, date);
          if (prev && (l.rate < prev * 0.2 || l.rate > prev * 5)) {
            refused.push({ raw: l.raw, reason: `${l.item.label} ${l.rate.toLocaleString()} is far from the last rate ${prev.toLocaleString()}; check for a typo` });
            continue;
          }
          const { previous_rate } = await this.rates.recordQuote({
            rate_date: date,
            item: l.item,
            rate: l.rate,
            source: 'WHATSAPP',
            source_ref: message.id,
          });
          let change = '';
          if (previous_rate && previous_rate > 0) {
            const pct = ((l.rate - previous_rate) / previous_rate) * 100;
            change = Math.abs(pct) < 0.05 ? ' (same)' : ` (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)`;
            if (Math.abs(pct) > 25) change += ' CHECK: big change';
          }
          saved.push(`• ${l.item.label}: ${l.rate.toLocaleString()}/${l.item.unit}${change}`);
        }
        const current = await this.rates.currentRates(date);
        const carried = current
          .filter((c) => c.carried_forward && !parsed.lines.some((l) => l.item.key === c.key))
          .map((c) => `• ${c.label}: ${c.rate.toLocaleString()}/${c.unit} (from ${fmtDate(c.rate_date)})`);
        const missing = MARKET_RATE_ITEMS.filter((i) => !current.some((c) => c.key === i.key)).map((i) => i.label);
        parsed.rejected.push(...refused);
        const out: string[] = [`Rates saved for ${fmtDate(date)} (${saved.length}):`, ...saved];
        if (carried.length) out.push('', 'No new rate, kept from earlier:', ...carried);
        if (carried.length > 8) {
          out.splice(out.indexOf('No new rate, kept from earlier:') + 1, carried.length, `• ${carried.length} items kept from earlier days (see the Daily Rates page)`);
        }
        if (missing.length) out.push('', `No rate on record yet: ${missing.length > 8 ? `${missing.length} items` : missing.join(', ')}`);
        if (parsed.rejected.length) out.push('', 'Not saved:', ...parsed.rejected.map((r) => `• ${r.raw}: ${r.reason}`));
        reply = out.join('\n');
      }
      await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });
    } catch (err) {
      this.logger.error(`Market rate handling failed: ${err instanceof Error ? err.stack : String(err)}`);
      reply = 'Sorry, the rates could not be saved right now. Please try again in a few minutes.';
    }
    try {
      await this.outbound.sendTextMessage(message.wa_id, reply);
    } catch (err) {
      this.logger.error(`Failed to send rate reply to ${maskPhone(message.wa_id)}`, err instanceof Error ? err.stack : String(err));
    }
    return reply;
  }

  private helpText(problems: string[]): string {
    return [
      'I could not read any rates from that message.',
      ...problems,
      '',
      'Send it like this:',
      'Market Rates',
      'Date: DD-MM-YYYY',
      'Cement: 1300 /bag',
      'Tiles: 95 /sqft',
      'Wire 7/29: 9800 /roll',
      'Mason labour: 380 /sqft',
      '',
      'Only send the items that have a new rate; the rest keep yesterday\'s.',
    ].join('\n');
  }
}
