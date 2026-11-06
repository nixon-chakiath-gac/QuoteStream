import { route, idOf, type IdCtx } from '@/lib/server/api';
import { customerPrincipalId } from '@/lib/server/auth';
import { customerDetail } from '@/lib/server/customerView';
import { FlowError } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const GET = route<IdCtx>('customer', async (req, ctx) => {
  const id = await idOf(ctx);
  const v = Number(new URL(req.url).searchParams.get('version')) || undefined;
  const d = await customerDetail(await customerPrincipalId(), id, v);
  if (!d) throw new FlowError('Request not found', 404);
  return d;
});
