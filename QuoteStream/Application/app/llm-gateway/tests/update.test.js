import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateFallback, applyUpdate } from '../fallback.js';

const req = {
  customer: 'Acme',
  mode: 'Air',
  origin: 'Shanghai',
  destination: 'Dubai',
  incoterm: null,
  job_type: null,
  service: null,
  pos: [],
  total_weight_kg: null,
  total_volume_cbm: null,
  requested_services: [],
  missing: ['incoterm', 'total_weight', 'total_volume'],
  notes: '',
  extra_key: { keep: true }
};

function run(text, r = req) {
  const f = updateFallback(r, text);
  return applyUpdate(r, f.changes, f.unclear);
}

test('fills incoterm, weight and volume', () => {
  const r = run('incoterm is FCA, weight 450 kg, volume 3.1 cbm');
  assert.deepEqual(r.changed.sort(), ['incoterm', 'total_volume_cbm', 'total_weight_kg']);
  assert.equal(r.request.incoterm, 'FCA');
  assert.equal(r.request.total_weight_kg, 450);
  assert.equal(r.request.total_volume_cbm, 3.1);
  assert.deepEqual(r.still_missing, []);
  assert.deepEqual(r.unclear, []);
  assert.deepEqual(r.request.extra_key, { keep: true });
});

test('ship it fob', () => {
  const r = run('ship it fob');
  assert.equal(r.request.incoterm, 'FOB');
  assert.deepEqual(r.changed, ['incoterm']);
  assert.deepEqual(r.still_missing, ['total_weight', 'total_volume']);
});

test('about 500 is unclear', () => {
  const r = run('it is about 500');
  assert.deepEqual(r.changed, []);
  assert.equal(r.unclear.length, 1);
  assert.equal(r.request.total_weight_kg, null);
});

test('weight with no number is unclear', () => {
  const r = run('the weight is heavy');
  assert.deepEqual(r.changed, []);
  assert.equal(r.unclear.length, 1);
});

test('unknown incoterm is unclear', () => {
  const r = run('incoterm is banana');
  assert.deepEqual(r.changed, []);
  assert.equal(r.unclear.length, 1);
  assert.equal(r.request.incoterm, null);
});

test('unit conversions', () => {
  assert.equal(run('weight 1000 lb').request.total_weight_kg, 453.59);
  assert.equal(run('weight 2 tonnes').request.total_weight_kg, 2000);
  assert.equal(run('volume 3 m3').request.total_volume_cbm, 3);
  assert.equal(run('volume 4 cubic metres').request.total_volume_cbm, 4);
});

test('mode and route', () => {
  const r = run('send it by sea from Ningbo to Jebel Ali');
  assert.equal(r.request.mode, 'Sea');
  assert.equal(r.request.origin, 'Ningbo');
  assert.equal(r.request.destination, 'Jebel Ali');
});

test('setting pos recomputes totals', () => {
  const r = run('PO-77: 100 kg, 1.5 cbm');
  assert.equal(r.request.pos.length, 1);
  assert.equal(r.request.total_weight_kg, 100);
  assert.equal(r.request.total_volume_cbm, 1.5);
});
