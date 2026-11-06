'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CargoEditor, { cargoToData, emptyCargo, type CargoState } from '@/components/CargoEditor';
import { Field, api, useData } from '@/lib/client';
import { missingFor, FIELD_LABELS, type FieldKey } from '@/lib/required';
import { MODES, type Mode } from '@/lib/weight';

const ICONS: Record<Mode, string> = { Air: '✈', Sea: '⚓', Land: '\u{1F69A}', Courier: '\u{1F4E6}', 'Hand Carry': '\u{1F9F3}', Others: '⚙' };

type Form = {
  origin: string;
  destination: string;
  pickup_needed: boolean;
  pickup_address: string;
  delivery_needed: boolean;
  delivery_address: string;
  incoterm: string;
  description: string;
  ready_date: string;
  load_type: string;
  container_type: string;
  container_count: string;
  vehicle_type: string;
  service_description: string;
  cargo: CargoState;
};

const empty = (): Form => ({
  origin: '',
  destination: '',
  pickup_needed: false,
  pickup_address: '',
  delivery_needed: false,
  delivery_address: '',
  incoterm: '',
  description: '',
  ready_date: '',
  load_type: '',
  container_type: '',
  container_count: '',
  vehicle_type: '',
  service_description: '',
  cargo: emptyCargo()
});

function nextWeek(): string {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

const EXAMPLES: Record<Mode, Omit<Partial<Form>, 'cargo'> & { cargo?: Partial<CargoState> }> = {
  Air: { origin: 'Shanghai (SHA)', destination: 'Dubai (DXB)', incoterm: 'FCA', description: 'Pump spare parts', cargo: { total_quantity: '3', total_weight: '450', total_volume: '3.2' } },
  Sea: { origin: 'Ningbo (NGB)', destination: 'Jebel Ali (JEA)', incoterm: 'FOB', description: 'Industrial valves', load_type: 'LCL', cargo: { total_quantity: '24', total_weight: '6200', total_volume: '14' } },
  Land: { origin: 'Dubai (DXB)', destination: 'Riyadh (RUH)', incoterm: 'DAP', description: 'Drilling consumables', vehicle_type: 'FTL', cargo: { total_quantity: '12', total_weight: '8000', total_volume: '20' } },
  Courier: { origin: 'Shanghai (SHA)', destination: 'Dubai (DXB)', incoterm: 'DAP', description: 'Sensor samples', cargo: { total_quantity: '2', total_weight: '30', total_volume: '0.4' } },
  'Hand Carry': { origin: 'Singapore (SIN)', destination: 'Dubai (DXB)', description: 'Calibration kit', cargo: { total_quantity: '1', total_weight: '12', total_volume: '0.05' } },
  Others: { origin: '', destination: '', service_description: 'Site survey and special lifting support for pump skid' }
};

export default function RequestPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<'mode' | 'form'>('mode');
  const [f, setF] = useState<Form>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: lookups } = useData<any>(mode ? `/api/lookups?mode=${encodeURIComponent(mode)}` : '/api/lookups');

  const data = useMemo(() => {
    const c = cargoToData(f.cargo);
    return {
      mode,
      origin: f.origin,
      destination: f.destination,
      incoterm: f.incoterm,
      description: f.description,
      ready_date: f.ready_date,
      load_type: f.load_type,
      container_type: f.container_type,
      container_count: Number(f.container_count) || 0,
      vehicle_type: f.vehicle_type,
      service_description: f.service_description,
      ...c
    } as Record<string, any>;
  }, [f, mode]);

  const missing = useMemo(() => (mode ? missingFor(data, 'Portal') : []), [data, mode]);
  const miss = (k: FieldKey) => missing.includes(k);
  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));

  function fillExample() {
    if (!mode) return;
    const ex = EXAMPLES[mode];
    setF({ ...empty(), ...ex, ready_date: nextWeek(), cargo: { ...emptyCargo(), ...(ex.cargo ?? {}) } } as Form);
  }

  async function submit() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...data,
        pickup_needed: f.pickup_needed,
        pickup_address: f.pickup_address,
        delivery_needed: f.delivery_needed,
        delivery_address: f.delivery_address
      };
      const res = await api<{ id: number }>('/api/portal/requests', { body });
      router.push(`/portal/requests/${res.id}?new=1`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (step === 'mode') {
    return (
      <div>
        <h1>Request a quotation</h1>
        <p className="subtitle">Choose how your cargo will travel</p>
        <div className="mode-grid">
          {MODES.map((m) => (
            <button key={m} className={`mode-card${mode === m ? ' selected' : ''}`} onClick={() => setMode(m)} aria-pressed={mode === m}>
              <span className="mode-icon">{ICONS[m]}</span>
              <span className="mode-name">{m}</span>
              <span className="mode-desc">{lookups?.mode_descriptions?.[m] ?? ''}</span>
            </button>
          ))}
        </div>
        <button className="btn" disabled={!mode} onClick={() => setStep('form')}>
          Continue
        </button>
        {!mode && <span className="hint" style={{ marginLeft: 12 }}>Choose a mode to continue</span>}
      </div>
    );
  }

  const ports: { code: string; label: string }[] = lookups?.ports ?? [];
  const incoterms: { code: string; text: string }[] = lookups?.incoterms ?? [];
  const m = mode as Mode;
  const isOthers = m === 'Others';
  const isHC = m === 'Hand Carry';
  const showIncoterm = !isOthers && !isHC;
  const showCargo = !isOthers;
  const showExtra = !isOthers && !isHC;
  const ready = missing.length === 0;

  const PortSelect = ({ value, onChange, missingKey, label }: { value: string; onChange: (v: string) => void; missingKey: FieldKey; label: string }) => (
    <Field label={label} missing={miss(missingKey)}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a place or port</option>
        {ports.map((p) => (
          <option key={p.code} value={p.label}>
            {p.label}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <div>
      <div className="row between">
        <div>
          <h1>Request a quotation</h1>
          <p className="subtitle">Tell us about your shipment. We will send you a quotation.</p>
        </div>
        <button className="btn secondary" onClick={fillExample}>
          Fill example
        </button>
      </div>

      <div className="summary-row">
        <div>
          <div className="lbl">From</div>
          <div className="val">{f.origin || 'Not chosen'}</div>
        </div>
        <div>
          <div className="lbl">By</div>
          <div className="val">{m}</div>
        </div>
        <div>
          <div className="lbl">To</div>
          <div className="val">{f.destination || 'Not chosen'}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="link-btn" onClick={() => setStep('mode')}>
          Change mode
        </button>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>From</h2>
          <PortSelect label={isOthers ? 'Place or port (optional)' : 'Place or port'} value={f.origin} onChange={(v) => set({ origin: v })} missingKey="origin" />
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={f.pickup_needed} onChange={(e) => set({ pickup_needed: e.target.checked })} />
            Pick-up needed
          </label>
          {f.pickup_needed && (
            <Field label="Pick-up address">
              <textarea rows={2} value={f.pickup_address} onChange={(e) => set({ pickup_address: e.target.value })} />
            </Field>
          )}
        </div>
        <div className="card">
          <h2>To</h2>
          <PortSelect label={isOthers ? 'Place or port (optional)' : 'Place or port'} value={f.destination} onChange={(v) => set({ destination: v })} missingKey="destination" />
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={f.delivery_needed} onChange={(e) => set({ delivery_needed: e.target.checked })} />
            Delivery needed
          </label>
          {f.delivery_needed && (
            <Field label="Delivery address">
              <textarea rows={2} value={f.delivery_address} onChange={(e) => set({ delivery_address: e.target.value })} />
            </Field>
          )}
        </div>
      </div>

      {isOthers && (
        <div className="card">
          <h2>Service needed</h2>
          <Field label="Description of the service needed" missing={miss('service_description')}>
            <textarea rows={3} value={f.service_description} onChange={(e) => set({ service_description: e.target.value })} />
          </Field>
          <Field label="Ready date (optional)">
            <input type="date" value={f.ready_date} onChange={(e) => set({ ready_date: e.target.value })} />
          </Field>
        </div>
      )}

      {m === 'Sea' && (
        <div className="card">
          <h2>Sea details</h2>
          <div className="grid3">
            <Field label="Load type" missing={miss('load_type')}>
              <select value={f.load_type} onChange={(e) => set({ load_type: e.target.value })}>
                <option value="">Select</option>
                <option value="FCL">FCL (full container)</option>
                <option value="LCL">LCL (part container)</option>
              </select>
            </Field>
            {f.load_type === 'FCL' && (
              <>
                <Field label="Container type" missing={miss('container_type')}>
                  <select value={f.container_type} onChange={(e) => set({ container_type: e.target.value })}>
                    <option value="">Select</option>
                    <option value="20 ft standard">20 ft standard</option>
                    <option value="40 ft standard">40 ft standard</option>
                    <option value="40 ft high cube">40 ft high cube</option>
                  </select>
                </Field>
                <Field label="Container count" missing={miss('container_count')}>
                  <input type="number" min="1" value={f.container_count} onChange={(e) => set({ container_count: e.target.value })} />
                </Field>
              </>
            )}
          </div>
        </div>
      )}

      {m === 'Land' && (
        <div className="card">
          <h2>Land details</h2>
          <Field label="Vehicle type" missing={miss('vehicle_type')}>
            <select value={f.vehicle_type} onChange={(e) => set({ vehicle_type: e.target.value })}>
              <option value="">Select</option>
              <option value="FTL">FTL (full truck load)</option>
              <option value="LTL">LTL (part truck load)</option>
            </select>
          </Field>
        </div>
      )}

      {showCargo && (
        <div className="card">
          <h2>Cargo</h2>
          <CargoEditor
            mode={m}
            value={f.cargo}
            onChange={(c) => set({ cargo: c })}
            missing={{ quantity: miss('total_quantity'), weight: miss('total_weight'), volume: miss('total_volume') }}
          />
        </div>
      )}

      {showExtra && (
        <div className="card">
          <h2>Incoterm and cargo information</h2>
          <div className="grid2">
            <div>
              <Field label="Incoterm" missing={miss('incoterm')}>
                <select value={f.incoterm} onChange={(e) => set({ incoterm: e.target.value })}>
                  <option value="">Select an incoterm</option>
                  {incoterms.map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.code}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="hint">{incoterms.find((i) => i.code === f.incoterm)?.text ?? 'Choose the incoterm that matches your sales contract.'}</p>
            </div>
            <div>
              <Field label="Cargo description" missing={miss('description')}>
                <input value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="For example: pump spare parts" />
              </Field>
              <Field label="Ready date" missing={miss('ready_date')}>
                <input type="date" value={f.ready_date} onChange={(e) => set({ ready_date: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      )}

      {isHC && (
        <div className="card">
          <h2>Cargo information</h2>
          <div className="grid2">
            <Field label="Cargo description (optional)">
              <input value={f.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Ready date" missing={miss('ready_date')}>
              <input type="date" value={f.ready_date} onChange={(e) => set({ ready_date: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {error && <div className="banner error">{error}</div>}

      <div className="row">
        <button className="btn" disabled={!ready || busy} onClick={submit}>
          {busy ? 'Sending...' : 'Request quotation'}
        </button>
        {!ready && (
          <span className="hint" style={{ color: 'var(--bad)' }}>
            {missing.length} field{missing.length > 1 ? 's' : ''} still needed: {missing.map((k) => FIELD_LABELS[k]).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
