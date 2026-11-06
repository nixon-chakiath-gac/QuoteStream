export const MODES = ['Air', 'Sea', 'Land', 'Courier', 'Hand Carry', 'Others'] as const;
export type Mode = (typeof MODES)[number];

export const WEIGHT_FACTORS: Record<Mode, number | null> = {
  Air: 1000 / 6,
  Courier: 200,
  Sea: null,
  Land: null,
  'Hand Carry': null,
  Others: null
};

export const WEIGHT_FORMULAS: Record<Mode, string> = {
  Air: 'Volume weight = volume (CBM) x 1000 / 6. Chargeable weight is the greater of actual and volume weight.',
  Courier: 'Volume weight = volume (CBM) x 200. Chargeable weight is the greater of actual and volume weight.',
  Sea: 'Weight rule not defined for this mode. Gross weight is shown.',
  Land: 'Weight rule not defined for this mode. Gross weight is shown.',
  'Hand Carry': 'Weight rule not defined for this mode. Gross weight is shown.',
  Others: 'Weight rule not defined for this mode. Gross weight is shown.'
};

export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isMode(v: unknown): v is Mode {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v);
}

export type CargoResult = {
  grossWeight: number;
  volume: number;
  volumeWeight: number | null;
  chargeableWeight: number | null;
  billableWeight: number;
  hasRule: boolean;
  formula: string;
};

export function volumeWeight(mode: Mode, cbm: number): number | null {
  const factor = WEIGHT_FACTORS[mode];
  if (factor === null) return null;
  return cbm * factor;
}

export function chargeableWeight(mode: Mode, grossKg: number, cbm: number): CargoResult {
  const vw = volumeWeight(mode, cbm);
  const gross = r2(grossKg);
  if (vw === null) {
    return {
      grossWeight: gross,
      volume: cbm,
      volumeWeight: null,
      chargeableWeight: null,
      billableWeight: gross,
      hasRule: false,
      formula: WEIGHT_FORMULAS[mode]
    };
  }
  const chargeable = r2(Math.max(grossKg, vw));
  return {
    grossWeight: gross,
    volume: cbm,
    volumeWeight: r2(vw),
    chargeableWeight: chargeable,
    billableWeight: chargeable,
    hasRule: true,
    formula: WEIGHT_FORMULAS[mode]
  };
}

export type PackageRow = {
  quantity: number;
  length: number;
  width: number;
  height: number;
  weight: number;
};

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

export function packageTotals(rows: PackageRow[], unitSystem: 'metric' | 'imperial') {
  let quantity = 0;
  let weightKg = 0;
  let cbm = 0;
  for (const row of rows) {
    const q = Number(row.quantity) || 0;
    const w = Number(row.weight) || 0;
    const l = Number(row.length) || 0;
    const wd = Number(row.width) || 0;
    const h = Number(row.height) || 0;
    const kg = unitSystem === 'imperial' ? w * LB_TO_KG : w;
    const k = unitSystem === 'imperial' ? IN_TO_CM : 1;
    quantity += q;
    weightKg += q * kg;
    cbm += (q * (l * k) * (wd * k) * (h * k)) / 1000000;
  }
  return { quantity, weightKg: r2(weightKg), cbm: Math.round(cbm * 1000) / 1000 };
}

export function lbToKg(lb: number): number {
  return r2(lb * LB_TO_KG);
}
