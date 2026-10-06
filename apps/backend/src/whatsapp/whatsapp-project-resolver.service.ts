import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';
import { WhatsappExpenseBatchEntity } from './entities/whatsapp-expense-batch.entity';
import { WhatsappDraftExpenseEntity } from './entities/whatsapp-draft-expense.entity';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { ConstructionProjectService } from '../construction-intelligence/construction-project.service';
import { isConfirmationReply } from './whatsapp-confirmation.service';
import { isCancelReply } from './whatsapp-expense-batch.service';
import { maskPhone } from './whatsapp-phone.util';

export type ProjectResolution =
  | { kind: 'resolved'; project_ref: string }
  | { kind: 'ask'; reply: string };

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function extractProjectName(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/^\s*project\s*(?:name)?\s*[:\-]\s*(.+)$/im);
  const name = m?.[1]?.trim();
  return name ? name : null;
}

export function nameScore(stated: string, actual: string): number {
  const a = norm(stated);
  const b = norm(actual);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const ca = a.replace(/ /g, '');
  const cb = b.replace(/ /g, '');
  if (ca === cb) return 0.95;
  if (ca.includes(cb) || cb.includes(ca)) return 0.8;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / new Set([...ta, ...tb]).size;
}

export function pickClosest(
  stated: string,
  projects: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const scored = projects.map((p) => ({ p, s: nameScore(stated, p.name) })).sort((x, y) => y.s - x.s);
  const best = scored[0];
  if (!best || best.s < 0.5) return null;
  if (scored[1] && best.s - scored[1].s < 0.15) return null;
  return best.p;
}

// One WhatsApp number can be linked to several projects. With exactly one
// link nothing changes; with several, the project is taken from the message's
// "Project Name:" line (closest match), or the sender is asked.
@Injectable()
export class WhatsappProjectResolverService {
  private readonly logger = new Logger(WhatsappProjectResolverService.name);

  constructor(
    @InjectRepository(WhatsappExpenseBatchEntity)
    private readonly batchRepo: Repository<WhatsappExpenseBatchEntity>,
    @InjectRepository(WhatsappDraftExpenseEntity)
    private readonly draftRepo: Repository<WhatsappDraftExpenseEntity>,
    private readonly cpSvc: ConstructionProjectService,
    private readonly outbound: WhatsappOutboundClient,
  ) {}

  async resolve(
    waId: string,
    text: string | null,
    mappings: WhatsappProjectMappingEntity[],
  ): Promise<ProjectResolution> {
    if (mappings.length === 1) return { kind: 'resolved', project_ref: mappings[0].project_ref };

    const projects: Array<{ id: string; name: string }> = [];
    for (const m of mappings) {
      const p = await this.cpSvc.findProjectById(m.project_ref);
      if (p) projects.push({ id: p.id, name: p.name });
    }
    const list = projects.map((p) => `• ${p.name}`).join('\n');

    if (isConfirmationReply(text) || isCancelReply(text)) {
      const refs = projects.map((p) => p.id);
      const pendingBatch = await this.batchRepo.find({ where: refs.map((r) => ({ project_ref: r, status: 'PENDING' as const })), order: { created_at: 'DESC' }, take: 1 });
      const pendingDraft = await this.draftRepo.find({ where: refs.map((r) => ({ project_ref: r, status: 'PENDING' as const })), order: { created_at: 'DESC' }, take: 1 });
      const b = pendingBatch[0];
      const d = pendingDraft[0];
      if (b && (!d || b.created_at >= d.created_at)) return { kind: 'resolved', project_ref: b.project_ref };
      if (d) return { kind: 'resolved', project_ref: d.project_ref };
      return { kind: 'ask', reply: 'Nothing is waiting for confirmation. Send your expenses with a "Project Name:" line.' };
    }

    const stated = extractProjectName(text);
    if (!stated) {
      return {
        kind: 'ask',
        reply: `Which project is this for? Please resend with a line like "Project Name: <name>".\nYour projects:\n${list}`,
      };
    }
    const match = pickClosest(stated, projects);
    if (!match) {
      return {
        kind: 'ask',
        reply: `I could not match "${stated}" to one of your projects. Please resend with the exact name.\nYour projects:\n${list}`,
      };
    }
    return { kind: 'resolved', project_ref: match.id };
  }

  // True when any of these projects has a PENDING ledger batch or draft
  // awaiting a YES/CANCEL — used to keep a reply from a listing-forwarder
  // number out of the inventory flow.
  async hasPending(projectRefs: string[]): Promise<boolean> {
    if (projectRefs.length === 0) return false;
    const where = projectRefs.map((r) => ({ project_ref: r, status: 'PENDING' as const }));
    const [b, d] = await Promise.all([this.batchRepo.count({ where }), this.draftRepo.count({ where })]);
    return b + d > 0;
  }

  async ask(to: string, text: string): Promise<void> {
    try {
      await this.outbound.sendTextMessage(to, text);
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp reply to ${maskPhone(to)}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
