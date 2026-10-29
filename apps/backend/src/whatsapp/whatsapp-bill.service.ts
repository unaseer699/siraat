import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappExpenseBatchEntity, ExpenseBatchStoredLine } from './entities/whatsapp-expense-batch.entity';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { ExpenseAttachmentService } from '../construction-intelligence/expense-attachment.service';
import { SELF_SERVE_CREATED_BY } from './whatsapp-self-serve.service';
import { maskPhone } from './whatsapp-phone.util';

// A bill photo/PDF counts only shortly after the sender saved a batch.
export const BILL_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_BILL_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface SavedLine {
  index: number;
  expense_id: string;
  line: ExpenseBatchStoredLine;
}

export function savedLinesOf(batch: Pick<WhatsappExpenseBatchEntity, 'lines' | 'result'>): SavedLine[] {
  const results = (batch.result ?? []) as Array<{ index: number; ok: boolean; expense_id?: string }>;
  return results
    .filter((r) => r.ok && r.expense_id && batch.lines[r.index])
    .map((r) => ({ index: r.index, expense_id: r.expense_id as string, line: batch.lines[r.index] }));
}

const ALL_WORDS = /\b(all|both|every|everything|consolidated|combined|together|total|single|one bill)\b/i;

function numbersIn(text: string): number[] {
  return (text.replace(/,/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

// Which saved expense(s) does this bill belong to? A bill can cover several
// items (one consolidated bill from a supplier), so this returns a list.
//   - a single saved expense needs no caption
//   - "all", "both", "consolidated", "combined"... covers every saved expense
//   - a list number or several ("2", "#2", "1,2", "1 and 3") picks those
//   - an amount in the caption: the total of all saved lines means all of them;
//     one line's own amount picks that line ("paid 90000 consolidated bill")
//   - a word from the item description ("cement") picks that one if unambiguous
// Returns null when it is not clear, so the sender is asked.
export function pickExpensesForCaption(saved: SavedLine[], caption: string | null): SavedLine[] | null {
  if (saved.length === 1) return saved;
  const text = (caption ?? '').trim().toLowerCase();
  if (!text) return null;
  if (ALL_WORDS.test(text)) return saved;

  // List numbers: the whole caption is just numbers, separated by commas, "and", "&" or spaces.
  if (/^[#\d\s,.&]+(?:and[#\d\s,.&]*)*$/.test(text) && /\d/.test(text)) {
    const wanted = new Set(text.split(/[^0-9]+/).filter(Boolean).map(Number));
    const picked = saved.filter((s) => wanted.has(s.index + 1));
    if (picked.length > 0 && picked.length === wanted.size) return picked;
    if (picked.length === 0 && !numbersIn(text).some((n) => n >= 1000)) return null;
  }

  const nums = numbersIn(text).filter((n) => n >= 100);
  if (nums.length > 0) {
    const total = saved.reduce((t, s) => t + (s.line.amount ?? 0), 0);
    if (nums.includes(total)) return saved;
    const byAmount = saved.filter((s) => nums.includes(s.line.amount));
    if (byAmount.length === 1) return byAmount;
  }

  const tokens = text.split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  if (tokens.length === 0) return null;
  const scored = saved
    .map((s) => ({ s, score: tokens.filter((t) => s.line.description.toLowerCase().includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored[1] && scored[1].score === scored[0].score) return null;
  return [scored[0].s];
}

@Injectable()
export class WhatsappBillService {
  private readonly logger = new Logger(WhatsappBillService.name);

  constructor(
    @InjectRepository(WhatsappExpenseBatchEntity)
    private readonly batchRepo: Repository<WhatsappExpenseBatchEntity>,
    @InjectRepository(WhatsappProjectMappingEntity)
    private readonly mappingRepo: Repository<WhatsappProjectMappingEntity>,
    private readonly attachments: ExpenseAttachmentService,
    private readonly outbound: WhatsappOutboundClient,
  ) {}

  private recentBatch(waId: string): Promise<WhatsappExpenseBatchEntity | null> {
    return this.batchRepo
      .createQueryBuilder('b')
      .innerJoin(WhatsappInboundMessageEntity, 'm', 'm.id = b.inbound_message_id')
      .where('m.wa_id = :waId', { waId })
      .andWhere("b.status = 'CONFIRMED'")
      .andWhere('b.confirmed_at > :since', { since: new Date(Date.now() - BILL_WINDOW_MS) })
      .orderBy('b.confirmed_at', 'DESC')
      .getOne();
  }

  async canAttach(waId: string, type: string): Promise<boolean> {
    if (type !== 'image' && type !== 'document') return false;
    return (await this.recentBatch(waId)) !== null;
  }

  // Never throws — fire-and-forget caller.
  async handle(message: WhatsappInboundMessageEntity): Promise<void> {
    const waId = message.wa_id;
    try {
      const batch = await this.recentBatch(waId);
      if (!batch) return;
      type Media = { id?: string; caption?: string; filename?: string };
      const raw = message.raw_payload as { image?: Media; document?: Media } | null;
      const media: Media | undefined = message.message_type === 'image' ? raw?.image : raw?.document;
      if (!media?.id) return;

      const saved = savedLinesOf(batch);
      if (saved.length === 0) {
        await this.reply(waId, 'Your last list had no saved expenses to attach a bill to.');
        return;
      }
      const targets = pickExpensesForCaption(saved, message.message_text ?? media.caption ?? null);
      if (!targets) {
        const list = saved.slice(0, 15).map((s) => `${s.index + 1}. ${s.line.description}`).join('\n');
        await this.reply(
          waId,
          `Which expense is this bill for? Send it again with a caption: a number (2), several numbers (1,2), a word from the item, or ALL if one bill covers everything:\n${list}`,
        );
        return;
      }

      const { data, mimeType } = await this.outbound.downloadMedia(media.id, MAX_BILL_BYTES);
      const ext = MIME_EXT[mimeType];
      if (!ext) {
        await this.reply(waId, 'Please send a photo (JPG/PNG) or a PDF.');
        return;
      }
      const mapping = await this.mappingRepo.findOneBy({ wa_id: waId, project_ref: batch.project_ref });
      await this.attachments.attachFromBufferToExpenses(batch.project_ref, targets.map((t) => t.expense_id), {
        data,
        content_type: mimeType,
        filename: media.filename ?? `bill-${targets.map((t) => t.index + 1).join('-')}.${ext}`,
        // A self-serve owner is the project's owner: they see their own bills.
        visible_to_owner: mapping?.created_by === SELF_SERVE_CREATED_BY,
      });
      await this.reply(
        waId,
        targets.length === 1
          ? `Bill attached to: ${targets[0].line.description}.`
          : `One bill attached to ${targets.length} expenses:\n${targets.map((t) => `• ${t.line.description}`).join('\n')}`,
      );
    } catch (err) {
      this.logger.error(`Bill attach failed for ${maskPhone(waId)}`, err instanceof Error ? err.stack : String(err));
      await this.reply(waId, 'I could not attach that bill right now. Please try again in a minute.');
    }
  }

  private async reply(to: string, text: string): Promise<void> {
    try {
      await this.outbound.sendTextMessage(to, text);
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp reply to ${maskPhone(to)}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
