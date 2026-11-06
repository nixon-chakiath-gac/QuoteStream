'use client';

import { useEffect, useState } from 'react';
import { AiStatusBanner, Field, api, useData } from '@/lib/client';

export default function SettingsPage() {
  const { data, reload } = useData<any>('/api/gac/settings');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const cfg = data?.config;

  useEffect(() => {
    if (cfg) {
      setProvider(cfg.provider);
      setModel(cfg.model);
    }
  }, [cfg?.provider, cfg?.model]);

  const prov = cfg?.providers?.find((p: any) => p.id === provider);

  async function save() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api<any>('/api/gac/settings', { body: { provider, model } });
      setResult({ ok: Boolean(r.health?.reachable), text: r.health?.message ?? (r.health?.reachable ? 'Connection works' : 'Could not connect') });
      reload();
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
    }
    setBusy(false);
  }

  return (
    <div>
      <h1>Settings</h1>
      <AiStatusBanner key={result?.text ?? ''} />
      <p className="subtitle">Choose which AI provider reads emails and writes cover notes. The change applies at once, no restart needed.</p>
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>AI provider</h2>
        {data && !data.available && <div className="banner error">The AI service is not reachable. The rule based reader still works for the sample emails.</div>}
        <Field label="Provider">
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              const p = cfg?.providers?.find((x: any) => x.id === e.target.value);
              if (p) setModel(p.default_model);
            }}
          >
            {(cfg?.providers ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Model">
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </Field>
        <p>
          {prov?.needs_key ? (
            prov.key_present ? (
              <span className="chip ok">Key found in environment</span>
            ) : (
              <span className="chip bad">Key missing in the .env file</span>
            )
          ) : (
            <span className="chip info">No key needed</span>
          )}
        </p>
        <button className="btn" disabled={busy || !provider || !model} onClick={save}>
          {busy ? 'Testing...' : 'Save and test connection'}
        </button>
        {result && <div className={`banner ${result.ok ? 'ok' : 'error'} mt`}>{result.text}</div>}
      </div>
    </div>
  );
}
