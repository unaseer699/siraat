import { Spinner } from '@/components/Spinner';

// UI REVIEW finding — no route anywhere had a loading.tsx, so a slow
// navigation/data fetch showed a blank page instead of any feedback. This
// root-level file covers every route that doesn't define its own more
// specific loading.tsx (none currently do), per Next's App Router
// loading-UI convention.
export default function Loading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={32} />
    </div>
  );
}
