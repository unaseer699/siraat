// UI REVIEW — shared loading indicator. Introduced so every page's
// loading/empty state (route-level loading.tsx, Suspense fallbacks,
// in-page "fetching more" states) renders a visible spinner instead of a
// blank flash or plain "Loading…" text with no visual anchor.
export function Spinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px' }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '3px solid #e5e7eb',
          borderTopColor: 'var(--brand)',
          animation: 'siraat-spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{label ?? 'Loading…'}</span>
      <style>{`@keyframes siraat-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
