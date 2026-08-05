import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchDeveloperVerification } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';

interface Props {
  params: { id: string; isSiraatAffiliated?: boolean };
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

// Search params allow the caller to pass is_siraat_affiliated=true for affiliation banner
interface PageProps {
  params: { id: string };
  searchParams: { affiliated?: string; name?: string };
}

export default async function BuilderProfilePage({ params, searchParams }: PageProps) {
  let verification;
  try {
    verification = await fetchDeveloperVerification(params.id);
  } catch {
    notFound();
  }

  const isSiraatAffiliated = searchParams.affiliated === 'true';
  const displayName = searchParams.name ?? `Developer ${params.id.slice(0, 8)}`;

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

        {/* Affiliation disclosure banner — same visual treatment as RecommendationDetails (Law 6) */}
        {isSiraatAffiliated && (
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
              This developer has a business relationship with Siraat. This disclosure does not
              affect verification status or scoring inputs.
            </p>
          </div>
        )}

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            BUILDER PROFILE
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{displayName}</h1>
        </div>

        {/* Verification status */}
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
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Developer Verification</h2>
            <StatusBadge status={verification.status} />
          </div>

          <p style={{ fontSize: '14px', color: 'var(--text)' }}>{verification.claim}</p>

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {verification.evidence.length} evidence item
              {verification.evidence.length !== 1 ? 's' : ''} on record
            </p>
            {verification.evidence.length > 0 && (
              <EvidenceDrawer evidence={verification.evidence} />
            )}
          </div>
        </div>

        {/* Project history placeholder — real data comes from DeveloperProfile API, not hoisted here */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
            Project History
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Project history is available via{' '}
            <code style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              GET /v1/property-intelligence/developers/{params.id}
            </code>
          </p>
        </div>
      </article>
    </main>
  );
}
