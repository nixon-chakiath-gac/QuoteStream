export class ProviderError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
  }
}

export const PROVIDER_IDS = ['ollama', 'gemini', 'claude', 'openai'];

export function providerInfo(env = process.env) {
  return [
    { id: 'ollama', label: 'Ollama (local)', default_model: env.OLLAMA_MODEL || 'llama3.1:8b', needs_key: false, key_present: true },
    { id: 'gemini', label: 'Google Gemini', default_model: env.GEMINI_MODEL || 'gemini-2.0-flash', needs_key: true, key_present: Boolean(env.GEMINI_API_KEY) },
    { id: 'claude', label: 'Anthropic Claude', default_model: env.ANTHROPIC_MODEL || 'claude-haiku-5-5', needs_key: true, key_present: Boolean(env.ANTHROPIC_API_KEY) },
    { id: 'openai', label: 'OpenAI', default_model: env.OPENAI_MODEL || 'gpt-4o-mini', needs_key: true, key_present: Boolean(env.OPENAI_API_KEY) }
  ];
}

function withHint(system, schemaHint) {
  return schemaHint ? `${system}\n\nReply with JSON only, shaped like: ${schemaHint}` : system;
}

async function post(url, headers, body, timeoutMs) {
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
  if (!res.ok) throw new ProviderError(`The provider returned HTTP ${res.status}`, 'http');
  try {
    return await res.json();
  } catch {
    throw new ProviderError('The provider returned an unreadable reply', 'bad_reply');
  }
}

function text(v) {
  if (typeof v !== 'string' || !v) throw new ProviderError('The provider returned an empty reply', 'bad_reply');
  return v;
}

export function adapter(provider, model, env = process.env) {
  const timeout = Number(env.LLM_TIMEOUT_MS) || 60000;
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
    return async (system, user, schemaHint) => {
      if (!env.GEMINI_API_KEY) throw new ProviderError('No API key is set for Gemini', 'no_key');
      const d = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { 'x-goog-api-key': env.GEMINI_API_KEY },
        {
          systemInstruction: { parts: [{ text: withHint(system, schemaHint) }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 }
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
