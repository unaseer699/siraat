import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAccountEntity, WhatsappPlan } from './entities/whatsapp-account.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { ConstructionProjectService } from '../construction-intelligence/construction-project.service';
import { maskPhone } from './whatsapp-phone.util';

const NEW_PROJECT_RE = /^\s*(?:new|start|create)\s+project\s*[:\-]\s*(.+)$/im;

export function extractNewProjectName(text: string | null): string | null {
  const m = text ? NEW_PROJECT_RE.exec(text) : null;
  const name = m?.[1]?.trim().slice(0, 120);
  return name ? name : null;
}

export function isNewProjectMessage(text: string | null): boolean {
  return extractNewProjectName(text) !== null;
}

const REPORT_RE = /^\s*(?:my\s+)?(?:report|link|dashboard)\s*[.!]?\s*$/i;

export function isReportRequest(text: string | null): boolean {
  return !!text && REPORT_RE.test(text);
}

export const SELF_SERVE_CREATED_BY = 'self-serve';

export type QuotaResult = { allowed: true } | { allowed: false; reply: string };

@Injectable()
export class WhatsappSelfServeService {
  private readonly logger = new Logger(WhatsappSelfServeService.name);

  constructor(
    @InjectRepository(WhatsappAccountEntity)
    private readonly accountRepo: Repository<WhatsappAccountEntity>,
    @InjectRepository(WhatsappProjectMappingEntity)
    private readonly mappingRepo: Repository<WhatsappProjectMappingEntity>,
    @InjectRepository(WhatsappInboundMessageEntity)
    private readonly inboundRepo: Repository<WhatsappInboundMessageEntity>,
    private readonly cpSvc: ConstructionProjectService,
    private readonly outbound: WhatsappOutboundClient,
  ) {}

  private isOwnerNumber(waId: string): boolean {
    const list = (process.env.WHATSAPP_ADMIN_NUMBERS ?? '').split(',').map((n) => n.replace(/\D/g, '')).filter(Boolean);
    return list.includes(waId.replace(/\D/g, ''));
  }

  private isActivePaid(a: WhatsappAccountEntity): boolean {
    return a.plan === 'PAID' && (!a.paid_until || a.paid_until.getTime() > Date.now());
  }

  // "New Project: <name>" from any number. Creates the project, links the
  // number to it and starts a TRIAL account. A trial number gets one project;
  // a paid number may start more. Never throws (fire-and-forget caller).
  async handleNewProject(message: WhatsappInboundMessageEntity): Promise<void> {
    const waId = message.wa_id;
    try {
      const name = extractNewProjectName(message.message_text);
      if (!name) return;
      await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });

      let account = await this.accountRepo.findOneBy({ wa_id: waId });
      if (account?.plan === 'BLOCKED') {
        await this.reply(waId, 'This number cannot start new projects. Please contact Siraat support.');
        return;
      }
      if (!account) account = await this.accountRepo.save(this.accountRepo.create({ wa_id: waId, plan: 'TRIAL' }));

      if (!this.isOwnerNumber(waId) && !this.isActivePaid(account)) {
        const owned = await this.mappingRepo.count({ where: { wa_id: waId, created_by: SELF_SERVE_CREATED_BY } });
        if (owned >= 1) {
          await this.reply(
            waId,
            'The free trial includes one live project. To track more projects, upgrade to the paid plan — message Siraat and we will activate it.',
          );
          return;
        }
      }

      const project = await this.cpSvc.createProject({
        name,
        property_ref: null,
        owner_contact: waId,
        start_date: new Date().toISOString().slice(0, 10),
        status: 'ACTIVE',
      });
      await this.mappingRepo.save(this.mappingRepo.create({ wa_id: waId, project_ref: project.id, created_by: SELF_SERVE_CREATED_BY }));

      const limitNote = this.isActivePaid(account) ? '' : `\n\nFree trial: up to ${account.trial_expense_limit} expenses.`;
      await this.reply(
        waId,
        `Your project "${project.name}" is ready.\n\nSend expenses like:\nProject Name: ${project.name}\nCement 50 bags - 77000\nBricks 5000 - 60000\n\nI will show what I understood — reply YES to save.${limitNote}`,
      );
    } catch (err) {
      this.logger.error(`New project failed for ${maskPhone(waId)}`, err instanceof Error ? err.stack : String(err));
      await this.reply(waId, 'I could not create the project right now. Please try again in a minute.');
    }
  }

  // "REPORT" from a number with linked projects: reply with each project's
  // private cost-report link. The project id is an unguessable UUID, so the
  // link itself is the secret; nothing else is exposed. Returns false when the
  // sender has no linked project (caller routes the message normally).
  async handleReportRequest(message: WhatsappInboundMessageEntity): Promise<boolean> {
    const waId = message.wa_id;
    try {
      const mappings = await this.mappingRepo.find({ where: { wa_id: waId }, order: { created_at: 'ASC' } });
      if (mappings.length === 0) return false;
      await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });
      const base = (process.env.PUBLIC_SITE_URL ?? process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
      const lines: string[] = [];
      for (const m of mappings) {
        const p = await this.cpSvc.findProjectById(m.project_ref);
        if (p) lines.push(`${p.name}\n${base}/project/${p.id}`);
      }
      if (lines.length === 0) return false;
      await this.reply(
        waId,
        `Your cost report${lines.length > 1 ? 's' : ''} (private link${lines.length > 1 ? 's' : ''} — do not share unless you want others to see your expenses):\n\n${lines.join('\n\n')}\n\nOpen it to see totals by section and use Download / Print PDF.`,
      );
      return true;
    } catch (err) {
      this.logger.error(`Report link failed for ${maskPhone(waId)}`, err instanceof Error ? err.stack : String(err));
      return false;
    }
  }

  // Checked when a batch is about to be saved. Numbers with no account row
  // (admin-mapped, legacy) and owner numbers are never limited.
  async checkExpenseQuota(waId: string, projectRef: string, incoming: number): Promise<QuotaResult> {
    if (this.isOwnerNumber(waId)) return { allowed: true };
    const account = await this.accountRepo.findOneBy({ wa_id: waId });
    if (!account) return { allowed: true };
    if (account.plan === 'BLOCKED') {
      return { allowed: false, reply: 'This account is blocked. Please contact Siraat support.' };
    }
    if (this.isActivePaid(account)) return { allowed: true };
    if (account.plan === 'PAID') {
      return { allowed: false, reply: 'Your paid plan has expired. Message Siraat to renew and continue saving expenses.' };
    }
    const used = await this.cpSvc.countActiveExpenses(projectRef);
    if (used + incoming > account.trial_expense_limit) {
      const left = Math.max(0, account.trial_expense_limit - used);
      return {
        allowed: false,
        reply: `Your free trial allows ${account.trial_expense_limit} expenses and you have used ${used}. This list has ${incoming} (${left} left). Nothing was saved. Upgrade to the paid plan to continue — message Siraat.`,
      };
    }
    return { allowed: true };
  }

  async setPlan(waId: string, plan: WhatsappPlan, paidUntil: Date | null, trialLimit?: number): Promise<WhatsappAccountEntity> {
    const existing = await this.accountRepo.findOneBy({ wa_id: waId });
    const row = existing ?? this.accountRepo.create({ wa_id: waId });
    row.plan = plan;
    row.paid_until = plan === 'PAID' ? paidUntil : null;
    if (trialLimit !== undefined) row.trial_expense_limit = trialLimit;
    return this.accountRepo.save(row);
  }

  listAccounts(): Promise<WhatsappAccountEntity[]> {
    return this.accountRepo.find({ order: { created_at: 'DESC' } });
  }

  private async reply(to: string, text: string): Promise<void> {
    try {
      await this.outbound.sendTextMessage(to, text);
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp reply to ${maskPhone(to)}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
