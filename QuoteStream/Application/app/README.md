# Quotation Portal and Copilot

A quotation request system for a freight forwarder, built for the GAC AI Hackathon demo (9 November 2026).

All data is made up. Nothing is really sent. The AI never sets a price.

## What it does

Two doors create the same kind of request, shown in one Requests list with a Source column (`Email` or `Portal`):

- **Email door.** A customer email arrives, an AI reads it and it becomes a request. Incomplete emails go through an Add Information dialog that asks for plain text answers and never guesses.
- **Portal door.** The customer picks a mode (Air, Sea, Land, Courier, Hand Carry, Others), fills in a form and sends it. A portal request is always complete.

A GAC user then prepares a draft quotation, submits it, accepts it and sends it (a simulated email preview with no cost or margin). The customer sees the quotation in the portal and can press **Revise or negotiate**, which creates a new version. Versions are unlimited and earlier ones stay visible.

### Rules built into the app

- Prices come only from known sources, in this order: the customer's service template, the same customer's latest Secured quotation on the lane, the median of Secured quotations on the lane, otherwise "Rate needed". Submit is blocked while any line says "Rate needed".
- No total ever mixes currencies.
- The customer never sees cost, margin, price source or internal notes, not even in API responses.
- Notes are suggestions only. Nothing changes until Accept, and a note applies only on its own price basis (per kg, per shipment, per CBM, per package). A suggested price above 3 times the current price on the same basis shows a warning.
- Chargeable weight: Air is CBM x 1000 / 6, Courier is CBM x 200, the greater of actual and volume weight, rounded to 2 decimals. Other modes show gross weight only with "Weight rule not defined for this mode".

## Architecture

Three containers (Docker Compose):

| Service | Purpose |
|---|---|
| `db` | MySQL 8 |
| `llm-gateway` | Separate AI service (plain Node, no dependencies). Tasks: extract, update_from_text, customer_email, health, warm. Providers: Ollama (default), Gemini, Claude, OpenAI. Switchable at runtime. Answers are cached, and a rule based fallback keeps the five sample emails working when no provider is available. |
| `app` | Next.js with TypeScript. The app never calls an AI provider directly. |

Two demo users, chosen from the top right switcher (no login): the customer Blue Dune Energy and the GAC user Christine Zock.

## Run it

Requirements: Docker with Compose. Ollama is optional (the fallback reader works without it).

1. Copy `.env.example` to `.env` and adjust if needed.
2. Start everything:

```
docker compose up -d --build
```

or run `./start.ps1` (Windows) or `./start.sh`. Open http://localhost:3000.

3. Reset and reseed the data:

```
docker compose exec -T app npx tsx scripts/init.ts --reset
```

or run `./reset.ps1` or `./reset.sh`.

### Ollama

The gateway reaches Ollama at `OLLAMA_URL` (default `http://host.docker.internal:11434`) with the model in `OLLAMA_MODEL` (default `llama3.1:8b`). Install the model first, for example `ollama pull llama3.1:8b`. Small local models can take up to a minute per email. Answers are cached, and the start scripts trigger a background warm up.

### AI providers and keys

Keys for Gemini, Claude and OpenAI go only in `.env`. Never commit `.env`. Choose the provider and model in the app under Settings and press Save and test connection. No restart is needed.

### Ports

| Port | Use |
|---|---|
| 3000 | App |
| 3307 | MySQL (host side) |
| 8090 | llm-gateway (host side) |

Change them in `.env`.

## Demo script (about 8 minutes)

1. Customer: pick Air, press Fill example, send. Check My requests shows `Received`.
2. GAC user: Requests shows the `Portal` row, open Edit Draft, check sources and chargeable weight, Submit.
3. Approvals: Accept, Send to customer, Send.
4. Customer: open the quotation, press Revise or negotiate with a message and a target price.
5. GAC user: see the revision panel, change the price, answer the Why prompt, Submit, Accept, Send. The customer sees Version 2 and Version 1 is still available.
6. Email simulator: load the hero sample. Totals are USD 2,994.00 revenue, 2,430.00 cost, 564.00 Est. Op. Income, 18.8%. Then load the incomplete sample and use Add Information.
7. Notes: send the two Demo Principal 12 samples to see the Fuel Surcharge suggestion with its basis.

## Tests

```
npm test                    unit tests: weight, price source order, notes basis rule, hero totals
npm run e2e                 API level run of the demo story (the app must be running)
cd llm-gateway && npm test  gateway tests (no Ollama needed)
```

`scripts/e2e.ts` accepts a scenario name: `portal`, `modes`, `hero` or `samples`.

## Project layout

```
app/
  src/app/          pages and API routes (portal, gac, api)
  src/components/   shared UI (shell, cargo editor, add information dialog)
  src/lib/          pure logic (weight, money, pricing, notes, required fields) and server code
  scripts/          init and seed, e2e
  db/schema.sql     database schema
  samples/          the five sample emails
  llm-gateway/      separate AI service
  docs/             assumptions, progress, Marlog notes
```

## Documentation

- `docs/assumptions.md` lists every assumption and gap to review.
- `docs/progress.md` shows the build log.
- `docs/marlog-notes.md` records what was and was not verifiable about Marlog.

## Notes

- Seed prices are invented for the demo.
- Quote to Job already exists in Marlog and is not rebuilt. The button Open in job portal is a placeholder.
