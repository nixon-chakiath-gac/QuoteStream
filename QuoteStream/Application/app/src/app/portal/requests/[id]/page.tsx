'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Chip, Dialog, MoneyList, Money, api, fmtDate, fmtDateTime, useData } from '@/lib/client';

function Details({ d }: { d: any }) {
  const x = d.details;
  const rows: [string, string | null][] = [
    ['Mode', x.mode],
    ['From', x.origin],
    ['To', x.destination],
    ['Pick-up address', x.pickup_address],
    ['Delivery address', x.delivery_address],
    ['Incoterm', x.incoterm],
    ['Cargo description', x.description],
    ['Service needed', x.service_description],
    ['Ready date', x.ready_date ? fmtDate(x.ready_date) : null],
    ['Load type', x.load_type],
    ['Container', x.container_type ? `${x.container_count} x ${x.container_type}` : null],
    ['Vehicle type', x.vehicle_type],
    ['Total quantity', x.total_quantity ? String(x.total_quantity) : null],
    ['Total weight', x.total_weight_kg ? `${x.total_weight_kg} kg` : null],
    ['Total volume', x.total_volume_cbm ? `${x.total_volume_cbm} m3` : null],
    ['Chargeable weight', x.chargeable_weight ? `${x.chargeable_weight.toFixed(2)} kg` : null]
  ];
  return (
    <div className="grid3">
      {rows
        .filter((r) => r[1])
        .map(([k, v]) => (
          <div key={k} className="field">
            <label>{k}</label>
            <div>{v}</div>
          </div>
        ))}
    </div>
  );
}

function ReviseDialog({ d, onClose, onDone }: { d: any; onClose: () => void; onDone: () => void }) {
  const [message, setMessage] = useState('');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasTarget = Object.values(targets).some((v) => v.trim() !== '' && Number(v) > 0);
  const can = message.trim().length > 0 || hasTarget;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/portal/requests/${d.id}/revision`, { body: { message, targets } });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Revise or negotiate" onClose={onClose} wide>
      <div className="field">
        <label>What would you like to change?</label>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <table className="t">
        <thead>
          <tr>
            <th>Service</th>
            <th className="num">Quoted amount</th>
            <th className="num">Target price (optional)</th>
          </tr>
        </thead>
        <tbody>
          {d.quotation.lines.map((l: any) => (
            <tr key={l.line_id}>
              <td>{l.service}</td>
              <td className="num">
                <Money currency={l.currency} amount={l.amount} />
              </td>
              <td className="num">
                <input
                  className="inline-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={targets[l.line_id] ?? ''}
                  onChange={(e) => setTargets({ ...targets, [l.line_id]: e.target.value })}
                  aria-label={`Target price for ${l.service}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Add a message or at least one target price.</p>
      {error && <div className="banner error">{error}</div>}
      <div className="dialog-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn" disabled={!can || busy} onClick={send}>
          Send to GAC
        </button>
      </div>
    </Dialog>
  );
}

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const isNew = sp.get('new') === '1';
  const [version, setVersion] = useState<number | null>(null);
  const [dialog, setDialog] = useState(false);
  const { data: d, error, reload } = useData<any>(`/api/portal/requests/${id}${version ? `?version=${version}` : ''}`, 4000);

  if (error) return <div className="banner error">{error}</div>;
  if (!d) return <p className="muted">Loading</p>;
  const q = d.quotation;

  if (isNew && !q) {
    return (
      <div>
        <div className="card center-card">
          <div className="check">{'✓'}</div>
          <h1>We have received your request</h1>
          <p>
            Request number <strong>{d.number}</strong>
          </p>
          <div style={{ textAlign: 'left' }}>
            <Details d={d} />
          </div>
          <p>Our team will send you a quotation.</p>
          <Link href="/portal/requests" className="btn" style={{ display: 'inline-block' }}>
            View my requests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row between">
        <div>
          <h1>
            {d.number} <Chip text={d.status} />
          </h1>
          <p className="subtitle">
            {d.details.mode}: {d.lane || 'Lane not given'}. Requested {fmtDate(d.created_at)}
          </p>
        </div>
        {q && (
          <div className="row">
            <select value={q.version_no} onChange={(e) => setVersion(Number(e.target.value))} aria-label="Version" style={{ width: 'auto' }}>
              {d.versions.map((v: any) => (
                <option key={v.version_no} value={v.version_no}>
                  Version {v.version_no}
                  {v.latest ? ' (latest)' : ''}
                </option>
              ))}
            </select>
            <button className="btn" disabled={Boolean(d.revision_open) || !q.is_latest} onClick={() => setDialog(true)}>
              {d.revision_open ? `Revision requested on version ${d.revision_open.version_no}` : 'Revise or negotiate'}
            </button>
          </div>
        )}
      </div>

      {q ? (
        <div className="two-col">
          <div>
            <div className="card">
              <h2>Quotation, version {q.version_no}</h2>
              <table className="t">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Unit</th>
                    <th className="num">Unit price</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {q.lines.map((l: any) => (
                    <tr key={l.line_id}>
                      <td>{l.service}</td>
                      <td>
                        {l.quantity} {l.unit_of_measure}
                      </td>
                      <td className="num">
                        <Money currency={l.currency} amount={l.unit_price} />
                      </td>
                      <td className="num">
                        <Money currency={l.currency} amount={l.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row between mt">
                <div>
                  <div className="lbl-text">Total</div>
                  <strong style={{ fontSize: 20 }}>
                    <MoneyList items={q.totals} />
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="lbl-text">Valid until</div>
                  <strong>{fmtDate(q.valid_until)}</strong>
                </div>
              </div>
              <h3 className="mt">Terms</h3>
              <p className="muted small-text">{q.terms}</p>
            </div>
            <div className="card">
              <h2>Your request</h2>
              <Details d={d} />
            </div>
            {d.my_revisions.length > 0 && (
              <div className="card">
                <h2>Your revision requests</h2>
                {d.my_revisions.map((r: any, i: number) => (
                  <p key={i}>
                    <strong>On version {r.version_no}</strong> ({fmtDateTime(r.created_at)}): {r.message || 'Target prices only'}
                    {Object.keys(r.targets).length > 0 && <span className="muted"> ({Object.keys(r.targets).length} target price{Object.keys(r.targets).length > 1 ? 's' : ''})</span>}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="email-card">
              <div className="email-head">
                <div>
                  <strong>From:</strong> GAC Quotations
                </div>
                <div>
                  <strong>To:</strong> {q.email.to}
                </div>
                <div>
                  <strong>Subject:</strong> {q.email.subject}
                </div>
                <div>{fmtDateTime(q.sent_at)}</div>
              </div>
              <pre>{q.email.body}</pre>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="banner">{d.status === 'Received' ? 'We have received your request.' : 'Our team is preparing your quotation.'} You will see it here as soon as it is ready.</div>
          <div className="card">
            <h2>Your request</h2>
            <Details d={d} />
          </div>
        </div>
      )}

      {dialog && q && (
        <ReviseDialog
          d={d}
          onClose={() => setDialog(false)}
          onDone={() => {
            setDialog(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
