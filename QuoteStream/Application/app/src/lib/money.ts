import { r2 } from './weight';

export type Basis = 'kg' | 'shipment' | 'cbm' | 'package';
export const BASES: Basis[] = ['kg', 'shipment', 'cbm', 'package'];

export const BASIS_LABEL: Record<Basis, string> = {
  kg: 'per kg',
  shipment: 'per shipment',
  cbm: 'per CBM',
  package: 'per package'
};

export function toCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100);
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtMoney(currency: string, n: number): string {
  return `${currency} ${fmt(n)}`;
}

export type CargoBasisInput = {
  billableWeight: number;
  volume: number;
  totalQuantity: number;
};

export function quantityFor(basis: Basis, cargo: CargoBasisInput): number {
  if (basis === 'kg') return cargo.billableWeight;
  if (basis === 'cbm') return cargo.volume;
  if (basis === 'package') return cargo.totalQuantity;
  return 1;
}

export function calcLine(unitPrice: number | null, estUnitCost: number | null, quantity: number) {
  const bill = unitPrice === null ? 0 : r2(unitPrice * quantity);
  const cost = estUnitCost === null ? 0 : r2(estUnitCost * quantity);
  return { bill, cost, op: r2(bill - cost) };
}

export type TotalLine = { currency: string; bill: number; cost: number };

export type CurrencyTotal = {
  currency: string;
  revenue: number;
  cost: number;
  opIncome: number;
  margin: number;
};

export function totalsByCurrency(lines: TotalLine[]): CurrencyTotal[] {
  const map = new Map<string, { rev: number; cost: number }>();
  for (const l of lines) {
    const cur = map.get(l.currency) ?? { rev: 0, cost: 0 };
    cur.rev += toCents(l.bill);
    cur.cost += toCents(l.cost);
    map.set(l.currency, cur);
  }
  return [...map.entries()].map(([currency, v]) => {
    const op = v.rev - v.cost;
    const margin = v.rev === 0 ? 0 : Math.round((op / v.rev) * 1000) / 10;
    return { currency, revenue: v.rev / 100, cost: v.cost / 100, opIncome: op / 100, margin };
  });
}

export function revenueByCurrency(lines: { currency: string; bill: number }[]) {
  return totalsByCurrency(lines.map((l) => ({ ...l, cost: 0 }))).map((t) => ({
    currency: t.currency,
    amount: t.revenue
  }));
}
