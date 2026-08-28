import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchSocietyVerifications, fetchSocietyScore } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { WatchButton } from '@/components/WatchButton';
import { BackLink } from '@/components/BackLink';
import StatCard from '@/components/StatCard';
import { ConfidenceGauge } from '@/components/ConfidenceGauge';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED } from '@/styles/tokens';
import type { VerificationResponse, SocietyScoreResponse } from '@siraat/shared-types';

interface Props {
  params: { id: string };
}

const STATUS_META: Record<
  'VERIFIED' | 'DISPUTED' | 'PENDING' | 'CANCELLED',
  { color: string; bg: string; border: string; tone: 'success' | 'danger' | 'warning'; icon: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, tone: 'success', icon: '✓' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, tone: 'danger', icon: '⚠' },
  // EVIDENCE DOCUMENT MODEL Chunk 1 — same red/danger family as DISPUTED
  // (both adverse), distinct icon: a cancelled approval no longer exists at
  // all, strictly more severe than a merely-contested one. Minimal
  // placeholder treatment to keep this Record exhaustive and the build
  // green — full CANCELLED UI/copy is frontend follow-up work.
  CANCELLED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, tone: 'danger', icon: '✕' },
  PENDING: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, tone: 'warning', icon: '…' },
};

function StatusBadge({ status }: { status: 'VERIFIED' | 'DISPUTED' | 'PENDING' | 'CANCELLED' }) {
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

function ClaimCard({
  claim,
  societyId,
  isAdverse,
}: {
  claim: VerificationResponse;
  societyId: string;
  isAdverse: boolean;
}) {
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {claim.evidence.length > 0 && <EvidenceDrawer evidence={claim.evidence} />}
        <Link
          href={`/submit-evidence/${societyId}`}
          style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
        >
          Help verify this society →
        </Link>
      </div>
    </div>
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
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>NOC &amp; Trust Status</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {claims.length} verification claim{claims.length !== 1 ? 's' : ''} on record
          </p>
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

        {/* Score breakdown */}
        {score && (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              display: 'flex',
              gap: '24px',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}
          >
            <ConfidenceGauge score={score.confidence_score} size="lg" />
            <div style={{ flex: 1, minWidth: '240px' }}>
              <ScoreBreakdown breakdown={score.breakdown} />
            </div>
          </div>
        )}

        {/* Primary claims */}
        {primaryClaims.map((claim, i) => (
          <ClaimCard key={i} claim={claim} societyId={params.id} isAdverse={false} />
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
              <ClaimCard key={i} claim={claim} societyId={params.id} isAdverse={true} />
            ))}
          </>
        )}

        {/* Possession history placeholder */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
            Possession History
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
            Possession history data is collected via the Contribute flow (Capability 4).
          </p>
        </div>
      </article>
    </main>
  );
}
