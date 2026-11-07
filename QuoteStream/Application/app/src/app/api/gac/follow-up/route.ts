import { route, body } from '@/lib/server/api';
import { FlowError } from '@/lib/server/flow';
import { gatewayCall } from '@/lib/server/gateway';
import { followUpFacts, followUpTemplate } from '@/lib/dashboard/followup';

export const dynamic = 'force-dynamic';

type Draft = { quotation: string; to: string; subject: string; body: string; fallback_used: boolean; reason: string | null };

const cache = new Map<string, Draft>();

export const POST = route('gac', async (req) => {
  const b = await body(req);
  const facts = followUpFacts(String(b.id ?? ''));
  if (!facts) throw new FlowError('This quotation does not need a follow-up', 404);
  const hit = cache.get(facts.id);
  if (hit) return hit;
  let out: Draft;
  try {
    const r = await gatewayCall<any>(
      '/follow_up',
      {
        quotation_number: facts.id,
        customer: facts.customer,
        mode: facts.mode,
        origin: facts.origin,
        destination: facts.destination,
        kind: facts.kind,
        days: facts.days,
        valid_until: facts.validUntil ?? ''
      },
      'POST',
      20000
    );
    out = { quotation: facts.id, to: facts.to, subject: r.subject, body: r.body, fallback_used: Boolean(r.fallback_used), reason: r.meta?.reason ?? null };
  } catch {
    out = { quotation: facts.id, to: facts.to, ...followUpTemplate(facts), fallback_used: true, reason: 'AI service unreachable' };
  }
  if (!out.fallback_used) cache.set(facts.id, out);
  return out;
});
