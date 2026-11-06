import { route, body, idOf, type IdCtx } from '@/lib/server/api';
import { addLine, loadDraft } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('gac', async (req, ctx) => {
  const id = await idOf(ctx);
  const change = await addLine(id, await body(req));
  return { change, draft: await loadDraft(id, { markOpened: false }) };
});
