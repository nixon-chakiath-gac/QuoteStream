import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adapter, providerInfo, PROVIDER_IDS, checkHealth, ProviderError } from './providers.js';
import { createCache, cacheKey } from './cache.js';
import {
  parseJson,
  computeMissing,
  validateExtract,
  applyExtractGuard,
  validateUpdate,
  applyUpdateGuard,
  validateEmailInput,
  validateEmailOutput,
  emailSubject
} from './validate.js';
import {
  extractFallback,
  updateFallback,
  applyUpdate,
  emailFallback,
  parseAddress,
  parseWeightVolume,
  customerFromDomain
} from './fallback.js';
import * as extractPrompt from './prompts/extract.js';
import * as updatePrompt from './prompts/update.js';
import * as emailPrompt from './prompts/customer_email.js';

const LOG_LIMIT = 200;

export function createService(options = {}) {
  const env = options.env || process.env;
  const dataDir = env.DATA_DIR || './data';
  const samplesDir = env.SAMPLES_DIR || './samples';
  const callProvider =
    options.callProvider || ((provider, model, system, user, hint) => adapter(provider, model, env)(system, user, hint));
  const cache = createCache(options.persist === false ? null : dataDir);
  const logs = [];

  function loadConfig() {
    const infos = providerInfo(env);
    const wanted = env.DEFAULT_PROVIDER || 'ollama';
    let cfg = { provider: PROVIDER_IDS.includes(wanted) ? wanted : 'ollama', model: null };
    if (options.persist !== false) {
      try {
        const saved = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8'));
        if (PROVIDER_IDS.includes(saved.provider) && typeof saved.model === 'string' && saved.model) cfg = saved;
      } catch {
        cfg.model = null;
      }
    }
    if (!cfg.model) cfg.model = infos.find((p) => p.id === cfg.provider).default_model;
    return cfg;
  }
  let config = loadConfig();

  function saveConfig(next) {
    config = next;
    if (options.persist === false) return;
    try {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'config.json'), JSON.stringify(config));
    } catch {
      return;
    }
  }

  function addLog(entry) {
    logs.push({ at: new Date().toISOString(), ...entry });
    while (logs.length > LOG_LIMIT) logs.shift();
  }

  async function runTask(task, input, spec) {
    const { provider, model } = config;
    const started = Date.now();
    const key = cacheKey(provider, model, task, input);
    const hit = cache.get(key);
    const done = (result, fallbackUsed, cached, reason) => {
      const meta = {
        task,
        provider,
        model,
        duration_ms: Date.now() - started,
        success: true,
        fallback_used: fallbackUsed,
        cached
      };
      addLog({ ...meta, reason: reason || null });
      return { ...result, fallback_used: fallbackUsed, meta };
    };
    if (hit) return done(hit.result, hit.fallback_used, true, 'cache');

    let result = null;
    let reason = null;
    try {
      let user = spec.user(input);
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        const reply = await callProvider(provider, model, spec.system, user, spec.hint);
        const parsed = spec.parse ? spec.parse(reply) : parseJson(reply);
        const v = spec.validate(parsed, input);
        if (v.ok) {
          result = spec.finalize(v.value, input);
        } else {
          reason = 'invalid';
          if (v.fatal) break;
          const why = v.errors && v.errors.length ? v.errors.slice(0, 4).join('; ') : 'not valid JSON';
          user = `${spec.user(input)}\n\nYour previous reply was not valid (${why}). Reply again with the JSON object only.`;
        }
      }
    } catch (e) {
      reason = e instanceof ProviderError && e.kind ? e.kind : 'error';
    }
    let fallbackUsed = false;
    if (!result) {
      result = spec.fallback(input);
      fallbackUsed = true;
    } else {
      reason = null;
    }
    cache.set(key, { result, fallback_used: fallbackUsed });
    return done(result, fallbackUsed, false, reason);
  }

  function extractText(input) {
    return `From: ${input.from}\nTo: ${input.to || ''}\nSubject: ${input.subject}\n\n${input.body}`;
  }

  const specs = {
    extract: {
      system: extractPrompt.system,
      hint: extractPrompt.schemaHint,
      user: extractPrompt.user,
      validate: (raw) => validateExtract(raw),
      finalize: (value, input) => {
        const address = parseAddress(input.from);
        const guarded = applyExtractGuard(value, { text: extractText(input), fromAddress: address });
        const fb = extractFallback(input);
        for (const f of ['customer', 'contact_name', 'mode', 'origin', 'destination']) {
          if (!guarded[f]) guarded[f] = fb[f];
        }
        if (fb.mode && guarded.mode !== fb.mode) guarded.mode = fb.mode;
        guarded.missing = computeMissing(guarded);
        return guarded;
      },
      fallback: (input) => extractFallback(input)
    },
    update: {
      system: updatePrompt.system,
      hint: updatePrompt.schemaHint,
      user: updatePrompt.user,
      validate: (raw) => validateUpdate(raw),
      finalize: (value, input) => {
        const g = applyUpdateGuard(value, { text: input.text, parsed: parseWeightVolume(input.text) });
        return applyUpdate(input.request, g.changes, g.unclear);
      },
      fallback: (input) => {
        const f = updateFallback(input.request, input.text);
        return applyUpdate(input.request, f.changes, f.unclear);
      }
    },
    email: {
      system: emailPrompt.system,
      hint: emailPrompt.schemaHint,
      user: emailPrompt.user,
      validate: (raw, input) => validateEmailOutput(raw, input),
      finalize: (value) => value,
      fallback: (input) => emailFallback(input)
    }
  };

  function parseEmailFile(raw) {
    const norm = raw.replace(/\r\n/g, '\n');
    const idx = norm.indexOf('\n\n');
    const head = idx >= 0 ? norm.slice(0, idx) : norm;
    const body = idx >= 0 ? norm.slice(idx + 2) : '';
    const get = (name) => {
      const m = new RegExp(`^${name}:[ \\t]*(.*)$`, 'im').exec(head);
      return m ? m[1].trim() : '';
    };
    return { from: get('From'), to: get('To'), subject: get('Subject'), body };
  }

  function checkExtractInput(b) {
    if (!b || typeof b !== 'object') return 'body must be a JSON object';
    for (const k of ['from', 'subject', 'body']) {
      if (typeof b[k] !== 'string' || !b[k].trim()) return `${k} is required`;
    }
    if (b.to !== undefined && b.to !== null && typeof b.to !== 'string') return 'to must be a string';
    return null;
  }

  async function handle(method, path, body) {
    if (method === 'GET' && path === '/health') {
      const infos = providerInfo(env);
      const h = await checkHealth(config.provider, config.model, env, callProvider);
      return {
        status: 200,
        json: {
          provider: config.provider,
          model: config.model,
          reachable: h.reachable,
          key_present: {
            gemini: infos[1].key_present,
            claude: infos[2].key_present,
            openai: infos[3].key_present
          },
          message: h.message
        }
      };
    }
    if (method === 'GET' && path === '/config') {
      return { status: 200, json: { provider: config.provider, model: config.model, providers: providerInfo(env) } };
    }
    if (method === 'PUT' && path === '/config') {
      if (!body || !PROVIDER_IDS.includes(body.provider)) {
        return { status: 400, json: { error: `provider must be one of ${PROVIDER_IDS.join(', ')}` } };
      }
      const info = providerInfo(env).find((p) => p.id === body.provider);
      let model = typeof body.model === 'string' ? body.model.trim() : '';
      if (!model) model = info.default_model;
      saveConfig({ provider: body.provider, model });
      return { status: 200, json: { provider: config.provider, model: config.model } };
    }
    if (method === 'GET' && path === '/logs') {
      return { status: 200, json: { logs: [...logs].reverse() } };
    }
    if (method === 'POST' && path === '/extract') {
      const bad = checkExtractInput(body);
      if (bad) return { status: 400, json: { error: bad } };
      return { status: 200, json: await runTask('extract', { from: body.from, to: body.to || '', subject: body.subject, body: body.body }, specs.extract) };
    }
    if (method === 'POST' && path === '/update_from_text') {
      if (!body || typeof body.text !== 'string' || !body.text.trim()) return { status: 400, json: { error: 'text is required' } };
      if (!body.request || typeof body.request !== 'object' || Array.isArray(body.request)) {
        return { status: 400, json: { error: 'request must be an object' } };
      }
      return { status: 200, json: await runTask('update_from_text', { request: body.request, text: body.text }, specs.update) };
    }
    if (method === 'POST' && path === '/customer_email') {
      const v = validateEmailInput(body);
      if (!v.ok) return { status: 400, json: { error: v.errors.join('; ') } };
      return { status: 200, json: await runTask('customer_email', body, specs.email) };
    }
    if (method === 'POST' && path === '/warm') {
      let files = [];
      try {
        files = readdirSync(samplesDir).filter((f) => f.endsWith('.txt')).sort();
      } catch {
        return { status: 200, json: { samples: [], message: 'Samples folder not found' } };
      }
      const samples = [];
      for (const f of files) {
        const input = parseEmailFile(readFileSync(join(samplesDir, f), 'utf8'));
        const r = await runTask('extract', input, specs.extract);
        samples.push({ file: f, ok: r.meta.success, fallback_used: r.fallback_used, cached: r.meta.cached });
      }
      return { status: 200, json: { samples } };
    }
    return { status: 404, json: { error: 'Not found' } };
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) {
        aborted = true;
        res.writeHead(413, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Body too large' }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', async () => {
      if (aborted) return;
      const send = (status, json) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(json));
      };
      let body = null;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim()) {
        try {
          body = JSON.parse(raw);
        } catch {
          return send(400, { error: 'Body is not valid JSON' });
        }
      }
      try {
        const path = new URL(req.url, 'http://localhost').pathname;
        const r = await handle(req.method, path, body);
        send(r.status, r.json);
      } catch {
        send(500, { error: 'Something went wrong' });
      }
    });
  });

  return { server, handle, cache, logs, getConfig: () => config };
}

export { emailSubject, customerFromDomain };

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entry === import.meta.url) {
  const port = Number(process.env.PORT) || 8080;
  const svc = createService();
  svc.server.listen(port, () => {
    console.log(`llm-gateway listening on ${port}`);
  });
}
