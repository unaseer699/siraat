import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchPropertyDetail, fetchSocietyVerifications } from '@/lib/api';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import StatCard from '@/components/StatCard';
import { TRUST_GREEN, DANGER_RED } from '@/styles/tokens';

interface Props {
  params: { id: string };
}

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

// UI REVIEW finding — this badge was always an outline-only pill, even for
// ACTIVE (the "good"/primary state), which reads inconsistently next to
// every other badge in the app (StatusBadge in browse/contractors/
// suppliers/house-plans, SourceTierBadge in components/SourceTierBadge.tsx):
// those fill the primary/verified state with a tinted background and no
// border, and only fall back to an outline-only treatment for a neutral
// state. Rebuilt to follow that same filled-for-primary / outlined-for-
// neutral convention instead of being always-outlined.
const STATUS_META: Record<
  string,
  { color: string; bg: string | null; label: string; tone: 'success' | 'neutral' | 'warning' }
> = {
  ACTIVE: { color: TRUST_GREEN, bg: `${TRUST_GREEN}18`, label: 'Active', tone: 'success' },
  LISTED: { color: '#1e40af', bg: null, label: 'Listed', tone: 'neutral' },
  ARCHIVED: { color: DANGER_RED, bg: null, label: 'Archived', tone: 'warning' },
};

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.ARCHIVED;
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        padding: meta.bg ? '2px 10px' : '1px 9px',
        borderRadius: '99px',
        color: meta.color,
        background: meta.bg ?? undefined,
        border: meta.bg ? undefined : `1px solid ${meta.color}50`,
        display: 'inline-block',
      }}
    >
      {meta.label}
    </span>
  );
}

export default async function PropertyDetailsPage({ params }: Props) {
  let property;
  try {
    property = await fetchPropertyDetail(params.id);
  } catch {
    notFound();
  }

  // Fetch linked society's primary trust claim — fail gracefully if unavailable
  let societyVerification = null;
  if (property.society) {
    try {
      const { claims } = await fetchSocietyVerifications(property.society.id);
      societyVerification = claims[0] ?? null;
    } catch {
      // Non-fatal: society trust data unavailable
    }
  }

  const statusMeta = STATUS_META[property.status] ?? STATUS_META.ARCHIVED;

  const nocTone: 'success' | 'warning' =
    property.society?.noc_approved ? 'success' : 'warning';

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
            PROPERTY DETAILS
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{property.address}</h1>
          <p style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }}>
            {formatPKR(property.price)}
          </p>
        </div>

        {/* StatCard row — key at-a-glance stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: property.society ? '1fr 1fr 1fr' : '1fr 1fr',
            gap: '12px',
          }}
        >
          <StatCard
            value={`${property.area_marla} Marla`}
            label="Property area"
            tone="neutral"
            icon="📐"
          />
          <StatCard
            value={property.status}
            label="Listing status"
            tone={statusMeta.tone}
            icon="📋"
          />
          {property.society && (
            <StatCard
              value={property.society.noc_approved ? 'Approved' : 'Pending'}
              label="Society NOC"
              tone={nocTone}
              icon="🏛"
            />
          )}
        </div>

        {/* Property specifics */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Listing Details</h2>

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px 24px',
              fontSize: '14px',
            }}
          >
            {[
              ['Type', property.property_type],
              ['Area', `${property.area_marla} Marla`],
              ['Source', property.listing_source],
              ['Status', null],
            ].map(([label, value]) =>
              label === 'Status' ? (
                <div key="status">
                  <dt style={{ color: 'var(--muted)', marginBottom: '2px' }}>Status</dt>
                  <dd>
                    <StatusChip status={property.status} />
                  </dd>
                </div>
              ) : (
                <div key={label as string}>
                  <dt style={{ color: 'var(--muted)', marginBottom: '2px' }}>{label}</dt>
                  <dd style={{ fontWeight: 600 }}>{value}</dd>
                </div>
              ),
            )}
          </dl>
        </div>

        {/* Linked society summary */}
        {property.society && (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Society</h2>
            <p style={{ fontSize: '14px' }}>
              <strong>{property.society.name}</strong> &mdash; {property.society.city}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              NOC status: {property.society.noc_approved ? 'Approved' : 'Not approved'}
            </p>
            <Link
              href={`/society/${property.society.id}`}
              style={{ fontSize: '13px', color: 'var(--text)' }}
            >
              View society profile →
            </Link>
          </div>
        )}

        {/* Linked trust evidence */}
        {societyVerification && societyVerification.evidence.length > 0 && (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Linked Evidence</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Evidence attached to this society&apos;s verification record:
            </p>
            <EvidenceDrawer
              evidence={societyVerification.evidence}
              triggerLabel="View society evidence"
            />
          </div>
        )}
      </article>
    </main>
  );
}
