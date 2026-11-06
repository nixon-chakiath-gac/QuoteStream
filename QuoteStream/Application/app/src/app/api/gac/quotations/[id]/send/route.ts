import { route, body, idOf, type IdCtx } from '@/lib/server/api';
import { sendQuotation } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('gac', async (req, ctx) => {
  const id = await idOf(ctx);
  const b = await body(req);
  return sendQuotation(id, String(b.subject ?? ''), String(b.body ?? ''));
});
