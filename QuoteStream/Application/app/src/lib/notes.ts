import type { Basis } from './money';
import { BASIS_LABEL } from './money';

export type NoteChange = 'add_service' | 'remove_service' | 'change_price';

export type NoteRow = {
  id: number;
  principal_id: number | null;
  mode: string | null;
  origin_port_id: number | null;
  destination_port_id: number | null;
  change_type: NoteChange;
  service_name: string | null;
  basis: Basis | null;
  currency: string | null;
  old_value: number | null;
  new_value: number | null;
  est_unit_cost: number | null;
  reason: string | null;
  reason_text: string | null;
  source_label: string;
  is_test: number;
  created_at: number;
};

export type DraftLineLite = {
  id: number;
  service_name: string;
  basis: Basis;
  currency: string;
  unit_price: number | null;
};

export type DraftContext = {
  principal_id: number;
  mode: string;
  origin_port_id: number | null;
  destination_port_id: number | null;
};

export type Suggestion = {
  note_id: number;
  change_type: NoteChange;
  service_name: string;
  basis: Basis | null;
  basis_label: string | null;
  currency: string | null;
  value: number | null;
  est_unit_cost: number | null;
  current_value: number | null;
  line_id: number | null;
  reason: string;
  source_label: string;
  match: 'Same customer and lane' | 'Same mode and lane';
  warning: string | null;
};

export const SANITY_FACTOR = 3;

export function suggestNotes(
  ctx: DraftContext,
  lines: DraftLineLite[],
  notes: NoteRow[],
  dismissed: Set<number>,
  includeTest = false
): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const sorted = [...notes].sort((a, b) => b.created_at - a.created_at || b.id - a.id);
  const ranked = [
    ...sorted.filter((n) => n.principal_id === ctx.principal_id),
    ...sorted.filter((n) => n.principal_id !== ctx.principal_id)
  ];
  for (const n of ranked) {
    if (dismissed.has(n.id)) continue;
    if (n.is_test && !includeTest) continue;
    if (!n.service_name) continue;
    if (n.mode !== ctx.mode) continue;
    if (n.origin_port_id !== ctx.origin_port_id || n.destination_port_id !== ctx.destination_port_id) continue;
    const sameCustomer = n.principal_id === ctx.principal_id;
    const line = lines.find((l) => l.service_name === n.service_name) ?? null;
    let sug: Suggestion | null = null;
    const base = {
      note_id: n.id,
      change_type: n.change_type,
      service_name: n.service_name,
      basis: n.basis,
      basis_label: n.basis ? BASIS_LABEL[n.basis] : null,
      currency: n.currency,
      value: n.new_value,
      est_unit_cost: n.est_unit_cost,
      current_value: line ? line.unit_price : null,
      line_id: line ? line.id : null,
      reason: n.reason_text ? `${n.reason ?? ''}: ${n.reason_text}`.replace(/^: /, '') : n.reason ?? '',
      source_label: `Note from ${n.source_label}`,
      match: sameCustomer ? ('Same customer and lane' as const) : ('Same mode and lane' as const),
      warning: null as string | null
    };
    if (n.change_type === 'add_service') {
      if (line || n.new_value === null || !n.basis) continue;
      sug = base;
    } else if (n.change_type === 'remove_service') {
      if (!line) continue;
      sug = base;
    } else if (n.change_type === 'change_price') {
      if (!line || n.new_value === null || !n.basis) continue;
      if (line.basis !== n.basis) continue;
      if (line.unit_price !== null && line.unit_price === n.new_value) continue;
      sug = base;
      if (line.unit_price !== null && line.unit_price > 0 && n.new_value > line.unit_price * SANITY_FACTOR) {
        sug.warning = `Price is more than ${SANITY_FACTOR} times the current price on the same basis (${BASIS_LABEL[n.basis]}).`;
      }
    }
    if (!sug) continue;
    const key = `${sug.change_type}|${sug.service_name}|${sug.basis}|${sug.value}|${sug.currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sug);
  }
  return out;
}
