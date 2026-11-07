import { DASH_ROWS, dayNumber, type DashRow } from './data';
import { parsePeriod, type Group, type Metric, type Parsed } from './parse';

export type Bucket = { key: string; value: number; count: number };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function overviewSpec(): Parsed {
  return { query: '', filters: {}, group: 'month', metric: 'revenue', period: parsePeriod(''), recognised: 0 };
}

export function filterRows(p: Parsed, rows: DashRow[] = DASH_ROWS): DashRow[] {
  const f = p.filters;
  return rows.filter((x) => {
    const d = dayNumber(x.date);
    if (d < p.period.fromDay || d > p.period.toDay) return false;
    if (f.mode && x.mode !== f.mode) return false;
    if (f.customer && x.customer !== f.customer) return false;
    if (f.status && x.status !== f.status) return false;
    if (f.source && x.source !== f.source) return false;
    if (f.origin && x.origin !== f.origin) return false;
    if (f.destination && x.destination !== f.destination) return false;
    if (f.city && x.origin !== f.city && x.destination !== f.city) return false;
    return true;
  });
}

export function measure(rows: DashRow[], metric: Metric): number {
  if (metric === 'count') return rows.length;
  if (metric === 'kg') return rows.reduce((s, x) => s + x.chargeableKg, 0);
  const rev = rows.reduce((s, x) => s + x.revenue, 0);
  const cost = rows.reduce((s, x) => s + x.cost, 0);
  if (metric === 'revenue') return rev;
  if (metric === 'income') return rev - cost;
  return rev === 0 ? 0 : ((rev - cost) / rev) * 100;
}

export function monthKey(iso: string): string {
  return `${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
}

function keyOf(x: DashRow, g: Group): string {
  if (g === 'customer') return x.customer;
  if (g === 'lane') return `${x.origin} to ${x.destination}`;
  if (g === 'mode') return x.mode;
  if (g === 'status') return x.status;
  if (g === 'source') return x.source;
  return monthKey(x.date);
}

export function groupRows(rows: DashRow[], p: Parsed, limit = 8): Bucket[] {
  const map = new Map<string, DashRow[]>();
  if (p.group === 'month') {
    const from = new Date(p.period.fromDay * 86400000);
    const to = new Date(p.period.toDay * 86400000);
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (d <= to) {
      map.set(monthKey(d.toISOString().slice(0, 10)), []);
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  for (const x of rows) {
    const k = keyOf(x, p.group);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(x);
  }
  const out = [...map].map(([key, v]) => ({ key, value: measure(v, p.metric), count: v.length }));
  if (p.group === 'month') return out;
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Kpi = { label: string; value: string; change: number };

export function kpis(rows: DashRow[], p: Parsed): Kpi[] {
  const base = ((hash(JSON.stringify(p.filters) + p.period.label) % 90) - 30) / 10;
  return [
    { label: 'Quotations', value: fmtInt(rows.length), change: base },
    { label: 'Revenue', value: fmtUsd(measure(rows, 'revenue')), change: base + 1.2 },
    { label: 'Est. Op. Income', value: fmtUsd(measure(rows, 'income')), change: base - 0.8 },
    { label: 'Average margin', value: `${measure(rows, 'margin').toFixed(1)}%`, change: (base % 3) },
    { label: 'Chargeable weight', value: `${fmtInt(measure(rows, 'kg'))} kg`, change: base + 0.4 }
  ];
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtUsd(n: number): string {
  return `USD ${fmtInt(n)}`;
}

export function fmtMetric(metric: Metric, v: number): string {
  if (metric === 'margin') return `${v.toFixed(1)}%`;
  if (metric === 'kg') return `${fmtInt(v)} kg`;
  if (metric === 'count') return fmtInt(v);
  return fmtUsd(v);
}

function q(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}

export function buildSql(p: Parsed): string {
  const f = p.filters;
  const where: string[] = [];
  if (f.mode) where.push(`mode = ${q(f.mode)}`);
  if (f.customer) where.push(`customer = ${q(f.customer)}`);
  if (f.status) where.push(`status = ${q(f.status)}`);
  if (f.source) where.push(`source = ${q(f.source)}`);
  if (f.origin) where.push(`origin = ${q(f.origin)}`);
  if (f.destination) where.push(`destination = ${q(f.destination)}`);
  if (f.city) where.push(`${q(f.city)} IN (origin, destination)`);
  const from = new Date(p.period.fromDay * 86400000).toISOString().slice(0, 10);
  const to = new Date(p.period.toDay * 86400000).toISOString().slice(0, 10);
  where.push(`quote_date BETWEEN '${from}' AND '${to}'`);
  const value: Record<Metric, string> = {
    revenue: 'SUM(revenue)',
    income: 'SUM(revenue - est_cost)',
    margin: 'ROUND(100 * SUM(revenue - est_cost) / NULLIF(SUM(revenue), 0), 1)',
    kg: 'SUM(chargeable_kg)',
    count: 'COUNT(*)'
  };
  const label: Record<Group, string> = {
    customer: 'customer',
    lane: "CONCAT(origin, ' to ', destination)",
    mode: 'mode',
    status: 'status',
    source: 'source',
    month: "DATE_FORMAT(quote_date, '%Y-%m')"
  };
  const tail = p.group === 'month' ? 'ORDER BY label;' : 'ORDER BY value DESC\nLIMIT 8;';
  return `SELECT ${label[p.group]} AS label,\n       ${value[p.metric]} AS value\nFROM v_quotation_report\nWHERE ${where.join('\n  AND ')}\nGROUP BY label\n${tail}`;
}
