import {
  INCOTERMS,
  computeMissing,
  mapServices,
  parseStatedTotals,
  round,
  formatAmount,
  totalLines,
  emailSubject,
  sanitizeDashes
} from './validate.js';

const WORDS = [
  'new', 'client', 'random', 'trading', 'logistics', 'freight', 'shipping', 'cargo', 'transport',
  'global', 'express', 'group', 'international', 'supply', 'imports', 'exports', 'trade', 'marine',
  'line', 'lines', 'worldwide', 'partners', 'solutions', 'services', 'general', 'star', 'blue'
];
const GENERIC_DOMAINS = ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'proton', 'protonmail'];

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function segment(label) {
  const best = new Array(label.length + 1).fill(null);
  best[0] = [];
  for (let i = 1; i <= label.length; i++) {
    for (const w of WORDS) {
      if (w.length <= i && best[i - w.length] && label.slice(i - w.length, i) === w) {
        const cand = [...best[i - w.length], w];
        if (!best[i] || cand.length < best[i].length) best[i] = cand;
      }
    }
  }
  return best[label.length];
}

export function customerFromDomain(address) {
  const m = /@([A-Za-z0-9.-]+)/.exec(address || '');
  if (!m) return null;
  const label = m[1].split('.')[0].toLowerCase().replace(/[^a-z]/g, '');
  if (!label || GENERIC_DOMAINS.includes(label)) return null;
  const seg = segment(label);
  if (seg) return seg.map(cap).join(' ');
  const tail = [...WORDS].sort((a, b) => b.length - a.length).find((w) => label.endsWith(w) && label.length > w.length);
  if (tail) return `${cap(label.slice(0, label.length - tail.length))} ${cap(tail)}`;
  return cap(label);
}

export function parseAddress(from) {
  const m = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(from || '');
  return m ? m[0] : null;
}

function signature(body) {
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(best regards|kind regards|regards|thanks|thank you|sincerely|cheers)\s*,?\s*$/i.test(lines[i])) {
      const rest = lines.slice(i + 1).map((l) => l.trim()).filter(Boolean);
      return { name: rest[0] || null, company: rest[1] || null };
    }
  }
  return { name: null, company: null };
}

function field(text, label) {
  const m = new RegExp(`^[ \\t]*[-*]?[ \\t]*${label}[ \\t]*:[ \\t]*(.+)$`, 'im').exec(text);
  return m ? m[1].trim() : null;
}

function routeFromSubjectOrBody(subject, body) {
  const cw = '[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*';
  const sources = [subject.includes(':') ? subject.slice(subject.lastIndexOf(':') + 1) : subject, subject, body];
  for (const s of sources) {
    const a = new RegExp(`\\bfrom (${cw}) to (${cw})`).exec(s);
    if (a) return [a[1], a[2]];
  }
  for (const s of sources) {
    const b = new RegExp(`\\b(${cw}) to (${cw})`).exec(s);
    if (b) return [b[1], b[2]];
  }
  return [null, null];
}

function modeFrom(text) {
  const m = field(text, 'Mode');
  const t = (m || '').toLowerCase();
  const pick = (s) => {
    if (/\bair\b/.test(s)) return 'Air';
    if (/\b(sea|ocean)\b/.test(s)) return 'Sea';
    if (/\b(land|road|truck)\b/.test(s)) return 'Land';
    if (/courier/.test(s)) return 'Courier';
    if (/hand carry/.test(s)) return 'Hand Carry';
    return null;
  };
  if (m) return pick(t) || 'Others';
  const low = text.toLowerCase();
  if (/air\s?freight|air shipment|by air/.test(low)) return 'Air';
  if (/ocean freight|sea freight|by sea/.test(low)) return 'Sea';
  if (/road freight|trucking/.test(low)) return 'Land';
  if (/courier/.test(low)) return 'Courier';
  if (/hand carry/.test(low)) return 'Hand Carry';
  return null;
}

function parsePos(text) {
  const out = [];
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    const po = /\b(PO-[A-Za-z0-9-]*\d[A-Za-z0-9-]*)/i.exec(line);
    if (!po) continue;
    const rest = line.slice(po.index + po[0].length);
    const w = /([\d,]*\.?\d+)\s*kgs?\b/i.exec(rest);
    const v = /([\d,]*\.?\d+)\s*(?:cbm|m3|m³)/i.exec(rest);
    if (!w || !v) continue;
    const key = po[1].toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      po_number: po[1],
      weight_kg: Number(w[1].replace(/,/g, '')),
      volume_cbm: Number(v[1].replace(/,/g, ''))
    });
  }
  return out;
}

function servicesSegment(body) {
  const parts = [];
  for (const line of body.split(/\r?\n/)) {
    if (/\b(please include|services needed|services required|include)\b/i.test(line) && !/^\s*$/.test(line)) parts.push(line);
  }
  return parts.join(' ');
}

export function extractFallback(input) {
  const from = input.from || '';
  const subject = input.subject || '';
  const body = input.body || '';
  const text = `${subject}\n${body}`;
  const address = parseAddress(from);
  const sig = signature(body);

  let customer = null;
  const dp = /Demo Principal \d+/i.exec(text);
  if (dp) customer = dp[0];
  if (!customer) {
    const we = /\b[Ww]e are ([A-Z][\w&.' -]+?)(?:\s+and\b|[,.;\n]|$)/.exec(body);
    if (we) customer = we[1].trim();
  }
  if (!customer && sig.company && !/@/.test(sig.company)) customer = sig.company;
  if (!customer) customer = customerFromDomain(address);

  let origin = field(text, 'Origin');
  let destination = field(text, 'Destination');
  if (!origin || !destination) {
    const [o, d] = routeFromSubjectOrBody(subject, body);
    origin = origin || o;
    destination = destination || d;
  }

  let incoterm = null;
  const incField = field(text, 'Incoterm');
  if (incField && INCOTERMS.includes(incField.slice(0, 3).toUpperCase())) incoterm = incField.slice(0, 3).toUpperCase();
  if (!incoterm) {
    const any = new RegExp(`\\b(${INCOTERMS.join('|')})\\b`).exec(text);
    if (any) incoterm = any[1];
  }

  let service = null;
  const svc = /^[ \t]*[-*]?[ \t]*Service[ \t]*:[ \t]*(.+)$/im.exec(text);
  const svcText = svc ? svc[1] : text;
  if (/consolidat/i.test(svcText)) service = 'Consolidation';
  else if (svc && /\bdirect\b/i.test(svc[1])) service = 'Direct';

  const pos = parsePos(text);
  const stated = parseStatedTotals(text);
  const sumW = pos.length ? round(pos.reduce((a, p) => a + p.weight_kg, 0)) : null;
  const sumV = pos.length ? round(pos.reduce((a, p) => a + p.volume_cbm, 0)) : null;
  const totalW = stated.weight !== null ? stated.weight : sumW;
  const totalV = stated.volume !== null ? stated.volume : sumV;
  const notes = [];
  if (stated.weight !== null && sumW !== null && Math.abs(stated.weight - sumW) > 0.01) {
    notes.push('Stated total weight differs from the sum of the POs; the stated total was kept.');
  }
  if (stated.volume !== null && sumV !== null && Math.abs(stated.volume - sumV) > 0.01) {
    notes.push('Stated total volume differs from the sum of the POs; the stated total was kept.');
  }

  const result = {
    customer,
    contact_name: sig.name,
    contact_email: address,
    mode: modeFrom(text),
    origin: origin || null,
    destination: destination || null,
    incoterm,
    job_type: field(text, 'Job Type'),
    service,
    pos,
    total_weight_kg: totalW,
    total_volume_cbm: totalV,
    requested_services: mapServices(servicesSegment(body)),
    missing: [],
    notes: notes.join(' ')
  };
  result.missing = computeMissing(result);
  return result;
}

const UNITS_W = '(kgs?|kilograms?|lbs?|pounds?|tonnes?|tons?|mt)';
const UNITS_V = '(cbm|m3|m\\u00b3|m\\^3|cubic\\s*met(?:er|re)s?)';

function toKg(n, unit) {
  const u = unit.toLowerCase();
  if (/^(kg|kgs|kilogram|kilograms)$/.test(u)) return n;
  if (/^(lb|lbs|pound|pounds)$/.test(u)) return n * 0.45359237;
  return n * 1000;
}

export function parseWeightVolume(text) {
  const w = new RegExp(`([\\d,]*\\.?\\d+)\\s*${UNITS_W}\\b`, 'i').exec(text);
  const v = new RegExp(`([\\d,]*\\.?\\d+)\\s*${UNITS_V}`, 'i').exec(text);
  return {
    weight: w ? Math.round(toKg(Number(w[1].replace(/,/g, '')), w[2]) * 100) / 100 : null,
    volume: v ? Math.round(Number(v[1].replace(/,/g, '')) * 1000) / 1000 : null
  };
}

function titleCase(s) {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (/^\(.*\)$/.test(w) ? w.toUpperCase() : cap(w.toLowerCase())))
    .join(' ');
}

export function updateFallback(request, text) {
  const req = JSON.parse(JSON.stringify(request));
  const changes = {};
  const unclear = [];
  let rest = ` ${text} `;

  const poHits = parsePos(text.replace(/[;,]\s*(?=PO-)/gi, '\n'));
  if (poHits.length) {
    const merged = Array.isArray(req.pos) ? req.pos.map((p) => ({ ...p })) : [];
    for (const p of poHits) {
      const i = merged.findIndex((m) => m.po_number.toLowerCase() === p.po_number.toLowerCase());
      if (i >= 0) merged[i] = p;
      else merged.push(p);
    }
    changes.pos = merged;
    rest = rest.replace(/PO-[A-Za-z0-9-]*\d[^;\n]*?(?:cbm|m3|m³)/gi, ' ');
  }

  const incMatch = new RegExp(`\\b(${INCOTERMS.join('|')})\\b`, 'i').exec(rest);
  if (incMatch) changes.incoterm = incMatch[1].toUpperCase();
  else {
    const bad = /\bincoterm\s*(?:is|:|=)?\s*([A-Za-z]+)/i.exec(rest);
    if (bad) unclear.push(`Which incoterm do you mean? "${bad[1]}" is not a recognised incoterm.`);
    else if (/\bincoterm\b/i.test(rest)) unclear.push('Which incoterm should be used?');
  }

  const mode = /\b(?:mode\s*(?:is|:)?\s*|by\s+|via\s+)(air|sea|ocean|road|land|truck|courier|hand carry)\b/i.exec(rest);
  if (mode) {
    const m = mode[1].toLowerCase();
    changes.mode = m === 'air' ? 'Air' : m === 'sea' || m === 'ocean' ? 'Sea' : m === 'courier' ? 'Courier' : m === 'hand carry' ? 'Hand Carry' : 'Land';
  }

  const fromTo = /\bfrom\s+([A-Za-z][A-Za-z ()]{1,30}?)\s+to\s+([A-Za-z][A-Za-z ()]{1,30}?)(?=\s*[,.;]|\s*$|\s+(?:and|with)\b)/i.exec(rest);
  const o = /\borigin\s*(?:is|:)\s*([A-Za-z][A-Za-z ()]*?)(?=\s*[,.;]|\s*$|\s+and\b|\s+destination\b)/i.exec(rest);
  const d = /\bdestination\s*(?:is|:)\s*([A-Za-z][A-Za-z ()]*?)(?=\s*[,.;]|\s*$|\s+and\b)/i.exec(rest);
  if (o) changes.origin = titleCase(o[1]);
  else if (fromTo) changes.origin = titleCase(fromTo[1]);
  if (d) changes.destination = titleCase(d[1]);
  else if (fromTo) changes.destination = titleCase(fromTo[2]);

  const jt = /\bjob type\s*(?:is|:)\s*([^,.;\n]+)/i.exec(rest);
  if (jt) changes.job_type = jt[1].trim();
  const cu = /\bcustomer(?: name)?\s*(?:is|:)\s*([^,.;\n]+)/i.exec(rest);
  if (cu) changes.customer = cu[1].trim();
  const sv = /\b(consolidation|consolidated|direct)\b/i.exec(rest);
  if (sv && (/\bservice\b/i.test(rest) || /consolidat/i.test(sv[1]))) {
    changes.service = /consolidat/i.test(sv[1]) ? 'Consolidation' : 'Direct';
  }

  const wv = parseWeightVolume(rest);
  if (wv.weight !== null) changes.total_weight_kg = wv.weight;
  if (wv.volume !== null) changes.total_volume_cbm = wv.volume;

  let leftover = rest
    .replace(new RegExp(`([\\d,]*\\.?\\d+)\\s*${UNITS_W}\\b`, 'gi'), ' ')
    .replace(new RegExp(`([\\d,]*\\.?\\d+)\\s*${UNITS_V}`, 'gi'), ' ')
    .replace(/\bPO-[A-Za-z0-9-]+/gi, ' ');
  const bareNums = [...leftover.matchAll(/(?<![\w.])(\d[\d,]*\.?\d*)(?![\w])/g)];
  for (const n of bareNums) {
    const before = leftover.slice(Math.max(0, n.index - 40), n.index).toLowerCase();
    if (/volume|cbm|cubic/.test(before) && wv.volume === null) {
      unclear.push(`Is the volume ${n[1]} cbm? Please confirm the unit.`);
    } else if (/weight|kg|heavy/.test(before) && wv.weight === null) {
      unclear.push(`Is the weight ${n[1]} kg, lb or tonnes? Please confirm the unit.`);
    } else if (wv.weight === null || wv.volume === null) {
      unclear.push(`What does ${n[1]} refer to, and in which unit?`);
    }
  }
  if (/\bweight\b/i.test(rest) && wv.weight === null && !bareNums.length) {
    unclear.push('What is the total weight, and in which unit?');
  }
  if (/\bvolume\b/i.test(rest) && wv.volume === null && !bareNums.length) {
    unclear.push('What is the total volume, and in which unit?');
  }

  return { changes, unclear: [...new Set(unclear)] };
}

export function applyUpdate(request, changes, unclear) {
  const req = JSON.parse(JSON.stringify(request));
  const changed = [];
  const merged = { ...changes };
  if (merged.pos && merged.total_weight_kg === undefined && merged.total_volume_cbm === undefined) {
    merged.total_weight_kg = round(merged.pos.reduce((a, p) => a + p.weight_kg, 0));
    merged.total_volume_cbm = round(merged.pos.reduce((a, p) => a + p.volume_cbm, 0));
  }
  for (const [k, v] of Object.entries(merged)) {
    if (JSON.stringify(req[k]) !== JSON.stringify(v)) {
      req[k] = v;
      changed.push(k);
    }
  }
  req.missing = computeMissing(req);
  return { request: req, changed, still_missing: req.missing, unclear };
}

export function emailFallback(input) {
  const name = input.contact_name || input.customer || 'Customer';
  const lines = [`Dear ${name},`, ''];
  if (input.revised) {
    lines.push(`Please find our revised quotation ${input.quotation_number} for your shipment from ${input.origin} to ${input.destination}. It replaces the earlier version.`);
  } else {
    lines.push(`Thank you for your enquiry. Please find our quotation ${input.quotation_number} for your shipment from ${input.origin} to ${input.destination}.`);
  }
  const names = Array.isArray(input.services) ? input.services.map((s) => s && s.service).filter(Boolean) : [];
  if (names.length) lines.push('', `Services included: ${names.join(', ')}.`);
  lines.push('', 'Total per currency:');
  for (const l of totalLines(input.totals)) lines.push(l);
  if (input.valid_until) lines.push('', `This quotation is valid until ${input.valid_until}.`);
  lines.push(
    '',
    'Please review the quotation in the portal. If you would like any changes, use Revise or negotiate and we will get back to you quickly.',
    '',
    'Kind regards,',
    'GAC Quotations Team'
  );
  return { subject: emailSubject(input), body: sanitizeDashes(lines.join('\n')) };
}

export { formatAmount };
