import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAccountEntity, WhatsappPlan } from './entities/whatsapp-account.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { ConstructionProjectService } from '../construction-intelligence/construction-project.service';
import { maskPhone } from './whatsapp-phone.util';
import { pickClosest, nameScore } from './whatsapp-project-resolver.service';

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

export type ProjectCommand = { action: 'SHARE' | 'SHARE_YES' | 'UNSHARE' | 'DONE' | 'REOPEN'; name: string | null };

// "SHARE", "SHARE YES", "UNSHARE", "DONE", "REOPEN", each optionally followed
// by a project name (needed only when the sender has several projects).
export function parseProjectCommand(text: string | null): ProjectCommand | null {
  if (!text || text.length > 120 || text.includes('\n')) return null;
  const m = /^\s*(share\s+yes|share|unshare|done|reopen)\b[\s:,.-]*(.*)$/i.exec(text);
  if (!m) return null;
  const word = m[1].toLowerCase().replace(/\s+/g, ' ');
  const action = word === 'share yes' ? 'SHARE_YES' : (word.toUpperCase() as ProjectCommand['action']);
  return { action, name: m[2].trim() || null };
}

export interface CommandProject {
  id: string;
  name: string;
  status: string;
  is_public: boolean;
}

export interface MatchedProjectCommand {
  cmd: ProjectCommand;
  projects: CommandProject[];
  target: CommandProject | null;
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

  // Decides whether a message is really a project command for this sender.
  // A command word followed by anything that is not the name of one of their
  // projects ("Done with the slab, paid 50000") is ordinary text, not a
  // command. Returns null then, or when the sender has no self-serve project.
  async matchProjectCommand(waId: string, text: string | null): Promise<MatchedProjectCommand | null> {
    const cmd = parseProjectCommand(text);
    if (!cmd) return null;
    const mappings = await this.mappingRepo.find({ where: { wa_id: waId, created_by: SELF_SERVE_CREATED_BY }, order: { created_at: 'ASC' } });
    const projects: CommandProject[] = [];
    for (const m of mappings) {
      const p = await this.cpSvc.findProjectById(m.project_ref);
      if (p) projects.push({ id: p.id, name: p.name, status: p.status, is_public: p.is_public });
    }
    if (projects.length === 0) return null;
    if (cmd.name) {
      const match = pickClosest(cmd.name, projects);
      const only = projects.length === 1 && nameScore(cmd.name, projects[0].name) >= 0.5 ? projects[0] : null;
      const hit = match ? (projects.find((p) => p.id === match.id) ?? null) : only;
      return hit ? { cmd, projects, target: hit } : null;
    }
    return { cmd, projects, target: projects.length === 1 ? projects[0] : null };
  }

  // Runs a matched command. Never throws.
  async handleProjectCommand(message: WhatsappInboundMessageEntity, matched: MatchedProjectCommand): Promise<void> {
    const waId = message.wa_id;
    const { cmd, projects, target } = matched;
    try {
      await this.inboundRepo.update({ id: message.id }, { status: 'PARSED' });
      if (!target) {
        const list = projects.map((p) => `• ${p.name}`).join('\n');
        await this.reply(waId, `Which project? Send the command with its name, e.g. "${cmd.action === 'SHARE_YES' ? 'SHARE YES' : cmd.action} ${projects[0].name}".\nYour projects:\n${list}`);
        return;
      }
      const base = (process.env.PUBLIC_SITE_URL ?? process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
      switch (cmd.action) {
        case 'SHARE':
          await this.reply(
            waId,
            `Share "${target.name}" on Siraat Real builds so others can learn from your costs?\n\nPeople will see: dates, item descriptions, amounts and quantities, and totals by phase.\nNever shown: your name, number, location, vendors or bills. Avoid names or phone numbers in item descriptions.\n\nReply "SHARE YES${projects.length > 1 ? ' ' + target.name : ''}" to publish. Send UNSHARE any time to remove it.`,
          );
          break;
        case 'SHARE_YES':
          await this.cpSvc.updateProject(target.id, { is_public: true });
          await this.reply(
            waId,
            target.status === 'COMPLETE'
              ? `"${target.name}" is now on Real builds.\n${base}/real-builds/${target.id}`
              : `Sharing is on for "${target.name}". It will appear on Real builds once you mark the house finished — send DONE then. Send UNSHARE to stop sharing.`,
          );
          break;
        case 'UNSHARE':
          await this.cpSvc.updateProject(target.id, { is_public: false });
          await this.reply(waId, `"${target.name}" is no longer shared on Real builds.`);
          break;
        case 'DONE':
          await this.cpSvc.updateProject(target.id, { status: 'COMPLETE' });
          await this.reply(
            waId,
            target.is_public
              ? `"${target.name}" is marked finished and is now on Real builds with your actual costs.\n${base}/real-builds/${target.id}`
              : `"${target.name}" is marked finished. Send SHARE if you want it on Real builds. Send REOPEN to add more expenses as in progress.`,
          );
          break;
        case 'REOPEN':
          await this.cpSvc.updateProject(target.id, { status: 'ACTIVE' });
          await this.reply(waId, `"${target.name}" is open again as in progress.`);
          break;
      }
    } catch (err) {
      this.logger.error(`Project command failed for ${maskPhone(waId)}`, err instanceof Error ? err.stack : String(err));
      await this.reply(waId, 'I could not do that right now. Please try again in a minute.');
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

  // Admin list: each account with its project count and saved-expense usage.
  async listAccounts(): Promise<
    Array<WhatsappAccountEntity & { projects: number; expenses_used: number; is_active_paid: boolean }>
  > {
    const rows = await this.accountRepo.find({ order: { created_at: 'DESC' } });
    return Promise.all(
      rows.map(async (a) => {
        const maps = await this.mappingRepo.find({ where: { wa_id: a.wa_id, created_by: SELF_SERVE_CREATED_BY } });
        let used = 0;
        for (const m of maps) used += await this.cpSvc.countActiveExpenses(m.project_ref);
        return Object.assign(a, { projects: maps.length, expenses_used: used, is_active_paid: this.isActivePaid(a) });
      }),
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
