import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsappOutboundClient } from './whatsapp-outbound.client';
import { GroundReportSubmissionService, ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from '../ground-reports/ground-report-submission.service';
import { StorageService } from '../trust/storage.service';
import type { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';

// GROUND-CONDITION REPORTS — the WhatsApp route. A user sends a message that
// starts with REPORT followed by "Field: value" lines; the sender's own
// WhatsApp number is the reporter phone (Meta has already verified it).
// Parsing is deterministic — no AI — so a typo never silently becomes data;
// anything missing or unclear is answered with exactly what to fix. The
// result is an UNTRUSTED_DATA submission in the admin review queue (Law 8),
// never a FACT. Photos / PDFs sent within 2 hours attach to that report.
export const REPORT_TEMPLATE = [
  'REPORT',
  'Society: Faisal Hills',
  'Block: A',
  'Plot: 2071 (optional)',
  'Role: Owner / Builder / Contractor',
  'Ground: Solid / Filled / Mixed',
  'Foundation: Standard / Raft / Deep strip / Piling',
  'Depth: 12 (feet, optional)',
  'Extra cost: 8 (Lac, optional)',
  'Year: 2024 (optional)',
  'Soil test: Yes / No',
  'Notes: anything buyers should know (optional)',
].join('\n');

const ROLES: Record<string, 'OWNER' | 'BUILDER' | 'CONTRACTOR' | 'OTHER'> = {
  owner: 'OWNER',
  builder: 'BUILDER',
  developer: 'BUILDER',
  contractor: 'CONTRACTOR',
  engineer: 'CONTRACTOR',
  other: 'OTHER',
};
const GROUNDS: Record<string, 'SOLID' | 'FILLED' | 'MIXED'> = {
  solid: 'SOLID',
  filled: 'FILLED',
  fill: 'FILLED',
  filling: 'FILLED',
  mixed: 'MIXED',
};
const FOUNDATIONS: Record<string, 'STANDARD' | 'RAFT' | 'DEEP_STRIP' | 'PILING'> = {
  standard: 'STANDARD',
  normal: 'STANDARD',
  raft: 'RAFT',
  'deep strip': 'DEEP_STRIP',
  'deep_strip': 'DEEP_STRIP',
  deep: 'DEEP_STRIP',
  piling: 'PILING',
  pile: 'PILING',
  piles: 'PILING',
};

const KEY_ALIASES: Record<string, string> = {
  society: 'society',
  block: 'block',
  plot: 'plot',
  'plot number': 'plot',
  role: 'role',
  ground: 'ground',
  soil: 'ground',
  foundation: 'foundation',
  depth: 'depth',
  'extra cost': 'extra_cost',
  cost: 'extra_cost',
  year: 'year',
  'soil test': 'soil_test',
  notes: 'notes',
  note: 'notes',
};

const firstNumber = (v: string): number | null => {
  const m = v.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

@Injectable()
export class WhatsappGroundReportService {
  private readonly logger = new Logger(WhatsappGroundReportService.name);

  constructor(
    private readonly reports: GroundReportSubmissionService,
    private readonly outbound: WhatsappOutboundClient,
    private readonly storage: StorageService,
  ) {}

  isReportMessage(text: string | null): boolean {
    return !!text && /^\s*report\b/i.test(text);
  }

  // A photo/PDF only counts as a report attachment when the sender has just
  // filed one; otherwise it flows through the normal routing untouched.
  async canAttach(waId: string, type: string): Promise<boolean> {
    if (type !== 'image' && type !== 'document') return false;
    return this.reports.hasRecentAttachableReport(waId);
  }

  async handle(message: WhatsappInboundMessageEntity): Promise<void> {
    try {
      if (message.message_type === 'image' || message.message_type === 'document') {
        await this.handleMedia(message);
      } else {
        await this.handleReportText(message);
      }
    } catch (err) {
      this.logger.error(
        `Ground report handling failed for message ${message.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.reply(message.wa_id, 'Sorry — we could not process that. Please try again in a moment.');
    }
  }

  private async handleReportText(message: WhatsappInboundMessageEntity): Promise<void> {
    const text = message.message_text ?? '';
    const fields = new Map<string, string>();
    let lastKey: string | null = null;
    for (const line of text.split('\n').slice(1)) {
      const m = line.match(/^\s*([A-Za-z ]{2,20}?)\s*[:\-–]\s*(.*)$/);
      const key = m ? KEY_ALIASES[m[1].trim().toLowerCase()] : undefined;
      if (m && key) {
        fields.set(key, m[2].trim());
        lastKey = key;
      } else if (lastKey === 'notes' && line.trim()) {
        fields.set('notes', `${fields.get('notes') ?? ''}\n${line.trim()}`.trim());
      }
    }

    if (fields.size === 0) {
      await this.reply(message.wa_id, `To report what you found underground, send:\n\n${REPORT_TEMPLATE}`);
      return;
    }

    const problems: string[] = [];
    const society = fields.get('society')?.replace(/\(.*?\)/g, '').trim();
    const block = fields.get('block')?.replace(/\(.*?\)/g, '').trim();
    if (!society || society.length < 2) problems.push('Society (e.g. Society: Faisal Hills)');
    if (!block) problems.push('Block (e.g. Block: A)');

    const pick = <T,>(key: string, table: Record<string, T>, label: string, optional = false): T | undefined => {
      const raw = fields.get(key)?.toLowerCase().replace(/\(.*?\)/g, '').trim();
      if (!raw) {
        if (!optional) problems.push(label);
        return undefined;
      }
      const hit = table[raw];
      if (!hit) problems.push(`${label} — "${fields.get(key)}" is not one of the options`);
      return hit;
    };
    const ground = pick('ground', GROUNDS, 'Ground (Solid / Filled / Mixed)');
    const foundation = pick('foundation', FOUNDATIONS, 'Foundation (Standard / Raft / Deep strip / Piling)');
    const role = pick('role', ROLES, 'Role', true) ?? 'OTHER';

    const depth = fields.has('depth') ? firstNumber(fields.get('depth')!) : null;
    const extra = fields.has('extra_cost') ? firstNumber(fields.get('extra_cost')!) : null;
    const year = fields.has('year') ? firstNumber(fields.get('year')!) : null;
    if (depth !== null && (depth < 0 || depth > 100)) problems.push('Depth must be in feet, between 0 and 100');
    if (year !== null && (year < 1990 || year > new Date().getFullYear())) problems.push('Year looks wrong');
    const soilRaw = fields.get('soil_test')?.toLowerCase() ?? '';
    const soilTest = /^(yes|y|true|done|haan|han)/.test(soilRaw);

    if (problems.length > 0 || !society || !block || !ground || !foundation) {
      await this.reply(
        message.wa_id,
        `We could not save your report yet. Please fix:\n- ${problems.join('\n- ')}\n\nSend the whole message again, starting with REPORT.`,
      );
      return;
    }

    try {
      const saved = await this.reports.submit({
        society_name_raw: society,
        block,
        plot_number: fields.get('plot')?.replace(/\(.*?\)/g, '').trim() || null,
        reporter_role: role,
        reporter_phone: message.wa_id,
        ground_condition: ground,
        soil_test_done: soilTest,
        foundation_type: foundation,
        foundation_depth_ft: depth,
        extra_cost_lac: extra,
        build_year: year,
        notes: fields.get('notes')?.slice(0, 1000) || null,
        source: 'WHATSAPP',
      });
      await this.reply(
        message.wa_id,
        `Thank you — report received (ref ${saved.id.slice(0, 8)}). You can now send up to 3 photos or soil-test PDFs in the next 2 hours and we will attach them. Our team reviews every report before it is shown.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.reply(
        message.wa_id,
        /already reported|DUPLICATE/i.test(JSON.stringify((err as { response?: unknown })?.response ?? msg))
          ? 'You have already reported this plot/block — thank you. It is awaiting review or already counted.'
          : 'Sorry — we could not save your report. Please check the details and try again.',
      );
      if (!/already reported|DUPLICATE/i.test(msg)) throw err;
    }
  }

  private async handleMedia(message: WhatsappInboundMessageEntity): Promise<void> {
    const raw = message.raw_payload as { image?: { id?: string }; document?: { id?: string } } | null;
    const mediaId = (message.message_type === 'image' ? raw?.image?.id : raw?.document?.id) ?? null;
    if (!mediaId) return;

    const { data, mimeType } = await this.outbound.downloadMedia(mediaId, MAX_ATTACHMENT_BYTES);
    const ext = ALLOWED_ATTACHMENT_TYPES[mimeType];
    if (!ext) {
      await this.reply(message.wa_id, 'Please send photos (JPG/PNG) or a PDF only.');
      return;
    }
    const key = `ground-reports/${randomUUID()}.${ext}`;
    await this.storage.uploadFile(key, data, mimeType);
    const attached = await this.reports.attachToRecentReport(message.wa_id, {
      key,
      content_type: mimeType,
      size_bytes: data.length,
    });
    if (!attached) {
      await this.storage.deleteFile(key).catch(() => undefined);
      await this.reply(message.wa_id, 'We could not attach that file (3 files per report, within 2 hours of sending your REPORT).');
      return;
    }
    await this.reply(message.wa_id, `File attached (${attached.count}/3). Thank you.`);
  }

  private async reply(to: string, body: string): Promise<void> {
    try {
      await this.outbound.sendTextMessage(to, body);
    } catch (err) {
      this.logger.warn(`Ground report reply failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
