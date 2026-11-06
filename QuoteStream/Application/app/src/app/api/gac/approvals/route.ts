import { route } from '@/lib/server/api';
import { q } from '@/lib/db';
import { linesOf, laneLabel } from '@/lib/server/core';
import { revenueByCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

const TAB: Record<string, string> = { Waiting: 'Submitted', Accepted: 'Accepted', Rejected: 'Rejected', Sent: 'Sent' };

export const GET = route('gac', async (req) => {
  const tab = new URL(req.url).searchParams.get('tab') ?? 'Waiting';
  const rows = await q<any>(
    `SELECT qt.*, p.name AS principal_name, r.number AS request_number, r.source AS request_source
     FROM quotation qt JOIN principal p ON p.id = qt.principal_id JOIN request r ON r.id = qt.request_id
     WHERE qt.request_id IS NOT NULL ORDER BY qt.id DESC`
  );
  const counts: Record<string, number> = { Waiting: 0, Accepted: 0, Rejected: 0, Sent: 0 };
  const items = [];
  for (const r of rows) {
    for (const [t, fs] of Object.entries(TAB)) if (r.flow_status === fs) counts[t]++;
    if (r.flow_status !== TAB[tab]) continue;
    const lines = await linesOf(r.id);
    const versions = await q<any>('SELECT MAX(version_no) AS v FROM quotation_version WHERE quotation_id = ?', [r.id]);
    items.push({
      id: r.id,
      number: r.number,
      request_number: r.request_number,
      request_id: r.request_id,
      source: r.request_source,
      customer: r.principal_name,
      mode: r.mode,
      lane: await laneLabel(r.origin_port_id, r.destination_port_id),
      revenue: revenueByCurrency(lines.map((l) => ({ currency: l.currency, bill: l.bill_amount }))),
      rejection_reason: r.rejection_reason,
      version: tab === 'Sent' ? versions[0]?.v ?? 1 : (versions[0]?.v ?? 0) + 1
    });
  }
  return { counts, items };
});
