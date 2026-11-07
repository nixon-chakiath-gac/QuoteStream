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

## Mailbox (2026-11-06)

Email simulator rebuilt as a customer mailbox (Templates, Sent, Inbox) with GET /api/gac/mailbox, clarification emails and quotation emails. Four new samples. Unit tests: 17 app, 38 gateway. E2E: 125 checks passing from a clean reset (new section: npm run e2e mailbox). Browser click through of the mailbox not run (skipped on request).

## Dashboard concept (2026-11-07)

New GAC landing page `/gac/dashboard`, first item in the sidebar. Overview (KPIs, revenue by month, revenue by mode, top customers by operating income, Needs attention, latest requests) and a search that a deterministic word parser (`src/lib/dashboard/parse.ts`) turns into filters, grouping, measure and period. Made up seeded data in `src/lib/dashboard/data.ts`, no database and no AI call. SVG charts in `src/components/DashCharts.tsx`. `/`, `/gac` and switching to Christine Zock now land on the dashboard. New e2e section `npm run e2e dashboard` (7 checks: landing redirects, sidebar order, customer cannot see it, no long dashes). Portal (41) and modes (19) e2e and the 17 unit tests still pass. Browser click through of overview, all example searches, shuffle, sort, Show all, no match, not recognised and phone width done with no console errors.

## AI assist (2026-11-07)

- Needs follow-up: dashboard card with up to 5 quotations from deterministic rules on the dashboard data, and a Follow-up draft dialog written by Gemini through the new `/follow_up` task (template fallback, cached per quotation, nothing is sent).
- Why this price: a short explanation under every draft line from the pricing source data, with a "N% above or below median" flag over 10 percent on the same basis, and "Why no price" for Rate needed lines. GAC draft only.
- Check this request: a warning banner above Submit for an unusual weight (Courier, Hand Carry, Air) and a possible duplicate within 24 hours, with Review and Ignore. Never blocks Submit. Demo data from `scripts/demo-assist.ts`. Existing suite after the change: 17 app unit tests, 49 AI service tests, 134 e2e checks, all passing.
