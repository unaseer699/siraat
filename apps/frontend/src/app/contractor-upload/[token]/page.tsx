'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchUploadLink, requestLinkPhotoUploadUrl, submitLinkProject } from '@/lib/api';
import { ProjectForm } from '@/components/ProjectForm';

// Private page a contractor opens from a WhatsApp link. English with an Urdu
// line under each heading. Whatever they send waits for review before it shows.
export default function ContractorUploadPage() {
  const token = useParams().token as string;
  const [name, setName] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [sent, setSent] = useState(0);

  useEffect(() => {
    fetchUploadLink(token).then((r) => setName(r.contractor_name)).catch(() => setInvalid(true));
  }, [token]);

  const ur = (t: string, extra?: React.CSSProperties) => (
    <span lang="ur" dir="rtl" style={{ display: 'block', fontSize: '15px', color: 'var(--muted)', lineHeight: 2, ...extra }}>{t}</span>
  );

  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '32px 16px 48px' }}>
      <article style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {invalid ? (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800 }}>This link is not valid</h1>
            {ur('یہ لنک درست نہیں ہے')}
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Please ask Siraat to send you a new link.</p>
          </div>
        ) : !name ? (
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : (
          <>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', margin: '0 0 4px' }}>SIRAAT · CONTRACTOR PORTFOLIO</p>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Hello {name}</h1>
              <p style={{ fontSize: '15px', margin: '6px 0 0' }}>Add a finished project with photos for your Siraat profile.</p>
              {ur('اپنے مکمل شدہ پراجیکٹ کی تصاویر اپنی سیراط پروفائل کے لیے شامل کریں۔')}
            </div>

            {sent > 0 && (
              <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', color: '#166534' }}>
                <strong>Thank you. {sent} project{sent === 1 ? '' : 's'} sent.</strong>
                <p style={{ fontSize: '13px', margin: '4px 0 0' }}>It will show on your profile after Siraat reviews it. You can add another one below.</p>
                {ur('شکریہ۔ سیراط کے جائزے کے بعد یہ آپ کی پروفائل پر نظر آئے گا۔', { color: '#166534', fontSize: '14px' })}
              </div>
            )}

            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              <ProjectForm
                bilingual
                requirePhoto
                submitLabel="Send project / بھیجیں"
                requestUrl={(ct) => requestLinkPhotoUploadUrl(token, ct)}
                onSubmit={async (data) => {
                  await submitLinkProject(token, data);
                  setSent((n) => n + 1);
                }}
              />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Only send photos of work you did. Photos are shown on your profile as supplied by you and are not verified until Siraat inspects them.
            </p>
          </>
        )}
      </article>
    </main>
  );
}
