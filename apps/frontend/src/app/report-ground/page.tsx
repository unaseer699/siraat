'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchPropertyListings, submitGroundReport, type GroundReportInput } from '@/lib/api';
import { BackLink } from '@/components/BackLink';

// GROUND-CONDITION REPORTS — public form. Everything submitted is held for
// human review; nothing appears on the site until approved, and the phone
// number is never shown.

const field: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
  width: '100%',
};
const label: CSSProperties = { fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '4px' };
const hint: CSSProperties = { fontSize: '12px', color: 'var(--muted)', marginTop: '4px' };

function ReportForm() {
  const sp = useSearchParams();
  const [societies, setSocieties] = useState<string[]>([]);
  const [society, setSociety] = useState(sp.get('society') ?? '');
  const [block, setBlock] = useState(sp.get('block') ?? '');
  const [plot, setPlot] = useState('');
  const [role, setRole] = useState<GroundReportInput['reporter_role']>('OWNER');
  const [ground, setGround] = useState<GroundReportInput['ground_condition']>('SOLID');
  const [foundation, setFoundation] = useState<GroundReportInput['foundation_type']>('STANDARD');
  const [soilTest, setSoilTest] = useState(false);
  const [depth, setDepth] = useState('');
  const [extraCost, setExtraCost] = useState('');
  const [year, setYear] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchPropertyListings()
      .then((r) => setSocieties(r.facets.societies.map((s) => s.name)))
      .catch(() => undefined);
  }, []);

  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await submitGroundReport({
        society_name_raw: society.trim(),
        block: block.trim(),
        plot_number: plot.trim() || null,
        reporter_role: role,
        reporter_phone: phone.trim(),
        ground_condition: ground,
        soil_test_done: soilTest,
        foundation_type: foundation,
        foundation_depth_ft: num(depth),
        extra_cost_lac: num(extraCost),
        build_year: num(year),
        notes: notes.trim() || null,
      });
      setDone(true);
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Could not submit';
      const m = text.match(/"message":"([^"]+)"/);
      setError(m ? m[1] : text);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ padding: '24px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Thank you — report received</h2>
        <p style={{ fontSize: '14px', marginTop: '8px' }}>
          Our team reviews every report before it is counted. Once approved it helps the next buyer in your block know
          what to expect underground.
        </p>
      </div>
    );
  }

  const ready = society.trim().length >= 2 && block.trim() && phone.trim().length >= 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={label}>Society *</label>
        <input list="soc" value={society} onChange={(e) => setSociety(e.target.value)} placeholder="e.g. Faisal Hills" style={field} />
        <datalist id="soc">
          {societies.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={label}>Block *</label>
          <input value={block} onChange={(e) => setBlock(e.target.value)} placeholder="e.g. A" style={field} />
        </div>
        <div>
          <label style={label}>Plot number (optional)</label>
          <input value={plot} onChange={(e) => setPlot(e.target.value)} placeholder="e.g. 2071" style={field} />
        </div>
      </div>
      <div>
        <label style={label}>You are the *</label>
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} style={field}>
          <option value="OWNER">Plot owner</option>
          <option value="BUILDER">Builder / developer</option>
          <option value="CONTRACTOR">Contractor / engineer</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label style={label}>What was the ground like? *</label>
        <select value={ground} onChange={(e) => setGround(e.target.value as typeof ground)} style={field}>
          <option value="SOLID">Solid — natural firm ground</option>
          <option value="FILLED">Filled — loose/made-up ground</option>
          <option value="MIXED">Mixed — part solid, part filled</option>
        </select>
      </div>
      <div>
        <label style={label}>Foundation you needed *</label>
        <select value={foundation} onChange={(e) => setFoundation(e.target.value as typeof foundation)} style={field}>
          <option value="STANDARD">Standard strip / normal footing</option>
          <option value="RAFT">Raft</option>
          <option value="DEEP_STRIP">Deep strip (had to dig much deeper)</option>
          <option value="PILING">Piling</option>
        </select>
      </div>
      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}>
        <input type="checkbox" checked={soilTest} onChange={(e) => setSoilTest(e.target.checked)} />
        A soil test / geotechnical report was done
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <div>
          <label style={label}>Foundation depth (ft)</label>
          <input inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} placeholder="e.g. 12" style={field} />
        </div>
        <div>
          <label style={label}>Extra cost (Lac)</label>
          <input inputMode="decimal" value={extraCost} onChange={(e) => setExtraCost(e.target.value)} placeholder="optional" style={field} />
        </div>
        <div>
          <label style={label}>Year built</label>
          <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2024" style={field} />
        </div>
      </div>
      <p style={hint}>Extra cost = what the deeper foundation cost beyond a normal one.</p>
      <div>
        <label style={label}>Anything else buyers should know (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} style={field} />
      </div>
      <div>
        <label style={label}>Your phone number *</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" style={field} />
        <p style={hint}>Private. Used only so our team can confirm your report — never shown on the site.</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '13px' }}>
          {error}
        </div>
      )}
      <button
        onClick={submit}
        disabled={!ready || busy}
        style={{ padding: '12px 20px', border: 'none', borderRadius: 'var(--radius)', background: !ready || busy ? 'var(--muted)' : '#111', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: !ready || busy ? 'not-allowed' : 'pointer' }}
      >
        {busy ? 'Submitting…' : 'Submit report'}
      </button>
    </div>
  );
}

export default function ReportGroundPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '48px 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink />
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>GROUND REPORTS</p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>What did you find underground?</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Built or building here? Tell future buyers what the soil was like and how deep you had to go. Reports are
            reviewed by our team, are not Siraat-verified engineering advice, and your number stays private.
          </p>
        </div>
        <Suspense fallback={null}>
          <ReportForm />
        </Suspense>
      </div>
    </main>
  );
}
