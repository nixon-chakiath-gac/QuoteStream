'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AiStatusBanner, Chip, FallbackTag, Field, api, fmtDateTime, useData } from '@/lib/client';

type Folder = 'templates' | 'sent' | 'inbox';
type Ai = { provider: string | null; model: string | null; seconds: number | null; cached: boolean; fallback_used: boolean; reason: string | null } | null;
type Sent = { id: number; number: string; status: string; missing: string[]; from: string; to: string; subject: string; body: string; created_at: string; error_text: string | null; ai: Ai };
type Template = { id: number; label: string; expect: string; from: string; to: string; subject: string; body: string };
type Mail = {
  id: number;
  kind: 'quotation' | 'clarification';
  request_id: number | null;
  request_number: string | null;
  request_status: string | null;
  to: string;
  subject: string;
  body: string;
  sent_at: string;
  can_reply: boolean;
  services: { service: string; unit: string; quantity: number; unit_price: number; amount: number; currency: string }[];
  totals: { currency: string; amount: number }[];
  valid_until: string | null;
};
type Box = { customers: { address: string; company: string }[]; templates: Template[]; sent: Sent[]; inbox: Mail[] };

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusChip({ status }: { status: string }) {
  if (status === 'Reading email')
    return (
      <span className="chip">
        <span className="spinner" />
        Reading email
      </span>
    );
  return <Chip text={status} kind={status === 'Quotation sent' ? 'chip ok' : undefined} />;
}

function AiLine({ item }: { item: Sent }) {
  if (item.status === 'Reading email') return <span className="hint">The AI is reading the email</span>;
  if (item.error_text) return <span className="hint">{item.error_text}</span>;
  if (!item.ai) return null;
  return (
    <span className="hint">
      {item.ai.provider === 'rules' ? 'Answered by the rule based reader' : `Answered by ${item.ai.provider} ${item.ai.model}`}
      {item.ai.seconds !== null && ` in ${item.ai.seconds.toFixed(1)} s`}
      {item.ai.cached && ' (cached)'}
      {item.ai.fallback_used && <FallbackTag reason={item.ai.reason} />}
    </span>
  );
}

function LiveStrip({ item }: { item: Sent }) {
  const reading = item.status === 'Reading email';
  const steps: { label: string; state: 'done' | 'now' | 'todo' }[] = [
    { label: 'Received', state: 'done' },
    { label: 'AI reading', state: reading ? 'now' : 'done' },
    { label: reading ? 'Draft ready or Missing information' : item.status, state: reading ? 'todo' : 'done' }
  ];
  return (
    <div className="live-strip" aria-live="polite">
      <div className="live-steps">
        {steps.map((s, i) => (
          <span key={i} className={`live-step ${s.state}`}>
            {s.state === 'now' && <span className="spinner" />}
            {s.label}
          </span>
        ))}
      </div>
      <div className="row wrap">
        <strong>{item.number}</strong>
        <AiLine item={item} />
      </div>
    </div>
  );
}

export default function EmailSimulator() {
  const [address, setAddress] = useState('');
  const [folder, setFolder] = useState<Folder>('templates');
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyResult, setReplyResult] = useState<{ status: string; still_missing: string[]; unclear: string[]; number: string } | null>(null);
  const [reading, setReading] = useState(false);
  const { data, reload } = useData<Box>(`/api/gac/mailbox?address=${encodeURIComponent(address)}`, reading ? 2000 : 0);

  const customers = data?.customers ?? [];
  const templates = address ? data?.templates ?? [] : [];
  const sent = address ? data?.sent ?? [] : [];
  const inbox = address ? data?.inbox ?? [] : [];

  useEffect(() => {
    if (!address && customers.length > 0) setAddress(customers[0].address);
  }, [address, customers]);

  useEffect(() => {
    setReading(sent.some((s) => s.status === 'Reading email'));
  }, [sent]);

  const lists = { templates, sent, inbox };
  const items: { id: number }[] = lists[folder];
  const current = items.find((x) => x.id === selected) ?? items[0] ?? null;

  function pickCustomer(a: string) {
    setAddress(a);
    setFolder('templates');
    setSelected(null);
    setDraft(null);
    setLastSent(null);
    setReplyResult(null);
  }

  function pickFolder(f: Folder) {
    setFolder(f);
    setSelected(null);
    setDraft(null);
    setReply('');
    setReplyResult(null);
    reload();
  }

  function pick(id: number) {
    setSelected(id);
    setDraft(null);
    setReply('');
    setReplyResult(null);
  }

  async function send(t: Template) {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ id: number }>('/api/gac/emails', { body: { from: t.from, to: t.to, subject: draft?.subject ?? t.subject, body: draft?.body ?? t.body } });
      setLastSent(r.id);
      setReading(true);
      await reload();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function sendReply(m: Mail) {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<any>(`/api/gac/requests/${m.request_id}/information`, { body: { text: reply } });
      setReplyResult({ status: r.status, still_missing: r.still_missing, unclear: r.unclear, number: m.request_number ?? '' });
      setReply('');
      await reload();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const counts: Record<Folder, number> = { templates: templates.length, sent: sent.length, inbox: inbox.length };
  const live = sent.find((s) => s.id === lastSent);

  function listItem(id: number, title: string, sub: ReactNode, extra?: ReactNode) {
    return (
      <button key={id} className={`mail-item${current?.id === id ? ' active' : ''}`} onClick={() => pick(id)}>
        <span className="mail-title">{title}</span>
        <span className="hint">{sub}</span>
        {extra}
      </button>
    );
  }

  function pane() {
    if (!current) return <div className="empty">{folder === 'templates' ? 'No templates for this customer' : folder === 'sent' ? 'No emails sent yet' : 'No emails yet'}</div>;
    if (folder === 'templates') {
      const t = current as Template;
      const d = draft ?? { subject: t.subject, body: t.body };
      return (
        <div>
          <h2>New email</h2>
          <div className="hint">
            {t.label}. {t.expect}
          </div>
          <div className="grid2 mt">
            <Field label="From">
              <input value={t.from} readOnly />
            </Field>
            <Field label="To">
              <input value={t.to || 'quotes@gac.com'} readOnly />
            </Field>
          </div>
          <Field label="Subject">
            <input value={d.subject} onChange={(e) => setDraft({ ...d, subject: e.target.value })} />
          </Field>
          <Field label="Body">
            <textarea rows={14} value={d.body} onChange={(e) => setDraft({ ...d, body: e.target.value })} />
          </Field>
          {err && <div className="banner error">{err}</div>}
          <div className="row wrap">
            <button className="btn" disabled={busy || !d.body.trim()} onClick={() => send(t)}>
              Send email
            </button>
            <button className="btn secondary" disabled={!draft} onClick={() => setDraft(null)}>
              Reset to template
            </button>
          </div>
          {live && <LiveStrip item={live} />}
        </div>
      );
    }
    if (folder === 'sent') {
      const s = current as Sent;
      return (
        <div>
          <h2>{s.subject}</h2>
          <div className="hint">
            From {s.from} to {s.to} | {fmtDateTime(s.created_at)}
          </div>
          <div className="row wrap mt">
            <strong>{s.number}</strong>
            <StatusChip status={s.status} />
            <a href={`/gac/requests?focus=${s.id}`}>Open in GAC Requests</a>
          </div>
          {s.missing.length > 0 && <div className="banner warn mt">Missing: {s.missing.join(', ')}</div>}
          <div className="mt">
            <AiLine item={s} />
          </div>
          <pre className="mail-body">{s.body}</pre>
        </div>
      );
    }
    const m = current as Mail;
    return (
      <div>
        <h2>{m.subject}</h2>
        <div className="hint">
          From GAC Quotations to {m.to} | {fmtDateTime(m.sent_at)}
        </div>
        <pre className="mail-body">{m.body}</pre>
        {m.kind === 'quotation' && m.services.length > 0 && (
          <div className="table-wrap mt">
            <table className="t">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Unit</th>
                  <th className="num">Quantity</th>
                  <th className="num">Unit price</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {m.services.map((l, i) => (
                  <tr key={i}>
                    <td>{l.service}</td>
                    <td>{l.unit}</td>
                    <td className="num">{l.quantity}</td>
                    <td className="num">{money(l.unit_price)}</td>
                    <td className="num">
                      {l.currency} {money(l.amount)}
                    </td>
                  </tr>
                ))}
                {m.totals.map((t) => (
                  <tr key={t.currency}>
                    <td colSpan={4}>
                      <strong>Total {t.currency}</strong>
                    </td>
                    <td className="num">
                      <strong>
                        {t.currency} {money(t.amount)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {m.kind === 'clarification' && (
          <div className="mt">
            {replyResult && (
              <div className={`banner ${replyResult.status === 'Draft ready' ? 'ok' : 'warn'}`}>
                Reply sent. {replyResult.number} is now <strong>{replyResult.status}</strong>.
                {replyResult.still_missing.length > 0 && ` Still missing: ${replyResult.still_missing.join(', ')}.`}
                {replyResult.unclear.map((u, i) => (
                  <div key={i}>{u}</div>
                ))}
              </div>
            )}
            {m.can_reply ? (
              <>
                <Field label="Reply with the missing details">
                  <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="For example: Incoterm FCA, 320 kg, 1.8 cbm" />
                </Field>
                {err && <div className="banner error">{err}</div>}
                <button className="btn" disabled={busy || !reply.trim()} onClick={() => sendReply(m)}>
                  {busy ? 'Reading reply...' : 'Send reply'}
                </button>
              </>
            ) : (
              !replyResult &&
              m.request_status && (
                <div className="hint">
                  {m.request_number} is now <StatusChip status={m.request_status} />
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>Email simulator</h1>
      <AiStatusBanner />
      <p className="subtitle">A mock mailbox for the email door. Choose which customer you are, send a template email and watch the request appear in GAC. Nothing is really sent.</p>
      <div className="mailbox-of">
        <Field label="Mailbox of">
          <select value={address} onChange={(e) => pickCustomer(e.target.value)}>
            {customers.map((c) => (
              <option key={c.address} value={c.address}>
                {c.company ? `${c.company} (${c.address})` : c.address}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mailbox">
        <nav className="mail-folders" aria-label="Folders">
          {(['templates', 'sent', 'inbox'] as Folder[]).map((f) => (
            <button key={f} className={`mail-folder${folder === f ? ' active' : ''}`} onClick={() => pickFolder(f)}>
              <span>{f === 'templates' ? 'Templates' : f === 'sent' ? 'Sent' : 'Inbox'}</span>
              <span className="count">{counts[f]}</span>
            </button>
          ))}
        </nav>
        <div className="mail-list">
          {items.length === 0 && <div className="empty">Nothing here yet</div>}
          {folder === 'templates' && templates.map((t) => listItem(t.id, t.label, t.expect, <span className="mail-sub">{t.subject}</span>))}
          {folder === 'sent' && sent.map((s) => listItem(s.id, s.subject, s.number, <StatusChip status={s.status} />))}
          {folder === 'inbox' &&
            inbox.map((m) =>
              listItem(m.id, m.subject, `From GAC Quotations | ${fmtDateTime(m.sent_at)}`, <span className="mail-sub">{m.kind === 'quotation' ? 'Quotation' : 'We need a few details'}</span>)
            )}
        </div>
        <div className="mail-pane">{pane()}</div>
      </div>
    </div>
  );
}
