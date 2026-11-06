import { q, q1, exec, nextNumber } from '../db';
import { isMode, packageTotals, type PackageRow, type Mode } from '../weight';
import { BASIS_LABEL, calcLine, quantityFor, revenueByCurrency, totalsByCurrency, type Basis } from '../money';
import { missingFor, missingLabels, type FieldKey } from '../required';
import { suggestNotes, type NoteRow, type DraftLineLite } from '../notes';
import {
  cargoOf,
  createDraft,
  insertLine,
  laneLabel,
  linesOf,
  portById,
  portLabel,
  requantify,
  resolvePort,
  resolvePrincipal,
  summarizeCargo,
  syncQuotation,
  type LineRow,
  type ReqData
} from './core';
import { gatewayCall } from './gateway';
import { customerPrincipalId } from './auth';

export function noDash(s: string): string {
  return s.replace(new RegExp(`\\s*[${String.fromCharCode(0x2013, 0x2014)}]\\s*`, 'g'), ', ');
}

export async function addEvent(requestId: number, type: string, text: string) {
  await exec('INSERT INTO request_event (request_id, type, text) VALUES (?,?,?)', [requestId, type, text]);
}

const EDITABLE = ['Draft', 'Submitted', 'Rejected'];

export class FlowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cleanPackages(v: unknown): PackageRow[] {
  if (!Array.isArray(v)) return [];
  return v.map((r: any) => ({
    quantity: num(r?.quantity),
    length: num(r?.length),
    width: num(r?.width),
    height: num(r?.height),
    weight: num(r?.weight)
  }));
}

const PORTAL_KEYS = [
  'origin',
  'destination',
  'incoterm',
  'description',
  'ready_date',
  'pickup_needed',
  'pickup_address',
  'delivery_needed',
  'delivery_address',
  'load_type',
  'container_type',
  'vehicle_type',
  'service_description',
  'job_type',
  'service'
];

function normalizeCargoFields(data: ReqData) {
  if (data.cargo_mode === 'packages') {
    data.packages = cleanPackages(data.packages);
    data.unit_system = data.unit_system === 'imperial' ? 'imperial' : 'metric';
    const t = packageTotals(data.packages, data.unit_system);
    data.total_quantity = t.quantity;
    data.total_weight_kg = t.weightKg;
    data.total_volume_cbm = t.cbm;
  } else {
    data.cargo_mode = 'totals';
    data.total_quantity = num(data.total_quantity);
    data.total_weight_kg = num(data.total_weight_kg);
    data.total_volume_cbm = num(data.total_volume_cbm);
  }
}

export async function createPortalRequest(input: Record<string, any>) {
  const mode = input.mode;
  if (!isMode(mode)) throw new FlowError('Choose a mode');
  const pid = await customerPrincipalId();
  const principal = await q1<any>('SELECT * FROM principal WHERE id = ?', [pid]);
  const data: ReqData = { mode, customer: principal.name, contact_email: principal.email };
  for (const k of PORTAL_KEYS) if (input[k] !== undefined) data[k] = input[k];
  data.cargo_mode = input.cargo_mode;
  data.unit_system = input.unit_system;
  data.packages = input.packages;
  data.total_quantity = input.total_quantity;
  data.total_weight_kg = input.total_weight_kg;
  data.total_volume_cbm = input.total_volume_cbm;
  data.container_count = input.container_count;
  data.pos = Array.isArray(input.pos) ? input.pos : [];
  data.requested_services = [];
  normalizeCargoFields(data);
  if (mode === 'Hand Carry' && data.cargo_mode === 'totals' && !data.total_quantity) data.total_quantity = 1;
  const missing = missingFor(data, 'Portal');
  if (missing.length > 0) throw new FlowError(`Missing required fields: ${missingLabels(missing).join(', ')}`);
  const originId = await resolvePort(data.origin, mode);
  const destId = await resolvePort(data.destination, mode);
  const number = await nextNumber('REQ');
  const lane = await laneLabel(originId, destId, `${data.origin ?? ''} to ${data.destination ?? ''}`);
  const id = (
    await exec(
      `INSERT INTO request (number, source, principal_id, customer_name, mode, origin_port_id, destination_port_id, lane_text, data, missing, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [number, 'Portal', pid, principal.name, mode, originId, destId, lane, JSON.stringify(data), JSON.stringify([]), 'Draft ready']
    )
  ).insertId;
  await addEvent(id, 'received', 'Request received from the portal');
  await createDraft(id);
  return { id, number };
}

export async function createEmailRequest(email: { from: string; to: string; subject: string; body: string }) {
  const number = await nextNumber('REQ');
  const id = (
    await exec(
      `INSERT INTO request (number, source, customer_name, data, email_json, missing, status) VALUES (?,?,?,?,?,?,?)`,
      [number, 'Email', email.from, JSON.stringify({}), JSON.stringify(email), JSON.stringify([]), 'Reading email']
    )
  ).insertId;
  await addEvent(id, 'received', `Email received from ${email.from}`);
  processEmail(id).catch(() => undefined);
  return { id, number };
}

function applyExtract(data: ReqData, x: Record<string, any>) {
  const keys = ['customer', 'contact_name', 'contact_email', 'mode', 'origin', 'destination', 'incoterm', 'job_type', 'service', 'pos', 'total_weight_kg', 'total_volume_cbm', 'requested_services', 'notes', 'load_type', 'container_type', 'container_count', 'vehicle_type'];
  for (const k of keys) if (x[k] !== undefined) data[k] = x[k];
  if (!Array.isArray(data.pos)) data.pos = [];
  if (!Array.isArray(data.requested_services)) data.requested_services = [];
  data.cargo_mode = 'totals';
  data.unit_system = 'metric';
  data.total_quantity = data.pos.length > 0 ? data.pos.length : data.total_quantity || 1;
}

async function finishIntake(requestId: number, data: ReqData, fallback: boolean) {
  const mode = isMode(data.mode) ? data.mode : null;
  const principal = data.customer || data.contact_email ? await resolvePrincipal(data.customer ?? null, data.contact_email ?? null) : null;
  if (principal) data.customer = principal.name;
  const originId = await resolvePort(data.origin, mode);
  const destId = await resolvePort(data.destination, mode);
  const missing = missingFor(data, 'Email');
  const lane = await laneLabel(originId, destId, data.origin && data.destination ? `${data.origin} to ${data.destination}` : null);
  await exec(
    `UPDATE request SET principal_id = ?, customer_name = ?, mode = ?, origin_port_id = ?, destination_port_id = ?, lane_text = ?, data = ?, missing = ?, ai_fallback = ?, status = ? WHERE id = ?`,
    [
      principal?.id ?? null,
      data.customer ?? null,
      mode,
      originId,
      destId,
      lane,
      JSON.stringify(data),
      JSON.stringify(missing),
      fallback ? 1 : 0,
      missing.length > 0 ? 'Missing information' : 'Draft ready',
      requestId
    ]
  );
  if (missing.length > 0) {
    await addEvent(requestId, 'read', `Email read. Missing information: ${missingLabels(missing).join(', ')}`);
    await writeClarification(requestId, data, missing);
    return null;
  }
  await addEvent(requestId, 'read', 'Email read. All required information found');
  return createDraft(requestId);
}

async function writeClarification(requestId: number, data: ReqData, missing: FieldKey[]) {
  const req = await q1<any>('SELECT number, email_json FROM request WHERE id = ?', [requestId]);
  const email = req?.email_json ?? {};
  const to = String(email.from ?? data.contact_email ?? '').trim();
  if (!req || !to) return;
  const body = [
    `Dear ${data.contact_name || data.customer || 'customer'},`,
    '',
    `Thank you for your email. To prepare the quotation for request ${req.number} we still need:`,
    '',
    ...missingLabels(missing).map((l) => `- ${l}`),
    '',
    'Please reply to this email with these details.',
    '',
    'Kind regards,',
    'GAC Quotations'
  ].join('\n');
  await exec("INSERT INTO outgoing_email (kind, request_id, to_email, subject, body) VALUES ('clarification',?,?,?,?)", [
    requestId,
    to,
    noDash(`Re: ${email.subject || 'Your quotation request'}`),
    noDash(body)
  ]);
}

export async function resumeReading() {
  const rows = await q<{ id: number }>("SELECT id FROM request WHERE source = 'Email' AND status = 'Reading email'");
  for (const r of rows) await processEmail(r.id).catch(() => undefined);
  return rows.length;
}

export async function processEmail(requestId: number) {
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [requestId]);
  if (!req) return;
  const data: ReqData = {};
  let fallback = false;
  try {
    const x = await gatewayCall('/extract', req.email_json);
    fallback = Boolean(x.fallback_used);
    const m = x.meta ?? {};
    await exec('UPDATE request SET ai_meta = ? WHERE id = ?', [JSON.stringify({ provider: m.provider ?? null, model: m.model ?? null, duration_ms: m.duration_ms ?? null, cached: Boolean(m.cached), reason: m.reason ?? null }), requestId]);
    applyExtract(data, x);
  } catch {
    await exec('UPDATE request SET error_text = ?, ai_meta = ? WHERE id = ?', [
      'The AI service could not be reached',
      JSON.stringify({ provider: 'rules', model: null, duration_ms: null, cached: false, reason: 'AI service unreachable' }),
      requestId
    ]);
    fallback = true;
    data.contact_email = req.email_json?.from ?? null;
  }
  await finishIntake(requestId, data, fallback);
}

export async function addInformation(requestId: number, text: string) {
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [requestId]);
  if (!req) throw new FlowError('Request not found', 404);
  if (req.source !== 'Email') throw new FlowError('Only email requests can be completed this way');
  if (req.status !== 'Missing information') throw new FlowError('This request is not waiting for information');
  const current: ReqData = req.data;
  let result: any;
  try {
    result = await gatewayCall('/update_from_text', { request: current, text });
  } catch {
    throw new FlowError('The AI service could not be reached. Try again in a moment.', 502);
  }
  const data: ReqData = { ...current };
  const allowed = ['customer', 'mode', 'origin', 'destination', 'incoterm', 'job_type', 'service', 'total_weight_kg', 'total_volume_cbm', 'pos'];
  const changed: string[] = Array.isArray(result.changed) ? result.changed : [];
  for (const k of allowed) if (result.request && result.request[k] !== undefined) data[k] = result.request[k];
  if (Array.isArray(data.pos) && data.pos.length > 0) data.total_quantity = data.pos.length;
  await exec('INSERT INTO information_update (request_id, text, result) VALUES (?,?,?)', [requestId, text, JSON.stringify({ changed, unclear: result.unclear ?? [] })]);
  await addEvent(requestId, 'information', `Information added: ${changed.length > 0 ? changed.join(', ') : 'nothing recognised'}`);
  const qid = await finishIntake(requestId, data, Boolean(result.fallback_used) || Boolean(req.ai_fallback));
  const after = await q1<any>('SELECT missing FROM request WHERE id = ?', [requestId]);
  const stillMissing: FieldKey[] = after?.missing ?? [];
  return {
    changed,
    unclear: (result.unclear ?? []) as string[],
    still_missing: missingLabels(stillMissing),
    complete: stillMissing.length === 0,
    status: stillMissing.length === 0 ? 'Draft ready' : 'Missing information',
    quotation_id: qid
  };
}

export async function nextVersionNo(quotationId: number): Promise<number> {
  const r = await q1<{ v: number | null }>('SELECT MAX(version_no) AS v FROM quotation_version WHERE quotation_id = ?', [quotationId]);
  return (r?.v ?? 0) + 1;
}

export function toTime(s: string | null): number {
  return s ? new Date(s.replace(' ', 'T') + 'Z').getTime() : 0;
}

export async function loadDraft(quotationId: number, opts: { includeTest?: boolean; markOpened?: boolean } = {}) {
  const qt = await q1<any>('SELECT * FROM quotation WHERE id = ?', [quotationId]);
  if (!qt || !qt.request_id) throw new FlowError('Quotation not found', 404);
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [qt.request_id]);
  if (opts.markOpened && !req.draft_opened_at) {
    await exec('UPDATE request SET draft_opened_at = UTC_TIMESTAMP() WHERE id = ?', [req.id]);
    await addEvent(req.id, 'draft_opened', 'Draft opened by the GAC user');
  }
  const principal = await q1<any>('SELECT id, name, email FROM principal WHERE id = ?', [qt.principal_id]);
  const lines = await linesOf(quotationId);
  const revision = await q1<any>("SELECT * FROM revision_request WHERE request_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", [req.id]);
  const targets: Record<string, number> = revision?.targets ?? {};
  const cargo = summarizeCargo(req.data, qt.mode);
  const totals = totalsByCurrency(lines.map((l) => ({ currency: l.currency, bill: l.bill_amount, cost: l.est_cost })));
  const noteRows = await q<any>('SELECT *, UNIX_TIMESTAMP(created_at) AS created_ts FROM quotation_note');
  const notes: NoteRow[] = noteRows.map((n) => ({ ...n, created_at: Number(n.created_ts) }));
  const dismissed = new Set((await q<any>('SELECT note_id FROM note_dismissal WHERE quotation_id = ?', [quotationId])).map((r) => r.note_id as number));
  const lite: DraftLineLite[] = lines.map((l) => ({ id: l.id, service_name: l.service_name, basis: l.basis, currency: l.currency, unit_price: l.unit_price }));
  const suggestions = suggestNotes(
    { principal_id: qt.principal_id, mode: qt.mode, origin_port_id: qt.origin_port_id, destination_port_id: qt.destination_port_id },
    lite,
    notes,
    dismissed,
    Boolean(opts.includeTest)
  );
  const versions = await q<any>('SELECT version_no, sent_at FROM quotation_version WHERE quotation_id = ? ORDER BY version_no', [quotationId]);
  const events = await q<any>('SELECT type, text, created_at FROM request_event WHERE request_id = ? ORDER BY id', [req.id]);
  const writtenNotes = await q<any>('SELECT id, change_type, service_name, basis, new_value, reason, reason_text, created_at FROM quotation_note WHERE quotation_id = ? ORDER BY id DESC', [quotationId]);
  const needed = lines.filter((l) => l.unit_price === null || l.price_source === 'Rate needed');
  const nextVersion = await nextVersionNo(quotationId);
  return {
    quotation: {
      id: qt.id,
      number: qt.number,
      flow_status: qt.flow_status,
      mode: qt.mode,
      job_type: qt.job_type,
      service_type: qt.service_type,
      incoterm: qt.incoterm,
      billing_currency: qt.billing_currency,
      rejection_reason: qt.rejection_reason,
      next_version: nextVersion,
      editable: EDITABLE.includes(qt.flow_status)
    },
    request: {
      id: req.id,
      number: req.number,
      source: req.source,
      status: req.status,
      customer: principal.name,
      principal_id: principal.id,
      contact_email: principal.email,
      data: req.data,
      email: req.email_json,
      ai_fallback: Boolean(req.ai_fallback),
      ai_reason: req.ai_meta?.reason ?? null,
      lane: await laneLabel(qt.origin_port_id, qt.destination_port_id, req.lane_text)
    },
    cargo,
    lines: lines.map((l) => ({
      ...l,
      basis_label: BASIS_LABEL[l.basis],
      op_income: Math.round((l.bill_amount - l.est_cost) * 100) / 100,
      target: targets[String(l.id)] ?? null
    })),
    totals,
    suggestions,
    notes_written: writtenNotes,
    revision: revision ? { message: revision.message, version_no: revision.version_no, created_at: revision.created_at, targets } : null,
    versions,
    timeline: events,
    submit_blocked_reason:
      lines.length === 0 ? 'Add at least one service line' : needed.length > 0 ? `Rate needed on ${needed.length} line${needed.length > 1 ? 's' : ''}` : null
  };
}

async function quotationOf(id: number) {
  const qt = await q1<any>('SELECT * FROM quotation WHERE id = ?', [id]);
  if (!qt || !qt.request_id) throw new FlowError('Quotation not found', 404);
  return qt;
}

async function editableQuotation(id: number) {
  const qt = await quotationOf(id);
  if (!EDITABLE.includes(qt.flow_status)) throw new FlowError('This quotation can no longer be edited');
  return qt;
}

export async function updateHeader(quotationId: number, patch: Record<string, any>) {
  const qt = await editableQuotation(quotationId);
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [qt.request_id]);
  const data: ReqData = { ...req.data };
  const fields = [
    'customer', 'mode', 'origin', 'destination', 'incoterm', 'job_type', 'service', 'cargo_mode', 'unit_system', 'packages', 'total_quantity',
    'total_weight_kg', 'total_volume_cbm', 'description', 'ready_date', 'pickup_needed', 'pickup_address', 'delivery_needed', 'delivery_address',
    'load_type', 'container_type', 'container_count', 'vehicle_type', 'service_description', 'contact_email'
  ];
  for (const k of fields) if (patch[k] !== undefined) data[k] = patch[k];
  if (patch.mode !== undefined && !isMode(patch.mode)) throw new FlowError('Unknown mode');
  normalizeCargoFields(data);
  let principalId = req.principal_id as number;
  if (patch.customer !== undefined && patch.customer !== req.data.customer) {
    const p = await resolvePrincipal(String(patch.customer), data.contact_email ?? null);
    principalId = p.id;
    data.customer = p.name;
  }
  const mode: Mode = isMode(data.mode) ? data.mode : 'Air';
  const originId = await resolvePort(data.origin, mode);
  const destId = await resolvePort(data.destination, mode);
  const lane = await laneLabel(originId, destId, `${data.origin ?? ''} to ${data.destination ?? ''}`);
  await exec('UPDATE request SET data = ?, principal_id = ?, customer_name = ?, mode = ?, origin_port_id = ?, destination_port_id = ?, lane_text = ? WHERE id = ?', [
    JSON.stringify(data),
    principalId,
    data.customer,
    mode,
    originId,
    destId,
    lane,
    req.id
  ]);
  await syncQuotation(req.id);
  if (patch.valid_until !== undefined) await exec('UPDATE quotation SET valid_until = ? WHERE id = ?', [patch.valid_until || null, quotationId]);
}

export type Change = {
  change_type: 'add_service' | 'remove_service' | 'change_price';
  service_name: string;
  basis: Basis;
  currency: string;
  old_value: number | null;
  new_value: number | null;
  est_unit_cost: number | null;
};

export async function updateLine(quotationId: number, lineId: number, patch: Record<string, any>): Promise<Change | null> {
  const qt = await editableQuotation(quotationId);
  const line = await q1<LineRow>('SELECT * FROM quotation_product_cost WHERE id = ? AND quotation_id = ?', [lineId, quotationId]);
  if (!line) throw new FlowError('Line not found', 404);
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [qt.request_id]);
  const cargo = cargoOf(req.data, qt.mode);
  const basis: Basis = patch.basis ?? line.basis;
  const unitPrice = patch.unit_price !== undefined ? (patch.unit_price === null || patch.unit_price === '' ? null : Number(patch.unit_price)) : line.unit_price;
  const estUnit = patch.est_unit_cost !== undefined ? (patch.est_unit_cost === null || patch.est_unit_cost === '' ? null : Number(patch.est_unit_cost)) : line.est_unit_cost;
  if ((unitPrice !== null && !(unitPrice >= 0)) || (estUnit !== null && !(estUnit >= 0))) throw new FlowError('Enter valid amounts');
  const currency = patch.currency ?? line.currency;
  const serviceName = patch.service_name ? String(patch.service_name) : line.service_name;
  const qty = quantityFor(basis, cargo);
  const c = calcLine(unitPrice, estUnit, qty);
  const priceChanged = unitPrice !== line.unit_price || basis !== line.basis;
  const source = priceChanged && unitPrice !== null ? 'Manual' : unitPrice === null ? 'Rate needed' : line.price_source;
  const ref = priceChanged && unitPrice !== null ? (line.price_source === 'Manual' ? line.source_ref : `Edited from ${line.price_source}`) : unitPrice === null ? null : line.source_ref;
  const confidence = source === 'Manual' ? 'Manual' : source === 'Rate needed' ? 'None' : line.confidence;
  await exec(
    'UPDATE quotation_product_cost SET service_name = ?, basis = ?, currency = ?, quantity = ?, unit_price = ?, bill_amount = ?, est_unit_cost = ?, est_cost = ?, price_source = ?, source_ref = ?, confidence = ? WHERE id = ?',
    [serviceName, basis, currency, qty, unitPrice, c.bill, estUnit, c.cost, source, ref, confidence, lineId]
  );
  if (priceChanged && unitPrice !== null) {
    return { change_type: 'change_price', service_name: serviceName, basis, currency, old_value: line.unit_price, new_value: unitPrice, est_unit_cost: estUnit };
  }
  return null;
}

export async function addLine(quotationId: number, input: Record<string, any>): Promise<Change> {
  const qt = await editableQuotation(quotationId);
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [qt.request_id]);
  const cargo = cargoOf(req.data, qt.mode);
  const name = String(input.service_name ?? '').trim();
  if (!name) throw new FlowError('Choose a service');
  const basis: Basis = (input.basis as Basis) ?? 'shipment';
  const price = input.unit_price === null || input.unit_price === undefined || input.unit_price === '' ? null : Number(input.unit_price);
  const est = input.est_unit_cost === null || input.est_unit_cost === undefined || input.est_unit_cost === '' ? null : Number(input.est_unit_cost);
  if ((price !== null && !(price >= 0)) || (est !== null && !(est >= 0))) throw new FlowError('Enter valid amounts');
  const currency = input.currency || qt.billing_currency;
  const qty = quantityFor(basis, cargo);
  const c = calcLine(price, est, qty);
  const max = await q1<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM quotation_product_cost WHERE quotation_id = ?', [quotationId]);
  await insertLine(quotationId, {
    service_name: name,
    basis,
    currency,
    quantity: qty,
    unit_price: price,
    bill_amount: c.bill,
    est_unit_cost: est,
    est_cost: c.cost,
    price_source: price === null ? 'Rate needed' : 'Manual',
    source_ref: null,
    confidence: price === null ? 'None' : 'Manual',
    sort_order: (max?.m ?? 0) + 1
  });
  return { change_type: 'add_service', service_name: name, basis, currency, old_value: null, new_value: price, est_unit_cost: est };
}

export async function removeLine(quotationId: number, lineId: number): Promise<Change> {
  await editableQuotation(quotationId);
  const line = await q1<LineRow>('SELECT * FROM quotation_product_cost WHERE id = ? AND quotation_id = ?', [lineId, quotationId]);
  if (!line) throw new FlowError('Line not found', 404);
  await exec('DELETE FROM quotation_product_cost WHERE id = ?', [lineId]);
  return { change_type: 'remove_service', service_name: line.service_name, basis: line.basis, currency: line.currency, old_value: line.unit_price, new_value: null, est_unit_cost: line.est_unit_cost };
}

export async function saveNote(quotationId: number, input: { change?: Change; reason?: string; reason_text?: string; free_text?: string }) {
  const qt = await quotationOf(quotationId);
  if (input.free_text !== undefined) {
    const text = String(input.free_text).trim();
    if (!text) throw new FlowError('Write the note first');
    await exec(
      `INSERT INTO quotation_note (principal_id, mode, origin_port_id, destination_port_id, change_type, reason_text, quotation_id, source_label) VALUES (?,?,?,?,?,?,?,?)`,
      [qt.principal_id, qt.mode, qt.origin_port_id, qt.destination_port_id, 'free_text', text.slice(0, 250), quotationId, qt.number]
    );
    return;
  }
  const ch = input.change;
  if (!ch) throw new FlowError('Nothing to save');
  await exec(
    `INSERT INTO quotation_note (principal_id, mode, origin_port_id, destination_port_id, change_type, service_name, basis, currency, old_value, new_value, est_unit_cost, reason, reason_text, quotation_id, source_label)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      qt.principal_id, qt.mode, qt.origin_port_id, qt.destination_port_id, ch.change_type, ch.service_name, ch.basis, ch.currency,
      ch.old_value, ch.new_value, ch.est_unit_cost, input.reason ?? null, input.reason_text ? String(input.reason_text).slice(0, 250) : null, quotationId, qt.number
    ]
  );
}

export async function acceptSuggestion(quotationId: number, noteId: number) {
  const qt = await editableQuotation(quotationId);
  const view = await loadDraft(quotationId, { includeTest: true });
  const s = view.suggestions.find((x) => x.note_id === noteId);
  if (!s) throw new FlowError('This suggestion does not apply to the current lines');
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [qt.request_id]);
  const cargo = cargoOf(req.data, qt.mode);
  const ref = s.source_label;
  if (s.change_type === 'add_service') {
    const basis = s.basis as Basis;
    const qty = quantityFor(basis, cargo);
    const c = calcLine(s.value, s.est_unit_cost, qty);
    const max = await q1<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM quotation_product_cost WHERE quotation_id = ?', [quotationId]);
    await insertLine(quotationId, {
      service_name: s.service_name,
      basis,
      currency: s.currency ?? qt.billing_currency,
      quantity: qty,
      unit_price: s.value,
      bill_amount: c.bill,
      est_unit_cost: s.est_unit_cost,
      est_cost: c.cost,
      price_source: 'Accepted from note',
      source_ref: ref,
      confidence: 'Medium',
      sort_order: (max?.m ?? 0) + 1
    });
  } else if (s.change_type === 'remove_service') {
    await exec('DELETE FROM quotation_product_cost WHERE id = ? AND quotation_id = ?', [s.line_id, quotationId]);
  } else {
    const line = await q1<LineRow>('SELECT * FROM quotation_product_cost WHERE id = ?', [s.line_id]);
    if (!line) throw new FlowError('Line not found', 404);
    const c = calcLine(s.value, line.est_unit_cost, line.quantity);
    await exec('UPDATE quotation_product_cost SET unit_price = ?, bill_amount = ?, est_cost = ?, price_source = ?, source_ref = ?, confidence = ? WHERE id = ?', [
      s.value, c.bill, c.cost, 'Accepted from note', ref, 'Medium', line.id
    ]);
  }
  await addEvent(qt.request_id, 'note_accepted', `Note suggestion accepted: ${s.change_type.replace('_', ' ')} ${s.service_name}`);
}

export async function dismissSuggestion(quotationId: number, noteId: number) {
  await quotationOf(quotationId);
  await exec('INSERT INTO note_dismissal (quotation_id, note_id) VALUES (?,?)', [quotationId, noteId]);
}

export async function submitQuotation(quotationId: number) {
  const qt = await editableQuotation(quotationId);
  if (qt.flow_status === 'Submitted') throw new FlowError('Already submitted');
  const lines = await linesOf(quotationId);
  if (lines.length === 0) throw new FlowError('Add at least one service line');
  if (lines.some((l) => l.unit_price === null || l.price_source === 'Rate needed')) throw new FlowError('Submit is blocked while any line says Rate needed');
  const version = await nextVersionNo(quotationId);
  const claimed = await exec("UPDATE quotation SET flow_status = 'Submitted', rejection_reason = NULL WHERE id = ? AND flow_status IN ('Draft', 'Rejected')", [quotationId]);
  if (claimed.affectedRows === 0) throw new FlowError('Already submitted', 409);
  await exec("UPDATE request SET status = 'Submitted' WHERE id = ?", [qt.request_id]);
  await exec("INSERT INTO approval (quotation_id, version_no, action) VALUES (?,?,'Submit')", [quotationId, version]);
  await addEvent(qt.request_id, 'submitted', `Version ${version} submitted for approval`);
}

export async function decide(quotationId: number, action: 'Accept' | 'Reject', reason?: string) {
  const qt = await quotationOf(quotationId);
  if (qt.flow_status !== 'Submitted') throw new FlowError('Only submitted quotations can be decided');
  const version = await nextVersionNo(quotationId);
  if (action === 'Reject') {
    const r = (reason ?? '').trim();
    if (!r) throw new FlowError('A reason is required to reject');
    const rejected = await exec("UPDATE quotation SET flow_status = 'Rejected', rejection_reason = ? WHERE id = ? AND flow_status = 'Submitted'", [r.slice(0, 250), quotationId]);
    if (rejected.affectedRows === 0) throw new FlowError('Only submitted quotations can be decided', 409);
    await exec("UPDATE request SET status = 'Rejected' WHERE id = ?", [qt.request_id]);
    await exec("INSERT INTO approval (quotation_id, version_no, action, reason) VALUES (?,?,'Reject',?)", [quotationId, version, r.slice(0, 250)]);
    await addEvent(qt.request_id, 'rejected', `Rejected: ${r}`);
    return;
  }
  const accepted = await exec("UPDATE quotation SET flow_status = 'Accepted' WHERE id = ? AND flow_status = 'Submitted'", [quotationId]);
  if (accepted.affectedRows === 0) throw new FlowError('Only submitted quotations can be decided', 409);
  await exec("UPDATE request SET status = 'Accepted' WHERE id = ?", [qt.request_id]);
  await exec("INSERT INTO approval (quotation_id, version_no, action) VALUES (?,?,'Accept')", [quotationId, version]);
  await addEvent(qt.request_id, 'accepted', `Version ${version} accepted`);
}

function plusDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function customerLines(quotationId: number) {
  const lines = await linesOf(quotationId);
  return lines.map((l) => ({
    line_id: l.id,
    service: l.service_name,
    unit_of_measure: BASIS_LABEL[l.basis],
    quantity: l.quantity,
    unit_price: l.unit_price as number,
    amount: l.bill_amount,
    currency: l.currency
  }));
}

export async function sendPreview(quotationId: number, withAi = true) {
  const qt = await quotationOf(quotationId);
  if (qt.flow_status !== 'Accepted') throw new FlowError('Accept the quotation before sending');
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [qt.request_id]);
  const principal = await q1<any>('SELECT * FROM principal WHERE id = ?', [qt.principal_id]);
  const version = await nextVersionNo(quotationId);
  const lines = await customerLines(quotationId);
  const totals = revenueByCurrency(lines.map((l) => ({ currency: l.currency, bill: l.amount })));
  const origin = portLabel(await portById(qt.origin_port_id)) || String(req.data.origin ?? '');
  const destination = portLabel(await portById(qt.destination_port_id)) || String(req.data.destination ?? '');
  const validUntil = plusDays(30);
  const subject = noDash(`Quotation ${qt.number}, ${origin} to ${destination}${version > 1 ? `, version ${version}` : ''}`);
  let body = '';
  let fallback = false;
  if (!withAi) {
    return { to: principal.email, subject, body, version, revised: version > 1, valid_until: validUntil, lines, totals, fallback_used: false };
  }
  try {
    const out = await gatewayCall('/customer_email', {
      customer: principal.name,
      contact_name: req.data.contact_name ?? null,
      quotation_number: qt.number,
      version,
      origin,
      destination,
      mode: qt.mode,
      valid_until: validUntil,
      services: lines.map((l) => ({ service: l.service, unit_of_measure: l.unit_of_measure, unit_price: l.unit_price, amount: l.amount, currency: l.currency })),
      totals: Object.fromEntries(totals.map((t) => [t.currency, t.amount])),
      revised: version > 1
    });
    body = noDash(String(out.body ?? ''));
    fallback = Boolean(out.fallback_used);
  } catch {
    body = '';
  }
  if (!body.trim()) {
    const t = totals.map((x) => `${x.currency} ${x.amount.toFixed(2)}`).join(', ');
    body = `Dear ${req.data.contact_name ?? principal.name},\n\nPlease find our ${version > 1 ? 'revised ' : ''}quotation ${qt.number} for ${origin} to ${destination}. The total is ${t}. This quotation is valid until ${validUntil}.\n\nYou can review it in the portal and use Revise or negotiate if you would like any changes.\n\nBest regards,\nGAC Quotations`;
    fallback = true;
  }
  return {
    to: principal.email,
    subject,
    body,
    version,
    revised: version > 1,
    valid_until: validUntil,
    lines,
    totals,
    fallback_used: fallback
  };
}

export async function sendQuotation(quotationId: number, subject: string, body: string) {
  const qt = await quotationOf(quotationId);
  if (qt.flow_status !== 'Accepted') throw new FlowError('Accept the quotation before sending');
  const preview = await sendPreview(quotationId, false);
  const version = preview.version;
  const principal = await q1<any>('SELECT * FROM principal WHERE id = ?', [qt.principal_id]);
  const terms = await q1<any>('SELECT text FROM branch_terms WHERE branch_id = ?', [qt.branch_id]);
  const finalSubject = noDash(subject || preview.subject);
  const finalBody = noDash(body.trim() || `Dear ${principal.name},

Please find our ${version > 1 ? 'revised ' : ''}quotation ${qt.number}. It is valid until ${preview.valid_until}.

Best regards,
GAC Quotations`);
  const snapshot = {
    version_no: version,
    valid_until: preview.valid_until,
    terms: terms?.text ?? '',
    lines: preview.lines,
    totals: preview.totals,
    email: { subject: finalSubject, body: finalBody, to: principal.email }
  };
  const claimed = await exec("UPDATE quotation SET flow_status = 'Sent', valid_until = ? WHERE id = ? AND flow_status = 'Accepted'", [preview.valid_until, quotationId]);
  if (claimed.affectedRows === 0) throw new FlowError('This quotation was already sent', 409);
  await exec('INSERT INTO quotation_version (quotation_id, request_id, version_no, snapshot, sent_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [quotationId, qt.request_id, version, JSON.stringify(snapshot)]);
  await exec("INSERT INTO outgoing_email (kind, request_id, quotation_id, version_no, to_email, subject, body, fallback_used) VALUES ('quotation',?,?,?,?,?,?,?)", [qt.request_id, quotationId, version, principal.email, finalSubject, finalBody, body.trim() ? 0 : 1]);
  await exec("UPDATE request SET status = 'Sent to customer', sent_at = UTC_TIMESTAMP() WHERE id = ?", [qt.request_id]);
  await exec("UPDATE revision_request SET status = 'answered' WHERE request_id = ? AND status = 'open'", [qt.request_id]);
  await addEvent(qt.request_id, 'sent', version > 1 ? `Revised quotation version ${version} sent to the customer` : 'Quotation sent to the customer');
  return { version };
}

export async function createRevision(requestId: number, principalId: number, input: { message?: string; targets?: Record<string, unknown> }) {
  const req = await q1<any>('SELECT * FROM request WHERE id = ? AND principal_id = ? AND source = ?', [requestId, principalId, 'Portal']);
  if (!req || !req.quotation_id) throw new FlowError('Request not found', 404);
  const latest = await q1<any>('SELECT * FROM quotation_version WHERE quotation_id = ? ORDER BY version_no DESC LIMIT 1', [req.quotation_id]);
  if (!latest) throw new FlowError('No quotation to revise yet');
  const open = await q1<any>("SELECT id FROM revision_request WHERE request_id = ? AND status = 'open'", [requestId]);
  if (open) throw new FlowError('A revision has already been requested');
  const validIds = new Set<number>(latest.snapshot.lines.map((l: any) => l.line_id));
  const targets: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.targets ?? {})) {
    if (v === '' || v === null || v === undefined) continue;
    const n = Number(v);
    if (!validIds.has(Number(k)) || !(n > 0)) throw new FlowError('Enter valid target prices');
    targets[k] = n;
  }
  const message = (input.message ?? '').trim().slice(0, 1000);
  if (!message && Object.keys(targets).length === 0) throw new FlowError('Add a message or at least one target price');
  await exec('INSERT INTO revision_request (request_id, version_no, message, targets) VALUES (?,?,?,?)', [requestId, latest.version_no, message || null, JSON.stringify(targets)]);
  await exec("UPDATE request SET status = 'Revision requested' WHERE id = ?", [requestId]);
  await exec("UPDATE quotation SET flow_status = 'Draft' WHERE id = ?", [req.quotation_id]);
  await addEvent(requestId, 'revision', `Customer requested a revision of version ${latest.version_no}`);
}

export async function requestsList(opts: { principalId?: number } = {}) {
  const rows = await q<any>(
    `SELECT r.*, p.name AS principal_name FROM request r LEFT JOIN principal p ON p.id = r.principal_id ${opts.principalId ? 'WHERE r.principal_id = ?' : ''} ORDER BY r.id DESC`,
    opts.principalId ? [opts.principalId] : []
  );
  return rows;
}
