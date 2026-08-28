import { notFound } from 'next/navigation';
import { fetchContractor, fetchContractorVerifications } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { BackLink } from '@/components/BackLink';
import StatCard from '@/components/StatCard';
import { TRADE_CATEGORY_OPTIONS } from '@/lib/tradeCategories';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY, REVOKED_SLATE, REVOKED_SLATE_BG, REVOKED_SLATE_BORDER } from '@/styles/tokens';
import type { VerificationResponse, SocietyVerificationStatus } from '@siraat/shared-types';

interface Props {
  params: { id: string };
}

// Same claim-status badge meta as society/[id]/page.tsx.
const STATUS_META: Record<
  'VERIFIED' | 'DISPUTED' | 'PENDING' | 'CANCELLED',
  { color: string; bg: string; border: string; tone: 'success' | 'danger' | 'warning' | 'revoked'; icon: string; label: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, tone: 'success', icon: '✓', label: 'Verified' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, tone: 'danger', icon: '⚠', label: 'Disputed' },
  // EVIDENCE DOCUMENT MODEL Chunk 2 — see STATUS_META in society/[id]/page.tsx
  // for why CANCELLED gets its own REVOKED_SLATE tone rather than DANGER_RED.
  CANCELLED: {
    color: REVOKED_SLATE,
    bg: REVOKED_SLATE_BG,
    border: REVOKED_SLATE_BORDER,
    tone: 'revoked',
    icon: '✕',
    label: 'Cancelled',
  },
  PENDING: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, tone: 'warning', icon: '…', label: 'Pending' },
};

function StatusBadge({ status }: { status: 'VERIFIED' | 'DISPUTED' | 'PENDING' | 'CANCELLED' }) {
  const { color, bg, border, icon, label } = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span
      style={{
        color,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: '12px',
        fontWeight: 700,
        padding: '4px 12px',
        borderRadius: '99px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {icon} {label}
    </span>
  );
}

// Overall contractor status (VERIFIED/PARTIAL/PENDING/DISPUTED) — same 4-state
// meta as contractors/page.tsx's list badge, distinct from the 3-state
// per-claim StatusBadge above.
const OVERALL_STATUS_META: Record<
  SocietyVerificationStatus,
  { color: string; bg: string; border: string; icon: string; label: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, icon: '✓', label: 'Verified' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, icon: '⚠', label: 'Disputed' },
  CANCELLED: { color: REVOKED_SLATE, bg: REVOKED_SLATE_BG, border: REVOKED_SLATE_BORDER, icon: '✕', label: 'Cancelled' },
  PARTIAL: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, icon: '…', label: 'Partial' },
  PENDING: { color: NEUTRAL_GRAY, bg: '#f9fafb', border: `${NEUTRAL_GRAY}40`, icon: '○', label: 'Pending' },
};

function OverallStatusBadge({ status }: { status: SocietyVerificationStatus }) {
  const meta = OVERALL_STATUS_META[status] ?? OVERALL_STATUS_META.PENDING;
  return (
    <span
      style={{
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        fontSize: '12px',
        fontWeight: 700,
        padding: '4px 12px',
        borderRadius: '99px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

function tradeLabel(value: string): string {
  return TRADE_CATEGORY_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

// wa.me links need a bare digit string — no "+", spaces, or dashes.
function toWaMeNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Same claim-card layout as society/[id]/page.tsx's ClaimCard, minus the
// "Help verify this" CTA — evidence submission (POST /trust/evidence-submissions)
// is SOCIETY-only today, so that link would point at an unsupported flow here.
function ClaimCard({ claim, isAdverse }: { claim: VerificationResponse; isAdverse: boolean }) {
  const meta = STATUS_META[claim.status] ?? STATUS_META.PENDING;
  const verifiedDateLabel = claim.verified_at
    ? new Date(claim.verified_at).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Pending';

  const evidenceTone =
    claim.evidence.length >= 2 ? 'success' : claim.evidence.length >= 1 ? 'neutral' : 'warning';

  return (
    <div
      style={{
        background: isAdverse ? '#fff8f8' : '#fff',
        border: `1px solid ${isAdverse ? DANGER_RED + '60' : 'var(--border)'}`,
        borderLeft: isAdverse ? `4px solid ${DANGER_RED}` : `1px solid var(--border)`,
        borderRadius: 'var(--radius)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{claim.claim}</h2>
        <StatusBadge status={claim.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <StatCard
          value={claim.evidence.length}
          label="Evidence items"
          tone={evidenceTone}
          icon="📋"
        />
        <StatCard
          value={verifiedDateLabel}
          label={claim.status === 'VERIFIED' ? 'Verified on' : 'Last updated'}
          tone={meta.tone}
          icon={meta.icon}
        />
      </div>

      {claim.status === 'PENDING' && (
        <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
          Verification is in progress. Evidence has not yet been reviewed.
        </p>
      )}

      {isAdverse && (
        <p style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600, margin: 0 }}>
          Adverse claim — review all evidence carefully before proceeding.
        </p>
      )}

      {claim.evidence.length > 0 && <EvidenceDrawer evidence={claim.evidence} />}
    </div>
  );
}

export default async function ContractorProfilePage({ params }: Props) {
  let contractor;
  try {
    contractor = await fetchContractor(params.id);
  } catch {
    notFound();
  }

  // Claims lookup can fail independently (e.g. no claims recorded yet) —
  // the rest of the profile (contact info, trades) must still render.
  let claims: VerificationResponse[] = [];
  try {
    const result = await fetchContractorVerifications(params.id);
    claims = result.claims;
  } catch {
    claims = [];
  }

  const primaryClaims = claims.filter((c) => c.status !== 'DISPUTED');
  const adverseClaims = claims.filter((c) => c.status === 'DISPUTED');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 16px 32px',
      }}
    >
      <article
        style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        <BackLink fallbackHref="/contractors" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            CONTRACTOR PROFILE
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{contractor.name}</h1>
            <OverallStatusBadge status={contractor.verification_status} />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {claims.length} verification claim{claims.length !== 1 ? 's' : ''} on record
          </p>
        </div>

        {contractor.is_siraat_affiliated && (
          <div
            style={{
              padding: '14px 16px',
              background: '#fffbeb',
              border: '2px solid #f59e0b',
              borderRadius: 'var(--radius)',
            }}
          >
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
              AFFILIATION DISCLOSURE
            </p>
            <p style={{ fontSize: '14px', color: '#78350f' }}>
              This contractor has a business relationship with Siraat. This disclosure does not
              affect verification status or scoring inputs.
            </p>
          </div>
        )}

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
              TRADES
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {contractor.trade_categories.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    padding: '3px 10px',
                    borderRadius: '99px',
                  }}
                >
                  {tradeLabel(t)}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
              SERVICE CITIES
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text)' }}>
              {contractor.service_cities.join(', ')}
            </p>
          </div>

          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
              CONTACT
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text)' }}>{contractor.contact_phone}</span>
              <CopyLinkButton label="Copy Number" text={contractor.contact_phone} />
              {contractor.contact_whatsapp && (
                <a
                  href={`https://wa.me/${toWaMeNumber(contractor.contact_whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: TRUST_GREEN,
                    border: `1px solid ${TRUST_GREEN}60`,
                    borderRadius: '4px',
                    padding: '6px 12px',
                    textDecoration: 'none',
                  }}
                >
                  WhatsApp →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Primary claims */}
        {primaryClaims.map((claim, i) => (
          <ClaimCard key={i} claim={claim} isAdverse={false} />
        ))}

        {/* Adverse claims */}
        {adverseClaims.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: `${DANGER_RED}30` }} />
              <span
                style={{ fontSize: '11px', fontWeight: 700, color: DANGER_RED, whiteSpace: 'nowrap' }}
              >
                ADVERSE CLAIMS
              </span>
              <div style={{ flex: 1, height: '1px', background: `${DANGER_RED}30` }} />
            </div>
            {adverseClaims.map((claim, i) => (
              <ClaimCard key={i} claim={claim} isAdverse={true} />
            ))}
          </>
        )}

        {claims.length === 0 && (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
            No verification claims on record yet for this contractor.
          </p>
        )}
      </article>
    </main>
  );
}
