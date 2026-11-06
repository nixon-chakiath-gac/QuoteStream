import { route, body } from '@/lib/server/api';
import { gatewayCall } from '@/lib/server/gateway';
import { FlowError } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const GET = route('gac', async () => {
  try {
    const config = await gatewayCall('/config', undefined, 'GET', 15000);
    const health = await gatewayCall('/health', undefined, 'GET', 20000).catch(() => null);
    return { available: true, config, health };
  } catch {
    return { available: false, config: null };
  }
});

export const POST = route('gac', async (req) => {
  const b = await body(req);
  try {
    const config = await gatewayCall('/config', { provider: b.provider, model: b.model }, 'PUT', 15000);
    const health = await gatewayCall('/health', undefined, 'GET', 60000);
    return { config, health };
  } catch {
    throw new FlowError('The AI service could not be reached', 502);
  }
});
