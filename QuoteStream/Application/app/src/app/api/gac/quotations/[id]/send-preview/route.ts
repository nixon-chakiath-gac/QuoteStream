import { route, idOf, type IdCtx } from '@/lib/server/api';
import { sendPreview } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('gac', async (_req, ctx) => {
  return sendPreview(await idOf(ctx));
});
