import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeableWeight, packageTotals, r2 } from './weight';
import { calcLine, totalsByCurrency, quantityFor } from './money';
import { resolvePrice, median, type PastCandidate } from './pricing';
import { suggestNotes, type NoteRow, type DraftLineLite } from './notes';
import { missingFor, requiredFor } from './required';

test('air volume weight and greater-of rule', () => {
  const hero = chargeableWeight('Air', 585, 4.2);
  assert.equal(hero.volumeWeight, 700);
  assert.equal(hero.chargeableWeight, 700);
  const a = chargeableWeight('Air', 450, 2.8);
  assert.equal(a.volumeWeight, 466.67);
  assert.equal(a.chargeableWeight, 466.67);
  const b = chargeableWeight('Air', 500, 3.0);
  assert.equal(b.volumeWeight, 500);
  assert.equal(b.chargeableWeight, 500);
  const heavy = chargeableWeight('Air', 900, 1);
  assert.equal(heavy.chargeableWeight, 900);
  const portal = chargeableWeight('Air', 450, 3.2);
  assert.equal(portal.chargeableWeight, 533.33);
});

test('courier volume weight uses 200 per CBM', () => {
  const c = chargeableWeight('Courier', 100, 1);
  assert.equal(c.volumeWeight, 200);
  assert.equal(c.chargeableWeight, 200);
  assert.equal(chargeableWeight('Courier', 300, 1).chargeableWeight, 300);
});

test('modes without a verified rule show gross weight only', () => {
  for (const m of ['Sea', 'Land', 'Hand Carry', 'Others'] as const) {
    const r = chargeableWeight(m, 2700, 18.5);
    assert.equal(r.hasRule, false);
    assert.equal(r.chargeableWeight, null);
    assert.equal(r.billableWeight, 2700);
    assert.match(r.formula, /Weight rule not defined/);
  }
});

test('rounding to 2 decimals', () => {
  assert.equal(r2(1.005), 1.01);
  assert.equal(r2(466.6666667), 466.67);
});

test('package rows in metric and imperial', () => {
  const m = packageTotals([{ quantity: 3, length: 100, width: 50, height: 40, weight: 150 }], 'metric');
  assert.equal(m.quantity, 3);
  assert.equal(m.weightKg, 450);
  assert.equal(m.cbm, 0.6);
  const i = packageTotals([{ quantity: 1, length: 10, width: 10, height: 10, weight: 10 }], 'imperial');
  assert.equal(i.weightKg, 4.54);
});

const heroLines = [
  ['kg', 0.12, 0.08],
  ['kg', 3.1, 2.6],
  ['kg', 0.45, 0.35],
  ['kg', 0.1, 0.07],
  ['shipment', 85, 60],
  ['shipment', 120, 90],
  ['shipment', 150, 110]
] as const;

test('hero scenario totals', () => {
  const cargo = chargeableWeight('Air', 585, 4.2);
  const lines = heroLines.map(([basis, price, cost]) => {
    const qty = quantityFor(basis, { billableWeight: cargo.billableWeight, volume: 4.2, totalQuantity: 1 });
    const c = calcLine(price, cost, qty);
    return { currency: 'USD', bill: c.bill, cost: c.cost };
  });
  const t = totalsByCurrency(lines);
  assert.equal(t.length, 1);
  assert.equal(t[0].revenue, 2994);
  assert.equal(t[0].cost, 2430);
  assert.equal(t[0].opIncome, 564);
  assert.equal(t[0].margin, 18.8);
});

test('totals never mix currencies', () => {
  const t = totalsByCurrency([
    { currency: 'USD', bill: 100, cost: 50 },
    { currency: 'AED', bill: 200, cost: 100 },
    { currency: 'USD', bill: 10, cost: 5 }
  ]);
  assert.equal(t.length, 2);
  assert.equal(t.find((x) => x.currency === 'USD')?.revenue, 110);
  assert.equal(t.find((x) => x.currency === 'AED')?.revenue, 200);
});

const past = (id: number, price: number, created: number, basis: 'kg' | 'shipment' = 'kg'): PastCandidate => ({
  basis,
  unit_price: price,
  est_unit_cost: price * 0.8,
  currency: 'USD',
  quotation_id: id,
  quotation_number: `QT-${id}`,
  created_at: created
});

test('price source order: template wins', () => {
  const r = resolvePrice({
    template: { basis: 'kg', unit_price: 3.1, est_unit_cost: 2.6, currency: 'USD' },
    customerPast: [past(1, 9, 100)],
    market: [past(2, 5, 1), past(3, 6, 2)]
  });
  assert.equal(r.source, 'Template');
  assert.equal(r.unit_price, 3.1);
});

test('price source order: latest customer past quotation next', () => {
  const r = resolvePrice({
    template: null,
    customerPast: [past(1, 4, 100), past(2, 4.5, 300), past(3, 4.2, 200)],
    market: [past(9, 5, 1), past(10, 6, 2)]
  });
  assert.equal(r.source, 'Past quotation');
  assert.equal(r.source_ref, 'QT-2');
  assert.equal(r.unit_price, 4.5);
});

test('price source order: market median, then rate needed', () => {
  const m = resolvePrice({ template: null, customerPast: [], market: [past(1, 3, 1), past(2, 5, 2), past(3, 4, 3)] });
  assert.equal(m.source, 'Market median');
  assert.equal(m.unit_price, 4);
  assert.equal(m.source_ref, 'Median of 3 quotations');
  const one = resolvePrice({ template: null, customerPast: [], market: [past(1, 3, 1)] });
  assert.equal(one.source, 'Rate needed');
  assert.equal(one.unit_price, null);
  const none = resolvePrice({ template: null, customerPast: [], market: [] });
  assert.equal(none.source, 'Rate needed');
});

test('median of even and odd sets', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([5, 1, 3]), 3);
});

const ctx = { principal_id: 7, mode: 'Air', origin_port_id: 1, destination_port_id: 2 };
const lines: DraftLineLite[] = [
  { id: 1, service_name: 'Airfreight', basis: 'kg', currency: 'USD', unit_price: 3.1 },
  { id: 2, service_name: 'Transportation', basis: 'shipment', currency: 'USD', unit_price: 150 }
];
const note = (over: Partial<NoteRow>): NoteRow => ({
  id: 1,
  principal_id: 7,
  mode: 'Air',
  origin_port_id: 1,
  destination_port_id: 2,
  change_type: 'change_price',
  service_name: 'Transportation',
  basis: 'shipment',
  currency: 'USD',
  old_value: 150,
  new_value: 175,
  est_unit_cost: null,
  reason: 'Customer agreed new rate',
  reason_text: null,
  source_label: 'QT-seed-2',
  is_test: 0,
  created_at: 1,
  ...over
});

test('notes: per shipment note is suggested on a per shipment line', () => {
  const s = suggestNotes(ctx, lines, [note({})], new Set());
  assert.equal(s.length, 1);
  assert.equal(s[0].value, 175);
  assert.equal(s[0].basis, 'shipment');
});

test('notes: basis mismatch is never suggested (the 152 per kg trap)', () => {
  const trap = note({ id: 3, basis: 'kg', new_value: 152, is_test: 1 });
  assert.equal(suggestNotes(ctx, lines, [trap], new Set(), true).length, 0);
  assert.equal(suggestNotes(ctx, lines, [trap], new Set(), false).length, 0);
});

test('notes: sanity warning above 3 times the current price', () => {
  const big = note({ id: 4, service_name: 'Airfreight', basis: 'kg', new_value: 10, is_test: 1 });
  assert.equal(suggestNotes(ctx, lines, [big], new Set(), false).length, 0);
  const s = suggestNotes(ctx, lines, [big], new Set(), true);
  assert.equal(s.length, 1);
  assert.ok(s[0].warning);
  const ok = note({ id: 5, service_name: 'Airfreight', basis: 'kg', new_value: 9.3 });
  assert.equal(suggestNotes(ctx, lines, [ok], new Set())[0].warning, null);
  const over = note({ id: 6, service_name: 'Airfreight', basis: 'kg', new_value: 9.31 });
  assert.ok(suggestNotes(ctx, lines, [over], new Set())[0].warning);
});

test('notes: add service only when missing, dismissed hidden, other lanes hidden', () => {
  const add = note({ id: 7, change_type: 'add_service', service_name: 'Fuel Surcharge', basis: 'kg', new_value: 0.45 });
  assert.equal(suggestNotes(ctx, lines, [add], new Set()).length, 1);
  const withFuel = [...lines, { id: 3, service_name: 'Fuel Surcharge', basis: 'kg' as const, currency: 'USD', unit_price: 0.45 }];
  assert.equal(suggestNotes(ctx, withFuel, [add], new Set()).length, 0);
  assert.equal(suggestNotes(ctx, lines, [add], new Set([7])).length, 0);
  assert.equal(suggestNotes(ctx, lines, [{ ...add, destination_port_id: 9 }], new Set()).length, 0);
});

test('notes: same customer ranks first and duplicates collapse', () => {
  const mine = note({ id: 8, principal_id: 7, new_value: 175, created_at: 5 });
  const other = note({ id: 9, principal_id: 3, new_value: 160, created_at: 9 });
  const dup = note({ id: 10, principal_id: 3, new_value: 175, created_at: 10 });
  const s = suggestNotes(ctx, lines, [other, mine, dup], new Set());
  assert.equal(s[0].note_id, 8);
  assert.equal(s.filter((x) => x.value === 175).length, 1);
});

test('required fields: email door and portal per mode', () => {
  assert.deepEqual(requiredFor('Air', 'Email'), [
    'customer', 'mode', 'origin', 'destination', 'incoterm', 'total_weight', 'total_volume'
  ]);
  const incomplete = missingFor(
    { customer: 'Random Trading', mode: 'Air', origin: 'Shanghai', destination: 'Dubai', incoterm: null, total_weight_kg: null, total_volume_cbm: null },
    'Email'
  );
  assert.deepEqual(incomplete, ['incoterm', 'total_weight', 'total_volume']);
  assert.ok(requiredFor('Sea', 'Portal', { load_type: 'FCL' }).includes('container_type'));
  assert.ok(!requiredFor('Sea', 'Portal', { load_type: 'LCL' }).includes('container_type'));
  assert.ok(requiredFor('Land', 'Portal').includes('vehicle_type'));
  assert.deepEqual(requiredFor('Others', 'Portal'), ['service_description']);
  assert.ok(!requiredFor('Hand Carry', 'Portal').includes('total_volume'));
});
