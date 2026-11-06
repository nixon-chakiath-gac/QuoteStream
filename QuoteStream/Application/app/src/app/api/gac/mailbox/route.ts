import { route } from '@/lib/server/api';
import { q } from '@/lib/db';
import { missingLabels } from '@/lib/required';

export const dynamic = 'force-dynamic';

const CUSTOMER_STATUS: Record<string, string> = { 'Sent to customer': 'Quotation sent' };

export const GET = route('gac', async (req) => {
  const address = (new URL(req.url).searchParams.get('address') ?? '').trim().toLowerCase();
  const customers = await q<any>(
    "SELECT from_email AS address, MAX(company) AS company FROM sample_email WHERE from_email <> '' GROUP BY from_email ORDER BY MIN(file_name)"
  );
  if (!address) return { customers, templates: [], sent: [], inbox: [] };

  const templates = (
    await q<any>('SELECT id, label, expect_text, from_email, to_email, subject, body FROM sample_email WHERE LOWER(from_email) = ? ORDER BY file_name', [address])
  ).map((t) => ({ id: t.id, label: t.label, expect: t.expect_text, from: t.from_email, to: t.to_email, subject: t.subject, body: t.body }));

  const sentRows = await q<any>(
    "SELECT * FROM request WHERE source = 'Email' AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(email_json, '$.from'))) = ? ORDER BY id DESC",
    [address]
  );
  const sent = sentRows.map((r) => ({
    id: r.id,
    number: r.number,
    status: CUSTOMER_STATUS[r.status] ?? r.status,
    missing: missingLabels(r.missing ?? []),
    from: r.email_json?.from ?? '',
    to: r.email_json?.to ?? '',
    subject: r.email_json?.subject ?? '',
    body: r.email_json?.body ?? '',
    created_at: r.created_at,
    error_text: r.error_text,
    ai: r.ai_meta
      ? {
          provider: r.ai_meta.provider,
          model: r.ai_meta.model,
          seconds: r.ai_meta.duration_ms === null ? null : Math.round(r.ai_meta.duration_ms / 100) / 10,
          cached: Boolean(r.ai_meta.cached),
          fallback_used: Boolean(r.ai_fallback),
          reason: r.ai_meta.reason ?? null
        }
      : null
  }));

  const ids = sentRows.map((r) => r.id);
  const inboxRows = await q<any>(
    `SELECT o.id, o.kind, o.request_id, o.to_email, o.subject, o.body, o.sent_at, r.number AS request_number, r.status AS request_status, v.snapshot
     FROM outgoing_email o
     LEFT JOIN request r ON r.id = o.request_id
     LEFT JOIN quotation_version v ON v.quotation_id = o.quotation_id AND v.version_no = o.version_no
     WHERE LOWER(o.to_email) = ?${ids.length ? ' OR o.request_id IN (?)' : ''}
     ORDER BY o.id DESC`,
    ids.length ? [address, ids] : [address]
  );
  const latestAsk = new Map<number, number>();
  for (const o of inboxRows) if (o.kind === 'clarification' && !latestAsk.has(o.request_id)) latestAsk.set(o.request_id, o.id);
  const inbox = inboxRows.map((o) => ({
    id: o.id,
    kind: o.kind,
    request_id: o.request_id,
    request_number: o.request_number,
    request_status: o.request_status ? CUSTOMER_STATUS[o.request_status] ?? o.request_status : null,
    to: o.to_email,
    subject: o.subject,
    body: o.body,
    sent_at: o.sent_at,
    can_reply: o.kind === 'clarification' && o.request_status === 'Missing information' && latestAsk.get(o.request_id) === o.id,
    services:
      o.kind === 'quotation' && o.snapshot
        ? (o.snapshot.lines ?? []).map((l: any) => ({ service: l.service, unit: l.unit_of_measure, quantity: l.quantity, unit_price: l.unit_price, amount: l.amount, currency: l.currency }))
        : [],
    totals: o.kind === 'quotation' && o.snapshot ? (o.snapshot.totals ?? []).map((t: any) => ({ currency: t.currency, amount: t.amount })) : [],
    valid_until: o.snapshot?.valid_until ?? null
  }));

  return { customers, templates, sent, inbox };
});
