'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AddInfoDialog from '@/components/AddInfoDialog';
import { Chip, Field, api, fmtDateTime, useData } from '@/lib/client';

export default function EmailSimulator() {
  const router = useRouter();
  const { data: samples } = useData<any[]>('/api/gac/emails');
  const { data: requests, reload } = useData<any[]>('/api/gac/requests?source=Email', 2000);
  const [form, setForm] = useState({ from: '', to: 'quotes@gac.com', subject: '', body: '' });
  const [sample, setSample] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<any | null>(null);

  function load(id: string) {
    setSample(id);
    const s = (samples ?? []).find((x) => String(x.id) === id);
    if (s) setForm({ from: s.from_email, to: s.to_email, subject: s.subject, body: s.body });
  }

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      await api('/api/gac/emails', { body: form });
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const latest = (requests ?? []).slice(0, 8);

  return (
    <div>
      <h1>Email simulator</h1>
      <p className="subtitle">Simulates a customer email arriving in the quotes mailbox. The AI reads it and creates a request.</p>
      <div className="two-col">
        <div className="card">
          <Field label="Load sample email">
            <select value={sample} onChange={(e) => load(e.target.value)}>
              <option value="">Choose a sample</option>
              {(samples ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="From">
              <input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            </Field>
            <Field label="To">
              <input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            </Field>
          </div>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <Field label="Body">
            <textarea rows={14} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          {err && <div className="banner error">{err}</div>}
          <button className="btn" disabled={busy || !form.from || !form.body} onClick={send}>
            Send email
          </button>
        </div>
        <div className="card">
          <h2>Latest requests from email</h2>
          {latest.length === 0 && <div className="empty">No emails yet</div>}
          {latest.map((r) => (
            <div key={r.id} className="suggestion" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <strong>{r.number}</strong> <span className="hint">{fmtDateTime(r.created_at)}</span>
                <div>{r.subject}</div>
                <div className="hint">
                  {r.customer} {r.lane ? `| ${r.lane}` : ''}
                </div>
                {r.missing.length > 0 && <div className="hint">Missing: {r.missing.join(', ')}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {r.status === 'Reading email' ? (
                  <span className="chip">
                    <span className="spinner" />
                    Reading email
                  </span>
                ) : (
                  <Chip text={r.status} />
                )}
                <div className="mt">
                  {r.action === 'Add Information' && (
                    <button className="btn small" onClick={() => setInfo(r)}>
                      Add Information
                    </button>
                  )}
                  {r.action && r.action !== 'Add Information' && r.quotation_id && (
                    <button className={`btn small${r.action === 'View' ? ' secondary' : ''}`} onClick={() => router.push(`/gac/quotations/${r.quotation_id}`)}>
                      {r.action}
                    </button>
                  )}
                </div>
                {r.ai_fallback && <div className="hint">fallback used</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {info && (
        <AddInfoDialog
          request={info}
          onClose={() => setInfo(null)}
          onDone={(qid) => {
            setInfo(null);
            reload();
            if (qid) router.push(`/gac/quotations/${qid}`);
          }}
        />
      )}
    </div>
  );
}
