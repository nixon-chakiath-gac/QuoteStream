'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Dialog, Field, Money, MoneyList, api, useData } from '@/lib/client';

const TABS = ['Waiting', 'Accepted', 'Rejected', 'Sent'];

function SendDialog({ item, onClose, onSent }: { item: any; onClose: () => void; onSent: () => void }) {
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/gac/quotations/${item.id}/send-preview`, { body: {} })
      .then((r) => {
        setPreview(r);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e.message);
        setLoading(false);
      });
  }, [item.id]);

  async function send() {
    setBusy(true);
    try {
      await api(`/api/gac/quotations/${item.id}/send`, { body: { subject: preview.subject, body: preview.body } });
      onSent();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Send to customer" onClose={onClose} wide>
      {loading && (
        <p>
          <span className="spinner" />
          Writing the cover note
        </p>
      )}
      {err && <div className="banner error">{err}</div>}
      {preview && (
        <>
          {preview.revised && <div className="banner revision">Revised quotation, version {preview.version}</div>}
          <div className="grid2">
            <Field label="To">
              <input value={preview.to} readOnly />
            </Field>
            <Field label="Subject">
              <input value={preview.subject} onChange={(e) => setPreview({ ...preview, subject: e.target.value })} />
            </Field>
          </div>
          <Field label={`Cover note${preview.fallback_used ? ' (template used)' : ''}`}>
            <textarea rows={7} value={preview.body} onChange={(e) => setPreview({ ...preview, body: e.target.value })} />
          </Field>
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
              {preview.lines.map((l: any) => (
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
          <p>
            <strong>Total:</strong> <MoneyList items={preview.totals} />. Valid until {preview.valid_until}.
          </p>
          <p className="hint">Nothing is really sent. This is a preview inside the app. Cost and margin are never included.</p>
        </>
      )}
      <div className="dialog-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn" disabled={!preview || busy} onClick={send}>
          Send
        </button>
      </div>
    </Dialog>
  );
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState('Waiting');
  const { data, loading, reload } = useData<any>(`/api/gac/approvals?tab=${tab}`, 4000);
  const [reject, setReject] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [sendFor, setSendFor] = useState<any | null>(null);
  const [jobPortal, setJobPortal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(item: any, action: 'Accept' | 'Reject', why?: string) {
    setErr(null);
    try {
      await api(`/api/gac/quotations/${item.id}/decision`, { body: { action, reason: why } });
      setReject(null);
      setReason('');
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <h1>Approvals</h1>
      <p className="subtitle">Prepare, approve, send. Only quotations from the new flow appear here.</p>
      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t} className={`subtab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
            {t} {data?.counts ? `(${data.counts[t]})` : ''}
          </button>
        ))}
      </div>
      {err && <div className="banner error">{err}</div>}
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Quotation</th>
              <th>Customer</th>
              <th>Lane</th>
              <th>Version</th>
              <th className="num">Revenue</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((i: any) => (
              <tr key={i.id}>
                <td>
                  <Link href={`/gac/quotations/${i.id}`}>
                    <strong>{i.number}</strong>
                  </Link>
                  <div className="hint">{i.request_number}</div>
                </td>
                <td>{i.customer}</td>
                <td>
                  {i.mode}: {i.lane || 'Not known'}
                </td>
                <td>{i.version}</td>
                <td className="num">
                  <MoneyList items={i.revenue} />
                </td>
                <td>
                  <div className="row wrap">
                    {tab === 'Waiting' && (
                      <>
                        <button className="btn small" onClick={() => decide(i, 'Accept')}>
                          Accept
                        </button>
                        <button className="btn danger small" onClick={() => setReject(i)}>
                          Reject
                        </button>
                      </>
                    )}
                    {tab === 'Accepted' && (
                      <>
                        <button className="btn small" onClick={() => setSendFor(i)}>
                          Send to customer
                        </button>
                        <button className="btn secondary small" onClick={() => setJobPortal(true)}>
                          Open in job portal
                        </button>
                      </>
                    )}
                    {tab === 'Rejected' && (
                      <>
                        <span className="muted small-text">Reason: {i.rejection_reason}</span>
                        <Link href={`/gac/quotations/${i.id}`} className="btn small">
                          Edit Draft
                        </Link>
                      </>
                    )}
                    {tab === 'Sent' && (
                      <button className="btn secondary small" onClick={() => setJobPortal(true)}>
                        Open in job portal
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (data?.items ?? []).length === 0 && <div className="empty">Nothing in {tab} yet</div>}
      </div>

      {reject && (
        <Dialog title={`Reject ${reject.number}`} onClose={() => setReject(null)}>
          <Field label="Reason (required)">
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <p className="hint">The request returns to the GAC user to fix and submit again. The customer never sees this reason.</p>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setReject(null)}>
              Cancel
            </button>
            <button className="btn danger" disabled={!reason.trim()} onClick={() => decide(reject, 'Reject', reason)}>
              Reject
            </button>
          </div>
        </Dialog>
      )}
      {sendFor && (
        <SendDialog
          item={sendFor}
          onClose={() => setSendFor(null)}
          onSent={() => {
            setSendFor(null);
            setTab('Sent');
            reload();
          }}
        />
      )}
      {jobPortal && (
        <Dialog title="Open in job portal" onClose={() => setJobPortal(false)}>
          <p>This is a placeholder for the hand over. Quote to Job already exists in Marlog and is not rebuilt here.</p>
          <div className="dialog-actions">
            <button className="btn" onClick={() => setJobPortal(false)}>
              Close
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
