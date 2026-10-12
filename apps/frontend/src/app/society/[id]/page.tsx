import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchSocietyVerifications, fetchSocietyScore, fetchPropertyListings, fetchSocietyDetails, type SocietyDetails } from '@/lib/api';
import { PlotGroupCard, ListingDisclaimer } from '@/components/PlotListings';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { WatchButton } from '@/components/WatchButton';
import { BackLink } from '@/components/BackLink';
import { ConfidenceGauge } from '@/components/ConfidenceGauge';
import { ScoreBreakdown, toneColor, toneIcon } from '@/components/ScoreBreakdown';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, REVOKED_SLATE, REVOKED_SLATE_BG, REVOKED_SLATE_BORDER } from '@/styles/tokens';
import type { VerificationResponse, SocietyScoreResponse, PropertyPlotGroup } from '@siraat/shared-types';

interface Props {
  params: { id: string };
}

const STATUS_META: Record<
  'VERIFIED' | 'DISPUTED' | 'PENDING' | 'CANCELLED',
  { color: string; bg: string; border: string; tone: 'success' | 'danger' | 'warning' | 'revoked'; icon: string; label: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, tone: 'success', icon: '✓', label: 'Verified' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, tone: 'danger', icon: '⚠', label: 'Disputed' },
  // EVIDENCE DOCUMENT MODEL Chunk 2 — real CANCELLED treatment (replaces
  // Chunk 1's DANGER_RED placeholder). Its own tone (REVOKED_SLATE, see
  // tokens.ts): DISPUTED is an active, ongoing conflict; CANCELLED is a
  // settled, final absence — visually distinct registers, not just a
  // different icon on the same alarm-red.
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

const CLAIM_TYPE_LABEL: Record<string, string> = {
  NOC: 'NOC',
  PLANNING_APPROVAL: 'Planning approval',
  COMPLETION_CERTIFICATE: 'Completion certificate',
  SHOW_CAUSE_NOTICE: 'Show cause notice',
  ILLEGAL_SCHEME_NOTICE: 'Illegal scheme notice',
  TRANSFER_DEED: 'Transfer deed',
  MORTGAGE_DEED: 'Mortgage deed',
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

// One compact row per claim: what it is, its status, and the papers behind it.
function ClaimRow({ claim, isAdverse }: { claim: VerificationResponse; isAdverse: boolean }) {
  const typeLabel = CLAIM_TYPE_LABEL[claim.claim_type];
  const docs = claim.evidence.length;
  const detail = [
    docs > 0 ? `${docs} document${docs === 1 ? '' : 's'}` : 'No documents attached yet',
    claim.status === 'VERIFIED' && claim.verified_at ? `Verified ${shortDate(claim.verified_at)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      style={{
        background: isAdverse ? '#fff8f8' : '#fff',
        border: `1px solid ${isAdverse ? DANGER_RED + '40' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {typeLabel && (
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              {typeLabel}
            </p>
          )}
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 0' }}>{claim.claim}</h3>
        </div>
        <StatusBadge status={claim.status} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{detail}</span>
        {docs > 0 && <EvidenceDrawer evidence={claim.evidence} triggerLabel="View documents" />}
      </div>
    </div>
  );
}

function DetailsCard({ d }: { d: SocietyDetails }) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (d.zone) rows.push({ label: 'Zone', value: d.zone });
  if (d.road) rows.push({ label: 'Road', value: d.road });
  if (d.area_kanal !== null) rows.push({ label: 'Area', value: `${Number(d.area_kanal).toLocaleString('en-PK', { maximumFractionDigits: 2 })} kanal` });
  if (d.owner_name) rows.push({ label: 'Registered society', value: d.owner_name });
  if (d.address) rows.push({ label: 'Office address', value: d.address });
  if (d.contact_phones.length > 0) {
    rows.push({
      label: 'Office contact',
      value: d.contact_phones.map((p, i) => (
        <span key={p}>
          {i > 0 && ', '}
          <a href={`tel:${p.replace(/[^0-9+]/g, '')}`} style={{ color: '#2563eb' }}>{p}</a>
        </span>
      )),
    });
  }
  if (d.email) rows.push({ label: 'Email', value: <a href={`mailto:${d.email}`} style={{ color: '#2563eb' }}>{d.email}</a> });
  if (d.website) rows.push({ label: 'Website', value: <a href={d.website} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>{d.website}</a> });
  if (rows.length === 0) return null;

  return (
    <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 12px' }}>Society details</h2>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px 28px' }}>
        {rows.map((r) => (
          <div key={r.label}>
            <dt style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</dt>
            <dd style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--text)' }}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {d.details_source_url && (
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '14px 0 0' }}>
          Source:{' '}
          <a href={d.details_source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
            published listing
          </a>
        </p>
      )}
    </section>
  );
}

export default async function SocietyProfilePage({ params }: Props) {
  let claims: VerificationResponse[];
  try {
    const result = await fetchSocietyVerifications(params.id);
    claims = result.claims;
  } catch {
    notFound();
  }

  if (!claims.length) notFound();

  // Score computation can fail independently of the claims lookup above — the
  // rest of the profile (claims) must still render if this does.
  let score: SocietyScoreResponse | null = null;
  try {
    score = await fetchSocietyScore(params.id);
  } catch {
    score = null;
  }

  // Plot listings are an enrichment — never let their failure break the profile.
  let listings: PropertyPlotGroup[] = [];
  try {
    listings = (await fetchPropertyListings({ society_id: params.id })).plots;
  } catch {
    listings = [];
  }

  // Registration details are an enrichment — never let their failure break the profile.
  let details: SocietyDetails | null = null;
  try {
    details = await fetchSocietyDetails(params.id);
  } catch {
    details = null;
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
        <BackLink />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            SOCIETY PROFILE
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{score?.society_name ?? 'Society profile'}</h1>
          {score?.developer_id && (
            <Link
              href={`/developer/${score.developer_id}`}
              style={{ fontSize: '13px', color: '#2563eb', fontWeight: 500, marginTop: '4px', display: 'inline-block' }}
            >
              Developed by {score.developer_name ?? 'Developer'} →
            </Link>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <CopyLinkButton />
          <WatchButton societyId={params.id} societyName={score?.society_name ?? params.id} />
        </div>

        {/* At a glance: one headline, the confidence, and the detail on demand */}
        {score && (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
              <ConfidenceGauge score={score.confidence_score} size="sm" />
              <div style={{ flex: 1, minWidth: '200px' }}>
                {score.breakdown ? (
                  <>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>Approval status</p>
                    <p style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0', color: toneColor(score.breakdown.regulatory.tone) }}>
                      {toneIcon(score.breakdown.regulatory.tone)} {score.breakdown.regulatory.label}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                      {score.breakdown.evidence_strength.label} · checked {score.breakdown.data_freshness.checked_date}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: '14px', color: 'var(--muted)', margin: 0 }}>
                    {Math.round(score.confidence_score * 100)}% trust confidence
                  </p>
                )}
              </div>
            </div>
            {score.breakdown && (
              <details>
                <summary style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}>
                  How is this worked out?
                </summary>
                <div style={{ marginTop: '12px' }}>
                  <ScoreBreakdown breakdown={score.breakdown} />
                </div>
              </details>
            )}
          </div>
        )}

        {details && <DetailsCard d={details} />}

        {/* Available plots (WhatsApp listing ingestion) */}
        {listings.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800 }}>
              Available Plots ({listings.length})
            </h2>
            {listings.slice(0, 6).map((l) => (
              <PlotGroupCard key={l.key} plot={l} />
            ))}
            {listings.length > 6 && (
              <Link
                href={`/plots?society_id=${params.id}`}
                style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}
              >
                View all {listings.length} plots →
              </Link>
            )}
            <ListingDisclaimer />
          </section>
        )}

        {/* What the records say */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800 }}>What the records say</h2>
          {primaryClaims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} isAdverse={false} />
          ))}
        </section>

        {adverseClaims.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: DANGER_RED }}>Reported problems</h2>
            {adverseClaims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} isAdverse={true} />
            ))}
          </section>
        )}

        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Know something about this society?{' '}
          <Link href={`/submit-evidence/${params.id}`} style={{ color: '#2563eb', fontWeight: 600 }}>
            Add information →
          </Link>
        </p>
      </article>
    </main>
  );
}
