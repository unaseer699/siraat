import Link from 'next/link';
import type { PropertyListingSummary, PropertyPlotGroup } from '@siraat/shared-types';
import { TRUST_GREEN, WARNING_AMBER, ACCENT_BLUE, RADIUS } from '@/styles/tokens';

// WHATSAPP LISTING INGESTION — public presentation of published plots.
// Server-component safe (no hooks); shared by the society profile section,
// the /plots page and the dealer profile.

export function formatLac(lac: number | null): string {
  if (lac === null) return 'Price on request';
  if (lac >= 100) return `PKR ${(lac / 100).toFixed(2).replace(/\.?0+$/, '')} Crore`;
  return `PKR ${lac.toFixed(2).replace(/\.?0+$/, '')} Lac`;
}

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min === null) return 'Price on request';
  if (max === null || max === min) return formatLac(min);
  return `${formatLac(min)} – ${formatLac(max)}`;
}

function formatPerMarla(v: number | null): string | null {
  return v === null ? null : `≈ ${v.toFixed(2).replace(/\.?0+$/, '')} Lac / marla`;
}

export function formatAge(iso: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

// Pakistani local numbers (03xx...) -> international digits for wa.me.
function waDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
}

function chipStyle(color: string, bg: string): React.CSSProperties {
  return { fontSize: '12px', fontWeight: 600, color, background: bg, padding: '3px 10px', borderRadius: '99px' };
}

function contactButtonStyle(color: string): React.CSSProperties {
  return {
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
    background: color,
    borderRadius: '99px',
    padding: '8px 14px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  };
}

function OfferRow({ offer, title, societyName }: { offer: PropertyListingSummary; title: string; societyName: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontWeight: 700, fontSize: '14px', minWidth: '110px' }}>{formatLac(offer.price_lac)}</span>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
        {offer.dealer_key ? (
          <Link href={`/dealers/${offer.dealer_key}`} style={{ color: ACCENT_BLUE, fontWeight: 600 }}>
            Dealer {offer.contact_phone?.slice(-4)}
          </Link>
        ) : (
          'Dealer'
        )}{' '}
        · confirmed {formatAge(offer.last_confirmed_at)}
      </span>
      {offer.contact_phone && (
        <span style={{ display: 'inline-flex', gap: '8px', marginLeft: 'auto' }}>
          <a href={`tel:${offer.contact_phone.replace(/[^\d+]/g, '')}`} style={contactButtonStyle(ACCENT_BLUE)}>
            Call
          </a>
          <a
            href={`https://wa.me/${waDigits(offer.contact_phone)}?text=${encodeURIComponent(
              `Hi, I saw ${title} (${societyName}) on Siraat. Is it still available?`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            style={contactButtonStyle(TRUST_GREEN)}
          >
            WhatsApp
          </a>
        </span>
      )}
    </div>
  );
}

export function PlotGroupCard({ plot, showSociety }: { plot: PropertyPlotGroup; showSociety?: boolean }) {
  const title = `${plot.block ? `Block ${plot.block} · ` : ''}Plot ${plot.plot_number}`;
  const societyName = plot.society_name ?? plot.society_name_raw;
  const tone = plot.status_raw ? statusTone(plot.status_raw) : null;
  const perMarla = formatPerMarla(plot.min_price_per_marla_lac);

  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        opacity: plot.may_be_sold ? 0.85 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>{title}</h3>
        <span style={{ fontSize: '16px', fontWeight: 800, color: ACCENT_BLUE }}>
          {formatPriceRange(plot.min_price_lac, plot.max_price_lac)}
        </span>
      </div>

      {showSociety && (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {plot.society_ref ? (
            <Link href={`/society/${plot.society_ref}`} style={{ color: ACCENT_BLUE, fontWeight: 600 }}>
              {societyName} →
            </Link>
          ) : (
            societyName
          )}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {(plot.size_label ?? (plot.size_marla !== null ? `${plot.size_marla} Marla` : null)) && (
          <span style={chipStyle('var(--text)', '#f3f4f6')}>
            {plot.size_label ?? `${plot.size_marla} Marla`}
          </span>
        )}
        {perMarla && <span style={chipStyle(ACCENT_BLUE, '#eff6ff')}>{perMarla}</span>}
        {plot.status_raw && tone && <span style={chipStyle(tone.color, tone.bg)}>{plot.status_raw}</span>}
        {plot.offers.length > 1 && <span style={chipStyle('#7c3aed', '#f5f3ff')}>{plot.offers.length} dealers</span>}
        {plot.may_be_sold && <span style={chipStyle(WARNING_AMBER, '#fffbeb')}>May be sold — not reconfirmed recently</span>}
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
          Confirmed {formatAge(plot.last_confirmed_at)}
        </span>
      </div>

      {plot.offers.some((o) => o.contact_phone || plot.offers.length > 1) && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
          {plot.offers.map((o) => (
            <OfferRow key={o.id} offer={o} title={title} societyName={societyName} />
          ))}
        </div>
      )}
    </article>
  );
}

// Honest provenance: these are market-reported, NOT Trust-verified claims.
export function ListingDisclaimer() {
  return (
    <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
      Listings are shared by property dealers and reviewed by Siraat for formatting only. Price, availability and
      legal status (e.g. NDC) are as reported and are <strong>not</strong> Siraat-verified — confirm independently
      before transacting. Listings expire automatically after 14 days; plots not reconfirmed within 7 days are
      marked &ldquo;may be sold&rdquo;.
    </p>
  );
}
