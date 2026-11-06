import { route } from '@/lib/server/api';
import { requestsList } from '@/lib/server/flow';
import { laneLabel } from '@/lib/server/core';
import { missingLabels } from '@/lib/required';

export const dynamic = 'force-dynamic';

function actionFor(status: string): string | null {
  if (status === 'Missing information') return 'Add Information';
  if (['Draft ready', 'Submitted', 'Rejected', 'Revision requested'].includes(status)) return 'Edit Draft';
  if (['Accepted', 'Sent to customer'].includes(status)) return 'View';
  return null;
}

export const GET = route('gac', async (req) => {
  const source = new URL(req.url).searchParams.get('source');
  const rows = await requestsList();
  const out = [];
  for (const r of rows) {
    if (source && r.source !== source) continue;
    out.push({
      id: r.id,
      number: r.number,
      created_at: r.created_at,
      source: r.source,
      customer: r.principal_name ?? r.customer_name ?? 'Unknown',
      mode: r.mode,
      lane: await laneLabel(r.origin_port_id, r.destination_port_id, r.lane_text),
      status: r.status,
      missing: r.source === 'Email' ? missingLabels(r.missing ?? []) : [],
      action: actionFor(r.status),
      quotation_id: r.quotation_id,
      ai_fallback: Boolean(r.ai_fallback),
      error_text: r.error_text,
      subject: r.email_json?.subject ?? null
    });
  }
  return out;
});
