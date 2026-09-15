import { WHATSAPP_GREEN } from '../styles/tokens';

// WHATSAPP EXPENSE BADGE — Frontend. Small, unobtrusive provenance tag for
// an expense line item that originated from a confirmed WhatsApp draft
// (Expense.source === 'WHATSAPP' — see WhatsApp Integration Phase 5).
// Deliberately the only badge this app renders per expense row: a manually
// entered expense (source: null | 'MANUAL') renders nothing here rather
// than a competing "Manual" tag, so the WhatsApp-sourced rows are the ones
// that stand out, not every row equally.
export default function WhatsappBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: 600,
        color: WHATSAPP_GREEN,
        whiteSpace: 'nowrap',
      }}
      title="Added via WhatsApp"
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: WHATSAPP_GREEN,
          flexShrink: 0,
        }}
      />
      via WhatsApp
    </span>
  );
}
