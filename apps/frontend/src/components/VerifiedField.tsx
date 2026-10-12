'use client';

// "Mark as verified" tick with the note that says HOW it was checked. Used when
// onboarding a contractor or supplier. The note is the proof Siraat keeps.
export function VerifiedField({
  verified,
  note,
  onChange,
}: {
  verified: boolean;
  note: string;
  onChange: (v: { verified: boolean; note: string }) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', background: verified ? '#f0fdf4' : '#fff', border: `1px solid ${verified ? '#bbf7d0' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
        <input type="checkbox" checked={verified} onChange={(e) => onChange({ verified: e.target.checked, note })} style={{ width: '20px', height: '20px' }} />
        Verified by Siraat
      </label>
      {verified && (
        <>
          <input
            value={note}
            onChange={(e) => onChange({ verified, note: e.target.value })}
            placeholder="How did you verify? e.g. visited a finished house, met in person"
            maxLength={300}
            style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', background: '#fff' }}
          />
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>Shown on the public profile as the reason. Only tick this once you have checked.</p>
        </>
      )}
    </div>
  );
}
