'use client';

import { chargeableWeight, lbToKg, packageTotals, WEIGHT_FORMULAS, type Mode } from '@/lib/weight';
import { Field } from '@/lib/client';

export type PkgState = { quantity: string; length: string; width: string; height: string; weight: string };

export type CargoState = {
  cargo_mode: 'totals' | 'packages';
  unit_system: 'metric' | 'imperial';
  total_quantity: string;
  total_weight: string;
  total_volume: string;
  packages: PkgState[];
};

export const emptyPkg = (): PkgState => ({ quantity: '1', length: '', width: '', height: '', weight: '' });

export const emptyCargo = (): CargoState => ({
  cargo_mode: 'totals',
  unit_system: 'metric',
  total_quantity: '',
  total_weight: '',
  total_volume: '',
  packages: [emptyPkg()]
});

const n = (s: string) => {
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
};

export function cargoToData(c: CargoState) {
  if (c.cargo_mode === 'packages') {
    const packages = c.packages.map((p) => ({ quantity: n(p.quantity), length: n(p.length), width: n(p.width), height: n(p.height), weight: n(p.weight) }));
    const t = packageTotals(packages, c.unit_system);
    return {
      cargo_mode: 'packages' as const,
      unit_system: c.unit_system,
      packages,
      total_quantity: t.quantity,
      total_weight_kg: t.weightKg,
      total_volume_cbm: t.cbm
    };
  }
  return {
    cargo_mode: 'totals' as const,
    unit_system: c.unit_system,
    packages: [],
    total_quantity: n(c.total_quantity),
    total_weight_kg: c.unit_system === 'imperial' ? lbToKg(n(c.total_weight)) : n(c.total_weight),
    total_volume_cbm: n(c.total_volume)
  };
}

export function dataToCargo(d: Record<string, any>): CargoState {
  if (d.cargo_mode === 'packages' && Array.isArray(d.packages) && d.packages.length > 0) {
    return {
      cargo_mode: 'packages',
      unit_system: d.unit_system === 'imperial' ? 'imperial' : 'metric',
      total_quantity: String(d.total_quantity ?? ''),
      total_weight: '',
      total_volume: '',
      packages: d.packages.map((p: any) => ({ quantity: String(p.quantity ?? ''), length: String(p.length ?? ''), width: String(p.width ?? ''), height: String(p.height ?? ''), weight: String(p.weight ?? '') }))
    };
  }
  return {
    cargo_mode: 'totals',
    unit_system: 'metric',
    total_quantity: d.total_quantity ? String(d.total_quantity) : '',
    total_weight: d.total_weight_kg ? String(d.total_weight_kg) : '',
    total_volume: d.total_volume_cbm ? String(d.total_volume_cbm) : '',
    packages: [emptyPkg()]
  };
}

export default function CargoEditor({
  mode,
  value,
  onChange,
  missing
}: {
  mode: Mode;
  value: CargoState;
  onChange: (v: CargoState) => void;
  missing: { quantity?: boolean; weight?: boolean; volume?: boolean };
}) {
  const imperial = value.unit_system === 'imperial';
  const data = cargoToData(value);
  const cw = chargeableWeight(mode, data.total_weight_kg, data.total_volume_cbm);
  const set = (patch: Partial<CargoState>) => onChange({ ...value, ...patch });
  const setPkg = (i: number, patch: Partial<PkgState>) => set({ packages: value.packages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const wUnit = imperial ? 'lb' : 'kg';
  const dUnit = imperial ? 'inch' : 'cm';

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="subtabs" style={{ marginBottom: 0, borderBottom: 0 }}>
          <button type="button" className={`subtab${value.cargo_mode === 'totals' ? ' on' : ''}`} onClick={() => set({ cargo_mode: 'totals' })}>
            Totals
          </button>
          <button type="button" className={`subtab${value.cargo_mode === 'packages' ? ' on' : ''}`} onClick={() => set({ cargo_mode: 'packages' })}>
            Package details
          </button>
        </div>
        <div className="switch" aria-label="Units">
          <button type="button" className={!imperial ? 'on' : ''} onClick={() => set({ unit_system: 'metric' })}>
            kg/cm
          </button>
          <button type="button" className={imperial ? 'on' : ''} onClick={() => set({ unit_system: 'imperial' })}>
            lb/inch
          </button>
        </div>
      </div>

      {value.cargo_mode === 'totals' ? (
        <div className="grid3">
          <Field label="Total quantity" missing={missing.quantity}>
            <input type="number" min="0" value={value.total_quantity} onChange={(e) => set({ total_quantity: e.target.value })} />
          </Field>
          <Field label="Total volume (m3)" missing={missing.volume}>
            <input type="number" min="0" step="0.01" value={value.total_volume} onChange={(e) => set({ total_volume: e.target.value })} />
          </Field>
          <Field label={`Total weight (${wUnit})`} missing={missing.weight}>
            <input type="number" min="0" step="0.01" value={value.total_weight} onChange={(e) => set({ total_weight: e.target.value })} />
          </Field>
        </div>
      ) : (
        <div>
          <table className="t">
            <thead>
              <tr>
                <th>Quantity</th>
                <th>Length ({dUnit})</th>
                <th>Width ({dUnit})</th>
                <th>Height ({dUnit})</th>
                <th>Weight per package ({wUnit})</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {value.packages.map((p, i) => (
                <tr key={i}>
                  {(['quantity', 'length', 'width', 'height', 'weight'] as const).map((k) => (
                    <td key={k}>
                      <input type="number" min="0" step="0.01" value={p[k]} onChange={(e) => setPkg(i, { [k]: e.target.value })} aria-label={k} />
                    </td>
                  ))}
                  <td>
                    {value.packages.length > 1 && (
                      <button type="button" className="link-btn" onClick={() => set({ packages: value.packages.filter((_, idx) => idx !== i) })}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row between mt">
            <button type="button" className="btn secondary small" onClick={() => set({ packages: [...value.packages, emptyPkg()] })}>
              Add package row
            </button>
            <span className="hint">
              Totals: {data.total_quantity} packages, {data.total_weight_kg} kg, {data.total_volume_cbm} m3
            </span>
          </div>
          {(missing.weight || missing.volume || missing.quantity) && <p className="hint" style={{ color: 'var(--bad)' }}>Fill every package row with quantity, size and weight.</p>}
        </div>
      )}

      <div className="chargeable mt">
        <div className="lbl-text">Chargeable weight</div>
        {cw.hasRule ? (
          <div className="big">{cw.chargeableWeight?.toFixed(2)} kg</div>
        ) : (
          <div className="big">{cw.grossWeight.toFixed(2)} kg gross</div>
        )}
        <div className="hint">{WEIGHT_FORMULAS[mode]}</div>
        {cw.hasRule && (
          <div className="hint">
            Actual {cw.grossWeight.toFixed(2)} kg, volume weight {cw.volumeWeight?.toFixed(2)} kg
          </div>
        )}
      </div>
    </div>
  );
}
