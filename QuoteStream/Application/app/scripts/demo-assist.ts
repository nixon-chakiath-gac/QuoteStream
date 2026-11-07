export {};

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

async function call(role: 'customer' | 'gac', method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', cookie: `role=${role}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${json?.error ?? res.status}`);
  return json;
}

async function main() {
  const common = { mode: 'Courier', origin: 'Shanghai (SHA)', destination: 'Dubai (DXB)', incoterm: 'DAP', cargo_mode: 'totals', unit_system: 'metric', packages: [], ready_date: '2026-11-16' };
  const first = await call('customer', 'POST', '/api/portal/requests', { ...common, description: 'Spare parts', total_quantity: 2, total_weight_kg: 20, total_volume_cbm: 0.05 });
  const second = await call('customer', 'POST', '/api/portal/requests', { ...common, description: 'Spare parts, heavy lot', total_quantity: 40, total_weight_kg: 70000, total_volume_cbm: 60 });
  const list = await call('gac', 'GET', '/api/gac/requests');
  const row = list.find((r: any) => r.id === second.id);
  console.log(`Created ${first.number} (20 kg) and ${second.number} (70,000 kg), Courier, Shanghai to Dubai, Blue Dune Energy.`);
  console.log(`Open the draft of ${second.number}: /gac/quotations/${row?.quotation_id}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
