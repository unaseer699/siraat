import { notFound } from 'next/navigation';
import { fetchSupplier, fetchSupplierVerifications, fetchSupplierMaterialRates } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { BackLink } from '@/components/BackLink';
import StatCard from '@/components/StatCard';
import { MATERIAL_CATEGORY_OPTIONS } from '@/lib/materialCategories';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY } from '@/styles/tokens';
import type { VerificationResponse, SocietyVerificationStatus, MaterialRateItem } from '@siraat/shared-types';

interface Props {
  params: { id: string };
}

// Same claim-status badge meta as contractor/[id]/page.tsx.
const STATUS_META: Record<
  'VERIFIED' | 'DISPUTED' | 'PENDING',
  { color: string; bg: string; border: string; tone: 'success' | 'danger' | 'warning'; icon: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, tone: 'success', icon: '✓' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, tone: 'danger', icon: '⚠' },
  PENDING: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, tone: 'warning', icon: '…' },
};

function StatusBadge({ status }: { status: 'VERIFIED' | 'DISPUTED' | 'PENDING' }) {
  const { color, bg, border, icon } = STATUS_META[status] ?? STATUS_META.PENDING;
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
      {icon} {status}
    </span>
  );
}

// Overall supplier status (VERIFIED/PARTIAL/PENDING/DISPUTED) — same 4-state
// meta as suppliers/page.tsx's list badge, distinct from the 3-state
// per-claim StatusBadge above.
const OVERALL_STATUS_META: Record<
  SocietyVerificationStatus,
  { color: string; bg: string; border: string; icon: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, icon: '✓' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, icon: '⚠' },
  PARTIAL: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, icon: '…' },
  PENDING: { color: NEUTRAL_GRAY, bg: '#f9fafb', border: `${NEUTRAL_GRAY}40`, icon: '○' },
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
      {meta.icon} {status}
    </span>
  );
}

function materialLabel(value: string): string {
  return MATERIAL_CATEGORY_OPTIONS.find((m) => m.value === value)?.label ?? value;
}

// wa.me links need a bare digit string — no "+", spaces, or dashes.
function toWaMeNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Same claim-card layout as contractor/[id]/page.tsx's ClaimCard, minus the
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

// SUPPLIER DIRECTORY Chunk 3 — the "Not the same visual weight as verified
// data" convention (same as EstimateResults.tsx's SourceTierBadge and the
// admin material-rates table): a filled green pill for supplier-verified
// rates, a plain outlined gray label for market-reference ones.
function SourceTierBadge({ tier }: { tier: MaterialRateItem['source_tier'] }) {
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
      Market Reference
    </span>
  );
}

// Linked active material rate submissions — via findMaterialRatesBySupplierId
// (SUPPLIER DIRECTORY Chunk 1), read-only public view of what the admin
// material-rates table shows internally.
function MaterialRateRow({ rate }: { rate: MaterialRateItem }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 0',
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
          {rate.material_name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>/ {rate.unit}</span>
        </span>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {rate.city} · {rate.recorded_date}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {rate.is_stale && (
          <span style={{ fontSize: '11px', fontWeight: 700, color: WARNING_AMBER }}>
            ⚠ Stale (&gt;{rate.staleness_threshold_days}d)
          </span>
        )}
        <SourceTierBadge tier={rate.source_tier} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
          PKR {rate.price.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default async function SupplierProfilePage({ params }: Props) {
  let supplier;
  try {
    supplier = await fetchSupplier(params.id);
  } catch {
    notFound();
  }

  // Claims lookup can fail independently (e.g. no claims recorded yet) —
  // the rest of the profile (contact info, materials) must still render.
  let claims: VerificationResponse[] = [];
  try {
    const result = await fetchSupplierVerifications(params.id);
    claims = result.claims;
  } catch {
    claims = [];
  }

  // Material rate submissions can fail independently too — same reasoning.
  let materialRates: MaterialRateItem[] = [];
  try {
    materialRates = await fetchSupplierMaterialRates(params.id);
  } catch {
    materialRates = [];
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
        <BackLink fallbackHref="/suppliers" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            SUPPLIER PROFILE
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{supplier.name}</h1>
            <OverallStatusBadge status={supplier.verification_status} />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {claims.length} verification claim{claims.length !== 1 ? 's' : ''} on record
          </p>
        </div>

        {supplier.is_siraat_affiliated && (
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
              This supplier has a business relationship with Siraat. This disclosure does not
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
              MATERIAL CATEGORIES
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {supplier.material_categories.map((m) => (
                <span
                  key={m}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    padding: '3px 10px',
                    borderRadius: '99px',
                  }}
                >
                  {materialLabel(m)}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
              SERVICE CITIES
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text)' }}>
              {supplier.service_cities.join(', ')}
            </p>
          </div>

          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
              CONTACT
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text)' }}>{supplier.contact_phone}</span>
              <CopyLinkButton label="Copy Number" text={supplier.contact_phone} />
              {supplier.contact_whatsapp && (
                <a
                  href={`https://wa.me/${toWaMeNumber(supplier.contact_whatsapp)}`}
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

        {materialRates.length > 0 && (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
              MATERIAL RATE SUBMISSIONS
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
              Rates this supplier has logged, most recent first.
            </p>
            <div>
              {materialRates.map((rate) => (
                <MaterialRateRow key={rate.id} rate={rate} />
              ))}
            </div>
          </div>
        )}

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
            No verification claims on record yet for this supplier.
          </p>
        )}
      </article>
    </main>
  );
}
