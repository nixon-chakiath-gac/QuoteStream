import { route, body } from '@/lib/server/api';
import { loadDraft, removeLine, updateLine, FlowError } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; lineId: string }> };

async function ids(ctx: Ctx) {
  const p = await ctx.params;
  const id = Number(p.id);
  const lineId = Number(p.lineId);
  if (!Number.isInteger(id) || !Number.isInteger(lineId)) throw new FlowError('Not found', 404);
  return { id, lineId };
}

export const PATCH = route<Ctx>('gac', async (req, ctx) => {
  const { id, lineId } = await ids(ctx);
  const change = await updateLine(id, lineId, await body(req));
  return { change, draft: await loadDraft(id, { markOpened: false }) };
});

export const DELETE = route<Ctx>('gac', async (_req, ctx) => {
  const { id, lineId } = await ids(ctx);
  const change = await removeLine(id, lineId);
  return { change, draft: await loadDraft(id, { markOpened: false }) };
});
