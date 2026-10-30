import Link from 'next/link';
import { DANGER_RED, TRUST_GREEN } from '@/styles/tokens';

// Two clearly separate lists. They share nothing but this switch: approved /
// verified societies on one side, schemes CDA publishes as unapproved on the other.
export function SchemeTabs({ active }: { active: 'societies' | 'unapproved' }) {
  const tab = (isActive: boolean, color: string): React.CSSProperties => ({
    flex: 1,
    textAlign: 'center',
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
    color: isActive ? '#fff' : color,
    background: isActive ? color : '#fff',
    border: `1px solid ${color}`,
  });
  return (
    <nav aria-label="Society lists" style={{ display: 'flex', width: '100%', maxWidth: '560px' }}>
      <Link
        href="/browse"
        aria-current={active === 'societies' ? 'page' : undefined}
        style={{ ...tab(active === 'societies', TRUST_GREEN), borderRadius: '8px 0 0 8px' }}
      >
        ✓ Societies
      </Link>
      <Link
        href="/illegal-schemes"
        aria-current={active === 'unapproved' ? 'page' : undefined}
        style={{ ...tab(active === 'unapproved', DANGER_RED), borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
      >
        ⚠ CDA-listed unapproved
      </Link>
    </nav>
  );
}
