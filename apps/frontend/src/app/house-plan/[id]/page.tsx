import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchHousePlan } from '@/lib/api';
import { HousePlanImage } from '@/components/HousePlanImage';
import { HousePlanGallery } from '@/components/HousePlanGallery';
import { BackLink } from '@/components/BackLink';
import { HOUSE_PLAN_STYLE_OPTIONS } from '@/lib/housePlanStyles';
import { parseHousePlanDescription, roomIcon, sectionIcon } from '@/lib/housePlanDescription';
import { TRUST_GREEN, ACCENT_BLUE } from '@/styles/tokens';

interface Props {
  params: { id: string };
}

function styleLabel(value: string): string {
  return HOUSE_PLAN_STYLE_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

// wa.me links need a bare digit string — no "+", spaces, or dashes.
function toWaMeNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// 1 Marla = 225 sq ft (founder-confirmed rule used across Siraat).
const SQFT_PER_MARLA = 225;

const CSS = `
.hp-facts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(min-width:640px){.hp-facts{grid-template-columns:repeat(4,1fr)}}
.hp-rooms{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:700px){.hp-rooms{grid-template-columns:1fr 1fr}}
.hp-steps{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:700px){.hp-steps{grid-template-columns:repeat(3,1fr)}}
.hp-step{display:flex;gap:12px;align-items:flex-start;text-decoration:none;color:inherit;background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px}
.hp-step:hover{border-color:#93c5fd}
.hp-sticky{position:fixed;left:0;right:0;bottom:0;z-index:20;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--border)}
@media(min-width:900px){.hp-sticky{display:none}}
`;

function Fact({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
      <div style={{ fontSize: '20px' }} aria-hidden="true">{icon}</div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginTop: '6px', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{children}</h2>
      {sub && <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '2px' }}>{sub}</p>}
    </div>
  );
}

export default async function HousePlanProfilePage({ params }: Props) {
  let plan;
  try {
    plan = await fetchHousePlan(params.id);
  } catch (err) {
    // Surface the real cause in Vercel's function logs instead of masking
    // every failure behind the same generic not-found page.
    console.error('[house-plan/[id]] fetchHousePlan failed', params.id, err);
    notFound();
  }

  const whatsappMessage = `Hi, I'm interested in the "${plan.title}" house plan on Siraat.`;
  const whatsappHref = `https://wa.me/${toWaMeNumber(plan.contact_whatsapp)}?text=${encodeURIComponent(whatsappMessage)}`;
  const parsed = parseHousePlanDescription(plan.description);
  const levels = parsed.sections.length;
  const coveredSqft = Math.round(plan.area_marla * SQFT_PER_MARLA);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px 96px' }}>
      <style>{CSS}</style>
      <article style={{ maxWidth: '820px', width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <BackLink fallbackHref="/house-plans" />

        <header>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>HOUSE PLAN</p>
          <h1 style={{ fontSize: '30px', fontWeight: 800, lineHeight: 1.15 }}>{plan.title}</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '8px' }}>
            New to house plans? Scroll down: pictures, then each floor room by room, then your next steps.
          </p>
        </header>

        {plan.is_siraat_affiliated && (
          <div style={{ padding: '14px 16px', background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 'var(--radius)' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>AFFILIATION DISCLOSURE</p>
            <p style={{ fontSize: '14px', color: '#78350f' }}>
              This house plan has a business relationship with Siraat. This disclosure does not affect verification status or scoring inputs.
            </p>
          </div>
        )}

        <HousePlanImage housePlanId={plan.id} hasImage={Boolean(plan.preview_image_ref)} alt={plan.title} maxHeight={520} />

        <div className="hp-facts">
          <Fact icon="📐" label="PLOT SIZE" value={`${plan.area_marla} Marla`} sub={`about ${coveredSqft.toLocaleString('en-US')} sq ft`} />
          <Fact icon="🛏️" label="BEDROOMS" value={`${plan.bedrooms}`} />
          <Fact icon="🎨" label="STYLE" value={styleLabel(plan.style)} />
          {levels > 0 ? <Fact icon="🏠" label="LEVELS" value={`${levels}`} sub={parsed.sections.map((s) => s.title.replace(/\s*\(.*\)/, '')).join(' · ')} /> : <Fact icon="🏠" label="TYPE" value="Family home" />}
        </div>

        {parsed.intro.length > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '16px 18px' }}>
            <p style={{ fontSize: '12px', fontWeight: 800, color: ACCENT_BLUE, letterSpacing: '0.05em', marginBottom: '6px' }}>IN SHORT</p>
            {parsed.intro.map((p, i) => (
              <p key={i} style={{ fontSize: '16px', lineHeight: 1.6, marginTop: i ? '8px' : 0 }}>{p}</p>
            ))}
          </div>
        )}

        <HousePlanGallery housePlanId={plan.id} planTitle={plan.title} contactWhatsapp={plan.contact_whatsapp} />

        {parsed.sections.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SectionHeading sub="What is on each floor, in plain words.">Room by room</SectionHeading>
            {parsed.sections.map((sec) => (
              <div key={sec.title} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800 }}>
                  <span aria-hidden="true">{sectionIcon(sec.title)}</span> {sec.title}
                </h3>
                <div className="hp-rooms">
                  {sec.rooms.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', background: '#f9fafb', borderRadius: '12px', padding: '12px' }}>
                      <span aria-hidden="true" style={{ fontSize: '20px', lineHeight: 1.2 }}>{roomIcon(r.label)}</span>
                      <div>
                        {r.label && <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '2px' }}>{r.label}</div>}
                        <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--text)' }}>{r.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {parsed.sections.length === 0 && parsed.intro.length > 1 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SectionHeading>About this plan</SectionHeading>
            {parsed.intro.slice(1).map((p, i) => (
              <p key={i} style={{ fontSize: '15px', lineHeight: 1.65 }}>{p}</p>
            ))}
          </section>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SectionHeading sub="Three easy steps to take this plan forward.">What to do next</SectionHeading>
          <div className="hp-steps">
            <Link href="/construction-estimate" className="hp-step">
              <span style={{ fontSize: '22px' }} aria-hidden="true">💰</span>
              <span>
                <strong style={{ display: 'block', fontSize: '15px' }}>1. See what it may cost</strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Enter {plan.area_marla} Marla in the estimator for a budget.</span>
              </span>
            </Link>
            <Link href="/plots" className="hp-step">
              <span style={{ fontSize: '22px' }} aria-hidden="true">📍</span>
              <span>
                <strong style={{ display: 'block', fontSize: '15px' }}>2. Find a {plan.area_marla} Marla plot</strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Browse plots for sale that fit this plan.</span>
              </span>
            </Link>
            <Link href="/build-guide" className="hp-step">
              <span style={{ fontSize: '22px' }} aria-hidden="true">🧭</span>
              <span>
                <strong style={{ display: 'block', fontSize: '15px' }}>3. Follow the build guide</strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Every step from plot to move-in.</span>
              </span>
            </Link>
          </div>
        </section>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 20px', background: TRUST_GREEN, color: '#fff', borderRadius: '14px', fontSize: '16px', fontWeight: 800, textDecoration: 'none' }}
        >
          Interested in this plan? Message us on WhatsApp →
        </a>

        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
          Directory listing only: no full-resolution download or payment through Siraat.
        </p>
      </article>

      <div className="hp-sticky">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', background: TRUST_GREEN, color: '#fff', borderRadius: '12px', fontSize: '16px', fontWeight: 800, textDecoration: 'none' }}
        >
          Message us on WhatsApp
        </a>
      </div>
    </main>
  );
}
