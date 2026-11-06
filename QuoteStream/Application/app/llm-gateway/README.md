# llm-gateway

Small HTTP service that turns freight emails into structured quotation requests, updates them from free text and writes customer emails. Plain Node 22+, no dependencies.

Run: `npm start` (port 8080) or build the Dockerfile. Test: `npm test` (no LLM needed, the provider is mocked).

## Endpoints

- GET /health, GET /config, PUT /config {provider, model}, GET /logs
- POST /extract {from, to, subject, body}
- POST /update_from_text {request, text}
- POST /customer_email {customer, contact_name, quotation_number, version, origin, destination, mode, valid_until, services, totals, revised}
- POST /warm runs the sample emails in SAMPLES_DIR once and fills the cache

Every task response has `fallback_used` and `meta {task, provider, model, duration_ms, success, fallback_used, cached}`.

## Environment

PORT, DEFAULT_PROVIDER (ollama, gemini, claude, openai), OLLAMA_URL, OLLAMA_MODEL, GEMINI_API_KEY, GEMINI_MODEL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL, OPENAI_API_KEY, OPENAI_MODEL, DATA_DIR (config.json and cache.json), LLM_TIMEOUT_MS, SAMPLES_DIR.

## How it stays reliable

1. Ask the model for JSON only, parse and validate.
2. If invalid, retry once with a short correction.
3. If still invalid, unreachable or timed out, use the rule based fallback in fallback.js.
4. Extract output passes an anti guess guard: text fields not found in the email become null, totals come from the email or the sum of the POs, `missing` is recomputed.
5. Answers are cached by sha256 of provider, model, task and input, in memory and in DATA_DIR/cache.json. Cached answers keep their original `fallback_used` flag.

Delete DATA_DIR/cache.json to force fresh model calls.
