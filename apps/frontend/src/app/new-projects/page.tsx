import type { Metadata } from 'next';
import { BackLink } from '@/components/BackLink';
import { NewProjects, ProjectSources } from '@/components/NewProjects';

export const metadata: Metadata = {
  title: 'New projects | Siraat',
  description: 'Affordable housing projects published by official authorities, with the source on every project.',
};

export default function NewProjectsPage() {
  return (
    <main style={{ width: '100%', maxWidth: '980px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <BackLink />
      <NewProjects />
      <ProjectSources />
    </main>
  );
}
