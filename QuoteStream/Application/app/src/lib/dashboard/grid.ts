import { MODES } from '../weight';
import { ANCHOR_DATE, CITIES, CUSTOMERS, dayNumber, isoFromDay, type DashRow } from './data';
import { monthKey } from './query';

export type ColKey =
  | 'id'
  | 'customer'
  | 'mode'
  | 'lane'
  | 'date'
  | 'status'
  | 'source'
  | 'revenue'
  | 'cost'
  | 'income'
  | 'margin'
  | 'chargeableKg'
  | 'owner'
  | 'incoterm';

export type GridRow = DashRow & { lane: string; income: number; margin: number; owner: string; incoterm: string };

export type GridCol = { key: ColKey; label: string; num?: boolean; words: string[] };

export const GRID_COLS: GridCol[] = [
  { key: 'id', label: 'Quote', words: ['quote', 'id', 'number', 'reference'] },
  { key: 'customer', label: 'Customer', words: ['customer', 'client', 'account'] },
  { key: 'mode', label: 'Mode', words: ['mode', 'transport'] },
  { key: 'lane', label: 'Lane', words: ['lane', 'route', 'origin', 'destination'] },
  { key: 'date', label: 'Date', words: ['date', 'created'] },
  { key: 'status', label: 'Status', words: ['status', 'state'] },
  { key: 'source', label: 'Source', words: ['source', 'channel'] },
  { key: 'revenue', label: 'Revenue', num: true, words: ['revenue', 'sales', 'amount', 'value'] },
  { key: 'cost', label: 'Est. cost', num: true, words: ['cost'] },
  { key: 'income', label: 'Op. income', num: true, words: ['income', 'profit', 'operating income', 'op income'] },
  { key: 'margin', label: 'Margin %', num: true, words: ['margin'] },
  { key: 'chargeableKg', label: 'Chargeable kg', num: true, words: ['weight', 'kg', 'chargeable'] },
  { key: 'owner', label: 'Owner', words: ['owner', 'handler', 'assigned'] },
  { key: 'incoterm', label: 'Incoterm', words: ['incoterm', 'terms'] }
];

export const OWNERS = ['Christine Zock', 'Omar Haddad', 'Priya Nair', 'Lena Fischer'];
export const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP'];

export function toGridRows(rows: DashRow[]): GridRow[] {
  return rows.map((x) => {
    const n = Number(x.id.slice(3));
    const income = x.revenue - x.cost;
    return {
      ...x,
      lane: `${x.origin} to ${x.destination}`,
      income,
      margin: x.revenue ? (income / x.revenue) * 100 : 0,
      owner: OWNERS[(n * 7 + 3) % OWNERS.length],
      incoterm: INCOTERMS[(n * 5 + 1) % INCOTERMS.length]
    };
  });
}

export type Filter =
  | { id: string; label: string; kind: 'eq'; key: ColKey; value: string }
  | { id: string; label: string; kind: 'city'; value: string }
  | { id: string; label: string; kind: 'gte' | 'lte'; key: ColKey; value: number }
  | { id: string; label: string; kind: 'since'; value: string };

export type GridState = {
  cols: ColKey[];
  sort: { key: ColKey; dir: 1 | -1 };
  filters: Filter[];
  group: ColKey | null;
  top: number | null;
  highlight: Filter | null;
};

export const DEFAULT_COLS: ColKey[] = ['id', 'customer', 'mode', 'lane', 'date', 'status', 'revenue', 'income', 'chargeableKg'];
export const DEFAULT_SORT: GridState['sort'] = { key: 'date', dir: -1 };

export function freshGrid(): GridState {
  return { cols: [...DEFAULT_COLS], sort: { ...DEFAULT_SORT }, filters: [], group: null, top: null, highlight: null };
}

export function colLabel(k: ColKey): string {
  return GRID_COLS.find((c) => c.key === k)!.label;
}

export function matches(x: GridRow, f: Filter): boolean {
  if (f.kind === 'eq') return String(x[f.key]) === f.value;
  if (f.kind === 'city') return x.origin === f.value || x.destination === f.value;
  if (f.kind === 'since') return x.date >= f.value;
  const v = Number(x[f.key]);
  return f.kind === 'gte' ? v >= f.value : v <= f.value;
}

export function groupKey(x: GridRow, k: ColKey): string {
  return k === 'date' ? monthKey(x.date) : String(x[k]);
}

export function viewRows(rows: GridRow[], s: GridState): GridRow[] {
  const { key, dir } = s.sort;
  const out = rows
    .filter((x) => s.filters.every((f) => matches(x, f)))
    .sort((a, b) => {
      const A = a[key];
      const B = b[key];
      const c = A > B ? 1 : A < B ? -1 : 0;
      return (c || (a.id > b.id ? 1 : -1)) * dir;
    });
  return s.top ? out.slice(0, s.top) : out;
}

function esc(w: string) {
  return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function has(s: string, word: string) {
  return new RegExp(`\\b${esc(word)}s?\\b`).test(s);
}

export function colsIn(s: string): ColKey[] {
  return GRID_COLS.filter((c) => c.words.some((w) => has(s, w))).map((c) => c.key);
}

function fmtNum(v: number) {
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const AMOUNT_KEYS: Record<string, ColKey> = {
  revenue: 'revenue',
  sales: 'revenue',
  income: 'income',
  profit: 'income',
  cost: 'cost',
  margin: 'margin',
  weight: 'chargeableKg',
  kg: 'chargeableKg'
};

const STATUS_WORDS: [RegExp, string][] = [
  [/\bdrafts?\b/, 'Draft'],
  [/\bsent\b/, 'Sent'],
  [/\bsubmitted\b/, 'Submitted'],
  [/\brevision/, 'Revision requested']
];

function customerPattern(c: string) {
  const w = c.toLowerCase().split(' ');
  return new RegExp(`\\b(${esc(w.slice(0, 2).join(' '))}${w[0].length >= 4 ? `|${esc(w[0])}` : ''})\\b`);
}

export type AskResult = { state: GridState; done: string[]; flash: ColKey[] };

export function applyAsk(prev: GridState, text: string): AskResult | null {
  const s = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/^(reset|start over|clear all)\b|reset (the )?grid|show all columns|default view/.test(s)) {
    const state = freshGrid();
    return { state, done: ['Grid reset to the default view'], flash: [...state.cols] };
  }
  if (/(clear|remove) (all )?(the )?filters?/.test(s)) {
    return { state: { ...prev, filters: [], highlight: null, top: null }, done: ['Filters cleared'], flash: [] };
  }

  const st: GridState = { ...prev, cols: [...prev.cols], filters: [...prev.filters] };
  const done: string[] = [];
  const flash = new Set<ColKey>();
  const labels = (ks: ColKey[]) => ks.map(colLabel).join(', ');

  const only = s.match(/(?:show|display|keep) (?:me )?only (.+?)(?: (?:for|where|with|sorted|sort|group|filter)\b|$)/);
  if (only) {
    const c = colsIn(only[1]);
    if (c.length) {
      st.cols = c;
      c.forEach((k) => flash.add(k));
      done.push(`Showing only ${labels(c)}`);
    }
  } else {
    const hide = s.match(/(?:hide|remove|drop) (?:the )?(?:columns? )?(.+?)(?: (?:for|where|and sort|sort|group)\b|$)/);
    if (hide) {
      const c = colsIn(hide[1]).filter((k) => st.cols.includes(k));
      if (c.length && c.length < st.cols.length) {
        st.cols = st.cols.filter((k) => !c.includes(k));
        done.push(`Hid ${labels(c)}`);
      }
    }
    const add = s.match(/(?:show|add|include|display) (?:the )?(?:columns? )?(?:also )?([a-z ,&%.]+?)(?: (?:columns?|for|where|with|sorted|sort|group)\b|$)/);
    if (add) {
      const c = colsIn(add[1]).filter((k) => !st.cols.includes(k));
      if (c.length) {
        st.cols = [...st.cols, ...c];
        c.forEach((k) => flash.add(k));
        done.push(`Added ${labels(c)}`);
      }
    }
  }

  const first = s.match(/(?:put|move) (.+?) (?:first|to the front|to the start)/);
  if (first) {
    const c = colsIn(first[1])[0];
    if (c) {
      st.cols = [c, ...st.cols.filter((k) => k !== c)];
      flash.add(c);
      done.push(`Moved ${colLabel(c)} first`);
    }
  }

  const addFilter = (f: Filter) => {
    st.filters = [...st.filters.filter((x) => x.id !== f.id), f];
    done.push(`Filter ${f.label}`);
  };
  for (const m of MODES) {
    if (new RegExp(`\\b${m.toLowerCase()}\\b`).test(s)) addFilter({ id: 'mode', label: `Mode: ${m}`, kind: 'eq', key: 'mode', value: m });
  }
  for (const [c] of CUSTOMERS) {
    if (customerPattern(c).test(s)) addFilter({ id: 'customer', label: `Customer: ${c}`, kind: 'eq', key: 'customer', value: c });
  }
  for (const [re, v] of STATUS_WORDS) {
    if (re.test(s)) addFilter({ id: 'status', label: `Status: ${v}`, kind: 'eq', key: 'status', value: v });
  }
  if (!/\bcolumns?\b/.test(s)) {
    if (/\bemails?\b/.test(s)) addFilter({ id: 'source', label: 'Source: Email', kind: 'eq', key: 'source', value: 'Email' });
    else if (/\bportal\b/.test(s)) addFilter({ id: 'source', label: 'Source: Portal', kind: 'eq', key: 'source', value: 'Portal' });
  }
  for (const o of OWNERS) {
    if (new RegExp(`\\b${o.split(' ')[0].toLowerCase()}\\b`).test(s)) addFilter({ id: 'owner', label: `Owner: ${o}`, kind: 'eq', key: 'owner', value: o });
  }
  for (const i of INCOTERMS) {
    if (new RegExp(`\\b${i.toLowerCase()}\\b`).test(s)) addFilter({ id: 'incoterm', label: `Incoterm: ${i}`, kind: 'eq', key: 'incoterm', value: i });
  }
  for (const c of CITIES) {
    if (new RegExp(`\\b${esc(c.toLowerCase())}\\b`).test(s)) addFilter({ id: `city:${c}`, label: `Lane includes ${c}`, kind: 'city', value: c });
  }

  const cmp = s.match(
    /\b(revenue|sales|income|profit|cost|margin|weight|kg)\b (?:is )?(over|above|greater than|more than|at least|under|below|less than|at most) \$?(\d[\d,.]*) ?(k|thousand)?\b/
  );
  if (cmp) {
    const key = AMOUNT_KEYS[cmp[1]];
    const v = parseFloat(cmp[3].replace(/,/g, '')) * (cmp[4] ? 1000 : 1);
    const up = /over|above|greater|more|least/.test(cmp[2]);
    const label = `${colLabel(key)} ${up ? 'over' : 'under'} ${fmtNum(v)}${key === 'margin' ? '%' : ''}`;
    const f: Filter = { id: `${key}:${up ? 'gte' : 'lte'}`, label, kind: up ? 'gte' : 'lte', key, value: v };
    if (/\b(highlight|mark|flag)\b/.test(s)) {
      st.highlight = f;
      done.push(`Highlighting ${label}`);
    } else addFilter(f);
  }

  const last = s.match(/\b(?:last|past) (\d+) (day|week|month)s?\b/);
  if (last) {
    const n = Number(last[1]);
    const days = n * ({ day: 1, week: 7, month: 30 } as const)[last[2] as 'day' | 'week' | 'month'];
    addFilter({ id: 'since', label: `Last ${n} ${last[2]}${n === 1 ? '' : 's'}`, kind: 'since', value: isoFromDay(dayNumber(ANCHOR_DATE) - days) });
  }

  const grp = s.match(/\bgroup(?:ed)? by ([a-z %.]+?)(?: and\b|,|$)/);
  if (grp) {
    const c = colsIn(grp[1])[0];
    if (c) {
      st.group = c;
      done.push(`Grouped by ${colLabel(c)}`);
    }
  }
  if (/\bungroup|no grouping|remove (the )?grouping/.test(s)) {
    st.group = null;
    done.push('Grouping removed');
  }

  const sort = s.match(/\b(?:sort(?:ed)?|order(?:ed)?|rank(?:ed)?) by ([a-z %.]+?)(?: (?:high|low|desc|asc|descending|ascending|highest|lowest|biggest|smallest|newest|oldest|latest)\b| and\b|,|$)/);
  if (sort) {
    const c = colsIn(sort[1])[0];
    if (c) {
      const rest = s.slice(sort.index ?? 0);
      const asc = !/\bhigh to low\b/.test(rest) && /\b(low to high|lowest|ascending|asc|smallest|oldest|a to z)\b/.test(rest);
      st.sort = { key: c, dir: asc ? 1 : -1 };
      flash.add(c);
      done.push(`Sorted by ${colLabel(c)} ${asc ? 'low to high' : 'high to low'}`);
    }
  }

  const top = s.match(/\b(?:top|biggest|largest|first) (\d+)\b/);
  if (top) {
    st.top = Number(top[1]);
    done.push(`Top ${st.top} rows`);
    if (!sort) {
      st.sort = { key: 'revenue', dir: -1 };
      flash.add('revenue');
      done.push('Sorted by Revenue high to low');
    }
  }

  if (!done.length) return null;
  return { state: st, done, flash: [...flash] };
}

export const UNRECOGNISED = 'Concept only: I did not recognise that. Try showing or hiding columns, filtering, sorting, grouping, or highlighting.';

export function replyFor(r: AskResult | null): string {
  return r ? `Done. ${r.done.join('. ')}.` : UNRECOGNISED;
}
