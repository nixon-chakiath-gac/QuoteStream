import type { Basis } from './money';

export type PriceSource = 'Template' | 'Past quotation' | 'Market median' | 'Accepted from note' | 'Manual' | 'Rate needed';

export type PriceCandidate = {
  basis: Basis;
  unit_price: number;
  est_unit_cost: number | null;
  currency: string;
};

export type PastCandidate = PriceCandidate & {
  quotation_id: number;
  quotation_number: string;
  created_at: number;
};

export type Resolved = {
  source: PriceSource;
  source_ref: string | null;
  confidence: 'High' | 'Medium' | 'Low' | 'None';
  basis: Basis | null;
  unit_price: number | null;
  est_unit_cost: number | null;
  currency: string | null;
};

export const MIN_MARKET_QUOTATIONS = 2;

export function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const v = s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(v * 10000) / 10000;
}

export function resolvePrice(input: {
  template: PriceCandidate | null;
  customerPast: PastCandidate[];
  market: PastCandidate[];
}): Resolved {
  if (input.template) {
    const t = input.template;
    return {
      source: 'Template',
      source_ref: null,
      confidence: 'High',
      basis: t.basis,
      unit_price: t.unit_price,
      est_unit_cost: t.est_unit_cost,
      currency: t.currency
    };
  }
  if (input.customerPast.length > 0) {
    const latest = [...input.customerPast].sort((a, b) => b.created_at - a.created_at || b.quotation_id - a.quotation_id)[0];
    return {
      source: 'Past quotation',
      source_ref: latest.quotation_number,
      confidence: 'Medium',
      basis: latest.basis,
      unit_price: latest.unit_price,
      est_unit_cost: latest.est_unit_cost,
      currency: latest.currency
    };
  }
  const groups = new Map<string, PastCandidate[]>();
  for (const m of input.market) {
    const key = `${m.basis}|${m.currency}`;
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }
  let best: PastCandidate[] = [];
  for (const arr of groups.values()) {
    const distinct = new Set(arr.map((x) => x.quotation_id)).size;
    const bestDistinct = new Set(best.map((x) => x.quotation_id)).size;
    if (distinct > bestDistinct) best = arr;
  }
  const n = new Set(best.map((x) => x.quotation_id)).size;
  if (n >= MIN_MARKET_QUOTATIONS) {
    const costs = best.filter((b) => b.est_unit_cost !== null).map((b) => b.est_unit_cost as number);
    return {
      source: 'Market median',
      source_ref: `Median of ${n} quotations`,
      confidence: n >= 5 ? 'Medium' : 'Low',
      basis: best[0].basis,
      unit_price: median(best.map((b) => b.unit_price)),
      est_unit_cost: costs.length > 0 ? median(costs) : null,
      currency: best[0].currency
    };
  }
  return {
    source: 'Rate needed',
    source_ref: null,
    confidence: 'None',
    basis: null,
    unit_price: null,
    est_unit_cost: null,
    currency: null
  };
}
