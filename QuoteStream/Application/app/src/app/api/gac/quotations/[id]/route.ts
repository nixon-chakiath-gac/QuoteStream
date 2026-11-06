import { route, body, idOf, type IdCtx } from '@/lib/server/api';
import { loadDraft, updateHeader } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const GET = route<IdCtx>('gac', async (req, ctx) => {
  const id = await idOf(ctx);
  const sp = new URL(req.url).searchParams;
  return loadDraft(id, { includeTest: sp.get('include_test') === '1', markOpened: sp.get('peek') !== '1' });
});

export const PATCH = route<IdCtx>('gac', async (req, ctx) => {
  const id = await idOf(ctx);
  await updateHeader(id, await body(req));
  return loadDraft(id, { markOpened: false });
});
