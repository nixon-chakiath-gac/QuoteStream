'use client';

import { useState } from 'react';
import { Dialog, api } from '@/lib/client';

export default function AddInfoDialog({
  request,
  onClose,
  onDone
}: {
  request: { id: number; number: string; missing: string[]; customer: string };
  onClose: () => void;
  onDone: (quotationId: number | null) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ changed: string[]; unclear: string[]; still_missing: string[]; complete: boolean; quotation_id: number | null } | null>(null);
  const [missing, setMissing] = useState<string[]>(request.missing);

  async function update() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<any>(`/api/gac/requests/${request.id}/information`, { body: { text } });
      setResult(r);
      setMissing(r.still_missing);
      if (r.complete) {
        onDone(r.quotation_id);
        return;
      }
      setText('');
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <Dialog title="Add Information" onClose={onClose}>
      <p>
        <strong>{request.number}</strong> from {request.customer}. This request is missing:
      </p>
      <div className="banner warn">{missing.length > 0 ? missing.join(', ') : 'Nothing is missing'}</div>
      <div className="field">
        <label>Type what you know, in plain words</label>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: Incoterm is FCA, total weight 450 kg, volume 2.8 cbm" />
      </div>
      {error && <div className="banner error">{error}</div>}
      {result && (
        <div className="banner">
          {result.changed.length > 0 && <div>Updated: {result.changed.join(', ')}</div>}
          {result.unclear.map((u, i) => (
            <div key={i} style={{ color: 'var(--warn)' }}>
              {u}
            </div>
          ))}
          <div>Still missing: {result.still_missing.length > 0 ? result.still_missing.join(', ') : 'nothing'}</div>
        </div>
      )}
      <div className="dialog-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn" disabled={busy || !text.trim()} onClick={update}>
          {busy ? 'Reading...' : 'Update request'}
        </button>
      </div>
    </Dialog>
  );
}
