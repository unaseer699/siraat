'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  createAdminProject,
  createContractorUploadLink,
  fetchAdminContractorProjects,
  fetchContractor,
  requestAdminPhotoUploadUrl,
  type ContractorProject,
} from '@/lib/api';
import { ProjectForm } from '@/components/ProjectForm';
import { AdminProjectCard } from '@/components/AdminProjectCard';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { plainButtonStyle } from '../../../buttonStyles';

export default function ContractorPortfolioAdminPage() {
  const id = useParams().id as string;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [projects, setProjects] = useState<ContractorProject[] | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchAdminContractorProjects(id).then(setProjects).catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }
  useEffect(() => {
    fetchContractor(id).then((c) => { setName(c.name); setPhone(c.contact_whatsapp ?? c.contact_phone); }).catch(() => {});
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function makeLink() {
    if (link && !window.confirm('Making a new link stops the old one working. Continue?')) return;
    setLinkBusy(true);
    try {
      const { token } = await createContractorUploadLink(id);
      setLink(`${window.location.origin}/contractor-upload/${token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link');
    } finally {
      setLinkBusy(false);
    }
  }

  const wa = link ? `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(`Assalam o Alaikum ${name}. Please add your finished projects and photos for your Siraat profile here: ${link}`)}` : null;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px 40px' }}>
      <article style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <Link href="/admin/contractors" style={{ fontSize: '14px', color: 'var(--muted)' }}>← Contractors</Link>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADMIN — INTERNAL ONLY</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>{name || 'Contractor'}: portfolio</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Projects you add are published straight away. Projects the contractor sends wait here until you publish them.{' '}
            <Link href={`/admin/contractor/${id}/add-claim`} style={{ fontWeight: 600 }}>Add verification →</Link>
          </p>
        </div>

        <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Let the contractor upload their own</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            Make a private link and send it on WhatsApp. They add projects and photos from their phone. Nothing shows publicly until you publish it.
          </p>
          {link ? (
            <>
              <code style={{ fontSize: '12px', wordBreak: 'break-all', background: '#f3f4f6', padding: '8px', borderRadius: '6px' }}>{link}</code>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <CopyLinkButton label="Copy link" text={link} />
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...plainButtonStyle, textDecoration: 'none', color: '#166534' }}>Send on WhatsApp →</a>}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>The link is shown only now. Make a new one if you lose it.</p>
            </>
          ) : (
            <button type="button" onClick={makeLink} disabled={linkBusy} style={{ ...plainButtonStyle, alignSelf: 'flex-start' }}>
              {linkBusy ? 'Making…' : 'Make upload link'}
            </button>
          )}
          {link && <button type="button" onClick={makeLink} disabled={linkBusy} style={{ ...plainButtonStyle, alignSelf: 'flex-start' }}>Make a new link</button>}
        </section>

        <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Add a project</h2>
          <ProjectForm
            requirePhoto={false}
            requestUrl={(ct) => requestAdminPhotoUploadUrl(id, ct)}
            onSubmit={async (data) => { await createAdminProject(id, data); load(); }}
            submitLabel="Save and publish"
          />
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Projects{projects ? ` (${projects.length})` : ''}</h2>
          {error && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</p>}
          {!projects && !error && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading…</p>}
          {projects?.length === 0 && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No projects yet.</p>}
          {projects?.map((p) => <AdminProjectCard key={p.id} project={p} onChanged={load} />)}
        </section>
      </article>
    </main>
  );
}
