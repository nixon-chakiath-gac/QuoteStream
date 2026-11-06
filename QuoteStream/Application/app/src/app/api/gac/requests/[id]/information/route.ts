import { route, body, idOf, type IdCtx } from '@/lib/server/api';
import { addInformation, FlowError } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('gac', async (req, ctx) => {
  const id = await idOf(ctx);
  const b = await body(req);
  const text = String(b.text ?? '').trim();
  if (!text) throw new FlowError('Type the missing information first');
  return addInformation(id, text);
});
