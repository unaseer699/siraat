import type { ContractorProject } from '@/lib/api';

// Past projects a contractor shows. Always labelled: Siraat has not inspected
// this work unless a verification on the profile says so.
export function ContractorPortfolio({ projects }: { projects: ContractorProject[] }) {
  if (projects.length === 0) return null;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Past projects ({projects.length})</h2>
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>
          Photos shown by the contractor. Siraat has not inspected this work. Visit a finished project before you decide.
        </p>
      </div>
      {projects.map((p) => {
        const meta = [p.society_name, p.city, p.plot_size, p.completed_year].filter(Boolean).join(' · ');
        const [first, ...rest] = p.photos;
        return (
          <article key={p.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {first && (
              <a href={first.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={first.url} alt={p.title} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
              </a>
            )}
            {rest.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '4px', padding: '4px' }}>
                {rest.map((ph, i) => (
                  <a key={i} href={ph.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1', overflow: 'hidden', borderRadius: '6px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
            )}
            <div style={{ padding: '12px 14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>{p.title}</h3>
              {meta && <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '2px 0 0' }}>{meta}</p>}
              {p.description && <p style={{ fontSize: '14px', margin: '8px 0 0', lineHeight: 1.5 }}>{p.description}</p>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
