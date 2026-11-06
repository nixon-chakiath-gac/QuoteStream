import { route, body, idOf, type IdCtx } from '@/lib/server/api';
import { customerPrincipalId } from '@/lib/server/auth';
import { createRevision } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('customer', async (req, ctx) => {
  const id = await idOf(ctx);
  const b = await body(req);
  await createRevision(id, await customerPrincipalId(), { message: b.message, targets: b.targets });
  return { ok: true };
});
