import type { ExpenseSource } from '@/lib/api';

// VENDOR COLUMN TIDY-UP — the backend stores a long placeholder sentence
// as vendor_name whenever WhatsApp confirmation can't extract a vendor
// (WhatsappConfirmationService.confirmDraft, whatsapp-confirmation.service.ts
// — the string is only defined there; kept as-is because it also flows into
// source_name elsewhere in that service). This is a display-only fix: the
// value in the database is untouched, we just render something quieter.
//
// Matched by source === 'WHATSAPP' plus a prefix check, not equality — an
// admin who edits the vendor by hand on a WhatsApp-sourced row overwrites
// vendor_name with a real name, and that must always win.
const WHATSAPP_VENDOR_PLACEHOLDER_PREFIX = 'WhatsApp submission';

export function isWhatsappVendorPlaceholder(vendor_name: string, source: ExpenseSource | null): boolean {
  return source === 'WHATSAPP' && vendor_name.startsWith(WHATSAPP_VENDOR_PLACEHOLDER_PREFIX);
}

// Shared by both the admin table (ExpenseRow/HistoryExpenseRow) and the
// public dashboard (ExpenseLine) so the two can't drift apart. An em-dash
// reads cleaner here than repeating "WhatsApp" — the WhatsappBadge next to
// the description already says that; the full placeholder sentence is still
// available via the title tooltip.
export default function VendorLabel({
  vendor_name,
  source,
}: {
  vendor_name: string;
  source: ExpenseSource | null;
}) {
  if (isWhatsappVendorPlaceholder(vendor_name, source)) {
    return (
      <span style={{ color: 'var(--muted)' }} title={vendor_name}>
        —
      </span>
    );
  }
  return <>{vendor_name}</>;
}
