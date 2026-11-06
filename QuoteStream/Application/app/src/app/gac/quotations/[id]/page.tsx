'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CargoEditor, { cargoToData, dataToCargo, type CargoState } from '@/components/CargoEditor';
import { Chip, Dialog, Field, Money, api, fmtDateTime, useData } from '@/lib/client';
import { BASES, BASIS_LABEL, fmt, type Basis } from '@/lib/money';
import { MODES } from '@/lib/weight';

const SOURCE_KIND: Record<string, string> = {
  Template: 'chip info',
  'Past quotation': 'chip',
  'Market median': 'chip',
  'Accepted from note': 'chip ok',
  Manual: 'chip warn',
  'Rate needed': 'chip bad'
};

const REASONS = ['Customer agreed new rate', 'This lane needs it', 'Wrong service', 'Other'];

function describe(c: any): string {
  const b = c.basis ? BASIS_LABEL[c.basis as Basis] : '';
  if (c.change_type === 'add_service') return `Add ${c.service_name}${c.new_value !== null ? `, ${fmt(c.new_value)} ${b}` : ''}`;
  if (c.change_type === 'remove_service') return `Remove ${c.service_name}`;
  return `Change ${c.service_name} to ${fmt(c.new_value)} ${b}`;
}

function WhyDialog({ change, onSave, onSkip }: { change: any; onSave: (reason: string, text: string) => void; onSkip: () => void }) {
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  return (
    <Dialog title="Why this change?" onClose={onSkip}>
      <p>
        <strong>{describe(change)}</strong>
      </p>
      <div className="reason-chips">
        {REASONS.map((r) => (
          <button key={r} className={`filter${reason === r ? ' active' : ''}`} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <Field label="Add a few words (optional)">
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <p className="hint">The reason is saved as an internal note. The customer never sees it.</p>
      <div className="dialog-actions">
        <button className="btn secondary" onClick={onSkip}>
          Skip
        </button>
        <button className="btn" disabled={!reason} onClick={() => onSave(reason, text)}>
          Save
        </button>
      </div>
    </Dialog>
  );
}

function AddServiceDialog({ lookups, currency, onClose, onAdd }: { lookups: any; currency: string; onClose: () => void; onAdd: (b: any) => void }) {
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<Basis>('shipment');
  const [price, setPrice] = useState('');
  const [est, setEst] = useState('');
  const [cur, setCur] = useState(currency);
  const services: any[] = lookups?.services ?? [];
  return (
    <Dialog title="Add service" onClose={onClose}>
      <div className="grid2">
        <Field label="Service">
          <select
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              const s = services.find((x) => x.name === e.target.value);
              if (s) setBasis(s.basis);
            }}
          >
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit of measure">
          <select value={basis} onChange={(e) => setBasis(e.target.value as Basis)}>
            {BASES.map((b) => (
              <option key={b} value={b}>
                {BASIS_LABEL[b]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit price">
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Estimated unit cost">
          <input type="number" min="0" step="0.01" value={est} onChange={(e) => setEst(e.target.value)} />
        </Field>
        <Field label="Currency">
          <input value={cur} maxLength={3} onChange={(e) => setCur(e.target.value.toUpperCase())} />
        </Field>
      </div>
      <p className="hint">Leave the unit price empty to mark the line as Rate needed.</p>
      <div className="dialog-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn" disabled={!name} onClick={() => onAdd({ service_name: name, basis, unit_price: price, est_unit_cost: est, currency: cur })}>
          Add service
        </button>
      </div>
    </Dialog>
  );
}

function DetailsEditor({ d, lookups, onSave }: { d: any; lookups: any; onSave: (patch: any) => Promise<void> }) {
  const data = d.request.data;
  const [f, setF] = useState<any>({});
  const [cargo, setCargo] = useState<CargoState>(dataToCargo(data));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setF({
      customer: d.request.customer,
      mode: d.quotation.mode,
      origin: data.origin ?? '',
      destination: data.destination ?? '',
      incoterm: data.incoterm ?? '',
      job_type: data.job_type ?? '',
      service: data.service ?? '',
      description: data.description ?? '',
      ready_date: data.ready_date ?? '',
      load_type: data.load_type ?? '',
      vehicle_type: data.vehicle_type ?? '',
      service_description: data.service_description ?? ''
    });
    setCargo(dataToCargo(data));
  }, [d.request.data, d.request.customer, d.quotation.mode]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const ports: { code: string; label: string }[] = lookups?.ports ?? [];
  const portVal = (v: string) => (ports.find((p) => p.label === v) ? v : ports.find((p) => v && v.toLowerCase().includes(p.code.toLowerCase()))?.label ?? v);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await onSave({ ...f, origin: portVal(f.origin), destination: portVal(f.destination), ...cargoToData(cargo) });
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="grid4">
        <Field label="Customer">
          <select value={f.customer ?? ''} onChange={(e) => set('customer', e.target.value)}>
            {(lookups?.customers ?? []).map((c: any) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mode">
          <select value={f.mode ?? ''} onChange={(e) => set('mode', e.target.value)}>
            {MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Origin">
          <input list="ports" value={f.origin ?? ''} onChange={(e) => set('origin', e.target.value)} />
        </Field>
        <Field label="Destination">
          <input list="ports" value={f.destination ?? ''} onChange={(e) => set('destination', e.target.value)} />
        </Field>
        <Field label="Incoterm">
          <select value={f.incoterm ?? ''} onChange={(e) => set('incoterm', e.target.value)}>
            <option value="">Not set</option>
            {(lookups?.incoterms ?? []).map((i: any) => (
              <option key={i.code}>{i.code}</option>
            ))}
          </select>
        </Field>
        <Field label="Job type">
          <select value={f.job_type ?? ''} onChange={(e) => set('job_type', e.target.value)}>
            <option value="">Not set</option>
            {(lookups?.job_types ?? []).map((j: string) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </Field>
        <Field label="Service">
          <select value={f.service ?? ''} onChange={(e) => set('service', e.target.value)}>
            <option value="">Not set</option>
            {(lookups?.service_types ?? []).map((j: string) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </Field>
        <Field label="Ready date">
          <input type="date" value={f.ready_date ?? ''} onChange={(e) => set('ready_date', e.target.value)} />
        </Field>
      </div>
      <datalist id="ports">
        {ports.map((p) => (
          <option key={p.code} value={p.label} />
        ))}
      </datalist>
      <Field label="Cargo description">
        <input value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <CargoEditor mode={(f.mode ?? 'Air') as any} value={cargo} onChange={setCargo} missing={{}} />
      {err && <div className="banner error mt">{err}</div>}
      <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" disabled={busy} onClick={save}>
          Save changes
        </button>
        <span className="hint">Saving recalculates quantities, amounts and totals. Prices stay as they are.</span>
      </div>
    </div>
  );
}

export default function DraftPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: d, error, setData } = useData<any>(`/api/gac/quotations/${id}`);
  const { data: lookups } = useData<any>('/api/lookups');
  const [why, setWhy] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<any>) {
    setErr(null);
    setMsg(null);
    try {
      return await fn();
    } catch (e: any) {
      setErr(e.message);
      return null;
    }
  }

  function afterEdit(res: any) {
    setData(res.draft);
    if (res.change) setWhy(res.change);
  }

  const editLine = (lineId: number, patch: any) => run(async () => afterEdit(await api(`/api/gac/quotations/${id}/lines/${lineId}`, { method: 'PATCH', body: patch })));
  const removeLine = (lineId: number) => run(async () => afterEdit(await api(`/api/gac/quotations/${id}/lines/${lineId}`, { method: 'DELETE' })));

  async function saveWhy(reason: string, text: string) {
    const change = why;
    setWhy(null);
    await run(async () => {
      const draft = await api(`/api/gac/quotations/${id}/notes`, { body: { change, reason, reason_text: text } });
      setData(draft);
      setMsg('Note saved');
    });
  }

  async function suggestion(noteId: number, action: 'accept' | 'dismiss') {
    await run(async () => {
      setData(await api(`/api/gac/quotations/${id}/suggestions/${noteId}`, { body: { action } }));
      setMsg(action === 'accept' ? 'Suggestion applied' : 'Suggestion dismissed');
    });
  }

  async function submit() {
    setBusy(true);
    const r = await run(() => api(`/api/gac/quotations/${id}/submit`, { body: {} }));
    setBusy(false);
    if (r) router.push('/gac/approvals');
  }

  if (error) return <div className="banner error">{error}</div>;
  if (!d) return <p className="muted">Loading</p>;
  const editable = d.quotation.editable;
  const blocked = d.submit_blocked_reason;
  const rev = d.revision;
  const cargo = d.cargo;
  const canSubmit = editable && d.quotation.flow_status !== 'Submitted' && !blocked;
  const colSpan = rev ? 11 : 10;

  return (
    <div>
      <div className="row between">
        <div>
          <h1>
            {d.quotation.number} <Chip text={d.quotation.flow_status === 'Draft' ? 'Draft' : d.quotation.flow_status} kind={d.quotation.flow_status === 'Rejected' ? 'chip bad' : d.quotation.flow_status === 'Draft' ? 'chip info' : 'chip ok'} />
          </h1>
          <p className="subtitle">
            Request {d.request.number} <Chip text={d.request.source} kind={d.request.source === 'Portal' ? 'chip info plain' : 'chip plain'} /> {d.request.customer}. Next version to send: {d.quotation.next_version}
            {d.request.ai_fallback && <span className="hint"> (email read by the fallback reader)</span>}
          </p>
        </div>
        <div className="row">
          <Link href={`/gac/requests/${d.request.id}`} className="btn secondary">
            Request and timeline
          </Link>
          {['Accepted', 'Sent'].includes(d.quotation.flow_status) && (
            <Link href="/gac/approvals" className="btn">
              Open Approvals
            </Link>
          )}
        </div>
      </div>

      {!editable && <div className="banner">This quotation is {d.quotation.flow_status.toLowerCase()} and is shown read only. A customer revision request opens a new draft.</div>}
      {d.quotation.flow_status === 'Rejected' && d.quotation.rejection_reason && (
        <div className="banner error">
          <strong>Rejected:</strong> {d.quotation.rejection_reason}. Fix the draft and submit again.
        </div>
      )}
      {err && <div className="banner error">{err}</div>}
      {msg && <div className="banner ok">{msg}</div>}

      {rev && (
        <div className="banner revision">
          <h3>Customer revision request, on version {rev.version_no}</h3>
          <div>{rev.message ? `"${rev.message}"` : 'No message, target prices only.'}</div>
          <div className="hint">Target prices are shown beside the lines. Nothing is applied automatically. Received {fmtDateTime(rev.created_at)}.</div>
        </div>
      )}

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Notes</h2>
          {editable && (
            <button className="btn secondary small" onClick={() => setNoteDialog(true)}>
              Add note
            </button>
          )}
        </div>
        <p className="hint">Internal. The customer never sees notes. A suggestion changes nothing until you press Accept.</p>
        {d.suggestions.length === 0 && <p className="muted">No suggestions from earlier notes for this draft.</p>}
        {d.suggestions.map((s: any) => (
          <div key={s.note_id} className={`suggestion${s.warning ? ' warning' : ''}`}>
            <div className="grow">
              <strong>
                {s.change_type === 'add_service' && `Add ${s.service_name}, ${fmt(s.value)} ${s.basis_label}`}
                {s.change_type === 'remove_service' && `Remove ${s.service_name}`}
                {s.change_type === 'change_price' && `Change ${s.service_name} to ${fmt(s.value)} ${s.basis_label}${s.current_value !== null ? ` (now ${fmt(s.current_value)})` : ''}`}
              </strong>
              <div className="hint">
                Basis: {s.basis_label ?? 'not applicable'}. {s.reason ? `Reason: ${s.reason}. ` : ''}Source: {s.source_label}. {s.match}.
              </div>
              {s.warning && <div style={{ color: 'var(--warn)', fontWeight: 600 }}>{'⚠'} {s.warning}</div>}
            </div>
            {editable && (
              <>
                <button className="btn small" onClick={() => suggestion(s.note_id, 'accept')}>
                  Accept
                </button>
                <button className="btn secondary small" onClick={() => suggestion(s.note_id, 'dismiss')}>
                  Dismiss
                </button>
              </>
            )}
          </div>
        ))}
        {d.notes_written.length > 0 && (
          <div className="mt">
            <div className="lbl-text">Notes on this quotation</div>
            {d.notes_written.map((n: any) => (
              <div key={n.id} className="small-text">
                {n.change_type === 'free_text' ? n.reason_text : `${describe(n)}${n.reason ? `. Reason: ${n.reason}` : ''}${n.reason_text ? `, ${n.reason_text}` : ''}`}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Cargo and lane</h2>
          {editable && (
            <button className="link-btn" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Hide details editor' : 'Edit request details'}
            </button>
          )}
        </div>
        <div className="grid4 mt">
          <div>
            <div className="lbl-text">Lane</div>
            <div>
              {d.request.lane || 'Not known'} ({d.quotation.mode})
            </div>
          </div>
          <div>
            <div className="lbl-text">Incoterm</div>
            <div>{d.quotation.incoterm ?? 'Not set'}</div>
          </div>
          <div>
            <div className="lbl-text">Gross weight and volume</div>
            <div>
              {cargo.grossWeight.toFixed(2)} kg, {cargo.volume} CBM, {cargo.totalQuantity} package{cargo.totalQuantity === 1 ? '' : 's'}
            </div>
          </div>
          <div className="chargeable">
            <div className="lbl-text">Chargeable weight</div>
            <div className="big">{cargo.hasRule ? `${cargo.chargeableWeight.toFixed(2)} kg` : `${cargo.grossWeight.toFixed(2)} kg gross`}</div>
          </div>
        </div>
        <p className="hint">{cargo.formula}</p>
        {showDetails && editable && (
          <div className="mt">
            <DetailsEditor
              d={d}
              lookups={lookups}
              onSave={async (patch) => {
                const next = await api(`/api/gac/quotations/${id}`, { method: 'PATCH', body: patch });
                setData(next);
                setMsg('Details saved and amounts recalculated');
              }}
            />
          </div>
        )}
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Cost lines</h2>
          {editable && (
            <button className="btn secondary small" onClick={() => setAdding(true)}>
              Add service
            </button>
          )}
        </div>
        <div className="table-wrap mt">
          <table className="t">
            <thead>
              <tr>
                <th>Service</th>
                <th>Unit of measure</th>
                <th className="num">Unit</th>
                <th className="num">Unit price</th>
                <th className="num">Bill amount</th>
                <th className="num">Est. unit cost</th>
                <th className="num">Est. cost</th>
                <th className="num">Est. Op. Income</th>
                <th>Price source</th>
                <th>Confidence</th>
                {rev && <th className="num">Customer target</th>}
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l: any) => (
                <tr key={`${l.id}-${l.unit_price}-${l.est_unit_cost}-${l.basis}`}>
                  <td>
                    <strong>{l.service_name}</strong>
                  </td>
                  <td>
                    {editable ? (
                      <select value={l.basis} style={{ width: 130 }} onChange={(e) => editLine(l.id, { basis: e.target.value })}>
                        {BASES.map((b) => (
                          <option key={b} value={b}>
                            {BASIS_LABEL[b]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      l.basis_label
                    )}
                  </td>
                  <td className="num">{l.quantity}</td>
                  <td className="num">
                    {editable ? (
                      <input
                        className="inline-input"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={l.unit_price ?? ''}
                        placeholder="Rate needed"
                        aria-label={`Unit price for ${l.service_name}`}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== String(l.unit_price ?? '')) editLine(l.id, { unit_price: v === '' ? null : Number(v) });
                        }}
                      />
                    ) : l.unit_price !== null ? (
                      fmt(l.unit_price)
                    ) : (
                      'Rate needed'
                    )}
                  </td>
                  <td className="num">
                    <Money currency={l.currency} amount={l.bill_amount} />
                  </td>
                  <td className="num">
                    {editable ? (
                      <input
                        className="inline-input"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={l.est_unit_cost ?? ''}
                        aria-label={`Estimated unit cost for ${l.service_name}`}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== String(l.est_unit_cost ?? '')) editLine(l.id, { est_unit_cost: v === '' ? null : Number(v) });
                        }}
                      />
                    ) : l.est_unit_cost !== null ? (
                      fmt(l.est_unit_cost)
                    ) : (
                      'Not set'
                    )}
                  </td>
                  <td className="num">{fmt(l.est_cost)}</td>
                  <td className="num">{fmt(l.op_income)}</td>
                  <td>
                    <span className={SOURCE_KIND[l.price_source] ?? 'chip'}>{l.price_source}</span>
                    {l.source_ref && <div className="hint">{l.source_ref}</div>}
                  </td>
                  <td>{l.confidence}</td>
                  {rev && <td className="num">{l.target !== null ? <span className="target">{fmt(l.target)}</span> : ''}</td>}
                  {editable && (
                    <td>
                      <button className="link-btn" onClick={() => removeLine(l.id)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {d.lines.length === 0 && (
                <tr>
                  <td colSpan={colSpan + 1} className="empty">
                    No service lines yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="kpis">
        {d.totals.map((t: any) => (
          <div key={t.currency} className="row wrap" style={{ gap: 16 }}>
            <div className="kpi">
              <div className="k">Revenue ({t.currency})</div>
              <div className="v">{fmt(t.revenue)}</div>
            </div>
            <div className="kpi">
              <div className="k">Est. Cost ({t.currency})</div>
              <div className="v">{fmt(t.cost)}</div>
            </div>
            <div className="kpi">
              <div className="k">Est. Op. Income ({t.currency})</div>
              <div className="v">{fmt(t.opIncome)}</div>
            </div>
            <div className="kpi">
              <div className="k">Margin ({t.currency})</div>
              <div className="v">{t.margin.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>

      {editable && (
        <div className="row">
          <button className="btn" disabled={!canSubmit || busy} onClick={submit}>
            Submit
          </button>
          {d.quotation.flow_status === 'Submitted' ? (
            <span className="hint">Already submitted and waiting in Approvals. Edits stay possible until a decision.</span>
          ) : (
            blocked && <span className="hint" style={{ color: 'var(--bad)' }}>Submit is blocked: {blocked}</span>
          )}
        </div>
      )}

      {why && <WhyDialog change={why} onSave={saveWhy} onSkip={() => setWhy(null)} />}
      {adding && (
        <AddServiceDialog
          lookups={lookups}
          currency={d.quotation.billing_currency}
          onClose={() => setAdding(false)}
          onAdd={async (b) => {
            setAdding(false);
            await run(async () => afterEdit(await api(`/api/gac/quotations/${id}/lines`, { body: b })));
          }}
        />
      )}
      {noteDialog && (
        <Dialog title="Add note" onClose={() => setNoteDialog(false)}>
          <Field label="Internal note for this quotation">
            <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          </Field>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setNoteDialog(false)}>
              Cancel
            </button>
            <button
              className="btn"
              disabled={!noteText.trim()}
              onClick={async () => {
                await run(async () => {
                  setData(await api(`/api/gac/quotations/${id}/notes`, { body: { free_text: noteText } }));
                  setMsg('Note saved');
                });
                setNoteText('');
                setNoteDialog(false);
              }}
            >
              Save note
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
