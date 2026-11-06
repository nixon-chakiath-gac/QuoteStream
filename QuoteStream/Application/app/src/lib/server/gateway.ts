import { exec } from '../db';

export type GatewayMeta = {
  task: string;
  provider: string;
  model: string;
  duration_ms: number;
  success: boolean;
  fallback_used: boolean;
  cached: boolean;
};

function base(): string {
  return process.env.LLM_GATEWAY_URL ?? 'http://127.0.0.1:8090';
}

export async function gatewayCall<T = any>(path: string, body?: unknown, method: 'GET' | 'POST' | 'PUT' = 'POST', timeoutMs = 120000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base()}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Gateway answered ${res.status}`);
    const json = (await res.json()) as T & { meta?: GatewayMeta };
    const meta = (json as any)?.meta as GatewayMeta | undefined;
    if (meta) {
      await exec('INSERT INTO ai_call_log (task, provider, model, duration_ms, success, fallback_used) VALUES (?,?,?,?,?,?)', [
        meta.task,
        meta.provider,
        meta.model,
        meta.duration_ms,
        meta.success ? 1 : 0,
        meta.fallback_used ? 1 : 0
      ]).catch(() => undefined);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}
