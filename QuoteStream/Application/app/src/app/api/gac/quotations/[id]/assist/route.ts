import { route, idOf, type IdCtx } from '@/lib/server/api';
import { assistFor } from '@/lib/server/assist';

export const dynamic = 'force-dynamic';

export const GET = route<IdCtx>('gac', async (_req, ctx) => {
  return assistFor(await idOf(ctx));
});
