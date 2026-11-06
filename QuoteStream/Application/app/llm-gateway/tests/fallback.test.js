import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFallback, customerFromDomain } from '../fallback.js';
import { loadSamples } from './helpers.js';

const s = loadSamples();
const all = [
  'Origin Charges',
  'Airfreight',
  'Fuel Surcharge',
  'Security Surcharge',
  'Export Customs',
  'Import Customs',
  'Transportation'
];

test('sample 01 hero', () => {
  const r = extractFallback(s['01']);
  assert.equal(r.customer, 'Demo Principal 07');
  assert.equal(r.mode, 'Air');
  assert.equal(r.origin, 'Shanghai (SHA)');
  assert.equal(r.destination, 'Dubai (DXB)');
  assert.equal(r.incoterm, 'FCA');
  assert.equal(r.job_type, 'Supplier to WH Destination');
  assert.equal(r.service, 'Consolidation');
  assert.equal(r.pos.length, 3);
  assert.equal(r.total_weight_kg, 585);
  assert.equal(r.total_volume_cbm, 4.2);
  assert.deepEqual(r.requested_services, all);
  assert.deepEqual(r.missing, []);
  assert.equal(r.contact_email, 'logistics@principal07.demo');
  assert.equal(r.contact_name, 'Coordinator 07');
});

test('sample 02 route from subject', () => {
  const r = extractFallback(s['02']);
  assert.equal(r.customer, 'Demo Principal 12');
  assert.equal(r.origin, 'Shanghai');
  assert.equal(r.destination, 'Dubai');
  assert.equal(r.incoterm, 'FCA');
  assert.equal(r.service, 'Consolidation');
  assert.deepEqual(r.pos, [{ po_number: 'PO-8812', weight_kg: 450, volume_cbm: 2.8 }]);
  assert.equal(r.total_weight_kg, 450);
  assert.equal(r.total_volume_cbm, 2.8);
  assert.deepEqual(r.missing, []);
});

test('sample 03', () => {
  const r = extractFallback(s['03']);
  assert.equal(r.customer, 'Demo Principal 12');
  assert.equal(r.mode, 'Air');
  assert.equal(r.origin, 'Shanghai (SHA)');
  assert.equal(r.destination, 'Dubai (DXB)');
  assert.equal(r.incoterm, 'FCA');
  assert.deepEqual(r.pos, [{ po_number: 'PO-8899', weight_kg: 500, volume_cbm: 3 }]);
  assert.deepEqual(r.missing, []);
});

test('sample 04 new customer sea', () => {
  const r = extractFallback(s['04']);
  assert.equal(r.customer, 'New Client Logistics');
  assert.equal(r.contact_name, 'Robert Vance');
  assert.equal(r.mode, 'Sea');
  assert.equal(r.origin, 'Shanghai (SHA)');
  assert.equal(r.destination, 'Dubai (JEA)');
  assert.equal(r.incoterm, 'FOB');
  assert.equal(r.pos.length, 2);
  assert.equal(r.total_weight_kg, 2700);
  assert.equal(r.total_volume_cbm, 18.5);
  assert.deepEqual(r.requested_services, ['Ocean Freight', 'Origin Terminal Handling', 'Destination Port Clearance', 'On-carriage']);
  assert.deepEqual(r.missing, []);
});

test('sample 05 incomplete', () => {
  const r = extractFallback(s['05']);
  assert.equal(r.customer, 'Random Trading');
  assert.equal(r.contact_name, 'Alex');
  assert.equal(r.mode, 'Air');
  assert.equal(r.origin, 'Shanghai');
  assert.equal(r.destination, 'Dubai');
  assert.equal(r.incoterm, null);
  assert.equal(r.total_weight_kg, null);
  assert.equal(r.total_volume_cbm, null);
  assert.deepEqual(r.missing, ['incoterm', 'total_weight', 'total_volume']);
});

test('customer from domain', () => {
  assert.equal(customerFromDomain('a@randomtrading.demo'), 'Random Trading');
  assert.equal(customerFromDomain('a@newclientlogistics.com'), 'New Client Logistics');
  assert.equal(customerFromDomain('a@gmail.com'), null);
});

test('stated total wins over PO sum with a note', () => {
  const r = extractFallback({
    from: 'x@acme.demo',
    subject: 'Quote',
    body: 'Origin: A\nDestination: B\n- PO-1: 100 kg, 1 CBM\n- PO-2: 100 kg, 1 CBM\nTotal Gross Weight: 250 kg\nTotal Volume: 2 CBM\n'
  });
  assert.equal(r.total_weight_kg, 250);
  assert.match(r.notes, /differs/);
});

test('sample 06 courier Blue Dune', () => {
  const r = extractFallback(s['06']);
  assert.equal(r.customer, 'Blue Dune Energy');
  assert.equal(r.contact_name, 'Maya Hart');
  assert.equal(r.contact_email, 'procurement@bluedune.demo');
  assert.equal(r.mode, 'Courier');
  assert.equal(r.origin, 'Dubai (DXB)');
  assert.equal(r.destination, 'Singapore (SIN)');
  assert.equal(r.incoterm, 'DAP');
  assert.equal(r.total_weight_kg, 30);
  assert.equal(r.total_volume_cbm, 0.4);
  assert.deepEqual(r.pos, []);
  assert.deepEqual(r.missing, []);
});

test('sample 07 land', () => {
  const r = extractFallback(s['07']);
  assert.equal(r.customer, 'Oasis Build Supplies');
  assert.equal(r.mode, 'Land');
  assert.equal(r.origin, 'Dubai (DXB)');
  assert.equal(r.destination, 'Riyadh (RUH)');
  assert.equal(r.incoterm, 'DAP');
  assert.equal(r.vehicle_type, 'FTL');
  assert.equal(r.total_weight_kg, 8000);
  assert.equal(r.total_volume_cbm, 20);
  assert.deepEqual(r.missing, []);
});

test('sample 08 sea FCL with containers', () => {
  const r = extractFallback(s['08']);
  assert.equal(r.customer, 'Harbor Light Foods');
  assert.equal(r.mode, 'Sea');
  assert.equal(r.origin, 'Ningbo (NGB)');
  assert.equal(r.destination, 'Jebel Ali (JEA)');
  assert.equal(r.incoterm, 'FOB');
  assert.equal(r.load_type, 'FCL');
  assert.equal(r.container_type, '40 ft standard');
  assert.equal(r.container_count, 2);
  assert.equal(r.total_weight_kg, 18000);
  assert.equal(r.total_volume_cbm, 60);
  assert.deepEqual(r.missing, []);
});

test('sample 09 missing only the weight', () => {
  const r = extractFallback(s['09']);
  assert.equal(r.customer, 'Cedar Point Medical');
  assert.equal(r.mode, 'Air');
  assert.equal(r.origin, 'Hong Kong (HKG)');
  assert.equal(r.destination, 'Dubai (DXB)');
  assert.equal(r.incoterm, 'FCA');
  assert.equal(r.total_weight_kg, null);
  assert.equal(r.total_volume_cbm, 1.2);
  assert.deepEqual(r.missing, ['total_weight']);
});

test('samples have no long dashes', () => {
  for (const [k, v] of Object.entries(s)) assert.ok(!new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`).test(JSON.stringify(v)), k);
});
