import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchDeveloperVerification, fetchDeveloperStats } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { BackLink } from '@/components/BackLink';
import StatCard from '@/components/StatCard';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY } from '@/styles/tokens';
import type { VerificationResponse, DeveloperStats, SocietyVerificationStatus } from '@siraat/shared-types';

interface PageProps {
  params: { id: string };
  searchParams: { name?: string };
}

// Same status pill pattern as browse/society pages — covers the full
// SocietyVerificationStatus union (adds PARTIAL on top of the per-claim
// VerificationResponse.status) so one badge serves both individual claims
// and the developer's aggregate verification_status below.
const STATUS_META: Record<
  SocietyVerificationStatus,
  { color: string; bg: string; border: string; icon: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, icon: '✓' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, icon: '⚠' },
  PARTIAL: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, icon: '…' },
  PENDING: { color: NEUTRAL_GRAY, bg: '#f9fafb', border: `${NEUTRAL_GRAY}40`, icon: '○' },
};

function StatusBadge({ status }: { status: SocietyVerificationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
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
        whiteSpace: 'nowrap',
      }}
    >
      {meta.icon} {status}
    </span>
  );
}

// Mirrors StatCard's container so the aggregate verification_status can sit in
// the same stat row while still rendering as the real pill badge, not a plain number.
function VerificationStatCard({ status }: { status: SocietyVerificationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <div
      style={{
        borderLeft: `4px solid ${meta.color}`,
        background: '#ffffff',
        borderRadius: '8px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div>
        <StatusBadge status={status} />
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
          Verification Status
        </div>
      </div>
    </div>
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

  // Aggregate stats live in property_intelligence — a separate context/table
  // from the trust claims above, with no FK between them — and can fail or
  // 404 independently. The claims-based profile must still render if so.
  let stats: DeveloperStats | null = null;
  try {
    stats = await fetchDeveloperStats(params.id);
  } catch {
    stats = null;
  }

  const displayName = stats?.developer_name ?? searchParams.name ?? `Developer ${params.id.slice(0, 8)}`;

  const primaryClaims = claims.filter((c) => c.status !== 'DISPUTED');
  const adverseClaims = claims.filter((c) => c.status === 'DISPUTED');

  const evidenceTone =
    stats && stats.evidence_count >= 2 ? 'success' : stats && stats.evidence_count >= 1 ? 'neutral' : 'warning';

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

        {stats?.is_siraat_affiliated && (
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

        {/* Aggregate stats */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            <StatCard value={stats.evidence_count} label="Evidence items" tone={evidenceTone} icon="📋" />
            <VerificationStatCard status={stats.verification_status} />
            {stats.linked_societies.length > 0 && (
              <StatCard
                value={stats.linked_societies.length}
                label="Linked societies"
                tone="neutral"
                icon="🏘"
              />
            )}
          </div>
        )}
        {stats && stats.linked_societies.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            No linked societies on record yet.
          </p>
        )}

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

        {/* Linked societies — always [] today (no developer_id on SocietyEntity
            yet), but this activates automatically once that association exists,
            same forward-compatible pattern as affiliation_disclosure. */}
        {stats && stats.linked_societies.length > 0 && (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
              Linked Societies
            </h2>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.linked_societies.map((s) => (
                <li
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <Link
                    href={`/society/${s.id}`}
                    style={{ fontSize: '14px', color: '#2563eb', fontWeight: 500 }}
                  >
                    {s.name} · {s.city}
                  </Link>
                  <StatusBadge status={s.verification_status} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Project history */}
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
          {!stats && (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
              Project history is currently unavailable.
            </p>
          )}
          {stats && stats.project_history.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
              No project history on record yet.
            </p>
          )}
          {stats && stats.project_history.length > 0 && (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}>
              {stats.project_history.map((project, i) => (
                <li key={i} style={{ fontSize: '14px', color: 'var(--text)' }}>
                  {project}
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </main>
  );
}
