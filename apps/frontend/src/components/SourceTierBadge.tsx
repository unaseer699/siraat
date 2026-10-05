import { TRUST_GREEN, NEUTRAL_GRAY } from '@/styles/tokens';

// UI REVIEW finding — this exact component (same markup, same style values)
// was independently copy-pasted into EstimateResults.tsx, admin/material-
// rates/page.tsx, and supplier/[id]/page.tsx, each with its own comment
// pointing at the "others" as the source of the convention. Consolidated
// here as the one real source of truth: "not the same visual weight as
// verified data" — a filled green pill for supplier-verified rates, a plain
// outlined gray label for market-reference/field-reported ones, nothing at
// all for an unknown/null tier.
export type SourceTier = 'SUPPLIER_VERIFIED' | 'MARKET_REFERENCE' | 'FIELD_REPORTED' | string;

export function SourceTierBadge({ tier }: { tier: SourceTier | null | undefined }) {
  if (tier === 'SUPPLIER_VERIFIED') {
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 700,
          color: TRUST_GREEN,
          background: `${TRUST_GREEN}18`,
          padding: '2px 10px',
          borderRadius: '99px',
        }}
      >
        Supplier Verified
      </span>
    );
  }
  if (tier === 'MARKET_REFERENCE' || tier === 'FIELD_REPORTED') {
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 600,
          color: NEUTRAL_GRAY,
          border: `1px solid ${NEUTRAL_GRAY}50`,
          padding: '1px 9px',
          borderRadius: '99px',
        }}
      >
        {tier === 'FIELD_REPORTED' ? 'Field Reported' : 'Market Reference'}
      </span>
    );
  }
  return null;
}
