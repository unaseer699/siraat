import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchSocietyNocStatus } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';

interface Props {
  params: { id: string };
}

function StatusBadge({ status }: { status: 'VERIFIED' | 'DISPUTED' | 'PENDING' }) {
  const styles: Record<string, { background: string; border: string; color: string }> = {
    VERIFIED: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
    DISPUTED: { background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' },
    PENDING: { background: '#fefce8', border: '1px solid #fde68a', color: '#92400e' },
  };
  const s = styles[status] ?? styles.PENDING;
  return (
    <span
      style={{
        ...s,
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
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>{verification.claim}</h2>
            <StatusBadge status={verification.status} />
          </div>

          {verification.verified_at && (
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Verified on{' '}
              {new Date(verification.verified_at).toLocaleDateString('en-PK', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          {verification.status === 'PENDING' && (
            <p style={{ fontSize: '13px', color: '#92400e' }}>
              Verification is in progress. Evidence has not yet been reviewed.
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {verification.evidence.length} evidence item
              {verification.evidence.length !== 1 ? 's' : ''} on record
            </p>
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
