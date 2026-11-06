import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../server.js';
import { ProviderError } from '../providers.js';
import { loadSamples } from './helpers.js';

const samples = loadSamples();
let calls = 0;
let mode = 'good';
let svc;
let base;

const good05 = {
  customer: 'Random Trading',
  contact_name: 'Alex',
  contact_email: 'alex@randomtrading.demo',
  mode: 'Air',
  origin: 'Shanghai',
  destination: 'Dubai',
  incoterm: 'FOB',
  job_type: 'Supplier to WH',
  service: null,
  pos: [],
  total_weight_kg: 500,
  total_volume_cbm: 3,
  requested_services: ['Rocket Launch'],
  notes: ''
};

before(async () => {
  svc = createService({
    persist: false,
    env: { DATA_DIR: 'unused' },
    callProvider: async (provider, model, system) => {
      calls++;
      if (mode === 'down') throw new ProviderError('The provider is not reachable', 'unreachable');
      if (mode === 'junk') return 'not json at all';
      if (system.includes('customer facing email')) {
        return JSON.stringify({ subject: 'x', body: 'Dear Sam, total USD 100.00, valid until 2026-12-31 \u2014 thanks. Our profit is fine.' });
      }
      return JSON.stringify(good05);
    }
  });
  await new Promise((r) => svc.server.listen(0, r));
  base = `http://localhost:${svc.server.address().port}`;
});

after(() => svc.server.close());

async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
}

test('extract via mocked provider is guarded', async () => {
  const { json } = await post('/extract', samples['05']);
  assert.equal(json.fallback_used, false);
  assert.equal(json.incoterm, null);
  assert.equal(json.job_type, null);
  assert.equal(json.total_weight_kg, null);
  assert.deepEqual(json.requested_services, []);
  assert.deepEqual(json.missing, ['incoterm', 'total_weight', 'total_volume']);
  assert.equal(json.meta.task, 'extract');
  assert.equal(json.meta.cached, false);
});

test('cache hit does not call the provider again and keeps the flag', async () => {
  const before = calls;
  const { json } = await post('/extract', samples['05']);
  assert.equal(calls, before);
  assert.equal(json.meta.cached, true);
  assert.equal(json.fallback_used, false);
});

test('provider down uses fallback, says why, and does not cache it', async () => {
  mode = 'down';
  const a = await post('/extract', samples['01']);
  assert.equal(a.json.fallback_used, true);
  assert.equal(a.json.total_weight_kg, 585);
  assert.equal(a.json.meta.provider, 'rules');
  assert.equal(a.json.meta.reason, 'Gemini unavailable');
  const b = await post('/extract', samples['01']);
  assert.equal(b.json.meta.cached, false);
  mode = 'good';
  const before = calls;
  const c = await post('/extract', samples['01']);
  assert.equal(calls - before, 1);
  assert.equal(c.json.fallback_used, false);
  assert.equal(c.json.meta.provider, 'gemini');
});

test('invalid twice falls back after one retry', async () => {
  mode = 'junk';
  const before = calls;
  const { json } = await post('/extract', samples['04']);
  assert.equal(calls - before, 2);
  assert.equal(json.fallback_used, true);
  assert.equal(json.customer, 'New Client Logistics');
  mode = 'good';
});

test('customer email forbidden word triggers template', async () => {
  const input = {
    customer: 'Acme',
    contact_name: 'Sam',
    quotation_number: 'Q-100',
    version: 2,
    origin: 'Shanghai',
    destination: 'Dubai',
    mode: 'Air',
    valid_until: '2026-12-31',
    services: [{ service: 'Airfreight', unit_of_measure: 'kg', unit_price: 1, amount: 100, currency: 'USD' }],
    totals: { USD: 100, EUR: 50 },
    revised: true
  };
  const { json } = await post('/customer_email', input);
  assert.equal(json.fallback_used, true);
  assert.equal(json.subject, 'Quotation Q-100, Shanghai to Dubai, version 2');
  assert.match(json.body, /Dear Sam/);
  assert.match(json.body, /USD 100\.00/);
  assert.match(json.body, /EUR 50\.00/);
  assert.match(json.body, /revised quotation/);
  assert.doesNotMatch(json.body, /[\u2013\u2014]/);
  assert.doesNotMatch(json.body, /\b(cost|margin|profit|internal)\b/i);
});

test('update_from_text with fallback when provider is down', async () => {
  mode = 'down';
  const { json } = await post('/update_from_text', {
    request: { customer: 'A', mode: 'Air', origin: 'X', destination: 'Y', incoterm: null, total_weight_kg: null, total_volume_cbm: null, extra: 1 },
    text: 'incoterm is FCA, weight 450 kg, volume 3.1 cbm'
  });
  mode = 'good';
  assert.equal(json.fallback_used, true);
  assert.deepEqual(json.still_missing, []);
  assert.equal(json.request.extra, 1);
});

test('config, logs and validation', async () => {
  const bad = await fetch(base + '/config', { method: 'PUT', body: JSON.stringify({ provider: 'nope', model: 'x' }) });
  assert.equal(bad.status, 400);
  const ok = await fetch(base + '/config', { method: 'PUT', body: JSON.stringify({ provider: 'gemini', model: 'm1' }) });
  assert.deepEqual(await ok.json(), { provider: 'gemini', model: 'm1' });
  const cfg = await (await fetch(base + '/config')).json();
  assert.equal(cfg.providers.length, 4);
  await fetch(base + '/config', { method: 'PUT', body: JSON.stringify({ provider: 'ollama', model: 'llama3.1:8b' }) });
  const logs = await (await fetch(base + '/logs')).json();
  assert.ok(logs.logs.length >= 4);
  assert.equal(JSON.stringify(logs).includes('Shanghai'), false);
  const r = await post('/extract', { from: 'a@b.demo' });
  assert.equal(r.status, 400);
});
