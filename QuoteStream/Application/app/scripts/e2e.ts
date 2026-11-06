const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

let failures = 0;
let passes = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passes++;
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`);
  }
}

async function call(role: 'customer' | 'gac', method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', cookie: `role=${role}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, text };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(fn: () => Promise<T | null | false>, ms = 300000): Promise<T | null> {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(1000);
  }
  return null;
}

const FORBIDDEN_KEYS = ['est_unit_cost', 'est_cost', 'op_income', 'opIncome', 'margin', 'cost', 'price_source', 'source_ref', 'confidence', 'notes', 'reason', 'rejection_reason', 'suggestions'];

function leaks(obj: unknown, path = ''): string[] {
  const found: string[] = [];
  if (Array.isArray(obj)) obj.forEach((v, i) => found.push(...leaks(v, `${path}[${i}]`)));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (FORBIDDEN_KEYS.includes(k)) found.push(`${path}.${k}`);
      found.push(...leaks(v, `${path}.${k}`));
    }
  }
  return found;
}

async function drive(requestId: number, quotationId: number, label: string) {
  const sub = await call('gac', 'POST', `/api/gac/quotations/${quotationId}/submit`, {});
  check(`${label}: submit`, sub.status === 200, sub.json);
  const acc = await call('gac', 'POST', `/api/gac/quotations/${quotationId}/decision`, { action: 'Accept' });
  check(`${label}: accept`, acc.status === 200, acc.json);
  const prev = await call('gac', 'POST', `/api/gac/quotations/${quotationId}/send-preview`, {});
  check(`${label}: send preview`, prev.status === 200 && prev.json.subject && prev.json.body, prev.json);
  check(`${label}: preview has no cost or margin words`, !/\b(cost|margin|profit|internal)\b/i.test(prev.json.body ?? ''), prev.json.body);
  check(`${label}: preview has no dashes`, !LONG_DASH.test(JSON.stringify(prev.json)));
  const sent = await call('gac', 'POST', `/api/gac/quotations/${quotationId}/send`, { subject: prev.json.subject, body: prev.json.body });
  check(`${label}: send`, sent.status === 200, sent.json);
  return prev.json;
}

async function portalFlow() {
  console.log('Portal door, Air, with revision');
  const wrong = await call('gac', 'GET', '/api/portal/requests');
  check('GAC cookie cannot use customer API', wrong.status === 403);
  const bad = await call('customer', 'POST', '/api/portal/requests', { mode: 'Air', origin: 'Shanghai (SHA)' });
  check('incomplete portal request rejected', bad.status === 400, bad.json);
  const created = await call('customer', 'POST', '/api/portal/requests', {
    mode: 'Air',
    origin: 'Shanghai (SHA)',
    destination: 'Dubai (DXB)',
    incoterm: 'FCA',
    description: 'Pump spare parts',
    ready_date: '2026-11-16',
    cargo_mode: 'totals',
    unit_system: 'metric',
    total_quantity: 3,
    total_weight_kg: 450,
    total_volume_cbm: 3.2,
    packages: []
  });
  check('portal request created', created.status === 200 && created.json.id, created.json);
  const rid = created.json.id as number;
  const list = await call('customer', 'GET', '/api/portal/requests');
  check('customer sees Received', list.json.find((r: any) => r.id === rid)?.status === 'Received', list.json);
  const gacList = await call('gac', 'GET', '/api/gac/requests');
  const row = gacList.json.find((r: any) => r.id === rid);
  check('GAC sees Portal source and Draft ready', row?.source === 'Portal' && row?.status === 'Draft ready', row);
  const qid = row.quotation_id as number;
  const draft = await call('gac', 'GET', `/api/gac/quotations/${qid}`);
  check('chargeable weight 533.33', draft.json.cargo.chargeableWeight === 533.33, draft.json.cargo);
  check('no Rate needed on Air portal demo', draft.json.lines.every((l: any) => l.price_source !== 'Rate needed'), draft.json.lines.map((l: any) => l.price_source));
  check('portal draft lines all from Template', draft.json.lines.every((l: any) => l.price_source === 'Template'));
  const afterOpen = await call('customer', 'GET', '/api/portal/requests');
  check('customer sees Under review after draft opened', afterOpen.json.find((r: any) => r.id === rid)?.status === 'Under review');
  const det0 = await call('customer', 'GET', `/api/portal/requests/${rid}`);
  check('customer detail has no quotation before send', det0.json.quotation === null);
  check('customer detail has no forbidden keys', leaks(det0.json).length === 0, leaks(det0.json));
  const other = await call('gac', 'GET', `/api/gac/quotations/${qid}`);
  void other;
  const prev = await drive(rid, qid, 'v1');
  const det1 = await call('customer', 'GET', `/api/portal/requests/${rid}`);
  check('customer Quotation ready', det1.json.status === 'Quotation ready', det1.json.status);
  check('customer quotation has lines and email', det1.json.quotation?.lines?.length > 0 && det1.json.quotation?.email?.subject);
  check('customer API has no cost, margin, source or note keys', leaks(det1.json).length === 0, leaks(det1.json));
  check('customer text has no source words', !/Template|Past quotation|Market median|Rate needed|Est\. Op/.test(JSON.stringify(det1.json)));
  check('totals one currency per entry', det1.json.quotation.totals.length === 1);
  const air = det1.json.quotation.lines.find((l: any) => l.service === 'Airfreight');
  const rev = await call('customer', 'POST', `/api/portal/requests/${rid}/revision`, {});
  check('empty revision rejected', rev.status === 400);
  const rev2 = await call('customer', 'POST', `/api/portal/requests/${rid}/revision`, { message: 'Can you lower the airfreight rate?', targets: { [air.line_id]: 3.0 } });
  check('revision accepted', rev2.status === 200, rev2.json);
  const det2 = await call('customer', 'GET', `/api/portal/requests/${rid}`);
  check('customer Revision requested', det2.json.status === 'Revision requested', det2.json.status);
  const dup = await call('customer', 'POST', `/api/portal/requests/${rid}/revision`, { message: 'again' });
  check('second revision blocked while open', dup.status === 400);
  const gd = await call('gac', 'GET', `/api/gac/quotations/${qid}`);
  check('GAC sees revision panel and target', gd.json.revision?.message === 'Can you lower the airfreight rate?' && gd.json.lines.find((l: any) => l.service_name === 'Airfreight')?.target === 3, gd.json.revision);
  check('GAC request status Revision requested', (await call('gac', 'GET', '/api/gac/requests')).json.find((r: any) => r.id === rid)?.status === 'Revision requested');
  const airLine = gd.json.lines.find((l: any) => l.service_name === 'Airfreight');
  const ed = await call('gac', 'PATCH', `/api/gac/quotations/${qid}/lines/${airLine.id}`, { unit_price: 3.2 });
  check('line edit returns a change descriptor', ed.json.change?.change_type === 'change_price' && ed.json.change.basis === 'kg', ed.json);
  const note = await call('gac', 'POST', `/api/gac/quotations/${qid}/notes`, { change: ed.json.change, reason: 'Customer agreed new rate' });
  check('note saved', note.status === 200 && note.json.notes_written.length === 1, note.json.notes_written);
  await drive(rid, qid, 'v2');
  const det3 = await call('customer', 'GET', `/api/portal/requests/${rid}`);
  check('customer Version 2 is latest and Quotation ready', det3.json.status === 'Quotation ready' && det3.json.quotation.version_no === 2 && det3.json.versions.length === 2, det3.json.versions);
  const airV2 = det3.json.quotation.lines.find((l: any) => l.service === 'Airfreight');
  check('version 2 shows 3.20', airV2.unit_price === 3.2, airV2);
  const v1 = await call('customer', 'GET', `/api/portal/requests/${rid}?version=1`);
  check('version 1 unchanged at 3.40', v1.json.quotation.version_no === 1 && v1.json.quotation.lines.find((l: any) => l.service === 'Airfreight').unit_price === 3.4, v1.json.quotation?.lines);
  check('v2 API has no forbidden keys', leaks(det3.json).length === 0, leaks(det3.json));
  const rev3 = await call('customer', 'POST', `/api/portal/requests/${rid}/revision`, { message: 'One more round please' });
  check('repeatable revision (round 2)', rev3.status === 200);
  void prev;
}

async function heroEmail() {
  console.log('Email door, hero sample');
  const samples = await call('gac', 'GET', '/api/gac/emails');
  check('samples load from data', Array.isArray(samples.json) && samples.json.length >= 5, samples.json?.length);
  const hero = samples.json.find((s: any) => s.file_name.startsWith('01'));
  const sent = await call('gac', 'POST', '/api/gac/emails', { from: hero.from_email, to: hero.to_email, subject: hero.subject, body: hero.body });
  check('email accepted', sent.status === 200, sent.json);
  const rid = sent.json.id as number;
  const row = await waitFor(async () => {
    const l = await call('gac', 'GET', '/api/gac/requests');
    const r = l.json.find((x: any) => x.id === rid);
    return r && r.status !== 'Reading email' ? r : null;
  });
  check('hero reaches Draft ready', row?.status === 'Draft ready', row);
  const d = await call('gac', 'GET', `/api/gac/quotations/${row.quotation_id}?peek=1`);
  const t = d.json.totals;
  check('hero single currency totals', t.length === 1 && t[0].currency === 'USD', t);
  check('hero revenue 2994.00', t[0].revenue === 2994, t[0]);
  check('hero cost 2430.00', t[0].cost === 2430, t[0]);
  check('hero op income 564.00', t[0].opIncome === 564, t[0]);
  check('hero margin 18.8', t[0].margin === 18.8, t[0]);
  check('hero chargeable 700.00', d.json.cargo.chargeableWeight === 700 && d.json.cargo.grossWeight === 585 && d.json.cargo.volume === 4.2, d.json.cargo);
  check('hero all Template', d.json.lines.length === 7 && d.json.lines.every((l: any) => l.price_source === 'Template'), d.json.lines.map((l: any) => l.price_source));
  const tr = d.json.suggestions.find((s: any) => s.service_name === 'Transportation');
  check('hero suggests Transportation 175 per shipment', tr?.value === 175 && tr?.basis === 'shipment', d.json.suggestions);
  check('trap notes hidden by default', !d.json.suggestions.some((s: any) => s.value === 152 || s.value === 10));
  const withTest = await call('gac', 'GET', `/api/gac/quotations/${row.quotation_id}?peek=1&include_test=1`);
  check('per kg 152 trap never offered even with test notes', !withTest.json.suggestions.some((s: any) => s.value === 152), withTest.json.suggestions);
  const sanity = withTest.json.suggestions.find((s: any) => s.value === 10);
  check('sanity warning on 10.00 per kg airfreight', Boolean(sanity?.warning), sanity);
  const before = d.json.totals[0].revenue;
  const acc = await call('gac', 'POST', `/api/gac/quotations/${row.quotation_id}/suggestions/${tr.note_id}`, { action: 'accept' });
  const t2 = acc.json.totals[0];
  check('accepting changes only Transportation, revenue 3019.00', before === 2994 && t2.revenue === 3019, t2);
  check('Transportation source Accepted from note', acc.json.lines.find((l: any) => l.service_name === 'Transportation').price_source === 'Accepted from note');
  check('other lines unchanged', acc.json.lines.filter((l: any) => l.service_name !== 'Transportation').every((l: any) => l.price_source === 'Template'));
}

async function modes() {
  console.log('Portal door, every mode');
  const common = { cargo_mode: 'totals', unit_system: 'metric', packages: [] as any[], ready_date: '2026-11-16' };
  const cases: { name: string; body: any; expectNeeded: boolean; chargeable: number | null }[] = [
    { name: 'Sea LCL', body: { mode: 'Sea', origin: 'Ningbo (NGB)', destination: 'Jebel Ali (JEA)', incoterm: 'FOB', description: 'Valves', load_type: 'LCL', total_quantity: 24, total_weight_kg: 6200, total_volume_cbm: 14, ...common }, expectNeeded: false, chargeable: null },
    { name: 'Sea FCL', body: { mode: 'Sea', origin: 'Ningbo (NGB)', destination: 'Jebel Ali (JEA)', incoterm: 'FOB', description: 'Valves', load_type: 'FCL', container_type: '40 ft standard', container_count: 1, total_quantity: 24, total_weight_kg: 6200, total_volume_cbm: 14, ...common }, expectNeeded: false, chargeable: null },
    { name: 'Land', body: { mode: 'Land', origin: 'Dubai (DXB)', destination: 'Riyadh (RUH)', incoterm: 'DAP', description: 'Consumables', vehicle_type: 'FTL', total_quantity: 12, total_weight_kg: 8000, total_volume_cbm: 20, ...common }, expectNeeded: false, chargeable: null },
    { name: 'Courier', body: { mode: 'Courier', origin: 'Shanghai (SHA)', destination: 'Dubai (DXB)', incoterm: 'DAP', description: 'Samples', total_quantity: 2, total_weight_kg: 30, total_volume_cbm: 0.4, ...common }, expectNeeded: false, chargeable: 80 },
    { name: 'Hand Carry', body: { mode: 'Hand Carry', origin: 'Singapore (SIN)', destination: 'Dubai (DXB)', total_weight_kg: 12, total_volume_cbm: 0, ...common }, expectNeeded: false, chargeable: null },
    { name: 'Others', body: { mode: 'Others', service_description: 'Site survey', ...common }, expectNeeded: false, chargeable: null }
  ];
  for (const c of cases) {
    const r = await call('customer', 'POST', '/api/portal/requests', c.body);
    check(`${c.name}: created`, r.status === 200, r.json);
    if (r.status !== 200) continue;
    const l = await call('gac', 'GET', '/api/gac/requests');
    const row = l.json.find((x: any) => x.id === r.json.id);
    const d = await call('gac', 'GET', `/api/gac/quotations/${row.quotation_id}?peek=1`);
    const needed = d.json.lines.filter((x: any) => x.price_source === 'Rate needed').length;
    check(`${c.name}: priced lines ${d.json.lines.length}, rate needed ${needed}`, (needed > 0) === c.expectNeeded, d.json.lines.map((x: any) => [x.service_name, x.price_source]));
    check(`${c.name}: chargeable`, d.json.cargo.chargeableWeight === c.chargeable, d.json.cargo);
  }
  const bad = await call('customer', 'POST', '/api/portal/requests', { mode: 'Sea', origin: 'Ningbo (NGB)', destination: 'Jebel Ali (JEA)', incoterm: 'FOB', description: 'x', total_quantity: 1, total_weight_kg: 1, total_volume_cbm: 1, ...common });
  check('Sea without load type rejected', bad.status === 400, bad.json);
}

async function sendSample(prefix: string) {
  const samples = await call('gac', 'GET', '/api/gac/emails');
  const sm = samples.json.find((x: any) => x.file_name.startsWith(prefix));
  const sent = await call('gac', 'POST', '/api/gac/emails', { from: sm.from_email, to: sm.to_email, subject: sm.subject, body: sm.body });
  const rid = sent.json.id as number;
  const row = await waitFor(async () => {
    const l = await call('gac', 'GET', '/api/gac/requests');
    const r = l.json.find((x: any) => x.id === rid);
    return r && r.status !== 'Reading email' ? r : null;
  });
  return row;
}

async function samples() {
  console.log('Email door, samples 02 to 05');
  const a = await sendSample('02');
  check('02 Draft ready', a?.status === 'Draft ready', a);
  const da = await call('gac', 'GET', `/api/gac/quotations/${a.quotation_id}?peek=1`);
  check('02 chargeable 466.67', da.json.cargo.chargeableWeight === 466.67, da.json.cargo);
  check('02 no Fuel Surcharge in template', !da.json.lines.some((l: any) => l.service_name === 'Fuel Surcharge'));
  const added = await call('gac', 'POST', `/api/gac/quotations/${a.quotation_id}/lines`, { service_name: 'Fuel Surcharge', basis: 'kg', unit_price: 0.45, est_unit_cost: 0.35, currency: 'USD' });
  check('02 add Fuel Surcharge', added.status === 200 && added.json.draft.lines.some((l: any) => l.service_name === 'Fuel Surcharge'), added.json.error);
  const sv = await call('gac', 'POST', `/api/gac/quotations/${a.quotation_id}/notes`, { change: added.json.change, reason: 'This lane needs it' });
  check('02 note saved with basis kg', sv.json.notes_written?.[0]?.basis === 'kg', sv.json.notes_written);
  const b = await sendSample('03');
  check('03 Draft ready', b?.status === 'Draft ready', b);
  const db = await call('gac', 'GET', `/api/gac/quotations/${b.quotation_id}?peek=1`);
  check('03 chargeable 500.00', db.json.cargo.chargeableWeight === 500, db.json.cargo);
  const sug = db.json.suggestions.find((x: any) => x.service_name === 'Fuel Surcharge');
  check('03 suggestion Add Fuel Surcharge 0.45 per kg, not applied', sug?.value === 0.45 && sug?.basis === 'kg' && !db.json.lines.some((l: any) => l.service_name === 'Fuel Surcharge'), db.json.suggestions);
  const acc = await call('gac', 'POST', `/api/gac/quotations/${b.quotation_id}/suggestions/${sug.note_id}`, { action: 'accept' });
  check('03 accepted line source says Accepted from note', acc.json.lines.find((l: any) => l.service_name === 'Fuel Surcharge')?.price_source === 'Accepted from note');
  const c = await sendSample('04');
  check('04 request created', Boolean(c) && c.customer === 'New Client Logistics', c);
  const dc = await call('gac', 'GET', `/api/gac/quotations/${c.quotation_id}?peek=1`);
  check('04 totals 2700 kg 18.5 CBM, Sea, no chargeable', dc.json.cargo.grossWeight === 2700 && dc.json.cargo.volume === 18.5 && dc.json.cargo.chargeableWeight === null && dc.json.quotation.mode === 'Sea', dc.json.cargo);
  check('04 all lines Rate needed', dc.json.lines.length === 4 && dc.json.lines.every((l: any) => l.price_source === 'Rate needed'), dc.json.lines.map((l: any) => l.price_source));
  const blocked = await call('gac', 'POST', `/api/gac/quotations/${c.quotation_id}/submit`, {});
  check('04 submit blocked', blocked.status === 400, blocked.json);
  const e = await sendSample('05');
  check('05 Missing information', e?.status === 'Missing information', e);
  check('05 missing exactly incoterm, weight, volume', JSON.stringify(e.missing) === JSON.stringify(['Incoterm', 'Total weight', 'Total volume']), e.missing);
  const unclear = await call('gac', 'POST', `/api/gac/requests/${e.id}/information`, { text: 'it is about 500' });
  check('05 unclear text changes nothing and asks', unclear.json.changed.length === 0 && unclear.json.unclear.length > 0 && unclear.json.complete === false, unclear.json);
  const fixed = await call('gac', 'POST', `/api/gac/requests/${e.id}/information`, { text: 'Incoterm is FCA, total weight 120 kg, volume 0.9 cbm' });
  check('05 Add Information completes and opens draft', fixed.json.complete === true && fixed.json.quotation_id, fixed.json);
}

async function mailbox(address: string) {
  return (await call('gac', 'GET', `/api/gac/mailbox?address=${encodeURIComponent(address)}`)).json;
}

async function mailboxFlow() {
  console.log('Email door, customer mailbox');
  const empty = await mailbox('');
  check('mailbox lists one entry per sample sender', empty.customers.length === 9 && empty.customers.every((c: any) => c.company && c.address), empty.customers);
  check('customer API cannot read the mailbox', (await call('customer', 'GET', '/api/gac/mailbox')).status === 403);
  const p12 = await mailbox('procurement@principal12.demo');
  check('principal 12 has its two templates', p12.templates.length === 2 && p12.templates.every((t: any) => t.from === 'procurement@principal12.demo'), p12.templates);
  const all = (await call('gac', 'GET', '/api/gac/emails')).json;
  check('ten samples load', all.length === 10, all.length);
  const labels = (await mailbox('logistics@principal07.demo')).templates.concat(p12.templates);
  check('labels have no developer words', labels.every((t: any) => !/hero|loop/i.test(t.label)), labels.map((t: any) => t.label));
  check('templates carry an expected result line', labels.every((t: any) => /^Expect: /.test(t.expect)), labels.map((t: any) => t.expect));

  for (const [prefix, mode] of [['06', 'Courier'], ['07', 'Land'], ['08', 'Sea']] as const) {
    const r = await sendSample(prefix);
    check(`${prefix} ${mode} Draft ready`, r?.status === 'Draft ready' && r?.mode === mode, r);
  }
  const fcl = await mailbox('imports@harborlight.demo');
  const fclRow = (await call('gac', 'GET', '/api/gac/requests')).json.find((x: any) => x.id === fcl.sent[0].id);
  const fclDraft = await call('gac', 'GET', `/api/gac/quotations/${fclRow.quotation_id}?peek=1`);
  const fd = fclDraft.json.request.data;
  check('08 container type and count read', fd.load_type === 'FCL' && fd.container_type === '40 ft standard' && fd.container_count === 2, fd);
  const ai = fcl.sent[0].ai;
  check('sent item shows who answered, the duration, and the reason when the rule reader answered', Boolean(ai && typeof ai.seconds === 'number' && (ai.provider === 'rules' ? ai.fallback_used && ai.reason : ai.model)), ai);

  const sl = await sendSample('10');
  const slMissing: string[] = sl?.missing ?? [];
  check('10 stocklist reaches Missing information without guessing', sl?.status === 'Missing information' && ['Origin', 'Incoterm', 'Total weight', 'Total volume'].every((x) => slMissing.includes(x)), sl);
  if (!sl?.ai_fallback) {
    const sld = (await call('gac', 'GET', `/api/gac/requests/${sl.id}`)).json;
    check('10 read by the AI: mode Air, destination Istanbul (IST), only four fields missing', sld.mode === 'Air' && sld.data.destination === 'Istanbul (IST)' && slMissing.length === 4, { mode: sld.mode, destination: sld.data.destination, missing: slMissing });
  }
  const inc = await sendSample('05');
  const box5 = await mailbox('alex@randomtrading.demo');
  const s5 = box5.sent.find((x: any) => x.id === inc.id);
  check('05 shows Missing information in Sent', s5?.status === 'Missing information', s5);
  const ask = box5.inbox.find((m: any) => m.kind === 'clarification' && m.request_id === inc.id);
  check('05 clarification email in Inbox', Boolean(ask) && ask.can_reply && /^Re: /.test(ask.subject), ask);
  const askLines = (ask?.body ?? '').split('\n').filter((l: string) => l.startsWith('- '));
  check('05 clarification lists exactly incoterm, weight, volume', JSON.stringify(askLines) === JSON.stringify(['- Incoterm', '- Total weight', '- Total volume']) && ask.body.includes(inc.number), ask?.body);
  check('clarification has no long dashes', !LONG_DASH.test(JSON.stringify(ask)));
  const replied = await call('gac', 'POST', `/api/gac/requests/${inc.id}/information`, { text: 'Incoterm is FCA, total weight 120 kg, volume 0.9 cbm' });
  check('05 reply completes the request', replied.json.complete === true && replied.json.status === 'Draft ready', replied.json);
  const box5b = await mailbox('alex@randomtrading.demo');
  check('05 Sent now Draft ready', box5b.sent.find((x: any) => x.id === inc.id)?.status === 'Draft ready');
  check('05 clarification can no longer be answered', box5b.inbox.find((m: any) => m.id === ask.id)?.can_reply === false);

  const w = await sendSample('09');
  check('09 missing only total weight', w?.status === 'Missing information' && JSON.stringify(w.missing) === JSON.stringify(['Total weight']), w);
  const box9 = await mailbox('shipping@cedarpoint.demo');
  const ask9 = box9.inbox.find((m: any) => m.request_id === w.id);
  const ask9Lines = (ask9?.body ?? '').split('\n').filter((l: string) => l.startsWith('- '));
  check('09 clarification asks only for the weight', JSON.stringify(ask9Lines) === JSON.stringify(['- Total weight']), ask9?.body);
  const unclear = await call('gac', 'POST', `/api/gac/requests/${w.id}/information`, { text: 'about 300' });
  check('09 unclear reply keeps it open', unclear.json.complete === false, unclear.json);
  const asks9 = (await mailbox('shipping@cedarpoint.demo')).inbox.filter((m: any) => m.request_id === w.id);
  check('09 only the newest clarification can be answered', asks9.length === 2 && asks9[0].can_reply && !asks9[1].can_reply, asks9.map((m: any) => m.can_reply));
  const done9 = await call('gac', 'POST', `/api/gac/requests/${w.id}/information`, { text: 'Total weight 180 kg' });
  check('09 reply with the weight completes it', done9.json.complete === true, done9.json);

  const hero = await sendSample('01');
  const subs = await Promise.all([1, 2].map(() => call('gac', 'POST', `/api/gac/quotations/${hero.quotation_id}/submit`, {})));
  const okSubs = subs.filter((x) => x.status === 200).length;
  check('double Submit: exactly one succeeds', okSubs === 1 && subs.every((x) => x.status === 200 || x.status === 400 || x.status === 409), subs.map((x) => x.status));
  const [a1, a2] = await Promise.all([
    call('gac', 'POST', `/api/gac/quotations/${hero.quotation_id}/decision`, { action: 'Accept' }),
    call('gac', 'POST', `/api/gac/quotations/${hero.quotation_id}/decision`, { action: 'Accept' })
  ]);
  check('double Accept: exactly one succeeds', [a1.status, a2.status].sort().join() === '200,409', [a1.status, a2.status]);
  const prev = await call('gac', 'POST', `/api/gac/quotations/${hero.quotation_id}/send-preview`, {});
  const [s1, s2] = await Promise.all([
    call('gac', 'POST', `/api/gac/quotations/${hero.quotation_id}/send`, { subject: prev.json.subject, body: prev.json.body }),
    call('gac', 'POST', `/api/gac/quotations/${hero.quotation_id}/send`, { subject: prev.json.subject, body: prev.json.body })
  ]);
  check('double Send: exactly one succeeds', [s1.status, s2.status].sort().join() === '200,409', [s1.status, s2.status, s1.json, s2.json]);
  const box7 = await mailbox('logistics@principal07.demo');
  const qmail = box7.inbox.filter((m: any) => m.kind === 'quotation' && m.request_id === hero.id);
  check('quotation email appears once in the Inbox', qmail.length === 1, qmail.length);
  const qm = qmail[0];
  check('quotation email has subject, body and 7 services', Boolean(qm && /^Quotation QT-/.test(qm.subject) && qm.body && qm.services.length === 7), qm);
  check('quotation email total USD 2,994.00', qm?.totals.length === 1 && qm.totals[0].currency === 'USD' && qm.totals[0].amount === 2994, qm?.totals);
  check('Inbox has no cost, margin or source keys', leaks(box7.inbox).length === 0 && !/\b(cost|margin)\b/i.test(qm?.body ?? ''), leaks(box7.inbox));
  check('Sent shows Quotation sent', box7.sent.find((x: any) => x.id === hero.id)?.status === 'Quotation sent');
}

async function main() {
  const only = process.argv[2];
  if (!only || only === 'modes') await modes();
  if (!only || only === 'portal') await portalFlow();
  if (!only || only === 'hero') await heroEmail();
  if (!only || only === 'samples') await samples();
  if (!only || only === 'mailbox') await mailboxFlow();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
