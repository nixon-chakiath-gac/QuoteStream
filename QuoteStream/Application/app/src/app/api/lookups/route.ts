import { route } from '@/lib/server/api';
import { listPorts } from '@/lib/server/core';
import { INCOTERMS, JOB_TYPES, SERVICES, SERVICE_TYPES, MODE_DESCRIPTIONS } from '@/lib/modes';
import { MODES } from '@/lib/weight';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = route('any', async (req) => {
  const mode = new URL(req.url).searchParams.get('mode');
  const ports = await listPorts(mode);
  const customers = await q('SELECT id, name FROM principal ORDER BY name');
  return {
    ports: ports.map((p) => ({ code: p.code, label: `${p.name} (${p.code})`, kind: p.kind })),
    incoterms: INCOTERMS,
    job_types: JOB_TYPES,
    service_types: SERVICE_TYPES,
    services: SERVICES,
    modes: MODES,
    mode_descriptions: MODE_DESCRIPTIONS,
    customers
  };
});
