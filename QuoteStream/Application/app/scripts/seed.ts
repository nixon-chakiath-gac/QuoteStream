import fs from 'node:fs';
import path from 'node:path';
import type mysql from 'mysql2/promise';
import { DEFAULT_SERVICES, SERVICES, INCOTERMS, JOB_TYPES } from '../src/lib/modes';
import type { Mode } from '../src/lib/weight';
import { chargeableWeight, r2 } from '../src/lib/weight';

type Conn = mysql.Connection | mysql.PoolConnection;

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PORTS: [string, string, string, string, string][] = [
  ['SHA', 'Shanghai', 'Shanghai', 'China', 'both'],
  ['SZX', 'Shenzhen', 'Shenzhen', 'China', 'both'],
  ['HKG', 'Hong Kong', 'Hong Kong', 'Hong Kong', 'both'],
  ['PEK', 'Beijing', 'Beijing', 'China', 'air'],
  ['NGB', 'Ningbo', 'Ningbo', 'China', 'sea'],
  ['SIN', 'Singapore', 'Singapore', 'Singapore', 'both'],
  ['BOM', 'Mumbai', 'Mumbai', 'India', 'both'],
  ['DEL', 'Delhi', 'Delhi', 'India', 'air'],
  ['NSA', 'Nhava Sheva', 'Mumbai', 'India', 'sea'],
  ['CMB', 'Colombo', 'Colombo', 'Sri Lanka', 'both'],
  ['DXB', 'Dubai', 'Dubai', 'United Arab Emirates', 'air'],
  ['JEA', 'Jebel Ali', 'Dubai', 'United Arab Emirates', 'sea'],
  ['AUH', 'Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', 'both'],
  ['KHL', 'Khalifa Port', 'Abu Dhabi', 'United Arab Emirates', 'sea'],
  ['SHJ', 'Sharjah', 'Sharjah', 'United Arab Emirates', 'air'],
  ['DOH', 'Doha', 'Doha', 'Qatar', 'both'],
  ['RUH', 'Riyadh', 'Riyadh', 'Saudi Arabia', 'both'],
  ['JED', 'Jeddah', 'Jeddah', 'Saudi Arabia', 'both'],
  ['KWI', 'Kuwait', 'Kuwait City', 'Kuwait', 'both'],
  ['MCT', 'Muscat', 'Muscat', 'Oman', 'both'],
  ['LHR', 'London Heathrow', 'London', 'United Kingdom', 'air'],
  ['FRA', 'Frankfurt', 'Frankfurt', 'Germany', 'air'],
  ['RTM', 'Rotterdam', 'Rotterdam', 'Netherlands', 'sea'],
  ['HAM', 'Hamburg', 'Hamburg', 'Germany', 'both'],
  ['JFK', 'New York', 'New York', 'United States', 'air'],
  ['LAX', 'Los Angeles', 'Los Angeles', 'United States', 'both']
];

const SUPPLIERS = [
  'Skyline Air Cargo', 'Orion Airlines Cargo', 'Falcon Freight Carriers', 'Meridian Shipping Line', 'Bluewave Container Lines',
  'Harbor Gate Terminals', 'Desert Road Haulage', 'Gulf Trucking Partners', 'Pacific Customs Brokers', 'Emirates Clearance Services',
  'Northstar Handling', 'Atlas Ground Services', 'Coastal Feeder Services', 'Zenith Courier Network', 'Swift Parcel Express',
  'Crescent Warehousing', 'Anchor Port Services', 'Summit Air Handling', 'Prime Border Logistics', 'Horizon Cargo Agents'
];

type Rate = { price: number; cost: number };
const RATES: Record<string, Rate> = {
  'Origin Charges': { price: 0.12, cost: 0.08 },
  Airfreight: { price: 3.1, cost: 2.6 },
  'Fuel Surcharge': { price: 0.45, cost: 0.35 },
  'Security Surcharge': { price: 0.1, cost: 0.07 },
  'Export Customs': { price: 85, cost: 60 },
  'Import Customs': { price: 120, cost: 90 },
  Transportation: { price: 150, cost: 110 },
  'Ocean Freight': { price: 28, cost: 22 },
  'Origin Terminal Handling': { price: 6.5, cost: 4.5 },
  'Destination Port Clearance': { price: 140, cost: 100 },
  'On-carriage': { price: 180, cost: 130 },
  'Courier Service': { price: 6.5, cost: 5 },
  'Road Freight': { price: 650, cost: 500 },
  'Hand Carry Service': { price: 900, cost: 700 },
  'Special Handling': { price: 350, cost: 260 }
};

const MAIN_LINE: Record<Mode, string> = {
  Air: 'Airfreight',
  Sea: 'Ocean Freight',
  Land: 'Road Freight',
  Courier: 'Courier Service',
  'Hand Carry': 'Hand Carry Service',
  Others: 'Special Handling'
};

type Lane = { mode: Mode; from: string | null; to: string | null; count: number; factor: number };
const LANES: Lane[] = [
  { mode: 'Air', from: 'SHA', to: 'DXB', count: 22, factor: 1 },
  { mode: 'Air', from: 'DXB', to: 'SIN', count: 8, factor: 1.15 },
  { mode: 'Air', from: 'SZX', to: 'DXB', count: 10, factor: 1.05 },
  { mode: 'Air', from: 'HKG', to: 'DXB', count: 8, factor: 1.1 },
  { mode: 'Air', from: 'FRA', to: 'DXB', count: 8, factor: 1.25 },
  { mode: 'Air', from: 'BOM', to: 'DXB', count: 8, factor: 0.7 },
  { mode: 'Air', from: 'LHR', to: 'DXB', count: 6, factor: 1.35 },
  { mode: 'Sea', from: 'SZX', to: 'JEA', count: 12, factor: 1 },
  { mode: 'Sea', from: 'NGB', to: 'JEA', count: 10, factor: 1.02 },
  { mode: 'Sea', from: 'SIN', to: 'JEA', count: 10, factor: 0.9 },
  { mode: 'Sea', from: 'RTM', to: 'JEA', count: 8, factor: 1.3 },
  { mode: 'Land', from: 'DXB', to: 'RUH', count: 8, factor: 1.6 },
  { mode: 'Land', from: 'DXB', to: 'DOH', count: 6, factor: 1.4 },
  { mode: 'Courier', from: 'SHA', to: 'DXB', count: 8, factor: 1 },
  { mode: 'Courier', from: 'HKG', to: 'DXB', count: 6, factor: 1.05 },
  { mode: 'Hand Carry', from: 'SIN', to: 'DXB', count: 6, factor: 1 },
  { mode: 'Hand Carry', from: 'FRA', to: 'DXB', count: 4, factor: 1.2 },
  { mode: 'Others', from: null, to: null, count: 12, factor: 1 }
];

const STATUSES = ['Secured', 'Pending', 'Secured', 'Lost', 'Pending', 'Secured', 'Alternate Option Secured', 'Pending', 'Secured', 'Re-opened'];

const CURRENCY_FACTOR: Record<string, number> = { USD: 1, AED: 3.67, SGD: 1.35 };

const PRINCIPAL_CURRENCY: Record<number, string> = { 4: 'AED', 9: 'AED', 5: 'SGD' };
const PRINCIPAL_FACTOR: Record<number, number> = { 1: 1.02, 2: 0.97, 3: 1.04, 4: 0.99, 5: 1.01, 6: 0.96, 8: 1.03, 9: 0.98, 10: 1.05, 11: 0.95 };

function roundPrice(v: number): number {
  return v < 10 ? Math.round(v * 100) / 100 : Math.round(v);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function seedAll(c: Conn, samplesDir: string) {
  const rand = rng(20261109);
  const ins = async (sql: string, params: any[] = []) => {
    const [r] = await c.query(sql, params);
    return (r as mysql.ResultSetHeader).insertId;
  };

  await ins('INSERT INTO branch (name, currency) VALUES (?, ?), (?, ?)', ['Dubai', 'AED', 'Singapore', 'SGD']);
  await ins('INSERT INTO branch_terms (branch_id, text) VALUES (1, ?), (2, ?)', [
    'Rates are valid for the period shown and are subject to space and equipment availability. Rates exclude duties, taxes and storage unless stated. Payment terms 30 days from invoice date. All business is subject to GAC standard trading conditions.',
    'Rates are valid for the period shown and are subject to carrier surcharges at time of shipment. Rates exclude duties, GST and storage unless stated. Payment terms 30 days from invoice date. All business is subject to GAC standard trading conditions.'
  ]);

  for (const p of PORTS) await ins('INSERT INTO port (code, name, city, country, kind) VALUES (?,?,?,?,?)', p);
  const portRows = (await c.query('SELECT id, code FROM port'))[0] as { id: number; code: string }[];
  const portId = (code: string | null) => (code ? portRows.find((p) => p.code === code)!.id : null);

  for (const s of SUPPLIERS) await ins('INSERT INTO supplier (name) VALUES (?)', [s]);

  let order = 0;
  for (const s of SERVICES) await ins('INSERT INTO service (name, default_basis, mode, sort_order) VALUES (?,?,?,?)', [s.name, s.basis, s.mode, order++]);
  const serviceRows = (await c.query('SELECT id, name FROM service'))[0] as { id: number; name: string }[];
  const serviceId = (n: string) => serviceRows.find((s) => s.name === n)!.id;

  const principals: { id: number; name: string }[] = [];
  for (let i = 1; i <= 12; i++) {
    const nn = String(i).padStart(2, '0');
    const id = await ins('INSERT INTO principal (name, email, domain, branch_id) VALUES (?,?,?,?)', [
      `Demo Principal ${nn}`,
      `logistics@principal${nn}.demo`,
      `principal${nn}.demo`,
      i <= 8 ? 1 : 2
    ]);
    principals.push({ id, name: `Demo Principal ${nn}` });
  }
  const blueDune = await ins('INSERT INTO principal (name, email, domain, branch_id) VALUES (?,?,?,?)', [
    'Blue Dune Energy',
    'procurement@bluedune.demo',
    'bluedune.demo',
    1
  ]);
  principals.push({ id: blueDune, name: 'Blue Dune Energy' });

  await ins('INSERT INTO app_user (kind, name, principal_id) VALUES (?,?,?)', ['customer', 'Blue Dune Energy', blueDune]);
  await ins('INSERT INTO app_user (kind, name, principal_id) VALUES (?,?,?)', ['gac', 'Christine Zock', null]);

  const addTemplate = async (
    principalId: number,
    mode: Mode,
    name: string,
    currency: string,
    lines: [string, number, number][]
  ) => {
    const tid = await ins('INSERT INTO service_template (principal_id, mode, name, currency) VALUES (?,?,?,?)', [principalId, mode, name, currency]);
    let so = 0;
    for (const [svc, price, cost] of lines) {
      const basis = SERVICES.find((s) => s.name === svc)!.basis;
      await ins(
        'INSERT INTO service_template_detail (template_id, service_id, basis, unit_price, est_unit_cost, supplier_id, sort_order) VALUES (?,?,?,?,?,?,?)',
        [tid, serviceId(svc), basis, price, cost, 1 + Math.floor(rand() * 20), so++]
      );
    }
  };

  await addTemplate(principals[6].id, 'Air', 'Air standard rates', 'USD', [
    ['Origin Charges', 0.12, 0.08],
    ['Airfreight', 3.1, 2.6],
    ['Fuel Surcharge', 0.45, 0.35],
    ['Security Surcharge', 0.1, 0.07],
    ['Export Customs', 85, 60],
    ['Import Customs', 120, 90],
    ['Transportation', 150, 110]
  ]);
  await addTemplate(principals[11].id, 'Air', 'Air standard rates', 'USD', [
    ['Origin Charges', 0.13, 0.09],
    ['Airfreight', 3.25, 2.7],
    ['Security Surcharge', 0.1, 0.07],
    ['Export Customs', 90, 65],
    ['Import Customs', 125, 95],
    ['Transportation', 155, 115]
  ]);
  await addTemplate(blueDune, 'Air', 'Air standard rates', 'USD', [
    ['Origin Charges', 0.12, 0.08],
    ['Airfreight', 3.4, 2.85],
    ['Fuel Surcharge', 0.45, 0.35],
    ['Security Surcharge', 0.1, 0.07],
    ['Import Customs', 120, 90],
    ['Transportation', 150, 110]
  ]);

  const templateFor = async (pid: number, mode: Mode, cur: string, f: number) => {
    const cf = CURRENCY_FACTOR[cur];
    const lines: [string, number, number][] = DEFAULT_SERVICES[mode].map((svc) => {
      const r = RATES[svc];
      return [svc, roundPrice(r.price * f * cf), roundPrice(r.cost * f * cf)];
    });
    await addTemplate(pid, mode, `${mode} standard rates`, cur, lines);
  };
  for (const p of principals) {
    const idx = Number(p.name.slice(-2));
    if (p.name.startsWith('Demo Principal') && idx !== 7 && idx !== 12) {
      const cur = PRINCIPAL_CURRENCY[idx] ?? 'USD';
      const f = PRINCIPAL_FACTOR[idx] ?? 1;
      await templateFor(p.id, 'Air', cur, f);
      if ([1, 3, 5].includes(idx)) await templateFor(p.id, 'Sea', cur, f);
      if (idx === 2) await templateFor(p.id, 'Land', cur, f);
      if (idx === 4) await templateFor(p.id, 'Courier', cur, f);
    }
  }

  const principalById = (n: number) => principals[n - 1];
  const quotePrincipals = principals.filter((p) => p.name !== 'Blue Dune Energy');
  let seq = 0;
  const now = new Date('2026-11-05T09:00:00Z').getTime();

  const makeQuote = async (lane: Lane, p: { id: number; name: string }, status: string, forceBlue: boolean) => {
    seq++;
    const idx = Number(p.name.slice(-2)) || 0;
    const cur = forceBlue || p.name === 'Blue Dune Energy' ? 'USD' : idx === 7 || idx === 12 ? 'USD' : PRINCIPAL_CURRENCY[idx] ?? 'USD';
    const cf = CURRENCY_FACTOR[cur];
    const pf = idx === 7 || idx === 12 || p.name === 'Blue Dune Energy' ? 1 : PRINCIPAL_FACTOR[idx] ?? 1;
    const gross = Math.round(120 + rand() * 1800);
    const cbm = Math.round((0.6 + rand() * 11) * 10) / 10;
    const cargo = chargeableWeight(lane.mode, gross, cbm);
    const daysAgo = Math.floor(rand() * 360) + 3;
    const created = fmtDate(new Date(now - daysAgo * 86400000));
    const branch = idx > 8 ? 2 : 1;
    const qid = await ins(
      `INSERT INTO quotation (number, request_id, principal_id, branch_id, status, flow_status, mode, job_type, service_type, incoterm, origin_port_id, destination_port_id, billing_currency, gross_weight, volume, chargeable_weight, total_quantity, valid_until, created_at)
       VALUES (?,NULL,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `QT-${String(seq).padStart(4, '0')}`,
        p.id,
        branch,
        status,
        lane.mode,
        JOB_TYPES[Math.floor(rand() * JOB_TYPES.length)],
        rand() > 0.5 ? 'Consolidation' : 'Direct',
        INCOTERMS[Math.floor(rand() * 4) + 1].code,
        portId(lane.from),
        portId(lane.to),
        cur,
        gross,
        cbm,
        cargo.chargeableWeight,
        1 + Math.floor(rand() * 8),
        fmtDate(new Date(now - daysAgo * 86400000 + 30 * 86400000)).slice(0, 10),
        created
      ]
    );
    let so = 0;
    for (const svc of DEFAULT_SERVICES[lane.mode]) {
      const r = RATES[svc];
      const def = SERVICES.find((s) => s.name === svc)!;
      const laneF = svc === MAIN_LINE[lane.mode] ? lane.factor : 1;
      const noise = 0.97 + rand() * 0.06;
      const price = roundPrice(r.price * laneF * pf * cf * noise);
      const costRatio = r.cost / r.price;
      const cost = roundPrice(price * costRatio * (0.98 + rand() * 0.04));
      const qty = def.basis === 'kg' ? cargo.billableWeight : def.basis === 'cbm' ? cbm : 1;
      await ins(
        `INSERT INTO quotation_product_cost (quotation_id, service_name, basis, currency, quantity, unit_price, bill_amount, est_unit_cost, est_cost, price_source, source_ref, confidence, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [qid, svc, def.basis, cur, qty, price, r2(price * qty), cost, r2(cost * qty), 'Template', null, 'High', so++]
      );
    }
  };

  for (const lane of LANES) {
    for (let i = 0; i < lane.count; i++) {
      const p = quotePrincipals[(i + seq) % quotePrincipals.length];
      const status = STATUSES[(i + lane.count) % STATUSES.length];
      await makeQuote(lane, p, status, false);
    }
  }
  const blueLanes = [LANES[0], LANES[0], LANES[1], LANES[1]];
  for (const lane of blueLanes) await makeQuote(lane, principalById(13), 'Secured', true);

  const lastSeq = seq;
  await ins('INSERT INTO counter (name, value) VALUES (?, ?), (?, ?)', ['REQ', 0, 'QT', lastSeq]);

  const air = (code: string) => portId(code);
  const noteIns = (
    pid: number,
    type: string,
    svc: string,
    basis: string,
    oldV: number | null,
    newV: number,
    est: number | null,
    reason: string,
    label: string,
    test: number,
    daysAgo: number
  ) =>
    ins(
      `INSERT INTO quotation_note (principal_id, mode, origin_port_id, destination_port_id, change_type, service_name, basis, currency, old_value, new_value, est_unit_cost, reason, quotation_id, source_label, is_test, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`,
      [pid, 'Air', air('SHA'), air('DXB'), type, svc, basis, 'USD', oldV, newV, est, reason, label, test, fmtDate(new Date(now - daysAgo * 86400000))]
    );
  await noteIns(principals[11].id, 'add_service', 'Fuel Surcharge', 'kg', null, 0.45, 0.35, 'This lane needs it', 'QT-seed-1', 0, 20);
  await noteIns(principals[6].id, 'change_price', 'Transportation', 'shipment', 150, 175, null, 'Customer agreed new rate', 'QT-seed-2', 0, 15);
  await noteIns(principals[6].id, 'change_price', 'Transportation', 'kg', 150, 152, null, 'Test only: basis mismatch trap', 'QT-seed-3', 1, 10);
  await noteIns(principals[6].id, 'change_price', 'Airfreight', 'kg', 3.1, 10, null, 'Test only: sanity warning', 'QT-seed-4', 1, 5);

  const files = fs.existsSync(samplesDir) ? fs.readdirSync(samplesDir).filter((f) => f.endsWith('.txt')).sort() : [];
  const labels: Record<string, string> = {
    '01_hero_air_3_pos.txt': 'Hero: Demo Principal 07, Air, 3 POs (complete)',
    '02_loop_a_principal12.txt': 'Notes loop A: Demo Principal 12, Air (complete)',
    '03_loop_b_principal12.txt': 'Notes loop B: Demo Principal 12, Air (complete)',
    '04_new_customer_sea.txt': 'New customer: New Client Logistics, Sea',
    '05_incomplete_air.txt': 'Incomplete: Air, no incoterm or cargo'
  };
  for (const f of files) {
    const text = fs.readFileSync(path.join(samplesDir, f), 'utf8').replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const head: Record<string, string> = {};
    let i = 0;
    for (; i < lines.length; i++) {
      if (lines[i].trim() === '') break;
      const m = lines[i].match(/^(From|To|Subject):\s*(.*)$/);
      if (m) head[m[1]] = m[2];
    }
    const body = lines.slice(i + 1).join('\n').trim();
    await ins('INSERT INTO sample_email (file_name, label, from_email, to_email, subject, body) VALUES (?,?,?,?,?,?)', [
      f,
      labels[f] ?? f,
      head.From ?? '',
      head.To ?? '',
      head.Subject ?? '',
      body
    ]);
  }
}
