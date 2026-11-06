export class ProviderError extends Error {
  constructor(message, kind, status) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export const PROVIDER_IDS = ['ollama', 'gemini', 'claude', 'openai'];

export const PROVIDER_LABEL = { ollama: 'Ollama', gemini: 'Gemini', claude: 'Claude', openai: 'OpenAI' };

export function timeoutFor(provider, env = process.env) {
  if (provider === 'gemini') return Number(env.GEMINI_TIMEOUT_MS) || 10000;
  return Number(env.LLM_TIMEOUT_MS) || 60000;
}

export function reasonText(failure, env = process.env) {
  const name = PROVIDER_LABEL[failure.provider] || failure.provider;
  if (failure.kind === 'invalid') return `Invalid answer from the model (${name})`;
  if (failure.kind === 'timeout') return `${name} timed out after ${Math.round(timeoutFor(failure.provider, env) / 1000)} s`;
  if (failure.kind === 'no_key') return `${name} unavailable: no API key`;
  if (failure.kind === 'http') return `${name} unavailable: HTTP ${failure.status}${failure.detail ? ' ' + failure.detail : ''}`;
  return `${name} unavailable`;
}

export function providerInfo(env = process.env) {
  return [
    { id: 'ollama', label: 'Ollama (local)', default_model: env.OLLAMA_MODEL || 'llama3.1:8b', needs_key: false, key_present: true },
    { id: 'gemini', label: 'Google Gemini', default_model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite', needs_key: true, key_present: Boolean(env.GEMINI_API_KEY) },
    { id: 'claude', label: 'Anthropic Claude', default_model: env.ANTHROPIC_MODEL || 'claude-haiku-5-5', needs_key: true, key_present: Boolean(env.ANTHROPIC_API_KEY) },
    { id: 'openai', label: 'OpenAI', default_model: env.OPENAI_MODEL || 'gpt-4o-mini', needs_key: true, key_present: Boolean(env.OPENAI_API_KEY) }
  ];
}

function withHint(system, schemaHint) {
  return schemaHint ? `${system}\n\nReply with JSON only, shaped like: ${schemaHint}` : system;
}

const TRANSIENT = [500, 502, 503, 504];

async function postOnce(url, headers, body, timeoutMs) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new ProviderError('The provider timed out', 'timeout');
    throw new ProviderError('The provider is not reachable', 'unreachable');
  }
  if (!res.ok) {
    let detail = '';
    try {
      const d = await res.json();
      detail = String((d && d.error && d.error.status) || '').replace(/[^A-Z_]/g, '').slice(0, 40);
    } catch {
      detail = '';
    }
    const err = new ProviderError(`The provider returned HTTP ${res.status}${detail ? ' ' + detail : ''}`, 'http', res.status);
    err.detail = detail;
    throw err;
  }
  try {
    return await res.json();
  } catch {
    throw new ProviderError('The provider returned an unreadable reply', 'bad_reply');
  }
}

export async function post(url, headers, body, timeoutMs, wait = 500) {
  try {
    return await postOnce(url, headers, body, timeoutMs);
  } catch (e) {
    const transient = e instanceof ProviderError && (e.kind === 'unreachable' || (e.kind === 'http' && TRANSIENT.includes(e.status)));
    if (!transient) throw e;
    await new Promise((r) => setTimeout(r, wait));
    return postOnce(url, headers, body, timeoutMs);
  }
}

function text(v) {
  if (typeof v !== 'string' || !v) throw new ProviderError('The provider returned an empty reply', 'bad_reply');
  return v;
}

export function adapter(provider, model, env = process.env) {
  const timeout = timeoutFor(provider, env);
  if (provider === 'ollama') {
    const base = (env.OLLAMA_URL || 'http://host.docker.internal:11434').replace(/\/+$/, '');
    return async (system, user, schemaHint) => {
      const d = await post(`${base}/api/chat`, {}, {
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0 },
        keep_alive: '30m',
        messages: [
          { role: 'system', content: withHint(system, schemaHint) },
          { role: 'user', content: user }
        ]
      }, timeout);
      return text(d && d.message && d.message.content);
    };
  }
  if (provider === 'gemini') {
    return async (system, user, schemaHint, jsonSchema) => {
      if (!env.GEMINI_API_KEY) throw new ProviderError('No API key is set for Gemini', 'no_key');
      const generationConfig = { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: Number(env.GEMINI_MAX_OUTPUT_TOKENS) || 2048 };
      if (jsonSchema) generationConfig.responseJsonSchema = jsonSchema;
      const level = env.GEMINI_THINKING_LEVEL === undefined ? 'minimal' : env.GEMINI_THINKING_LEVEL;
      if (level && /^gemini-3/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: level };
      const d = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { 'x-goog-api-key': env.GEMINI_API_KEY },
        {
          systemInstruction: { parts: [{ text: withHint(system, schemaHint) }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig
        },
        timeout
      );
      const parts = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
      return text(parts && parts.map((p) => p.text || '').join(''));
    };
  }
  if (provider === 'claude') {
    return async (system, user, schemaHint) => {
      if (!env.ANTHROPIC_API_KEY) throw new ProviderError('No API key is set for Claude', 'no_key');
      const d = await post(
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        {
          model,
          max_tokens: 2048,
          temperature: 0,
          system: withHint(system, schemaHint),
          messages: [{ role: 'user', content: user }]
        },
        timeout
      );
      return text(d && Array.isArray(d.content) && d.content.map((c) => c.text || '').join(''));
    };
  }
  if (provider === 'openai') {
    return async (system, user, schemaHint) => {
      if (!env.OPENAI_API_KEY) throw new ProviderError('No API key is set for OpenAI', 'no_key');
      const d = await post(
        'https://api.openai.com/v1/chat/completions',
        { authorization: `Bearer ${env.OPENAI_API_KEY}` },
        {
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: withHint(system, schemaHint) },
            { role: 'user', content: user }
          ]
        },
        timeout
      );
      return text(d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content);
    };
  }
  throw new ProviderError('Unknown provider', 'bad_provider');
}

export async function checkHealth(provider, model, env = process.env, callProvider) {
  const info = providerInfo(env).find((p) => p.id === provider);
  if (provider === 'ollama') {
    const base = (env.OLLAMA_URL || 'http://host.docker.internal:11434').replace(/\/+$/, '');
    let res;
    try {
      res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
    } catch {
      return { reachable: false, message: 'Ollama is not reachable' };
    }
    if (!res.ok) return { reachable: false, message: `Ollama returned HTTP ${res.status}` };
    let names = [];
    try {
      const d = await res.json();
      names = (d.models || []).map((m) => m.name || m.model);
    } catch {
      return { reachable: false, message: 'Ollama returned an unreadable reply' };
    }
    const installed = names.some((n) => n === model || n === `${model}:latest` || `${n}` === `${model}`);
    return installed
      ? { reachable: true, message: `Ollama is ready with model ${model}` }
      : { reachable: false, message: `Ollama is running but model ${model} is not installed` };
  }
  if (!info || !info.key_present) return { reachable: false, message: 'No API key is set for this provider' };
  try {
    await callProvider(provider, model, 'Reply with the JSON object {"ok":true} and nothing else.', 'ping', '{"ok":true}');
    return { reachable: true, message: `Provider answered with model ${model}` };
  } catch (e) {
    return { reachable: false, message: e instanceof ProviderError ? e.message : 'The provider call failed' };
  }
}

export async function listGeminiModels(env = process.env) {
  if (!env.GEMINI_API_KEY) throw new ProviderError('No API key is set for Gemini', 'no_key');
  let res;
  try {
    res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
      signal: AbortSignal.timeout(timeoutFor('gemini', env))
    });
  } catch {
    throw new ProviderError('Gemini is not reachable', 'unreachable');
  }
  if (!res.ok) throw new ProviderError(`Gemini returned HTTP ${res.status}`, 'http', res.status);
  const d = await res.json();
  return (d.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name).replace(/^models\//, ''));
}
