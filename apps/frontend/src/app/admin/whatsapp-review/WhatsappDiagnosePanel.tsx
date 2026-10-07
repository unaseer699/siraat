'use client';

import { useState } from 'react';
import { diagnoseWhatsapp, type WhatsappDiagnosis } from '@/lib/api';
import { plainButtonStyle } from '../buttonStyles';

// Checks the WhatsApp token and phone-number id with Meta and can send a real
// test message, so a failure shows Meta's actual reason on screen.
export default function WhatsappDiagnosePanel() {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WhatsappDiagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(send: boolean) {
    setBusy(true);
    setError(null);
    try {
      const digits = to.replace(/\D/g, '');
      if (send && digits.length < 8) throw new Error('Enter the number to send to, digits only, with country code (e.g. 923001234567)');
      setResult(await diagnoseWhatsapp(send ? digits : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Reply diagnostics</h2>
      <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
        Asks Meta whether the server&apos;s token and phone number ID work. To also send a test message, enter a number.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="923001234567"
          style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px', width: '180px' }}
        />
        <button style={plainButtonStyle} disabled={busy} onClick={() => run(false)}>Check configuration</button>
        <button style={plainButtonStyle} disabled={busy} onClick={() => run(true)}>Send test message</button>
      </div>
      {error && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</p>}
      {result && (
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p><strong>{result.hint}</strong></p>
          <p>
            Token set: {String(result.configured.token_set)} · Phone number ID set: {String(result.configured.phone_number_id_set)}
            {result.configured.phone_number_id_tail ? ` (ends ${result.configured.phone_number_id_tail})` : ''}
          </p>
          <p>Phone number check: {result.phone_number_check.ok ? 'OK' : `failed (${result.phone_number_check.status ?? 'no response'})`}</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f6f6f6', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>{result.phone_number_check.body}</pre>
          {result.send.attempted && (
            <>
              <p>Test message: {result.send.ok ? 'sent' : `failed (${result.send.status ?? 'no response'})`}</p>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f6f6f6', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>{result.send.body}</pre>
            </>
          )}
        </div>
      )}
    </section>
  );
}
