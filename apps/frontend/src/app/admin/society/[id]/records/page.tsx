'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  addClaimToSociety,
  addEvidenceToVerification,
  fetchSocietyVerifications,
  setClaimStatus,
  type DocumentType,
  type VerificationResponse,
} from '@/lib/api';
import { EvidenceLink } from '@/components/EvidenceLink';
import { ExistingClaimsList } from '../../../ExistingClaimsList';
import { DOCUMENT_TYPE_OPTIONS, fieldGroupStyle, inputStyle, labelStyle } from '../../../constants';
import { DOC_RULES, STATUS_WORD, docTime, newestDocTime, topicOf } from '@/lib/societyRecords';

const DOC_LABEL = Object.fromEntries(DOCUMENT_TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<DocumentType, string>;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
const STATUS_COLOR: Record<string, string> = { VERIFIED: '#166534', DISPUTED: '#b91c1c', CANCELLED: '#475569', PENDING: '#b45309' };

function Group({ title, claims }: { title: string; claims: VerificationResponse[] }) {
  if (claims.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0 }}>{title}</h3>
      {claims.map((c) => {
        const docs = [...c.evidence].sort((a, b) => docTime(b) - docTime(a));
        return (
          <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: docs.length ? '1px solid var(--border)' : 'none', gap: '8px' }}>
              <strong style={{ fontSize: '14px' }}>{c.claim}</strong>
              <span style={{ fontSize: '13px', fontWeight: 700, color: STATUS_COLOR[c.status] }}>{STATUS_WORD[c.status]}</span>
            </div>
            {docs.map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 14px', fontSize: '13px', borderTop: '1px solid var(--border)' }}>
                <span>
                  {e.document_type ? DOC_LABEL[e.document_type] : 'Document'} — <EvidenceLink id={e.id} />
                </span>
                <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmt(e.document_date ?? e.created_at)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function SocietyRecordsPage() {
  const societyId = useParams().id as string;
  const [claims, setClaims] = useState<VerificationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [docType, setDocType] = useState<DocumentType>('LOP_APPROVAL');
  const [link, setLink] = useState('');
  const [date, setDate] = useState('');
  const [source, setSource] = useState('CDA Portal');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchSocietyVerifications(societyId)
      .then((d) => setClaims(d.claims))
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }
  useEffect(load, [societyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rule = DOC_RULES[docType];
  const canSubmit = link.trim() && date && source.trim() && (docType !== 'OTHER' || title.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const evidence = { type: 'document' as const, file_ref: link.trim(), source_ref: source.trim(), document_date: date, document_type: docType };
      // The record this paper belongs to: same type; for "Other", same title.
      const existing = claims.find((c) => c.claim_type === rule.claimType && (docType !== 'OTHER' || c.claim === title.trim()));
      if (existing) {
        await addEvidenceToVerification(existing.id, evidence);
        // Status follows the NEWEST paper, so adding an old document never flips it.
        if (new Date(date).getTime() >= newestDocTime(existing) && existing.status !== rule.status) {
          await setClaimStatus(existing.id, rule.status);
        }
      } else {
        const res = await addClaimToSociety(societyId, {
          claim: docType === 'OTHER' ? title.trim() : rule.claim,
          claim_type: rule.claimType,
          target_status: rule.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
          evidence: [evidence],
        });
        if (rule.status !== 'VERIFIED') await setClaimStatus(res.verification_id, rule.status);
      }
      setOk(`Saved. ${rule.outcome}.`);
      setLink('');
      setTitle('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const lop = claims.filter((c) => topicOf(c.claim_type) === 'LOP');
  const noc = claims.filter((c) => topicOf(c.claim_type) === 'NOC');
  const other = claims.filter((c) => topicOf(c.claim_type) === 'IMPORTANT');

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 32px' }}>
      <article style={{ maxWidth: '620px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <Link href={`/society/${societyId}`} style={{ fontSize: '14px', color: 'var(--muted)' }}>← Back to society profile</Link>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADMIN — INTERNAL ONLY</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Society records</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Add the documents from the CDA / RDA portal one by one. Each document files itself under the right record and sets its status, so there is no separate claim to create.{' '}
            <Link href={`/admin/society/${societyId}/edit`} style={{ fontWeight: 600 }}>Edit society details →</Link>
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Add a document</h2>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} style={inputStyle}>
              {DOCUMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p style={{ fontSize: '12px', margin: 0, fontWeight: 600, color: STATUS_COLOR[rule.status] }}>→ {rule.outcome}</p>
          </div>
          {docType === 'OTHER' && (
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Court order" style={inputStyle} />
            </div>
          )}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Document link</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.cda.gov.pk/storage/…pdf  (or a stored file key)" style={inputStyle} />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Date on the document</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Source</label>
            <input value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: '13px', margin: 0 }}>{error}</p>}
          {ok && <p style={{ color: '#166534', fontSize: '13px', fontWeight: 600, margin: 0 }}>{ok}</p>}
          <button type="submit" disabled={busy || !canSubmit} style={{ padding: '12px 20px', background: busy || !canSubmit ? 'var(--muted)' : '#111', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 600, cursor: busy || !canSubmit ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>
            {busy ? 'Saving…' : 'Save document'}
          </button>
        </form>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Current status</h2>
          {loading ? <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading…</p> : claims.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No records yet. Add the first document above.</p> : (
            <>
              <Group title="LOP" claims={lop} />
              <Group title="NOC" claims={noc} />
              <Group title="Important documents" claims={other} />
            </>
          )}
        </section>

        <details>
          <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>Advanced: change a status by hand</summary>
          <div style={{ marginTop: '12px' }}>
            <ExistingClaimsList claims={claims} onEvidenceAdded={load} />
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Need a custom record? <Link href={`/admin/society/${societyId}/add-claim`}>Add a custom claim</Link>.
            </p>
          </div>
        </details>
      </article>
    </main>
  );
}
