import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createService, PROMPT_VERSION } from '../server.js';
import { ProviderError, reasonText, post } from '../providers.js';
import { cacheKey } from '../cache.js';
import { appearsIn } from '../validate.js';
import { extractFallback } from '../fallback.js';
import { loadSamples } from './helpers.js';

const samples = loadSamples();

const good = {
  customer: 'Tulip Harbor Agency',
  contact_name: 'Deniz Aydin',
  contact_email: 'ops@tulipharbor.demo',
  mode: 'Air',
  origin: null,
  destination: 'Istanbul (IST)',
  incoterm: null,
  job_type: null,
  service: null,
  pos: [],
  total_weight_kg: null,
  total_volume_cbm: null,
  requested_services: [],
  notes: ''
};

function service(geminiMode, seen = [], answer = good) {
  return createService({
    persist: false,
    env: { DATA_DIR: 'unused', DEFAULT_PROVIDER: 'gemini', GEMINI_MODEL: 'flash-lite-test' },
    callProvider: async (provider, model, system, user, hint, schema) => {
      seen.push({ provider, model, schema: Boolean(schema) });
      if (geminiMode === 'no_key') throw new ProviderError('No API key is set for Gemini', 'no_key');
      if (geminiMode === 'quota') {
        const e = new ProviderError('The provider returned HTTP 429 RESOURCE_EXHAUSTED', 'http', 429);
        e.detail = 'RESOURCE_EXHAUSTED';
        throw e;
      }
      if (geminiMode === 'timeout') throw new ProviderError('The provider timed out', 'timeout');
      if (geminiMode === 'junk') return 'not json';
      return JSON.stringify(answer);
    }
  });
}

test('Gemini answers the stocklist email with the schema and the result is cached', async () => {
  const seen = [];
  const svc = service('good', seen);
  const r = (await svc.handle('POST', '/extract', samples['10'])).json;
  assert.equal(r.fallback_used, false);
  assert.equal(r.meta.provider, 'gemini');
  assert.equal(r.meta.model, 'flash-lite-test');
  assert.equal(r.meta.reason, null);
  assert.equal(r.mode, 'Air');
  assert.equal(r.destination, 'Istanbul (IST)');
  assert.equal(r.origin, null);
  assert.deepEqual(r.missing, ['origin', 'incoterm', 'total_weight', 'total_volume']);
  assert.equal(seen[0].schema, true);
  const again = (await svc.handle('POST', '/extract', samples['10'])).json;
  assert.equal(again.meta.cached, true);
  assert.equal(seen.length, 1);
});

test('Gemini without a key goes straight to the rule reader and never calls Ollama', async () => {
  const seen = [];
  const r = (await service('no_key', seen).handle('POST', '/extract', samples['10'])).json;
  assert.equal(r.fallback_used, true);
  assert.equal(r.meta.provider, 'rules');
  assert.equal(r.meta.reason, 'Gemini unavailable: no API key');
  assert.ok(seen.every((s) => s.provider === 'gemini'));
});

test('quota error keeps the real status and type, and is not cached', async () => {
  const seen = [];
  const svc = service('quota', seen);
  const r = (await svc.handle('POST', '/extract', samples['10'])).json;
  assert.equal(r.meta.provider, 'rules');
  assert.equal(r.meta.reason, 'Gemini unavailable: HTTP 429 RESOURCE_EXHAUSTED');
  assert.equal(r.mode, null);
  assert.equal(r.destination, null);
  const again = (await svc.handle('POST', '/extract', samples['10'])).json;
  assert.equal(again.meta.cached, false);
  assert.ok(seen.every((s) => s.provider === 'gemini'));
});

test('invalid JSON twice from Gemini is reported as an invalid answer', async () => {
  const seen = [];
  const r = (await service('junk', seen).handle('POST', '/extract', samples['01'])).json;
  assert.equal(seen.length, 2);
  assert.equal(r.meta.reason, 'Invalid answer from the model (Gemini)');
  assert.equal(r.total_weight_kg, 585);
});

test('timeout reason names the Gemini limit', async () => {
  const r = (await service('timeout').handle('POST', '/extract', samples['01'])).json;
  assert.equal(r.meta.reason, 'Gemini timed out after 10 s');
  assert.equal(reasonText({ provider: 'gemini', kind: 'timeout' }, { GEMINI_TIMEOUT_MS: '10000' }), 'Gemini timed out after 10 s');
});

test('a domain or email address is never kept as the customer name', async () => {
  const r = (await service('good', [], { ...good, customer: 'randomtrading.demo', mode: 'Air', origin: 'Shanghai', destination: 'Dubai' }).handle('POST', '/extract', samples['05'])).json;
  assert.equal(r.fallback_used, false);
  assert.equal(r.customer, 'Random Trading');
});

async function fakeServer(statuses) {
  let n = 0;
  const srv = http.createServer((req, res) => {
    const s = statuses[Math.min(n++, statuses.length - 1)];
    res.writeHead(s, { 'content-type': 'application/json' });
    res.end(JSON.stringify(s === 200 ? { ok: true } : { error: { status: s === 429 ? 'RESOURCE_EXHAUSTED' : 'UNAVAILABLE' } }));
  });
  await new Promise((r) => srv.listen(0, r));
  return { url: `http://localhost:${srv.address().port}/x`, calls: () => n, close: () => srv.close() };
}

test('one retry on a transient 503, then success', async () => {
  const s = await fakeServer([503, 200]);
  const d = await post(s.url, {}, {}, 5000, 1);
  s.close();
  assert.deepEqual(d, { ok: true });
  assert.equal(s.calls(), 2);
});

test('no retry on 429, and the error keeps status and type', async () => {
  const s = await fakeServer([429, 200]);
  await assert.rejects(post(s.url, {}, {}, 5000, 1), (e) => e.status === 429 && e.detail === 'RESOURCE_EXHAUSTED');
  s.close();
  assert.equal(s.calls(), 1);
});

test('cache key changes with the prompt version', () => {
  assert.notEqual(cacheKey(PROMPT_VERSION, 'gemini', 'm', 'extract', { a: 1 }), cacheKey('old', 'gemini', 'm', 'extract', { a: 1 }));
});

test('guard keeps City (CODE) only when both parts are in the email', () => {
  const t = samples['10'].body;
  assert.equal(appearsIn('Istanbul (IST)', t), true);
  assert.equal(appearsIn('Ankara (IST)', t), false);
  assert.equal(appearsIn('Istanbul (SAW)', t), false);
});

test('rule reader never guesses on the stocklist email', () => {
  const r = extractFallback(samples['10']);
  assert.equal(r.mode, null);
  assert.equal(r.origin, null);
  assert.equal(r.destination, null);
  assert.equal(r.incoterm, null);
  assert.equal(r.total_weight_kg, null);
  assert.equal(r.total_volume_cbm, null);
  assert.equal(r.customer, 'Tulip Harbor Agency');
});
