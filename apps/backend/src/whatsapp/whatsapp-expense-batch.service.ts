import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TradeCategory } from '@siraat/shared-types';
import { WhatsappAiClient } from './whatsapp-ai.client';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { WhatsappConfirmationService, isConfirmationReply, mapToExpenseUnit } from './whatsapp-confirmation.service';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappExpenseBatchEntity, ExpenseBatchStoredLine } from './entities/whatsapp-expense-batch.entity';
import { ConstructionProjectService } from '../construction-intelligence/construction-project.service';
import { maskPhone } from './whatsapp-phone.util';

const BATCH_TRIGGER = /^\s*project\s+expense\b/i;
const CANCEL_WORDS = ['cancel', 'no', 'n', 'discard', 'stop', 'reject'];
const SUMMARY_LINE_LIMIT = 25;

export function isExpenseBatchMessage(text: string | null): boolean {
  return !!text && BATCH_TRIGGER.test(text);
}

export function isCancelReply(text: string | null): boolean {
  if (!text) return false;
  return CANCEL_WORDS.includes(text.trim().toLowerCase().replace(/[.!?]+$/, ''));
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function projectNamesMatch(stated: string, actual: string): boolean {
  const a = normName(stated);
  const b = normName(actual);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

function money(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildBatchSummary(projectName: string, lines: ExpenseBatchStoredLine[], total: number): string {
  const out: string[] = [`Found ${lines.length} expenses for ${projectName}:`];
  let lastDate = '';
  lines.slice(0, SUMMARY_LINE_LIMIT).forEach((l, i) => {
    if (l.date !== lastDate) {
      out.push('', l.date);
      lastDate = l.date;
    }
    const extras = [l.vendor !== 'Not specified' ? l.vendor : null, l.paid_by ? `paid by ${l.paid_by}` : null].filter(Boolean);
    out.push(`${i + 1}. ${l.description} — ${money(l.amount)}${extras.length ? ` (${extras.join(', ')})` : ''}`);
  });
  if (lines.length > SUMMARY_LINE_LIMIT) out.push(`…and ${lines.length - SUMMARY_LINE_LIMIT} more`);
  out.push('', `Total: ${money(total)}`, '', 'Reply YES to save all, CANCEL to discard, or resend a corrected message.');
  return out.join('\n');
}

@Injectable()
export class WhatsappExpenseBatchService {
  private readonly logger = new Logger(WhatsappExpenseBatchService.name);

  constructor(
    @InjectRepository(WhatsappExpenseBatchEntity)
    private readonly batchRepo: Repository<WhatsappExpenseBatchEntity>,
    @InjectRepository(WhatsappInboundMessageEntity)
    private readonly inboundRepo: Repository<WhatsappInboundMessageEntity>,
    private readonly aiClient: WhatsappAiClient,
    private readonly outbound: WhatsappOutboundClient,
    private readonly confirmationSvc: WhatsappConfirmationService,
    private readonly cpSvc: ConstructionProjectService,
  ) {}

  // Never throws — fire-and-forget caller. On failure the message stays
  // RECEIVED so it can be re-driven, and the sender is told.
  async parseAndStoreBatch(message: WhatsappInboundMessageEntity): Promise<void> {
    if (message.status !== 'RECEIVED' || !message.project_ref || !message.message_text) return;
    try {
      const project = await this.cpSvc.findProjectById(message.project_ref);
      const projectName = project?.name ?? 'your project';

      const outcome = await this.aiClient.extractExpenseBatch(message.message_text);

      if (outcome.project_name && project && !projectNamesMatch(outcome.project_name, project.name)) {
        await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });
        await this.reply(
          message.wa_id,
          `This message is for "${outcome.project_name}", but this number is linked to "${project.name}". Nothing was saved. Please check the Project Name line.`,
        );
        return;
      }

      if (outcome.lines.length === 0) {
        await this.reply(message.wa_id, 'I could not find any expense lines in that message. Nothing was saved.');
        await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });
        return;
      }

      const fallbackDate = isoDay(message.wa_timestamp);
      const lines: ExpenseBatchStoredLine[] = outcome.lines.map((l) => ({
        date: l.date ?? fallbackDate,
        description: l.description,
        amount: l.amount,
        quantity: l.quantity,
        unit: l.unit,
        vendor: l.vendor?.trim() || 'Not specified',
        paid_by: l.paid_by,
        trade_category: l.trade_category ?? 'MISCELLANEOUS',
        raw_line: l.raw_line,
      }));
      const total = lines.reduce((s, l) => s + l.amount, 0);

      await this.batchRepo.update(
        { project_ref: message.project_ref, status: 'PENDING' },
        { status: 'SUPERSEDED' },
      );
      await this.batchRepo.save(
        this.batchRepo.create({
          inbound_message_id: message.id,
          project_ref: message.project_ref,
          status: 'PENDING',
          lines,
          line_count: lines.length,
          total_amount: total.toFixed(2),
          raw_ai_response: outcome.raw,
        }),
      );
      await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });
      await this.reply(message.wa_id, buildBatchSummary(projectName, lines, total));
    } catch (err) {
      this.logger.error(
        `Failed bulk expense parse for message id=${message.id} from ${maskPhone(message.wa_id)}`,
        err instanceof Error ? err.stack : String(err),
      );
      await this.reply(message.wa_id, 'I could not read that expense list right now. Nothing was saved — please resend in a minute.');
    }
  }

  async findPendingBatch(projectRef: string | null): Promise<WhatsappExpenseBatchEntity | null> {
    if (!projectRef) return null;
    return this.batchRepo.findOne({ where: { project_ref: projectRef, status: 'PENDING' }, order: { created_at: 'DESC' } });
  }

  // Returns true when the reply was consumed (YES / CANCEL), false when it is
  // something else and should fall through to the normal flow.
  async handleReply(batch: WhatsappExpenseBatchEntity, message: WhatsappInboundMessageEntity): Promise<boolean> {
    try {
      if (isConfirmationReply(message.message_text)) {
        await this.confirm(batch, message);
        return true;
      }
      if (isCancelReply(message.message_text)) {
        await this.batchRepo.update({ id: batch.id, status: 'PENDING' }, { status: 'CANCELLED' });
        await this.reply(message.wa_id, 'Discarded. Nothing was saved.');
        return true;
      }
      return false;
    } catch (err) {
      this.logger.error(`Failed bulk expense reply for batch id=${batch.id}`, err instanceof Error ? err.stack : String(err));
      return true;
    }
  }

  private async confirm(batch: WhatsappExpenseBatchEntity, message: WhatsappInboundMessageEntity): Promise<void> {
    const claim = await this.batchRepo.update({ id: batch.id, status: 'PENDING' }, { status: 'CONFIRMED', confirmed_at: new Date() });
    if (!claim.affected) return;

    const results: Array<{ index: number; ok: boolean; expense_id?: string; error?: string }> = [];
    let saved = 0;
    let savedTotal = 0;

    for (let i = 0; i < batch.lines.length; i++) {
      const l = batch.lines[i];
      try {
        const sectionId = await this.confirmationSvc.findOrCreateSection(batch.project_ref, l.trade_category as TradeCategory);
        const expense = await this.cpSvc.createExpense(sectionId, {
          expense_date: l.date,
          description: l.description,
          vendor_name: l.vendor,
          vendor_contact: null,
          linked_contractor_id: null,
          linked_supplier_id: null,
          amount: l.amount,
          quantity: l.quantity,
          unit: mapToExpenseUnit(l.unit),
          rate: null,
          source: 'WHATSAPP',
          paid_by: l.paid_by,
        });
        saved++;
        savedTotal += l.amount;
        results.push({ index: i, ok: true, expense_id: expense.id });
      } catch (err) {
        results.push({ index: i, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    await this.batchRepo.update({ id: batch.id }, { result: results });
    const failed = batch.lines.length - saved;
    await this.reply(
      message.wa_id,
      failed === 0
        ? `Saved ${saved} expenses, total ${money(savedTotal)}.`
        : `Saved ${saved} of ${batch.lines.length} expenses (total ${money(savedTotal)}). ${failed} failed — please check the project or resend those lines.`,
    );
  }

  private async reply(to: string, text: string): Promise<void> {
    try {
      await this.outbound.sendTextMessage(to, text);
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp reply to ${maskPhone(to)}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
