# Quotation Portal and Copilot (hackathon demo)

Made up data only. Nothing is really sent.

## Run

Start everything (db, llm-gateway, app):

    docker compose up -d --build

or `./start.ps1` (Windows) or `./start.sh`. Open http://localhost:3000.

Reset and reseed the data:

    docker compose exec -T app npx tsx scripts/init.ts --reset

or `./reset.ps1` or `./reset.sh`.

## Settings

Copy `.env.example` to `.env`. Keys for Gemini, Claude and OpenAI go only in `.env`. `OLLAMA_URL` is the address the llm-gateway container uses to reach Ollama (default `http://host.docker.internal:11434`).

## Tests

    npm test                 unit tests: weight, price source order, notes basis rule, hero totals
    npm run e2e              API level run of the demo story (app must be running)
    cd llm-gateway && npm test

Docs: `docs/assumptions.md`, `docs/progress.md`, `docs/marlog-notes.md`.
