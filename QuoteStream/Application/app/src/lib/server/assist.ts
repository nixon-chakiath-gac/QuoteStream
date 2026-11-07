import { q, q1 } from '../db';
import { BASIS_LABEL, fmt, type Basis } from '../money';
import { median, MIN_MARKET_QUOTATIONS } from '../pricing';
import { linesOf, summarizeCargo } from './core';
import { FlowError } from './flow';

export const FLAG_PERCENT = 10;

export const WEIGHT_RANGES: Record<string, [number, number]> = {
  Courier: [1, 70],
  'Hand Carry': [1, 30],
  Air: [1, 20000]
};

export type Why = {
  line_id: number;
  kind: 'price' | 'none';
  text: string;
  flag: string | null;
};

export type Check = {
  kind: 'weight' | 'duplicate';
  text: string;
  request_id: number | null;
  request_number: string | null;
};

function day(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function price(currency: string, v: number, basis: Basis) {
  return `${currency} ${fmt(v)} ${BASIS_LABEL[basis]}`;
}

function kg(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function since(seconds: number) {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}

export async function assistFor(quotationId: number) {
  const qt = await q1<any>('SELECT * FROM quotation WHERE id = ?', [quotationId]);
  if (!qt || !qt.request_id) throw new FlowError('Quotation not found', 404);
  const req = await q1<any>('SELECT *, UNIX_TIMESTAMP(created_at) AS created_ts FROM request WHERE id = ?', [qt.request_id]);
  const principal = await q1<any>('SELECT name FROM principal WHERE id = ?', [qt.principal_id]);
  const customer = principal?.name ?? 'this customer';
  const lines = await linesOf(quotationId);

  const templates = await q<any>(
    'SELECT id FROM service_template WHERE principal_id = ? AND mode = ? AND (origin_port_id <=> NULL OR origin_port_id <=> ?) AND (destination_port_id <=> NULL OR destination_port_id <=> ?) ORDER BY id',
    [qt.principal_id, qt.mode, qt.origin_port_id, qt.destination_port_id]
  );
  const templateId = templates[0]?.id ?? null;
  const tplServices = templateId
    ? new Set((await q<any>('SELECT s.name FROM service_template_detail d JOIN service s ON s.id = d.service_id WHERE d.template_id = ? AND d.unit_price IS NOT NULL', [templateId])).map((r) => r.name as string))
    : new Set<string>();

  const why: Why[] = [];
  for (const l of lines) {
    const past = await q<any>(
      `SELECT c.basis, c.unit_price, c.currency, c.quotation_id, qt.number, qt.principal_id, UNIX_TIMESTAMP(qt.created_at) AS ts
       FROM quotation_product_cost c JOIN quotation qt ON qt.id = c.quotation_id
       WHERE qt.status = 'Secured' AND qt.id <> ? AND qt.mode = ? AND qt.origin_port_id <=> ? AND qt.destination_port_id <=> ? AND c.service_name = ? AND c.unit_price IS NOT NULL`,
      [quotationId, qt.mode, qt.origin_port_id, qt.destination_port_id, l.service_name]
    );
    const own = past.filter((p) => p.principal_id === qt.principal_id);
    const similar = past.filter((p) => p.basis === l.basis && p.currency === l.currency);
    const similarCount = new Set(similar.map((p) => p.quotation_id)).size;

    if (l.unit_price === null || l.price_source === 'Rate needed') {
      if (l.price_source !== 'Rate needed') {
        why.push({ line_id: l.id, kind: 'none', text: 'The price was cleared on this line. Add a rate to submit.', flag: null });
        continue;
      }
      const parts = [
        tplServices.has(l.service_name) ? 'the template line has no price' : 'no template line',
        own.length > 0 ? 'no usable Secured quotation for this customer' : 'no earlier Secured quotation for this customer',
        similarCount === 0 ? `fewer than ${MIN_MARKET_QUOTATIONS} similar quotations` : `only ${similarCount} similar quotation, fewer than ${MIN_MARKET_QUOTATIONS}`
      ];
      const text = `${parts[0][0].toUpperCase()}${parts[0].slice(1)}, ${parts[1]}, and ${parts[2]}. Add a rate to submit.`;
      why.push({ line_id: l.id, kind: 'none', text, flag: null });
      continue;
    }

    const sentences: string[] = [];
    if (l.price_source === 'Template') sentences.push(`Source: the ${customer} service template for ${qt.mode}.`);
    else if (l.price_source === 'Past quotation') {
      const ref = own.find((p) => p.number === l.source_ref) ?? null;
      sentences.push(`Source: the latest Secured quotation for ${customer}${l.source_ref ? `, ${l.source_ref}` : ''}${ref ? ` from ${day(Number(ref.ts))}` : ''}.`);
    } else if (l.price_source === 'Market median') sentences.push(`Source: the median of ${similarCount || 'several'} similar Secured quotations on this lane.`);
    else if (l.price_source === 'Accepted from note') sentences.push('Source: a note accepted on this draft.');
    else if (l.price_source === 'Manual') sentences.push('Source: entered by hand on this draft.');
    else sentences.push(`Source: ${l.price_source}.`);

    let flag: string | null = null;
    if (similarCount >= MIN_MARKET_QUOTATIONS) {
      const med = median(similar.map((p) => Number(p.unit_price)));
      const pct = med > 0 ? Math.round(((Number(l.unit_price) - med) / med) * 100) : 0;
      const medText = `The median of ${similarCount} similar Secured quotations is ${price(l.currency, med, l.basis)}`;
      if (Math.abs(pct) > FLAG_PERCENT) {
        flag = `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} median`;
        sentences.push(`${medText}, so this line is ${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} it.`);
      } else if (pct === 0 && l.price_source === 'Market median') {
        sentences.push(`That median is ${price(l.currency, med, l.basis)}.`);
      } else if (pct === 0) sentences.push(`Matches the median of ${similarCount} similar Secured quotations.`);
      else sentences.push(`${medText}, within ${FLAG_PERCENT}% of this line.`);
    } else if (past.length > 0 && similar.length === 0) {
      sentences.push('Similar quotations use a different price basis, so there is no comparison.');
    }
    if (l.confidence && l.confidence !== 'None') sentences.push(`Confidence: ${l.confidence}.`);
    why.push({ line_id: l.id, kind: 'price', text: sentences.join(' '), flag });
  }

  const checks: Check[] = [];
  const cargo = summarizeCargo(req.data ?? {}, qt.mode);
  const range = WEIGHT_RANGES[qt.mode];
  const weight = Number((cargo.hasRule ? cargo.chargeableWeight : cargo.grossWeight) ?? 0);
  if (range && weight > 0 && (weight < range[0] || weight > range[1])) {
    checks.push({
      kind: 'weight',
      text: `Weight ${kg(weight)} kg looks ${weight > range[1] ? 'high' : 'low'} for a ${qt.mode} shipment (usual range ${kg(range[0])} to ${kg(range[1])} kg).`,
      request_id: null,
      request_number: null
    });
  }

  if (req.principal_id && req.mode && (req.origin_port_id || req.lane_text)) {
    const dup = await q1<any>(
      `SELECT id, number, source, UNIX_TIMESTAMP(created_at) AS ts, UNIX_TIMESTAMP() AS now_ts FROM request
       WHERE id <> ? AND principal_id = ? AND mode = ?
         AND ((? IS NOT NULL AND origin_port_id <=> ? AND destination_port_id <=> ?) OR (? IS NULL AND lane_text = ?))
         AND created_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR
       ORDER BY ABS(TIMESTAMPDIFF(SECOND, created_at, FROM_UNIXTIME(?))) LIMIT 1`,
      [req.id, req.principal_id, req.mode, req.origin_port_id, req.origin_port_id, req.destination_port_id, req.origin_port_id, req.lane_text, Number(req.created_ts)]
    );
    if (dup) {
      checks.push({
        kind: 'duplicate',
        text: `A similar request from the same customer arrived by ${dup.source} ${since(Number(dup.now_ts) - Number(dup.ts))} (${dup.number}).`,
        request_id: dup.id,
        request_number: dup.number
      });
    }
  }

  return { why, checks };
}
