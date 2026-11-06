import { route, idOf, type IdCtx } from '@/lib/server/api';
import { submitQuotation } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('gac', async (_req, ctx) => {
  await submitQuotation(await idOf(ctx));
  return { ok: true };
});
