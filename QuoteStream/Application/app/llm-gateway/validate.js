export const MODES = ['Air', 'Sea', 'Land', 'Courier', 'Hand Carry', 'Others'];
export const SERVICE_TYPES = ['Direct', 'Consolidation'];
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
export const CANON_SERVICES = [
  'Origin Charges',
  'Airfreight',
  'Fuel Surcharge',
  'Security Surcharge',
  'Export Customs',
  'Import Customs',
  'Transportation',
  'Ocean Freight',
  'Origin Terminal Handling',
  'Destination Port Clearance',
  'On-carriage',
  'Courier Service',
  'Road Freight',
  'Hand Carry Service',
  'Special Handling'
];
export const UPDATE_FIELDS = [
  'customer',
  'mode',
  'origin',
  'destination',
  'incoterm',
  'job_type',
  'service',
  'total_weight_kg',
  'total_volume_cbm',
  'pos'
];
const STRING_GUARDED = ['origin', 'destination', 'incoterm', 'job_type', 'customer'];

export function round(n) {
  return Math.round(n * 1000) / 1000;
}

export function compact(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function appearsIn(value, text) {
  const v = compact(value);
  if (!v) return false;
  const t = compact(text);
  if (t.includes(v)) return true;
  const m = /^(.+?)\s*\(([A-Za-z]{3})\)$/.exec(String(value).trim());
  return Boolean(m) && t.includes(compact(m[1])) && new RegExp(`\\b${m[2]}\\b`, 'i').test(String(text));
}

export function parseJson(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function computeMissing(r) {
  const missing = [];
  if (!r.customer) missing.push('customer');
  if (!r.mode) missing.push('mode');
  if (!r.origin) missing.push('origin');
  if (!r.destination) missing.push('destination');
  if (!r.incoterm) missing.push('incoterm');
  if (r.total_weight_kg === null || r.total_weight_kg === undefined) missing.push('total_weight');
  if (r.total_volume_cbm === null || r.total_volume_cbm === undefined) missing.push('total_volume');
  return missing;
}

export function mapServices(text) {
  const t = String(text).toLowerCase();
  const out = new Set();
  if (/origin charges?/.test(t)) out.add('Origin Charges');
  if (/air\s?freight/.test(t)) out.add('Airfreight');
  if (/fuel/.test(t)) out.add('Fuel Surcharge');
  if (/security/.test(t)) out.add('Security Surcharge');
  if (/customs|clearance/.test(t) && !/destination port clearance/.test(t)) {
    const ex = /export/.test(t);
    const im = /import/.test(t);
    if (ex || !im) out.add('Export Customs');
    if (im || !ex) out.add('Import Customs');
  }
  if (/final delivery|transportation|delivery transport|last mile/.test(t)) out.add('Transportation');
  if (/ocean freight|sea freight/.test(t)) out.add('Ocean Freight');
  if (/origin terminal handling|\bothc\b/.test(t)) out.add('Origin Terminal Handling');
  if (/destination port clearance/.test(t)) out.add('Destination Port Clearance');
  if (/on-?\s?carriage/.test(t)) out.add('On-carriage');
  if (/courier/.test(t)) out.add('Courier Service');
  if (/road freight|trucking/.test(t)) out.add('Road Freight');
  if (/hand carry/.test(t)) out.add('Hand Carry Service');
  if (/special handling/.test(t)) out.add('Special Handling');
  return CANON_SERVICES.filter((s) => out.has(s));
}

export function normalizeServiceList(list) {
  const out = new Set();
  for (const item of list) {
    const exact = CANON_SERVICES.find((s) => s.toLowerCase() === String(item).trim().toLowerCase());
    if (exact) out.add(exact);
    else for (const m of mapServices(item)) out.add(m);
  }
  return CANON_SERVICES.filter((s) => out.has(s));
}

export function parseStatedTotals(text) {
  const w = /total\s+(?:gross\s+)?weight\s*[:=]?\s*([\d,]*\.?\d+)\s*(?:kgs?|kilograms?)/i.exec(text);
  const v = /total\s+(?:gross\s+)?volume\s*[:=]?\s*([\d,]*\.?\d+)\s*(?:cbm|m3|m³)/i.exec(text);
  return {
    weight: w ? Number(w[1].replace(/,/g, '')) : null,
    volume: v ? Number(v[1].replace(/,/g, '')) : null
  };
}

function strOrNull(v, name, errors) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') {
    errors.push(`${name} must be a string or null`);
    return null;
  }
  const t = v.trim();
  if (!t || /^(null|none|n\/a|unknown|not stated)$/i.test(t)) return null;
  return t;
}

function numOrNull(v, name, errors) {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    errors.push(`${name} must be a number or null`);
    return null;
  }
  return n;
}

function enumOrNull(v, list, aliases, name, errors) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') {
    errors.push(`${name} must be a string or null`);
    return null;
  }
  const t = v.trim().toLowerCase();
  if (!t || t === 'null') return null;
  const hit = list.find((x) => x.toLowerCase() === t) || aliases[t];
  if (!hit) {
    errors.push(`${name} must be one of ${list.join(', ')} or null`);
    return null;
  }
  return hit;
}

const MODE_ALIASES = { ocean: 'Sea', road: 'Land', truck: 'Land', 'air freight': 'Air', 'sea freight': 'Sea' };
const SERVICE_ALIASES = { consolidated: 'Consolidation', fcl: 'Direct' };

function cleanPos(v, errors, key) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    errors.push(`${key} must be an array`);
    return [];
  }
  const out = [];
  for (const p of v) {
    if (!p || typeof p !== 'object') {
      errors.push(`${key} items must be objects`);
      continue;
    }
    const po = typeof p.po_number === 'string' ? p.po_number.trim() : '';
    const w = typeof p.weight_kg === 'string' ? Number(p.weight_kg) : p.weight_kg;
    const c = typeof p.volume_cbm === 'string' ? Number(p.volume_cbm) : p.volume_cbm;
    if (!po || !Number.isFinite(w) || !Number.isFinite(c) || w < 0 || c < 0) {
      errors.push(`each po needs po_number, weight_kg and volume_cbm`);
      continue;
    }
    out.push({ po_number: po, weight_kg: w, volume_cbm: c });
  }
  return out;
}

export function validateExtract(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['reply must be a JSON object'], value: null };
  }
  const value = {
    customer: strOrNull(raw.customer, 'customer', errors),
    contact_name: strOrNull(raw.contact_name, 'contact_name', errors),
    contact_email: strOrNull(raw.contact_email, 'contact_email', errors),
    mode: enumOrNull(raw.mode, MODES, MODE_ALIASES, 'mode', errors),
    origin: strOrNull(raw.origin, 'origin', errors),
    destination: strOrNull(raw.destination, 'destination', errors),
    incoterm: null,
    job_type: strOrNull(raw.job_type, 'job_type', errors),
    service: enumOrNull(raw.service, SERVICE_TYPES, SERVICE_ALIASES, 'service', errors),
    pos: cleanPos(raw.pos, errors, 'pos'),
    total_weight_kg: numOrNull(raw.total_weight_kg, 'total_weight_kg', errors),
    total_volume_cbm: numOrNull(raw.total_volume_cbm, 'total_volume_cbm', errors),
    requested_services: [],
    missing: [],
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : ''
  };
  const inc = strOrNull(raw.incoterm, 'incoterm', errors);
  if (inc) {
    const u = inc.toUpperCase();
    if (INCOTERMS.includes(u)) value.incoterm = u;
    else errors.push('incoterm must be a 3 letter incoterm code or null');
  }
  if (raw.requested_services !== undefined && raw.requested_services !== null) {
    if (Array.isArray(raw.requested_services) && raw.requested_services.every((x) => typeof x === 'string')) {
      value.requested_services = normalizeServiceList(raw.requested_services);
    } else {
      errors.push('requested_services must be an array of strings');
    }
  }
  value.missing = computeMissing(value);
  return { ok: errors.length === 0, errors, value };
}

export function applyExtractGuard(value, ctx) {
  const out = { ...value };
  for (const f of STRING_GUARDED) {
    if (out[f] && !appearsIn(out[f], ctx.text)) out[f] = null;
  }
  out.pos = out.pos.filter((p) => appearsIn(p.po_number, ctx.text));
  out.contact_email = ctx.fromAddress || null;
  const stated = parseStatedTotals(ctx.text);
  const sumW = out.pos.length ? round(out.pos.reduce((a, p) => a + p.weight_kg, 0)) : null;
  const sumV = out.pos.length ? round(out.pos.reduce((a, p) => a + p.volume_cbm, 0)) : null;
  out.total_weight_kg = stated.weight !== null ? stated.weight : sumW;
  out.total_volume_cbm = stated.volume !== null ? stated.volume : sumV;
  const notes = [];
  if (stated.weight !== null && sumW !== null && Math.abs(stated.weight - sumW) > 0.01) {
    notes.push('Stated total weight differs from the sum of the POs; the stated total was kept.');
  }
  if (stated.volume !== null && sumV !== null && Math.abs(stated.volume - sumV) > 0.01) {
    notes.push('Stated total volume differs from the sum of the POs; the stated total was kept.');
  }
  out.notes = notes.join(' ');
  out.missing = computeMissing(out);
  return out;
}

export function validateUpdate(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['reply must be a JSON object'], value: null };
  }
  const ch = raw.changes && typeof raw.changes === 'object' && !Array.isArray(raw.changes) ? raw.changes : {};
  if (raw.changes !== undefined && ch !== raw.changes) errors.push('changes must be an object');
  const changes = {};
  for (const [k, v] of Object.entries(ch)) {
    if (v === null || v === undefined) continue;
    if (!UPDATE_FIELDS.includes(k)) continue;
    const sub = [];
    if (k === 'mode') {
      const m = enumOrNull(v, MODES, MODE_ALIASES, k, sub);
      if (m) changes[k] = m;
    } else if (k === 'service') {
      const s = enumOrNull(v, SERVICE_TYPES, SERVICE_ALIASES, k, sub);
      if (s) changes[k] = s;
    } else if (k === 'incoterm') {
      const s = strOrNull(v, k, sub);
      if (s && INCOTERMS.includes(s.toUpperCase())) changes[k] = s.toUpperCase();
      else if (s) sub.push('bad incoterm');
    } else if (k === 'total_weight_kg' || k === 'total_volume_cbm') {
      const n = numOrNull(v, k, sub);
      if (n !== null && n > 0) changes[k] = n;
    } else if (k === 'pos') {
      const p = cleanPos(v, sub, k);
      if (p.length) changes[k] = p;
    } else {
      const s = strOrNull(v, k, sub);
      if (s) changes[k] = s;
    }
    errors.push(...sub);
  }
  let unclear = [];
  if (raw.unclear !== undefined && raw.unclear !== null) {
    if (Array.isArray(raw.unclear) && raw.unclear.every((x) => typeof x === 'string')) {
      unclear = raw.unclear.map((x) => x.trim()).filter(Boolean);
    } else errors.push('unclear must be an array of strings');
  }
  return { ok: errors.length === 0, errors, value: { changes, unclear } };
}

export function applyUpdateGuard(value, ctx) {
  const changes = {};
  for (const [k, v] of Object.entries(value.changes)) {
    if (STRING_GUARDED.includes(k) && k !== 'incoterm') {
      if (appearsIn(v, ctx.text)) changes[k] = v;
    } else if (k === 'incoterm') {
      if (appearsIn(v, ctx.text)) changes[k] = v;
    } else if (k === 'total_weight_kg') {
      if (ctx.parsed.weight !== null && Math.abs(ctx.parsed.weight - v) < 0.01) changes[k] = v;
    } else if (k === 'total_volume_cbm') {
      if (ctx.parsed.volume !== null && Math.abs(ctx.parsed.volume - v) < 0.01) changes[k] = v;
    } else if (k === 'pos') {
      const ok = v.filter((p) => appearsIn(p.po_number, ctx.text));
      if (ok.length) changes[k] = ok;
    } else {
      changes[k] = v;
    }
  }
  return { changes, unclear: value.unclear };
}

export const FORBIDDEN_WORDS = /\b(cost|costs|margin|margins|profit|profits|internal)\b/i;

export function sanitizeDashes(s) {
  return String(s).replace(/\s*[\u2013\u2014]\s*/g, ', ');
}

export function validateEmailInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['body must be a JSON object'] };
  for (const k of ['quotation_number', 'origin', 'destination']) {
    if (typeof input[k] !== 'string' || !input[k].trim()) errors.push(`${k} is required`);
  }
  if (input.totals === undefined || typeof input.totals !== 'object' || input.totals === null || Array.isArray(input.totals)) {
    errors.push('totals must be an object of currency to number');
  } else {
    for (const [c, n] of Object.entries(input.totals)) {
      if (typeof n !== 'number' || !Number.isFinite(n)) errors.push(`totals.${c} must be a number`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function formatAmount(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function totalLines(totals) {
  return Object.entries(totals).map(([c, n]) => `${c} ${formatAmount(n)}`);
}

export function emailSubject(input) {
  const version = Number(input.version);
  let s = `Quotation ${input.quotation_number}, ${input.origin} to ${input.destination}`;
  if (Number.isFinite(version) && version > 1) s += `, version ${version}`;
  return sanitizeDashes(s);
}

export function validateEmailOutput(raw, input) {
  if (!raw || typeof raw !== 'object' || typeof raw.body !== 'string' || !raw.body.trim()) {
    return { ok: false, errors: ['reply must be a JSON object with a body string'], value: null };
  }
  const body = sanitizeDashes(raw.body.trim());
  if (FORBIDDEN_WORDS.test(body)) {
    return { ok: false, fatal: true, errors: ['forbidden wording'], value: null };
  }
  const errors = [];
  for (const line of totalLines(input.totals)) {
    if (!body.includes(line)) errors.push(`body must contain the total exactly as "${line}"`);
  }
  if (input.valid_until && !body.includes(String(input.valid_until))) {
    errors.push(`body must mention the validity date "${input.valid_until}"`);
  }
  if (errors.length) return { ok: false, errors, value: null };
  return { ok: true, errors: [], value: { subject: emailSubject(input), body } };
}

const FOLLOW_KINDS = ['no_reply', 'revision', 'validity'];

export function validateFollowUpInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['body must be a JSON object'] };
  for (const k of ['quotation_number', 'customer', 'mode', 'origin', 'destination']) {
    if (typeof input[k] !== 'string' || !input[k].trim()) errors.push(`${k} is required`);
  }
  if (!FOLLOW_KINDS.includes(input.kind)) errors.push(`kind must be one of ${FOLLOW_KINDS.join(', ')}`);
  if (errors.length) return { ok: false, errors };
  const s = (k) => String(input[k]).trim().slice(0, 80);
  return {
    ok: true,
    errors: [],
    value: {
      quotation_number: s('quotation_number'),
      customer: s('customer'),
      mode: s('mode'),
      origin: s('origin'),
      destination: s('destination'),
      kind: input.kind,
      days: Number.isFinite(Number(input.days)) ? Math.max(0, Math.round(Number(input.days))) : 0,
      valid_until: typeof input.valid_until === 'string' ? input.valid_until.slice(0, 10) : ''
    }
  };
}

export function followUpSubject(input) {
  return `Following up on ${input.quotation_number}`;
}

const FOLLOW_UP_FORBIDDEN = /\b(cost|costs|margin|margins|profit|profits|internal|source|sources|median)\b|\b(USD|EUR|AED|GBP)\b|\d[\d,]*\.\d{2}\b/i;

export function validateFollowUpOutput(raw, input) {
  if (!raw || typeof raw !== 'object' || typeof raw.body !== 'string' || !raw.body.trim()) {
    return { ok: false, errors: ['reply must be a JSON object with a body string'], value: null };
  }
  const body = sanitizeDashes(raw.body.trim());
  if (FOLLOW_UP_FORBIDDEN.test(body)) return { ok: false, fatal: true, errors: ['forbidden wording'], value: null };
  const errors = [];
  if (!body.includes(input.quotation_number)) errors.push(`body must mention ${input.quotation_number}`);
  if (!body.includes(input.origin) || !body.includes(input.destination)) errors.push(`body must mention ${input.origin} to ${input.destination}`);
  if (input.kind === 'validity' && input.valid_until && !body.includes(input.valid_until)) errors.push(`body must mention the validity date "${input.valid_until}"`);
  if (!/Christine Zock\s*\n\s*GAC\s*$/.test(body)) errors.push('body must end with Christine Zock and GAC on their own lines');
  if (errors.length) return { ok: false, errors, value: null };
  return { ok: true, errors: [], value: { subject: followUpSubject(input), body } };
}

export function followUpFallback(input) {
  const lane = `${input.origin} to ${input.destination}`;
  const opener =
    input.kind === 'revision'
      ? `Thank you for your revision request on our quotation ${input.quotation_number} for ${input.mode} from ${lane}. We are reviewing it and will come back with an updated offer shortly.`
      : `I wanted to check whether you had a chance to review our quotation ${input.quotation_number} for ${input.mode} from ${lane}.`;
  const validity = input.kind === 'validity' && input.valid_until ? ` Please note that the quotation is valid until ${input.valid_until}.` : '';
  return {
    subject: followUpSubject(input),
    body: sanitizeDashes(`Dear team,\n\n${opener}${validity} We are happy to adjust the rate or the timing if that helps.\n\nKind regards,\nChristine Zock\nGAC`)
  };
}
