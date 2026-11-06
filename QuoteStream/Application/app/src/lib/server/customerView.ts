import { q, q1 } from '../db';
import { laneLabel, summarizeCargo } from './core';

export type CustomerStatus = 'Received' | 'Under review' | 'Quotation ready' | 'Revision requested';

export function customerStatus(req: any, hasVersion: boolean, openRevision: boolean): CustomerStatus {
  if (openRevision) return 'Revision requested';
  if (hasVersion) return 'Quotation ready';
  if (req.draft_opened_at || ['Submitted', 'Accepted', 'Rejected', 'Sent to customer', 'Revision requested'].includes(req.status)) return 'Under review';
  return 'Received';
}

function safeRequestData(req: any) {
  const d = req.data ?? {};
  const cargo = summarizeCargo(d, req.mode);
  return {
    mode: req.mode,
    origin: d.origin ?? null,
    destination: d.destination ?? null,
    incoterm: d.incoterm ?? null,
    description: d.description ?? null,
    ready_date: d.ready_date ?? null,
    pickup_needed: Boolean(d.pickup_needed),
    pickup_address: d.pickup_needed ? d.pickup_address ?? null : null,
    delivery_needed: Boolean(d.delivery_needed),
    delivery_address: d.delivery_needed ? d.delivery_address ?? null : null,
    load_type: d.load_type ?? null,
    container_type: d.container_type ?? null,
    container_count: d.container_count ?? null,
    vehicle_type: d.vehicle_type ?? null,
    service_description: d.service_description ?? null,
    cargo_mode: d.cargo_mode ?? 'totals',
    unit_system: d.unit_system ?? 'metric',
    packages: d.packages ?? [],
    total_quantity: cargo.totalQuantity,
    total_weight_kg: cargo.grossWeight,
    total_volume_cbm: cargo.volume,
    chargeable_weight: cargo.chargeableWeight,
    weight_note: cargo.hasRule ? cargo.formula : null
  };
}

export async function customerList(principalId: number) {
  const rows = await q<any>("SELECT * FROM request WHERE principal_id = ? AND source = 'Portal' ORDER BY id DESC", [principalId]);
  const out = [];
  for (const r of rows) {
    const v = r.quotation_id ? await q1<any>('SELECT COUNT(*) AS n FROM quotation_version WHERE quotation_id = ?', [r.quotation_id]) : { n: 0 };
    const rev = await q1<any>("SELECT id FROM revision_request WHERE request_id = ? AND status = 'open'", [r.id]);
    out.push({
      id: r.id,
      number: r.number,
      mode: r.mode,
      lane: await laneLabel(r.origin_port_id, r.destination_port_id, r.lane_text),
      created_at: r.created_at,
      status: customerStatus(r, (v?.n ?? 0) > 0, Boolean(rev))
    });
  }
  return out;
}

export async function customerDetail(principalId: number, requestId: number, version?: number) {
  const r = await q1<any>("SELECT * FROM request WHERE id = ? AND principal_id = ? AND source = 'Portal'", [requestId, principalId]);
  if (!r) return null;
  const versions = r.quotation_id
    ? await q<any>('SELECT version_no, sent_at, snapshot FROM quotation_version WHERE quotation_id = ? ORDER BY version_no', [r.quotation_id])
    : [];
  const rev = await q1<any>("SELECT version_no, created_at FROM revision_request WHERE request_id = ? AND status = 'open'", [r.id]);
  const latest = versions.length > 0 ? versions[versions.length - 1] : null;
  const chosen = version ? versions.find((v: any) => v.version_no === version) ?? latest : latest;
  const myRevisions = await q<any>('SELECT version_no, message, targets, created_at FROM revision_request WHERE request_id = ? ORDER BY id', [r.id]);
  return {
    id: r.id,
    number: r.number,
    created_at: r.created_at,
    lane: await laneLabel(r.origin_port_id, r.destination_port_id, r.lane_text),
    status: customerStatus(r, versions.length > 0, Boolean(rev)),
    details: safeRequestData(r),
    versions: versions.map((v: any) => ({ version_no: v.version_no, sent_at: v.sent_at, latest: v.version_no === latest?.version_no })),
    quotation: chosen
      ? {
          version_no: chosen.version_no,
          is_latest: chosen.version_no === latest?.version_no,
          sent_at: chosen.sent_at,
          valid_until: chosen.snapshot.valid_until,
          terms: chosen.snapshot.terms,
          lines: chosen.snapshot.lines,
          totals: chosen.snapshot.totals,
          email: chosen.snapshot.email
        }
      : null,
    revision_open: rev ? { version_no: rev.version_no } : null,
    my_revisions: myRevisions.map((m: any) => ({ version_no: m.version_no, message: m.message, targets: m.targets, created_at: m.created_at }))
  };
}
