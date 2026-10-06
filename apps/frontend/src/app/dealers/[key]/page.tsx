import { notFound } from 'next/navigation';
import { fetchDealerProfile } from '@/lib/api';
import { BackLink } from '@/components/BackLink';
import { PlotGroupCard, ListingDisclaimer, formatAge } from '@/components/PlotListings';
import type { DealerProfile } from '@siraat/shared-types';

// Public dealer track record, keyed by the dealer's normalized phone number.
// Deliberately factual (counts and recency) — no rating or "trusted" label is
// invented from it.
export default async function DealerPage({ params }: { params: { key: string } }) {
  let profile: DealerProfile;
  try {
    profile = await fetchDealerProfile(params.key);
  } catch {
    notFound();
  }

  const stats: [string, string][] = [
    ['Live plots', String(profile.active_plots.length)],
    ['Total listed', String(profile.total_published)],
    ['Marked sold', String(profile.sold_count)],
    ['Kept current', `${profile.reconfirmed_count} reconfirmed`],
  ];

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink />
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>DEALER</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Dealer …{profile.contact_phone.slice(-4)}</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            Active on Siraat since {new Date(profile.first_seen_at).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })} ·
            last confirmed {formatAge(profile.last_confirmed_at)}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          {stats.map(([label, value]) => (
            <div key={label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>{label.toUpperCase()}</p>
              <p style={{ fontSize: '18px', fontWeight: 800 }}>{value}</p>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Live plots</h2>
        {profile.active_plots.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No live plots from this dealer right now.</p>
        ) : (
          profile.active_plots.map((p) => <PlotGroupCard key={p.key} plot={p} showSociety />)
        )}
        <ListingDisclaimer />
      </div>
    </main>
  );
}
