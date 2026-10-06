import Link from 'next/link';
import type { PropertyListingSummary } from '@siraat/shared-types';
import { TRUST_GREEN, WARNING_AMBER, ACCENT_BLUE, RADIUS } from '@/styles/tokens';

// WHATSAPP LISTING INGESTION — public presentation of published plot
// listings. Server-component safe (no hooks), shared by the society profile
// section and the /plots page.

export function formatLac(lac: number | null): string {
  if (lac === null) return 'Price on request';
  if (lac >= 100) return `PKR ${(lac / 100).toFixed(2).replace(/\.?0+$/, '')} Crore`;
  return `PKR ${lac.toFixed(2).replace(/\.?0+$/, '')} Lac`;
}

function formatAge(iso: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// The status text is free-form as forwarded ("MDR back NDC open"). Tone only
// what is unambiguous: "open" is positive, "closed" is a caution, anything
// else stays neutral — never reinterpret the text itself.
function statusTone(status: string): { color: string; bg: string } {
  const s = status.toLowerCase();
  if (/\bclosed?\b/.test(s)) return { color: WARNING_AMBER, bg: '#fffbeb' };
  if (/\bopen\b/.test(s)) return { color: TRUST_GREEN, bg: '#f0fdf4' };
  return { color: 'var(--muted)', bg: '#f3f4f6' };
}

export function PlotListingCard({
  listing,
  showSociety,
}: {
  listing: PropertyListingSummary;
  showSociety?: boolean;
}) {
  const title = `${listing.block ? `Block ${listing.block} · ` : ''}Plot ${listing.plot_number}`;
  const societyName = listing.society_name ?? listing.society_name_raw;
  const tone = listing.status_raw ? statusTone(listing.status_raw) : null;

  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>{title}</h3>
        <span style={{ fontSize: '16px', fontWeight: 800, color: ACCENT_BLUE }}>{formatLac(listing.price_lac)}</span>
      </div>

      {showSociety && (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {listing.society_ref ? (
            <Link href={`/society/${listing.society_ref}`} style={{ color: ACCENT_BLUE, fontWeight: 600 }}>
              {societyName} →
            </Link>
          ) : (
            societyName
          )}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {listing.size_marla !== null && (
          <span style={chipStyle('var(--text)', '#f3f4f6')}>{listing.size_marla} Marla</span>
        )}
        {listing.status_raw && tone && <span style={chipStyle(tone.color, tone.bg)}>{listing.status_raw}</span>}
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
          Listed {formatAge(listing.published_at)}
        </span>
      </div>
    </article>
  );
}

function chipStyle(color: string, bg: string): React.CSSProperties {
  return { fontSize: '12px', fontWeight: 600, color, background: bg, padding: '3px 10px', borderRadius: '99px' };
}

// Honest provenance: these are market-reported, NOT Trust-verified claims.
export function ListingDisclaimer() {
  return (
    <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
      Listings are shared by property dealers and reviewed by Siraat for formatting only. Price, availability and
      legal status (e.g. NDC) are as reported and are <strong>not</strong> Siraat-verified — confirm independently
      before transacting. Listings expire automatically after 14 days.
    </p>
  );
}
