import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchSocietyNocStatus } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import StatCard from '@/components/StatCard';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED } from '@/styles/tokens';

interface Props {
  params: { id: string };
}

const STATUS_META: Record<
  'VERIFIED' | 'DISPUTED' | 'PENDING',
  { color: string; bg: string; border: string; tone: 'success' | 'danger' | 'warning' }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, tone: 'success' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, tone: 'danger' },
  PENDING: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, tone: 'warning' },
};

function StatusBadge({ status }: { status: 'VERIFIED' | 'DISPUTED' | 'PENDING' }) {
  const { color, bg, border } = STATUS_META[status] ?? STATUS_META.PENDING;
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
        display: 'inline-block',
      }}
    >
      {status}
    </span>
  );
}

export default async function SocietyProfilePage({ params }: Props) {
  let verification;
  try {
    verification = await fetchSocietyNocStatus(params.id);
  } catch {
    notFound();
  }

  const verifiedDateLabel = verification.verified_at
    ? new Date(verification.verified_at).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Pending';

  const evidenceTone =
    verification.evidence.length >= 2
      ? 'success'
      : verification.evidence.length >= 1
        ? 'neutral'
        : 'warning';

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
        <Link href="/" style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ← Back to search
        </Link>

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            SOCIETY PROFILE
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>NOC &amp; Trust Status</h1>
        </div>

        {/* NOC status card */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>{verification.claim}</h2>
            <StatusBadge status={verification.status} />
          </div>

          {/* StatCard row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <StatCard
              value={verification.evidence.length}
              label="Evidence items"
              tone={evidenceTone}
              icon="📋"
            />
            <StatCard
              value={verifiedDateLabel}
              label="Verified on"
              tone={STATUS_META[verification.status]?.tone ?? 'warning'}
              icon="✓"
            />
          </div>

          {verification.status === 'PENDING' && (
            <p style={{ fontSize: '13px', color: '#92400e' }}>
              Verification is in progress. Evidence has not yet been reviewed.
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {verification.evidence.length > 0 && (
              <EvidenceDrawer evidence={verification.evidence} />
            )}
            <Link
              href={`/submit-evidence/${params.id}`}
              style={{
                fontSize: '13px',
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Help verify this society →
            </Link>
          </div>
        </div>

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
