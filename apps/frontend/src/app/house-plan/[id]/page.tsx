import { notFound } from 'next/navigation';
import { fetchHousePlan } from '@/lib/api';
import { HousePlanImage } from '@/components/HousePlanImage';
import { BackLink } from '@/components/BackLink';
import { HOUSE_PLAN_STYLE_OPTIONS } from '@/lib/housePlanStyles';
import { TRUST_GREEN } from '@/styles/tokens';

interface Props {
  params: { id: string };
}

function styleLabel(value: string): string {
  return HOUSE_PLAN_STYLE_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

// wa.me links need a bare digit string — no "+", spaces, or dashes. Same
// helper as supplier/[id]/page.tsx and contractor/[id]/page.tsx.
function toWaMeNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export default async function HousePlanProfilePage({ params }: Props) {
  let plan;
  try {
    plan = await fetchHousePlan(params.id);
  } catch {
    notFound();
  }

  const whatsappMessage = `Hi, I'm interested in the "${plan.title}" house plan on Siraat.`;
  const whatsappHref = `https://wa.me/${toWaMeNumber(plan.contact_whatsapp)}?text=${encodeURIComponent(whatsappMessage)}`;

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
      <article style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <BackLink fallbackHref="/house-plans" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            HOUSE PLAN
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{plan.title}</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {plan.area_marla} Marla · {plan.bedrooms} Bed{plan.bedrooms === 1 ? '' : 's'} · {styleLabel(plan.style)}
          </p>
        </div>

        {plan.is_siraat_affiliated && (
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
              This house plan has a business relationship with Siraat. This disclosure does not
              affect verification status or scoring inputs.
            </p>
          </div>
        )}

        <HousePlanImage
          housePlanId={plan.id}
          hasImage={Boolean(plan.preview_image_ref)}
          alt={plan.title}
          maxHeight={560}
        />

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
          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
              DESCRIPTION
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6 }}>{plan.description}</p>
          </div>
        </div>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '14px 20px',
            background: TRUST_GREEN,
            color: '#fff',
            borderRadius: 'var(--radius)',
            fontSize: '15px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Interested? Contact us on WhatsApp →
        </a>

        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
          Directory listing only — no full-resolution download or payment through Siraat.
        </p>
      </article>
    </main>
  );
}
