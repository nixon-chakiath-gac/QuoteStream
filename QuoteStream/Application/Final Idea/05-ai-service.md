# 05 AI Service (`llm-gateway`)

The AI lives in its own small service, own folder, own container. The app talks to it over simple HTTP and never calls a provider directly. **[confirmed in earlier instructions]**

## Principles

- The AI reads and writes text. The app does the maths. Weights, totals and price sources are deterministic code. The AI never sets a price.
- Only made-up text is ever sent to a provider.
- Keys live only in `.env`. Never in code, the database or logs.
- Switching provider works from Settings without restarting any container.
- Never show a raw error to the user. Show a short plain message and use the fallback.

## Providers (one small adapter each)

| Provider | Notes |
|---|---|
| Ollama (default) | Llama in the user's Docker or local. Default model `llama3.1:8b`. Use an existing Ollama at `http://localhost:11434` if it answers, otherwise add a container. |
| Gemini | Key in `.env`. |
| Anthropic Claude | Key in `.env`. |
| OpenAI | Key in `.env`. |

Adapter interface: one function that takes a system prompt, a user prompt and a JSON schema, and returns text. Everything else is shared.

Settings screen: provider dropdown, model name, key present or missing (never show the key), **Save and test connection** button that calls `health`.

## Tasks (HTTP endpoints)

### `POST /extract`
Input: the email (from, to, subject, body).
Output JSON:
```json
{
  "customer": "string or null",
  "contact_email": "string or null",
  "mode": "Air|Sea|Land|Courier|Hand Carry|Others|null",
  "origin": "string or null",
  "destination": "string or null",
  "incoterm": "string or null",
  "job_type": "string or null",
  "service": "Direct|Consolidation|null",
  "pos": [{"po_number": "string", "weight_kg": 0, "volume_cbm": 0}],
  "total_weight_kg": 0,
  "total_volume_cbm": 0,
  "requested_services": ["string"],
  "missing": ["customer|mode|origin|destination|incoterm|total_weight|total_volume"],
  "notes": "string"
}
```
Rules: a value not stated in the email is `null` and goes into `missing`. Never guess a value. Totals come from the email or from the sum of the POs; if both are present and disagree, keep the email total and add a note.

### `POST /update_from_text`
Input: the current request JSON and the GAC user's plain text answer.
Output: `{ "request": <updated JSON>, "changed": ["field"], "still_missing": ["field"], "unclear": ["short follow-up question"] }`. When the text is unclear, add a short question to `unclear` and change nothing for that field.

### `POST /customer_email`
Input: the accepted draft (customer, lane, mode, services with amounts per currency, validity). Output: `{ "subject": "...", "body": "..." }`. Customer facing: simple English, short, no cost, no margin, no source, no em dashes, no internal wording.

### `GET /health`
Returns the active provider, the model, and whether it is reachable.

## Reliability

1. Ask for JSON only. Validate against the schema.
2. If invalid, retry once with a short correction message.
3. If still invalid or the provider is unreachable, use the **rule based fallback**: a simple reader (regular expressions and keyword lists) that handles the five sample emails. Tag the result `"fallback_used": true` and show a small "fallback used" tag in the UI.
4. Cache answers by a hash of provider, model, task and input, so repeat demo runs are instant. Provide a warm up endpoint (`POST /warm`) that runs the five samples once.
5. Log every call to `ai_call_log` (task, provider, model, duration, success, fallback flag). No keys, no secrets.

Small models are weaker. Test the five samples on `llama3.1:8b` and fix prompts until all five extract correctly, or rely on the fallback. The demo must never depend on a live provider working.

## Prompts

Keep prompts short and put them in one file per task. Ask the model to answer with JSON only, to use `null` for anything not stated, and never to guess. Include one example per task from the samples.

## Contract with the app

The app calls the gateway at an internal URL from an environment variable. The app stores the extract result on the `request` row (JSON), computes weights itself, and runs the price search itself.
