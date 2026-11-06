# llm-gateway

Small HTTP service that turns freight emails into structured quotation requests, updates them from free text and writes customer emails. Plain Node 22+, no dependencies.

Run: `npm start` (port 8080) or build the Dockerfile. Test: `npm test` (no LLM needed, the provider is mocked).

## Endpoints

- GET /health, GET /config, PUT /config {provider, model}, GET /logs, GET /models (Gemini models the key can use)
- POST /extract {from, to, subject, body}
- POST /update_from_text {request, text}
- POST /customer_email {customer, contact_name, quotation_number, version, origin, destination, mode, valid_until, services, totals, revised}
- POST /warm runs every sample email in SAMPLES_DIR once with the active provider and fills the cache

Every task response has `fallback_used` and `meta {task, provider, model, active_provider, duration_ms, success, fallback_used, cached, reason, reason_kind}`. When the rule based reader answered, `provider` is `rules` and `reason` says why, for example "Gemini unavailable: HTTP 429 RESOURCE_EXHAUSTED" or "Gemini timed out after 10 s".

## Environment

PORT, DEFAULT_PROVIDER (gemini, ollama, claude, openai; default gemini), GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT_MS, GEMINI_THINKING_LEVEL, GEMINI_MAX_OUTPUT_TOKENS, ANTHROPIC_API_KEY, ANTHROPIC_MODEL, OPENAI_API_KEY, OPENAI_MODEL, OLLAMA_URL, OLLAMA_MODEL, LLM_TIMEOUT_MS, DATA_DIR (config.json and cache.json), SAMPLES_DIR.

## How it stays reliable

1. The active provider is asked first (Gemini by default). Ollama is only called when it is the selected provider.
2. Gemini gets JSON output with a schema, temperature 0, minimal thinking and a capped output length. The key is sent only in the x-goog-api-key header.
3. One retry after a network error or HTTP 500, 502, 503 or 504. If the answer is not valid JSON, one retry with a short correction.
4. If it still fails, the rule based reader in fallback.js answers and the reason is returned.
5. Extract output passes an anti guess guard: text fields not found in the email become null, totals come from the email or the sum of the POs, `missing` is recomputed.
6. Only answers from the active provider are cached, by sha256 of the prompt version, provider, model, task and input, in memory and in DATA_DIR/cache.json. Change PROMPT_VERSION in server.js whenever a prompt changes.

Delete DATA_DIR/cache.json to force fresh model calls.
