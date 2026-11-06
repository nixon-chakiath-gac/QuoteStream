import { q, q1, exec, nextNumber } from '../db';
import { chargeableWeight, isMode, packageTotals, r2, type Mode, type PackageRow } from '../weight';
import { calcLine, quantityFor, type Basis } from '../money';
import { DEFAULT_SERVICES, serviceBasis } from '../modes';
import { resolvePrice, type PastCandidate, type PriceCandidate } from '../pricing';

export type ReqData = Record<string, any>;

export type PortRow = { id: number; code: string; name: string; city: string; country: string; kind: string };

export function portLabel(p: PortRow | null | undefined): string {
  return p ? `${p.name} (${p.code})` : '';
}

export async function listPorts(mode?: string | null): Promise<PortRow[]> {
  const rows = await q<PortRow>('SELECT * FROM port ORDER BY name');
  if (mode === 'Air') return rows.filter((p) => p.kind === 'air' || p.kind === 'both');
  if (mode === 'Sea') return rows.filter((p) => p.kind === 'sea' || p.kind === 'both');
  return rows;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function resolvePort(text: unknown, mode: string | null): Promise<number | null> {
  if (typeof text !== 'string' || !text.trim()) return null;
  const ports = await q<PortRow>('SELECT * FROM port');
  const code = text.match(/\(([A-Za-z]{3})\)/)?.[1]?.toUpperCase() ?? (/^[A-Za-z]{3}$/.test(text.trim()) ? text.trim().toUpperCase() : null);
  if (code) {
    const byCode = ports.find((p) => p.code === code);
    if (byCode) return byCode.id;
  }
  const n = norm(text.replace(/\([^)]*\)/g, ''));
  if (!n) return null;
  const matches = ports.filter((p) => norm(p.name) === n || norm(p.city) === n);
  if (matches.length === 0) return null;
  const want = mode === 'Air' ? 'air' : mode === 'Sea' ? 'sea' : null;
  if (want) {
    const exact = matches.find((p) => p.kind === want) ?? matches.find((p) => p.kind === 'both');
    if (exact) return exact.id;
  }
  const nameMatch = matches.find((p) => norm(p.name) === n);
  return (nameMatch ?? matches[0]).id;
}

export async function portById(id: number | null): Promise<PortRow | null> {
  if (!id) return null;
  return q1<PortRow>('SELECT * FROM port WHERE id = ?', [id]);
}

export async function laneLabel(originId: number | null, destId: number | null, fallbackText?: string | null): Promise<string> {
  const o = await portById(originId);
  const d = await portById(destId);
  if (o && d) return `${portLabel(o)} to ${portLabel(d)}`;
  return fallbackText ?? '';
}

export async function resolvePrincipal(name: string | null, email: string | null): Promise<{ id: number; name: string; branch_id: number }> {
  const domain = email && email.includes('@') ? email.split('@')[1].toLowerCase() : null;
  if (name) {
    const byName = await q1<any>('SELECT id, name, branch_id FROM principal WHERE LOWER(name) = LOWER(?)', [name.trim()]);
    if (byName) return byName;
  }
  if (domain) {
    const byDomain = await q1<any>('SELECT id, name, branch_id FROM principal WHERE domain = ?', [domain]);
    if (byDomain) return byDomain;
  }
  const finalName = name?.trim() || (domain ? domain.split('.')[0] : 'Unknown customer');
  const id = (await exec('INSERT INTO principal (name, email, domain, branch_id) VALUES (?,?,?,1)', [finalName, email ?? `contact@${domain ?? 'unknown.demo'}`, domain])).insertId;
  return { id, name: finalName, branch_id: 1 };
}

export function cargoOf(data: ReqData, mode: string | null) {
  const m: Mode = isMode(mode) ? mode : 'Air';
  let qty = Number(data.total_quantity) || (Array.isArray(data.pos) && data.pos.length ? data.pos.length : 1);
  let kg = Number(data.total_weight_kg) || 0;
  let cbm = Number(data.total_volume_cbm) || 0;
  if (data.cargo_mode === 'packages' && Array.isArray(data.packages) && data.packages.length > 0) {
    const t = packageTotals(data.packages as PackageRow[], data.unit_system === 'imperial' ? 'imperial' : 'metric');
    kg = t.weightKg;
    cbm = t.cbm;
    qty = t.quantity || qty;
  }
  const c = chargeableWeight(m, kg, cbm);
  return { ...c, totalQuantity: qty };
}

export type LineRow = {
  id: number;
  quotation_id: number;
  service_name: string;
  basis: Basis;
  currency: string;
  quantity: number;
  unit_price: number | null;
  bill_amount: number;
  est_unit_cost: number | null;
  est_cost: number;
  price_source: string;
  source_ref: string | null;
  confidence: string;
  sort_order: number;
};

export async function buildLines(opts: {
  principalId: number;
  mode: Mode;
  originId: number | null;
  destId: number | null;
  requested: string[];
  cargo: ReturnType<typeof cargoOf>;
}) {
  const { principalId, mode, originId, destId } = opts;
  const templates = await q<any>(
    'SELECT * FROM service_template WHERE principal_id = ? AND mode = ? AND (origin_port_id <=> NULL OR origin_port_id <=> ?) AND (destination_port_id <=> NULL OR destination_port_id <=> ?) ORDER BY id',
    [principalId, mode, originId, destId]
  );
  const template = templates[0] ?? null;
  const tplLines = template
    ? await q<any>(
        'SELECT d.*, s.name AS service_name FROM service_template_detail d JOIN service s ON s.id = d.service_id WHERE d.template_id = ? ORDER BY d.sort_order',
        [template.id]
      )
    : [];
  const services: string[] = template ? tplLines.map((t: any) => t.service_name) : [...DEFAULT_SERVICES[mode]];
  for (const r of opts.requested) if (!services.includes(r)) services.push(r);

  const out: Omit<LineRow, 'id' | 'quotation_id'>[] = [];
  let order = 0;
  for (const svc of services) {
    const t = tplLines.find((x: any) => x.service_name === svc);
    const tpl: PriceCandidate | null = t
      ? { basis: t.basis, unit_price: Number(t.unit_price), est_unit_cost: Number(t.est_unit_cost), currency: template.currency }
      : null;
    const pastRows = await q<any>(
      `SELECT c.basis, c.unit_price, c.est_unit_cost, c.currency, c.quotation_id, qt.number AS quotation_number, UNIX_TIMESTAMP(qt.created_at) AS created_at, qt.principal_id
       FROM quotation_product_cost c JOIN quotation qt ON qt.id = c.quotation_id
       WHERE qt.status = 'Secured' AND qt.mode = ? AND qt.origin_port_id <=> ? AND qt.destination_port_id <=> ? AND c.service_name = ? AND c.unit_price IS NOT NULL`,
      [mode, originId, destId, svc]
    );
    const toCand = (r: any): PastCandidate => ({
      basis: r.basis,
      unit_price: Number(r.unit_price),
      est_unit_cost: r.est_unit_cost === null ? null : Number(r.est_unit_cost),
      currency: r.currency,
      quotation_id: r.quotation_id,
      quotation_number: r.quotation_number,
      created_at: Number(r.created_at)
    });
    const resolved = resolvePrice({
      template: tpl,
      customerPast: pastRows.filter((r) => r.principal_id === principalId).map(toCand),
      market: pastRows.map(toCand)
    });
    const basis: Basis = resolved.basis ?? serviceBasis(svc);
    const qty = quantityFor(basis, opts.cargo);
    const calc = calcLine(resolved.unit_price, resolved.est_unit_cost, qty);
    out.push({
      service_name: svc,
      basis,
      currency: resolved.currency ?? '',
      quantity: qty,
      unit_price: resolved.unit_price,
      bill_amount: calc.bill,
      est_unit_cost: resolved.est_unit_cost,
      est_cost: calc.cost,
      price_source: resolved.source,
      source_ref: resolved.source_ref,
      confidence: resolved.confidence,
      sort_order: order++
    });
  }
  const counts = new Map<string, number>();
  for (const l of out) if (l.currency) counts.set(l.currency, (counts.get(l.currency) ?? 0) + 1);
  const topCurrency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (template?.currency ?? 'USD');
  for (const l of out) if (!l.currency) l.currency = topCurrency;
  return { lines: out, currency: topCurrency };
}

export async function insertLine(quotationId: number, l: Omit<LineRow, 'id' | 'quotation_id'>) {
  return (
    await exec(
      `INSERT INTO quotation_product_cost (quotation_id, service_name, basis, currency, quantity, unit_price, bill_amount, est_unit_cost, est_cost, price_source, source_ref, confidence, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [quotationId, l.service_name, l.basis, l.currency, l.quantity, l.unit_price, l.bill_amount, l.est_unit_cost, l.est_cost, l.price_source, l.source_ref, l.confidence, l.sort_order]
    )
  ).insertId;
}

export async function linesOf(quotationId: number): Promise<LineRow[]> {
  return q<LineRow>('SELECT * FROM quotation_product_cost WHERE quotation_id = ? ORDER BY sort_order, id', [quotationId]);
}

export async function createDraft(requestId: number): Promise<number> {
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [requestId]);
  if (!req) throw new Error('Request not found');
  const data: ReqData = req.data;
  const mode = isMode(data.mode) ? data.mode : 'Air';
  const principal = await q1<any>('SELECT * FROM principal WHERE id = ?', [req.principal_id]);
  const originId = req.origin_port_id as number | null;
  const destId = req.destination_port_id as number | null;
  const cargo = cargoOf(data, mode);
  const requested: string[] = Array.isArray(data.requested_services) ? data.requested_services : [];
  const built = await buildLines({ principalId: principal.id, mode, originId, destId, requested, cargo });
  const number = await nextNumber('QT');
  const qid = (
    await exec(
      `INSERT INTO quotation (number, request_id, principal_id, branch_id, status, flow_status, mode, job_type, service_type, incoterm, origin_port_id, destination_port_id, billing_currency, gross_weight, volume, chargeable_weight, total_quantity)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        number,
        requestId,
        principal.id,
        principal.branch_id,
        'Pending',
        'Draft',
        mode,
        data.job_type ?? null,
        data.service ?? null,
        data.incoterm ?? null,
        originId,
        destId,
        built.currency,
        cargo.grossWeight,
        cargo.volume,
        cargo.chargeableWeight,
        cargo.totalQuantity
      ]
    )
  ).insertId;
  if (Array.isArray(data.pos)) {
    for (const po of data.pos) {
      const g = Number(po.weight_kg) || 0;
      const v = Number(po.volume_cbm) || 0;
      const pc = chargeableWeight(mode, g, v);
      await exec('INSERT INTO quotation_po (quotation_id, po_number, gross_weight, volume, chargeable_weight) VALUES (?,?,?,?,?)', [
        qid,
        String(po.po_number),
        g,
        v,
        pc.chargeableWeight
      ]);
    }
  }
  for (const l of built.lines) await insertLine(qid, l);
  await exec("UPDATE request SET quotation_id = ?, status = 'Draft ready' WHERE id = ?", [qid, requestId]);
  await exec("INSERT INTO request_event (request_id, type, text) VALUES (?,?,?)", [requestId, 'draft_created', `Draft quotation ${number} created`]);
  return qid;
}

export async function syncQuotation(requestId: number) {
  const req = await q1<any>('SELECT * FROM request WHERE id = ?', [requestId]);
  if (!req?.quotation_id) return;
  const data: ReqData = req.data;
  const mode = isMode(data.mode) ? data.mode : 'Air';
  const cargo = cargoOf(data, mode);
  const principal = await q1<any>('SELECT * FROM principal WHERE id = ?', [req.principal_id]);
  await exec(
    `UPDATE quotation SET principal_id = ?, branch_id = ?, mode = ?, job_type = ?, service_type = ?, incoterm = ?, origin_port_id = ?, destination_port_id = ?,
     gross_weight = ?, volume = ?, chargeable_weight = ?, total_quantity = ? WHERE id = ?`,
    [
      principal.id,
      principal.branch_id,
      mode,
      data.job_type ?? null,
      data.service ?? null,
      data.incoterm ?? null,
      req.origin_port_id,
      req.destination_port_id,
      cargo.grossWeight,
      cargo.volume,
      cargo.chargeableWeight,
      cargo.totalQuantity,
      req.quotation_id
    ]
  );
  await exec('DELETE FROM quotation_po WHERE quotation_id = ?', [req.quotation_id]);
  if (Array.isArray(data.pos)) {
    for (const po of data.pos) {
      const g = Number(po.weight_kg) || 0;
      const v = Number(po.volume_cbm) || 0;
      await exec('INSERT INTO quotation_po (quotation_id, po_number, gross_weight, volume, chargeable_weight) VALUES (?,?,?,?,?)', [
        req.quotation_id,
        String(po.po_number),
        g,
        v,
        chargeableWeight(mode, g, v).chargeableWeight
      ]);
    }
  }
  await requantify(req.quotation_id, cargo);
}

export async function requantify(quotationId: number, cargo: ReturnType<typeof cargoOf>) {
  const lines = await linesOf(quotationId);
  for (const l of lines) {
    const qty = quantityFor(l.basis, cargo);
    const c = calcLine(l.unit_price, l.est_unit_cost, qty);
    await exec('UPDATE quotation_product_cost SET quantity = ?, bill_amount = ?, est_cost = ? WHERE id = ?', [qty, c.bill, c.cost, l.id]);
  }
}

export function summarizeCargo(data: ReqData, mode: string | null) {
  const c = cargoOf(data, mode);
  return {
    grossWeight: c.grossWeight,
    volume: c.volume,
    volumeWeight: c.volumeWeight,
    chargeableWeight: c.chargeableWeight,
    billableWeight: c.billableWeight,
    hasRule: c.hasRule,
    formula: c.formula,
    totalQuantity: c.totalQuantity
  };
}

export { r2 };
