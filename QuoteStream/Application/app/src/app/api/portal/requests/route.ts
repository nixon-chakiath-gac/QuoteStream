import { route, body } from '@/lib/server/api';
import { customerPrincipalId } from '@/lib/server/auth';
import { customerList } from '@/lib/server/customerView';
import { createPortalRequest } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const GET = route('customer', async () => {
  return customerList(await customerPrincipalId());
});

export const POST = route('customer', async (req) => {
  const b = await body(req);
  return createPortalRequest(b);
});
