import type { Mode } from '../weight';
import { ANCHOR_DATE, CITIES, CUSTOMERS, dayNumber, type DashSource, type DashStatus } from './data';

export type Metric = 'revenue' | 'margin' | 'income' | 'kg' | 'count';
export type Group = 'customer' | 'lane' | 'mode' | 'status' | 'source' | 'month';

export type Filters = {
  mode?: Mode;
  customer?: string;
  status?: DashStatus;
  source?: DashSource;
  origin?: string;
  destination?: string;
  city?: string;
};

export type Period = { label: string; fromDay: number; toDay: number; months: number; isDefault: boolean };

export type Parsed = {
  query: string;
  filters: Filters;
  group: Group;
  metric: Metric;
  period: Period;
  recognised: number;
};

export const METRIC_LABEL: Record<Metric, string> = {
  revenue: 'Revenue',
  margin: 'Margin %',
  income: 'Est. Op. Income',
  kg: 'Chargeable weight',
  count: 'Number of quotations'
};

export const GROUP_LABEL: Record<Group, string> = {
  customer: 'Customer',
  lane: 'Lane',
  mode: 'Mode',
  status: 'Status',
  source: 'Source',
  month: 'Month'
};

const MODE_PATTERNS: [Mode, RegExp][] = [
  ['Hand Carry', /\bhand ?carry\b/],
  ['Air', /\bair(freight)?\b/],
  ['Sea', /\b(sea(freight)?|ocean)\b/],
  ['Land', /\b(land|road|trucks?|trucking)\b/],
  ['Courier', /\bcouriers?\b/],
  ['Others', /\bothers?\b/]
];

const STATUS_PATTERNS: [DashStatus, RegExp][] = [
  ['Revision requested', /\b(revisions?|revised|revise|negotiat\w*)\b/],
  ['Submitted', /\b(submitted|awaiting|pending( approval)?)\b/],
  ['Draft', /\bdrafts?\b/],
  ['Sent', /\bsent\b/]
];

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CITY_ALT = [...CITIES].sort((a, b) => b.length - a.length).map((c) => esc(c.toLowerCase())).join('|');

function city(name: string): string {
  return CITIES.find((c) => c.toLowerCase() === name) ?? name;
}

function monthsBack(day: number, n: number): number {
  const d = new Date(day * 86400000);
  return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, d.getUTCDate()) / 86400000);
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export function parsePeriod(s: string, anchorIso = ANCHOR_DATE): Period {
  const to = dayNumber(anchorIso);
  const m = s.match(/\b(?:last|past) (\d+) (month|week|day)s?\b/);
  if (m) {
    const n = Math.max(1, Math.min(120, Number(m[1])));
    const from = m[2] === 'month' ? monthsBack(to, n) : to - n * (m[2] === 'week' ? 7 : 1);
    return { label: `Last ${plural(n, m[2])}`, fromDay: from, toDay: to, months: Math.max(1, Math.round((to - from) / 30.4)), isDefault: false };
  }
  if (/\b(last|past) month\b/.test(s)) return { label: 'Last month', fromDay: monthsBack(to, 1), toDay: to, months: 1, isDefault: false };
  if (/\b(last|past|this) week\b/.test(s)) return { label: 'Last 7 days', fromDay: to - 7, toDay: to, months: 1, isDefault: false };
  if (/\bquarter\b/.test(s)) return { label: 'Last quarter', fromDay: monthsBack(to, 3), toDay: to, months: 3, isDefault: false };
  if (/\b(this year|ytd|year to date)\b/.test(s)) {
    const y = new Date(to * 86400000).getUTCFullYear();
    const from = Math.round(Date.UTC(y, 0, 1) / 86400000);
    return { label: 'This year', fromDay: from, toDay: to, months: new Date(to * 86400000).getUTCMonth() + 1, isDefault: false };
  }
  return { label: 'Last 12 months', fromDay: monthsBack(to, 12), toDay: to, months: 12, isDefault: true };
}

export function parse(query: string, anchorIso = ANCHOR_DATE): Parsed {
  const s = ` ${query.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const filters: Filters = {};

  for (const [mode, re] of MODE_PATTERNS) {
    if (re.test(s)) {
      filters.mode = mode;
      break;
    }
  }

  for (const [name] of CUSTOMERS) {
    const full = name.toLowerCase();
    const first = full.split(' ')[0];
    const firstRe = first === 'al' ? /\bal noor\b/ : new RegExp(`\\b${esc(first)}\\b`);
    if (s.includes(` ${full} `) || firstRe.test(s)) {
      filters.customer = name;
      break;
    }
  }

  for (const [status, re] of STATUS_PATTERNS) {
    if (re.test(s)) {
      filters.status = status;
      break;
    }
  }

  const email = /\be ?mails?\b/.test(s);
  const portal = /\bportal\b/.test(s);
  const versus = email && portal;
  if (!versus && email) filters.source = 'Email';
  if (!versus && portal) filters.source = 'Portal';

  const pair = s.match(new RegExp(`\\b(${CITY_ALT}) to (${CITY_ALT})\\b`));
  if (pair) {
    filters.origin = city(pair[1]);
    filters.destination = city(pair[2]);
  } else {
    const from = s.match(new RegExp(`\\bfrom (${CITY_ALT})\\b`));
    const to = s.match(new RegExp(`\\b(?:to|into) (${CITY_ALT})\\b`));
    if (from) filters.origin = city(from[1]);
    if (to) filters.destination = city(to[1]);
    if (!from && !to) {
      const one = s.match(new RegExp(`\\b(${CITY_ALT})\\b`));
      if (one) filters.city = city(one[1]);
    }
  }

  const period = parsePeriod(s, anchorIso);

  let metric: Metric = 'revenue';
  if (/\bmargins?\b/.test(s)) metric = 'margin';
  else if (/\b(profit|profits|income|op income)\b/.test(s)) metric = 'income';
  else if (/\b(weight|weights|kg|kgs|kilos?|tonnes?|tons?)\b/.test(s)) metric = 'kg';
  else if (/\b(how many|count|number)\b/.test(s)) metric = 'count';
  const metricSaid = metric !== 'revenue' || /\b(revenue|revenues|sales|turnover)\b/.test(s);

  let group: Group | null = null;
  if (versus || /\b(by|per) source\b/.test(s)) group = 'source';
  else if (/\b(by|per) customers?\b|\btop customers?\b|\bcustomers\b/.test(s)) group = 'customer';
  else if (/\b(by|per) (lane|route)s?\b|\blanes\b|\broutes?\b/.test(s)) group = 'lane';
  else if (/\b(by|per) modes?\b|\bmodes\b/.test(s)) group = 'mode';
  else if (/\b(by|per) status(es)?\b|\bstatuses\b/.test(s)) group = 'status';
  else if (/\b(by|per) month\b|\bmonthly\b|\bmonths?\b|\btrend\b|\bover time\b/.test(s)) group = 'month';

  const recognised = Object.keys(filters).length + (group ? 1 : 0) + (metricSaid ? 1 : 0) + (period.isDefault ? 0 : 1);

  return { query, filters, group: group ?? 'month', metric, period, recognised };
}

export type Chip = { label: string; kind: 'filter' | 'default' | 'shape' };

export function chipsFor(p: Parsed): Chip[] {
  const f = p.filters;
  const out: Chip[] = [];
  if (f.mode) out.push({ label: `Mode: ${f.mode}`, kind: 'filter' });
  if (f.customer) out.push({ label: `Customer: ${f.customer}`, kind: 'filter' });
  if (f.status) out.push({ label: `Status: ${f.status}`, kind: 'filter' });
  if (f.source) out.push({ label: `Source: ${f.source}`, kind: 'filter' });
  if (f.origin) out.push({ label: `From: ${f.origin}`, kind: 'filter' });
  if (f.destination) out.push({ label: `To: ${f.destination}`, kind: 'filter' });
  if (f.city) out.push({ label: `Lane includes: ${f.city}`, kind: 'filter' });
  out.push({ label: `Period: ${p.period.label}`, kind: p.period.isDefault ? 'default' : 'filter' });
  out.push({ label: `Measure: ${METRIC_LABEL[p.metric]}`, kind: 'shape' });
  out.push({ label: `Grouped by: ${GROUP_LABEL[p.group]}`, kind: 'shape' });
  return out;
}
