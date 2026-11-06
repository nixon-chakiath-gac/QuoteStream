# Progress

## Plan (build order from 09)

1. Study and setup: done. Compose with db, llm-gateway, app. `.env.example`. Start and reset commands.
2. Data and weights: done. Schema, seed, weight function with unit tests.
3. Portal door for Air end to end: done.
4. GAC core: done. Requests, draft, submit, approvals, send preview, customer sees quotation.
5. Revise or negotiate with versions: done.
6. Email door with the AI gateway and Add Information: in progress.
7. Notes: suggestions, basis rule, sanity warning, Why prompt, Add note: done in the app, rehearsal pending.
8. Other modes, Settings, polish: forms for all six modes are built; polish pending.
9. Rehearse the demo script from a clean reset.

## Milestones

- M1 (setup, data, weights): schema and seed run, 17 unit tests pass including hero totals 2,994.00 / 2,430.00 / 564.00 / 18.8%.
- M2 (portal to version 2): the API level run of the whole demo story passes (41 checks in `scripts/e2e.ts portal`).
- M3 (email door, notes, other modes): hero sample gives exactly 2,994.00 / 2,430.00 / 564.00 / 18.8% in the UI and API; samples 02 to 05 behave as specified; all six portal modes create priced drafts; fallback verified with the provider switched to one without a key.
- M4 (browser run): the demo script was clicked through with Playwright (customer door, GAC draft, submit, accept, send, revise, version 2, email door, Add Information, Settings) with no console errors.

## Final state

Docker stack runs (db, llm-gateway, app). Unit tests: 17 app, 32 gateway. E2E: portal 41, modes 19, hero 17, samples 17, all passing. Data is reset to the clean seed.
