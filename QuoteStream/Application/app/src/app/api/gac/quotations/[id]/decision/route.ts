import { route, body, idOf, type IdCtx } from '@/lib/server/api';
import { decide, FlowError } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('gac', async (req, ctx) => {
  const id = await idOf(ctx);
  const b = await body(req);
  if (b.action !== 'Accept' && b.action !== 'Reject') throw new FlowError('Unknown action');
  await decide(id, b.action, b.reason);
  return { ok: true };
});
