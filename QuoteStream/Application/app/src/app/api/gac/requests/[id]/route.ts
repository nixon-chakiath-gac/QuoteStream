import { route, idOf, type IdCtx } from '@/lib/server/api';
import { q, q1 } from '@/lib/db';
import { FlowError } from '@/lib/server/flow';
import { laneLabel, summarizeCargo } from '@/lib/server/core';
import { missingLabels } from '@/lib/required';

export const dynamic = 'force-dynamic';

export const GET = route<IdCtx>('gac', async (_req, ctx) => {
  const id = await idOf(ctx);
  const r = await q1<any>('SELECT r.*, p.name AS principal_name FROM request r LEFT JOIN principal p ON p.id = r.principal_id WHERE r.id = ?', [id]);
  if (!r) throw new FlowError('Request not found', 404);
  const events = await q('SELECT type, text, created_at FROM request_event WHERE request_id = ? ORDER BY id', [id]);
  const quotation = r.quotation_id ? await q1<any>('SELECT id, number, flow_status FROM quotation WHERE id = ?', [r.quotation_id]) : null;
  return {
    id: r.id,
    number: r.number,
    source: r.source,
    status: r.status,
    customer: r.principal_name ?? r.customer_name,
    mode: r.mode,
    lane: await laneLabel(r.origin_port_id, r.destination_port_id, r.lane_text),
    data: r.data,
    email: r.email_json,
    missing: missingLabels(r.missing ?? []),
    cargo: r.mode ? summarizeCargo(r.data, r.mode) : null,
    quotation,
    events,
    created_at: r.created_at,
    ai_fallback: Boolean(r.ai_fallback)
  };
});
