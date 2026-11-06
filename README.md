# QuoteStream: Quotation Portal and Copilot

A quotation request system for a freight forwarder, built for the GAC AI Hackathon demo (9 November 2026).
Customer requests arrive by email (read by Gemini) or through a portal form, and a GAC user turns them into priced, approved quotations.
All data is made up. Nothing is really sent. The AI never sets a price.

## Requirements

- Docker Desktop (with Compose)
- A Google Gemini API key (create one in Google AI Studio)

## Setup

All commands run from `QuoteStream/Application/app`.

1. Clone the repository and open `QuoteStream/Application/app`.
2. Copy `.env.example` to `.env`.
3. Put your key in `.env` as `GEMINI_API_KEY=...`. Never commit `.env` (it is in `.gitignore`).
4. Start everything with `docker compose up -d --build`, or run `./start.ps1` (Windows) or `./start.sh`. The start scripts also warm the AI cache with the sample emails.
5. Open http://localhost:3000.

The first start builds the images and seeds the database. Later starts keep your data and bring the schema and the sample emails up to date.

## Reset the data

```
docker compose exec -T app npx tsx scripts/init.ts --reset
```

or run `./reset.ps1` or `./reset.sh`.

## Demo users

There is no login. Switch user from the avatar menu at the top right:

- **Blue Dune Energy**, the customer: portal form, My requests, quotations, Revise or negotiate.
- **Christine Zock**, the GAC user: Requests, Approvals, Email simulator, Settings.

## What it does

Two doors create the same kind of request, shown in one Requests list with a Source column (`Email` or `Portal`):

- **Email door.** The Email simulator is a mock customer mailbox. Choose whose mailbox it is, send a template email from Templates, and watch it in Sent (Reading email, then Draft ready or Missing information) with the provider, model and time that read it. The Inbox shows the quotation email after GAC presses Send to customer, and a clarification email listing what is missing, with a reply box.
- **Portal door.** The customer picks a mode (Air, Sea, Land, Courier, Hand Carry, Others), fills in a form and sends it. A portal request is always complete.

A GAC user then prepares a draft quotation, submits it, accepts it and sends it (a simulated email with no cost or margin). The customer sees the quotation in the portal and can press **Revise or negotiate**, which creates a new version.

### Rules built into the app

- Prices come only from known sources, in this order: the customer's service template, the same customer's latest Secured quotation on the lane, the median of Secured quotations on the lane, otherwise "Rate needed". Submit is blocked while any line says "Rate needed".
- No total ever mixes currencies.
- The customer never sees cost, margin, price source or internal notes, not even in API responses.
- Notes are suggestions only and apply only on their own price basis (per kg, per shipment, per CBM, per package).
- Chargeable weight: Air is CBM x 1000 / 6, Courier is CBM x 200, the greater of actual and volume weight. Other modes show gross weight only.

## Architecture

| Service | Purpose |
|---|---|
| `db` | MySQL 8 |
| `llm-gateway` | Separate AI service (plain Node, no dependencies). Tasks: extract, update_from_text, customer_email, health, warm. Gemini is the default provider; Claude, OpenAI and Ollama can be chosen in Settings. If the provider fails, a rule based reader answers and the reason is shown. |
| `app` | Next.js with TypeScript. The app never calls an AI provider directly. |
| `ollama` | Optional, not started by default (compose profile `ollama`). |

Ports: app 3000, MySQL 3307, gateway 8090 (change them in `.env`).

## AI provider

- Default: Gemini, model `gemini-3.5-flash-lite`, JSON output, temperature 0, minimal thinking, 10 second timeout, one retry on network errors.
- Switch provider live under **Settings**: choose the provider and model, press **Save and test connection**. No restart is needed. Keys for Claude and OpenAI go in `.env` the same way as the Gemini key.
- When an email is read by the rule based reader instead of the AI, the request shows a **fallback used** tag with the reason (hover it or read the small line under it).
- Ollama is optional: `docker compose --profile ollama up -d`, then `docker compose exec ollama ollama pull llama3.1:8b`, then select Ollama in Settings. The `OLLAMA_*` and `LLM_TIMEOUT_MS` settings in `.env` are only used then.

The demo sends only made up email text to Google's Gemini API.

## Tests

```
npm test                    unit tests: weight, price source order, notes basis rule, hero totals
npm run e2e                 API level run of the demo story (the app must be running)
cd llm-gateway && npm test  gateway tests (the provider is mocked, no key needed)
```

Without Node on your machine, run them in the container, for example `docker compose exec -T app npm test` and `docker compose exec -T app npx tsx scripts/e2e.ts`. `scripts/e2e.ts` accepts a scenario name: `portal`, `modes`, `hero`, `samples` or `mailbox`.

## Documentation

- `QuoteStream/Application/app/docs`: `assumptions.md` (every assumption and gap to review), `progress.md` (build log), `marlog-notes.md`.
- `QuoteStream/Application/Final Idea`: the original brief (read only).
- `QuoteStream/Application/design-reference`: clickable mockups and screenshots for the mailbox and the portal. Open the `.html` files in a browser.

## Project layout

```
QuoteStream/Application/
  Final Idea/          the original brief
  design-reference/    mockups and screenshots
  app/
    src/app/           pages and API routes (portal, gac, api)
    src/components/    shared UI
    src/lib/           pure logic (weight, money, pricing, notes, required fields) and server code
    scripts/           init and seed, e2e
    db/schema.sql      database schema
    samples/           sample emails (made up)
    llm-gateway/       separate AI service
    docs/              assumptions, progress, Marlog notes
```

## Troubleshooting

- **No key (red banner "Google Gemini is not ready: No API key is set for this provider").** `GEMINI_API_KEY` is empty in `.env`. Add it and run `docker compose up -d` so the gateway picks it up. Emails are still read by the rule based reader meanwhile.
- **Rate limit (HTTP 429 RESOURCE_EXHAUSTED).** The key's per minute quota was used up, usually by sending many emails at once or running the e2e. The tag shows the reason; wait a minute and send again.
- **Port already in use.** Change `APP_PORT`, `DB_HOST_PORT` or `GATEWAY_HOST_PORT` in `.env` and run `docker compose up -d`.
- **Docker runs out of memory.** Give Docker Desktop more memory (Settings, Resources) and do not start the optional Ollama profile; local models need several GB.
- **Stale AI answers after changing a prompt.** Change `PROMPT_VERSION` in `llm-gateway/server.js`, or delete the cache: `docker compose exec llm-gateway rm -f /data/cache.json` and restart the gateway.
