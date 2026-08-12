import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchDeveloperVerification } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import type { VerificationResponse } from '@siraat/shared-types';

interface PageProps {
  params: { id: string };
  searchParams: { affiliated?: string; name?: string };
}

function StatusBadge({ status }: { status: 'VERIFIED' | 'DISPUTED' | 'PENDING' }) {
  const styles: Record<string, { background: string; border: string; color: string }> = {
    VERIFIED: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' },
    DISPUTED: { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
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

function ClaimRow({ c }: { c: VerificationResponse }) {
  const isAdverse = c.status === 'DISPUTED';
  return (
    <div
      style={{
        padding: '14px 16px',
        background: isAdverse ? '#fff8f8' : '#fff',
        border: `1px solid ${isAdverse ? '#fca5a580' : 'var(--border)'}`,
        borderLeft: isAdverse ? '4px solid #dc2626' : '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>{c.claim}</span>
        <StatusBadge status={c.status} />
      </div>

      {c.verified_at && (
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
          Verified on{' '}
          {new Date(c.verified_at).toLocaleDateString('en-PK', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}

      {isAdverse && (
        <p style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600, margin: 0 }}>
          Adverse claim — review carefully before proceeding.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {c.evidence.length} evidence item{c.evidence.length !== 1 ? 's' : ''}
        </span>
        {c.evidence.length > 0 && <EvidenceDrawer evidence={c.evidence} />}
      </div>
    </div>
  );
}

export default async function BuilderProfilePage({ params, searchParams }: PageProps) {
  let claims: VerificationResponse[];
  try {
    const result = await fetchDeveloperVerification(params.id);
    claims = result.claims;
  } catch {
    notFound();
  }

  if (!claims.length) notFound();

  const isSiraatAffiliated = searchParams.affiliated === 'true';
  const displayName = searchParams.name ?? `Developer ${params.id.slice(0, 8)}`;

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
        <Link href="/" style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ← Back to search
        </Link>

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
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {claims.length} verification claim{claims.length !== 1 ? 's' : ''} on record
          </p>
        </div>

        {/* Primary claims */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Developer Verification</h2>
          {primaryClaims.map((c, i) => (
            <ClaimRow key={i} c={c} />
          ))}
        </div>

        {/* Adverse claims */}
        {adverseClaims.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: '#dc262630' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>
                ADVERSE CLAIMS
              </span>
              <div style={{ flex: 1, height: '1px', background: '#dc262630' }} />
            </div>
            {adverseClaims.map((c, i) => (
              <ClaimRow key={i} c={c} />
            ))}
          </div>
        )}

        {/* Project history placeholder */}
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
