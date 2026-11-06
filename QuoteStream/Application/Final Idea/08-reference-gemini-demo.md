# 08 Reference: the earlier Gemini demo

Location: `C:\reppos\hackathon\quote-copilot` (running at `http://localhost:3000`). Built by Gemini as a first attempt. The user does not like it. It is a reference only. Do not copy or extend its code. You may read it.

Screenshots in `screenshots/`:
- `gemini-demo-01-new-request.jpg`: new request page with sample dropdown.
- `gemini-demo-02-draft-quotation.jpg`: draft quotation (shows the revenue bug, USD 109,244.00).
- `gemini-demo-03-bu-approval.jpg`: approval list.
- `gemini-demo-04-learned-notes.jpg`: learned notes page.
- `gemini-demo-05-settings.jpg`: AI provider settings.

## Folders seen

`app/` (server.js, src/views), `db/init`, `db/seed.py`, `llm-gateway/` (adapters.py, fallback.py, main.py, pricing_engine.py, weight_calculator.py, tests), `docs/marlog-notes.md`, `docker-compose.yml`, `README.md`, `llm-gateway/sample_emails.py` (the five sample emails, saved verbatim in `samples/`).

## Keep (as ideas)

- The five sample emails and the flow they exercise.
- Seed size: 2 branches, 25 ports, 20 suppliers, 11 services, 12 principals, templates, 150 past quotations.
- The strict price source order (template, same customer's latest Secured, median, Rate needed).
- Separate `llm-gateway` with adapters and a rule based fallback for the sample emails, plus caching and a warm up endpoint.
- Live provider switch in Settings.
- The Add Information idea for incomplete emails.

## Avoid

- **Revenue bug.** A learned note with a per kg price (152) was applied to a per shipment line (Transportation), so revenue became USD 109,244.00 instead of USD 2,994.00. Every note now stores its basis and is applied only on that basis. See `01-product-spec.md` section 6.8.
- **Clutter in the approval list** (too many old rows and unclear states). Show only quotations created through the new flow, with tabs Waiting, Accepted, Rejected, Sent.
- **Role label.** It used a "BU" role label. Here there is one GAC user and no role names on screen.
- **Hard coded database password** in configuration. Use `.env` only and never commit it.
- **Unverified Sea rule.** Its notes and README say Sea uses real weight (2,700 kg). Not verified.
- **Auto applied notes.** Nothing changes until the user presses Accept.
- Its general look. Use the new layout described in `06-ui-guide-and-stitch-prompts.md`.
