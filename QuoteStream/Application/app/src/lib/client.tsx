'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json' },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store'
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? 'Something went wrong. Please try again.');
  return json as T;
}

export function useData<T = any>(path: string | null, intervalMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathRef = useRef(path);
  pathRef.current = path;
  const load = useCallback(async () => {
    if (!pathRef.current) return;
    try {
      const d = await api<T>(pathRef.current);
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setLoading(true);
    load();
    if (intervalMs > 0) {
      const t = setInterval(load, intervalMs);
      return () => clearInterval(t);
    }
  }, [path, intervalMs, load]);
  return { data, error, loading, reload: load, setData };
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00Z' : s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function statusClass(status: string): string {
  switch (status) {
    case 'Received':
    case 'Reading email':
      return 'chip';
    case 'Under review':
    case 'Missing information':
    case 'Submitted':
    case 'Waiting':
      return 'chip warn';
    case 'Quotation ready':
    case 'Accepted':
    case 'Sent to customer':
    case 'Sent':
      return 'chip ok';
    case 'Revision requested':
    case 'Draft ready':
      return 'chip info';
    case 'Rejected':
      return 'chip bad';
    default:
      return 'chip';
  }
}

export function Chip({ text, kind }: { text: string; kind?: string }) {
  return <span className={kind ?? statusClass(text)}>{text}</span>;
}

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, missing, hint, children }: { label: string; missing?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className={`field${missing ? ' missing' : ''}`}>
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Money({ currency, amount }: { currency: string; amount: number }) {
  return (
    <span>
      {currency} {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function MoneyList({ items }: { items: { currency: string; amount: number }[] }) {
  if (items.length === 0) return <span className="muted">None</span>;
  return (
    <span>
      {items.map((i, idx) => (
        <span key={i.currency}>
          {idx > 0 && <br />}
          <Money currency={i.currency} amount={i.amount} />
        </span>
      ))}
    </span>
  );
}

export function FallbackTag({ reason }: { reason?: string | null }) {
  const text = reason || 'The rule based reader answered';
  return (
    <span className="fallback" title={text}>
      <span className="chip warn tag">fallback used</span>
      <span className="hint">{text}</span>
    </span>
  );
}

export function AiStatusBanner() {
  const { data } = useData<any>('/api/gac/settings');
  if (!data) return null;
  if (!data.available) return <div className="banner error">The AI service is not reachable. Emails are read by the rule based reader until it is back.</div>;
  const h = data.health;
  if (!h || h.reachable) return null;
  const label = data.config?.providers?.find((p: any) => p.id === data.config.provider)?.label ?? data.config?.provider;
  return (
    <div className="banner error">
      {label} is not ready: {h.message}. Emails fall back to the next provider or the rule based reader. Check Settings and the .env file.
    </div>
  );
}
