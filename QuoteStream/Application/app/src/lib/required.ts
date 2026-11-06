import { isMode } from './weight';

export type FieldKey =
  | 'customer'
  | 'mode'
  | 'origin'
  | 'destination'
  | 'incoterm'
  | 'total_weight'
  | 'total_volume'
  | 'total_quantity'
  | 'description'
  | 'ready_date'
  | 'load_type'
  | 'container_type'
  | 'container_count'
  | 'vehicle_type'
  | 'service_description';

export const FIELD_LABELS: Record<FieldKey, string> = {
  customer: 'Customer',
  mode: 'Mode',
  origin: 'Origin',
  destination: 'Destination',
  incoterm: 'Incoterm',
  total_weight: 'Total weight',
  total_volume: 'Total volume',
  total_quantity: 'Total quantity',
  description: 'Cargo description',
  ready_date: 'Ready date',
  load_type: 'Load type',
  container_type: 'Container type',
  container_count: 'Container count',
  vehicle_type: 'Vehicle type',
  service_description: 'Description of the service needed'
};

export type Source = 'Email' | 'Portal';

export const EMAIL_REQUIRED: FieldKey[] = [
  'customer',
  'mode',
  'origin',
  'destination',
  'incoterm',
  'total_weight',
  'total_volume'
];

const PORTAL_BASE: FieldKey[] = [
  'origin',
  'destination',
  'incoterm',
  'total_quantity',
  'total_weight',
  'total_volume',
  'description',
  'ready_date'
];

export function requiredFor(mode: string | null | undefined, source: Source, data?: Record<string, unknown>): FieldKey[] {
  if (source === 'Email') return EMAIL_REQUIRED;
  if (!isMode(mode)) return ['origin', 'destination'];
  if (mode === 'Hand Carry') return ['origin', 'destination', 'total_weight', 'ready_date'];
  if (mode === 'Others') return ['service_description'];
  const list = [...PORTAL_BASE];
  if (mode === 'Sea') {
    list.push('load_type');
    if (data && data.load_type === 'FCL') list.push('container_type', 'container_count');
  }
  if (mode === 'Land') list.push('vehicle_type');
  return list;
}

function str(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function pos(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export function isFilled(key: FieldKey, d: Record<string, unknown>): boolean {
  switch (key) {
    case 'customer':
      return str(d.customer);
    case 'mode':
      return isMode(d.mode);
    case 'origin':
      return str(d.origin);
    case 'destination':
      return str(d.destination);
    case 'incoterm':
      return str(d.incoterm);
    case 'total_weight':
      return pos(d.total_weight_kg);
    case 'total_volume':
      return pos(d.total_volume_cbm);
    case 'total_quantity':
      return pos(d.total_quantity);
    case 'description':
      return str(d.description);
    case 'ready_date':
      return str(d.ready_date);
    case 'load_type':
      return str(d.load_type);
    case 'container_type':
      return str(d.container_type);
    case 'container_count':
      return pos(d.container_count);
    case 'vehicle_type':
      return str(d.vehicle_type);
    case 'service_description':
      return str(d.service_description);
  }
}

export function missingFor(d: Record<string, unknown>, source: Source): FieldKey[] {
  const mode = typeof d.mode === 'string' ? d.mode : null;
  return requiredFor(mode, source, d).filter((k) => !isFilled(k, d));
}

export function missingLabels(keys: string[]): string[] {
  return keys.map((k) => FIELD_LABELS[k as FieldKey] ?? k);
}
