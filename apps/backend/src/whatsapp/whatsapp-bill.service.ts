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

// Which saved expense does this bill belong to? A single saved expense needs
// no caption. Otherwise the caption names it: a list number ("2", "#2") or a
// word from its description ("cement"). Returns null when it is not clear.
export function pickExpenseForCaption(saved: SavedLine[], caption: string | null): SavedLine | null {
  if (saved.length === 1) return saved[0];
  const text = (caption ?? '').trim().toLowerCase();
  if (!text) return null;
  const num = /^#?\s*(\d{1,3})\.?$/.exec(text);
  if (num) return saved.find((s) => s.index + 1 === Number(num[1])) ?? null;
  const tokens = text.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return null;
  const scored = saved
    .map((s) => ({ s, score: tokens.filter((t) => s.line.description.toLowerCase().includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored[1] && scored[1].score === scored[0].score) return null;
  return scored[0].s;
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
      const target = pickExpenseForCaption(saved, message.message_text ?? media.caption ?? null);
      if (!target) {
        const list = saved.slice(0, 15).map((s) => `${s.index + 1}. ${s.line.description}`).join('\n');
        await this.reply(
          waId,
          `Which expense is this bill for? Send it again with a caption — the number or a word from the item:\n${list}`,
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
      await this.attachments.attachFromBuffer(batch.project_ref, target.expense_id, {
        data,
        content_type: mimeType,
        filename: media.filename ?? `bill-${target.index + 1}.${ext}`,
        // A self-serve owner is the project's owner: they see their own bills.
        visible_to_owner: mapping?.created_by === SELF_SERVE_CREATED_BY,
      });
      await this.reply(waId, `Bill attached to: ${target.line.description}.`);
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
