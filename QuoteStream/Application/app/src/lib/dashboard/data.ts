import { MODES, type Mode } from '../weight';

export type DashStatus = 'Draft' | 'Submitted' | 'Sent' | 'Revision requested';
export type DashSource = 'Email' | 'Portal';

export type DashRow = {
  id: string;
  customer: string;
  mode: Mode;
  origin: string;
  destination: string;
  date: string;
  status: DashStatus;
  revenue: number;
  cost: number;
  chargeableKg: number;
  source: DashSource;
};

export const ANCHOR_DATE = '2026-11-07';

export const RATE_NEEDED_LINES = 6;

export const CUSTOMERS: [string, number][] = [
  ['Blue Dune Energy', 22],
  ['Al Noor Trading', 16],
  ['Gulf Petro Services', 14],
  ['Harbor Marine Supply', 12],
  ['Desert Rail Logistics', 9],
  ['Oryx Engineering', 8]
];

type ModeProfile = { weight: number; lanes: [string, string][]; revenue: [number, number]; kg: [number, number] };

export const MODE_PROFILES: Record<Mode, ModeProfile> = {
  Air: {
    weight: 40,
    lanes: [
      ['Shanghai', 'Dubai'],
      ['Frankfurt', 'Dubai'],
      ['Mumbai', 'Dubai'],
      ['Dubai', 'London'],
      ['Singapore', 'Dubai'],
      ['Dubai', 'Nairobi']
    ],
    revenue: [1500, 9000],
    kg: [80, 2500]
  },
  Sea: {
    weight: 25,
    lanes: [
      ['Jebel Ali', 'Rotterdam'],
      ['Shenzhen', 'Jebel Ali'],
      ['Mumbai', 'Jebel Ali'],
      ['Jebel Ali', 'Mombasa']
    ],
    revenue: [3000, 22000],
    kg: [2000, 24000]
  },
  Land: {
    weight: 15,
    lanes: [
      ['Dubai', 'Riyadh'],
      ['Dubai', 'Muscat'],
      ['Dubai', 'Doha'],
      ['Abu Dhabi', 'Kuwait']
    ],
    revenue: [800, 5000],
    kg: [500, 12000]
  },
  Courier: {
    weight: 12,
    lanes: [
      ['Dubai', 'London'],
      ['Istanbul', 'Dubai'],
      ['Dubai', 'Singapore']
    ],
    revenue: [150, 900],
    kg: [2, 60]
  },
  'Hand Carry': {
    weight: 4,
    lanes: [
      ['Dubai', 'Karachi'],
      ['Dubai', 'Mumbai']
    ],
    revenue: [100, 500],
    kg: [1, 15]
  },
  Others: {
    weight: 4,
    lanes: [
      ['Dubai', 'Fujairah'],
      ['Jebel Ali', 'Dubai']
    ],
    revenue: [300, 3000],
    kg: [1, 800]
  }
};

const STATUS_WEIGHTS: [DashStatus, number][] = [
  ['Sent', 55],
  ['Submitted', 15],
  ['Draft', 16],
  ['Revision requested', 14]
];

export const STATUSES: DashStatus[] = ['Draft', 'Submitted', 'Sent', 'Revision requested'];

export const CITIES: string[] = [...new Set(MODES.flatMap((m) => MODE_PROFILES[m].lanes.flat()))];

const DAY = 86400000;

export function dayNumber(iso: string): number {
  return Math.round(Date.parse(iso + 'T00:00:00Z') / DAY);
}

export function isoFromDay(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, list: [T, number][]): T {
  const total = list.reduce((s, x) => s + x[1], 0);
  let v = r() * total;
  for (const [item, w] of list) {
    v -= w;
    if (v < 0) return item;
  }
  return list[0][0];
}

function build(): DashRow[] {
  const r = mulberry32(7);
  const anchor = dayNumber(ANCHOR_DATE);
  const rows: Omit<DashRow, 'id'>[] = [];
  const modeList = MODES.map((m) => [m, MODE_PROFILES[m].weight] as [Mode, number]);
  for (let i = 0; i < 340; i++) {
    const mode = pick(r, modeList);
    const p = MODE_PROFILES[mode];
    const lane = p.lanes[Math.floor(r() * p.lanes.length)];
    const revenue = Math.round((p.revenue[0] + r() * (p.revenue[1] - p.revenue[0])) / 10) * 10;
    const margin = 0.08 + r() * 0.18;
    const date = isoFromDay(anchor - Math.floor(Math.pow(r(), 0.9) * 364));
    rows.push({
      customer: pick(r, CUSTOMERS),
      mode,
      origin: lane[0],
      destination: lane[1],
      date,
      status: pick(r, STATUS_WEIGHTS),
      revenue,
      cost: Math.round(revenue * (1 - margin)),
      chargeableKg: Math.round(p.kg[0] + r() * (p.kg[1] - p.kg[0])),
      source: r() < 0.55 ? 'Email' : 'Portal'
    });
  }
  rows.push({
    customer: 'Blue Dune Energy',
    mode: 'Air',
    origin: 'Shanghai',
    destination: 'Dubai',
    date: isoFromDay(anchor - 1),
    status: 'Draft',
    revenue: 2994,
    cost: 2430,
    chargeableKg: 700,
    source: 'Portal'
  });
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows.map((x, i) => ({ ...x, id: 'QT-' + String(i + 1).padStart(4, '0') }));
}

export const DASH_ROWS: DashRow[] = build();
