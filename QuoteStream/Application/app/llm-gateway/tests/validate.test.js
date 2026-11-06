import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateExtract,
  applyExtractGuard,
  validateUpdate,
  parseJson,
  computeMissing,
  mapServices,
  normalizeServiceList,
  validateEmailOutput,
  sanitizeDashes
} from '../validate.js';
import { loadSamples } from './helpers.js';

const base = {
  customer: 'Acme',
  contact_name: 'Sam',
  contact_email: 'sam@acme.demo',
  mode: 'Air',
  origin: 'Shanghai',
  destination: 'Dubai',
  incoterm: 'FCA',
  job_type: null,
  service: null,
  pos: [],
  total_weight_kg: 10,
  total_volume_cbm: 1,
  requested_services: [],
  missing: [],
  notes: ''
};

test('validateExtract accepts a good object and normalizes', () => {
  const v = validateExtract({ ...base, mode: 'air', incoterm: 'fob', total_weight_kg: '10' });
  assert.equal(v.ok, true);
  assert.equal(v.value.mode, 'Air');
  assert.equal(v.value.incoterm, 'FOB');
  assert.equal(v.value.total_weight_kg, 10);
});

test('validateExtract rejects bad types', () => {
  assert.equal(validateExtract(null).ok, false);
  assert.equal(validateExtract({ ...base, mode: 'Rocket' }).ok, false);
  assert.equal(validateExtract({ ...base, incoterm: 'ABCDE' }).ok, false);
  assert.equal(validateExtract({ ...base, pos: [{ po_number: 'PO-1' }] }).ok, false);
  assert.equal(validateExtract({ ...base, total_weight_kg: 'lots' }).ok, false);
  assert.equal(validateExtract({ ...base, requested_services: 'x' }).ok, false);
});

test('requested services are canonical only', () => {
  assert.deepEqual(normalizeServiceList(['air freight', 'Fuel Surcharge', 'Moon landing']), ['Airfreight', 'Fuel Surcharge']);
  assert.deepEqual(mapServices('export/import customs clearance'), ['Export Customs', 'Import Customs']);
});

test('computeMissing uses the 7 keys', () => {
  assert.deepEqual(computeMissing({ ...base, customer: null, total_volume_cbm: null }), ['customer', 'total_volume']);
});

test('parseJson handles fences and noise', () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('here {"a":2} done'), { a: 2 });
  assert.equal(parseJson('nope'), null);
});

test('anti guess guard nulls strings absent from the email', () => {
  const s = loadSamples()['05'];
  const text = `From: ${s.from}\nSubject: ${s.subject}\n\n${s.body}`;
  const v = validateExtract({
    ...base,
    customer: 'Random Trading',
    origin: 'Shanghai',
    destination: 'Rotterdam',
    incoterm: 'FOB',
    job_type: 'Supplier to WH',
    total_weight_kg: 900,
    total_volume_cbm: 5
  }).value;
  const g = applyExtractGuard(v, { text, fromAddress: 'alex@randomtrading.demo' });
  assert.equal(g.customer, 'Random Trading');
  assert.equal(g.origin, 'Shanghai');
  assert.equal(g.destination, null);
  assert.equal(g.incoterm, null);
  assert.equal(g.job_type, null);
  assert.equal(g.total_weight_kg, null);
  assert.equal(g.total_volume_cbm, null);
  assert.deepEqual(g.missing, ['destination', 'incoterm', 'total_weight', 'total_volume']);
});

test('guard recomputes totals from POs and drops invented POs', () => {
  const text = 'PO-1: 100 kg, 1 CBM and PO-2: 50 kg, 2 CBM';
  const v = validateExtract({
    ...base,
    pos: [
      { po_number: 'PO-1', weight_kg: 100, volume_cbm: 1 },
      { po_number: 'PO-2', weight_kg: 50, volume_cbm: 2 },
      { po_number: 'PO-9', weight_kg: 5, volume_cbm: 5 }
    ],
    total_weight_kg: 999,
    total_volume_cbm: 999
  }).value;
  const g = applyExtractGuard(v, { text: `Origin Shanghai Dubai FCA Acme ${text}`, fromAddress: 'a@b.demo' });
  assert.equal(g.pos.length, 2);
  assert.equal(g.total_weight_kg, 150);
  assert.equal(g.total_volume_cbm, 3);
});

test('guard keeps the stated total and adds a note', () => {
  const text = 'PO-1: 100 kg, 1 CBM\nTotal Weight: 120 kg\nTotal Volume: 1 CBM';
  const v = validateExtract({ ...base, pos: [{ po_number: 'PO-1', weight_kg: 100, volume_cbm: 1 }] }).value;
  const g = applyExtractGuard(v, { text: `Shanghai Dubai FCA Acme ${text}`, fromAddress: null });
  assert.equal(g.total_weight_kg, 120);
  assert.match(g.notes, /differs/);
});

test('validateUpdate filters unknown fields and bad incoterms', () => {
  const v = validateUpdate({ changes: { incoterm: 'ZZZ', secret: 1, mode: 'sea', total_weight_kg: 0 }, unclear: ['Which one?'] });
  assert.equal(v.ok, false);
  assert.deepEqual(v.value.changes, { mode: 'Sea' });
  assert.deepEqual(v.value.unclear, ['Which one?']);
});

test('email output sanitizing and forbidden words', () => {
  assert.equal(sanitizeDashes('a \u2014 b \u2013 c'), 'a, b, c');
  const input = { quotation_number: 'Q-1', origin: 'A', destination: 'B', totals: { USD: 100 }, valid_until: '2026-12-31' };
  const ok = validateEmailOutput({ body: 'Total USD 100.00 valid until 2026-12-31 \u2014 thanks' }, input);
  assert.equal(ok.ok, true);
  assert.doesNotMatch(ok.value.body, /[\u2013\u2014]/);
  const bad = validateEmailOutput({ body: 'Total USD 100.00 valid until 2026-12-31. Our margin is low.' }, input);
  assert.equal(bad.ok, false);
  assert.equal(bad.fatal, true);
});
