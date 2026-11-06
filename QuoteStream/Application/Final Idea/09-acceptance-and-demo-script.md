# 09 Build Order, Acceptance and Demo Script

Demo day: Monday 9 November 2026, 11:00 to 13:00. Build for a reliable demo first, then widen.

## 1. Build order (milestones)

1. **Study and setup.** Step 0 (Marlog notes, 5 line summary to the user). Create the project folder, Docker Compose (`db`, `llm-gateway`, `app`), `.env.example`, one command to start and one to reset and reseed.
2. **Data and weights.** Schema, seed (hero data first, then the rest), weight function with unit tests.
3. **Portal door end to end for Air.** User switcher, customer layout, mode cards, Air form with required fields, request creation, confirmation, My requests.
4. **GAC core.** Requests list, draft quotation with price sources and totals, Submit, Approvals, Accept, Send to customer preview, customer sees the quotation.
5. **Revise or negotiate.** Dialog, versions, revision panel on the draft, send version 2.
6. **Email door.** Email simulator, AI service (fallback first, then Ollama), Add Information dialog.
7. **Notes.** Suggestions with basis, sanity warning, Why prompt, Add note.
8. **Other modes and polish.** Sea, Land, Courier, Hand Carry, Others forms and seed rates. Settings with provider switching. Empty and loading states. Projector readability.
9. **Rehearse** the demo script twice from a clean reset.

At each milestone the app must run. Keep a short `docs/assumptions.md` and `docs/progress.md`.

## 2. Acceptance checks

Layout and users
- [ ] The top right user switcher toggles Customer (Blue Dune Energy) and GAC user (Christine Zock) and keeps data.
- [ ] Customer sees no sidebar. GAC user sees the icon rail with Requests, Approvals, Email simulator, Settings only.

Portal door
- [ ] All six modes can be requested. Required fields are enforced per mode and the button stays disabled until complete.
- [ ] Submit creates a request with source `Portal`. Customer sees only the confirmation and `Received`.

GAC flow
- [ ] The Requests list shows both doors with a Source column.
- [ ] The draft has price sources in the strict order. No line without a source. "Rate needed" blocks Submit.
- [ ] Submit, Accept (and Reject with a reason), Send to customer preview, Send.
- [ ] The GAC user can edit any field of any request or quotation.

Customer after send
- [ ] Status `Quotation ready`, the quotation page and the email are shown. No cost, margin, price source or internal note anywhere, including in API responses for the customer.
- [ ] No Accept or Reject. Revise or negotiate works with a message and optional target prices, status becomes `Revision requested`.
- [ ] GAC sees the revision panel and targets, edits, submits, accepts, sends. Customer sees Version 2 as `Quotation ready`, Version 1 still selectable. Repeatable many times.

Email door
- [ ] Samples load from data. Complete emails reach `Draft ready`. The incomplete sample reaches `Missing information` and the Add Information dialog completes it without guessing.

Notes
- [ ] Suggestions change nothing until Accept. Notes apply only on their own price basis. Sanity warning above 3 times. Notes never visible to the customer.
- [ ] The hero sample totals USD 2,994.00 revenue, 2,430.00 cost, 564.00 Est. Op. Income, 18.8% before any suggestion is accepted.

Safety and quality
- [ ] No total mixes currencies.
- [ ] AI provider switch works without restart. Fallback works with the provider offline.
- [ ] Nothing in `C:\reppos\gac-marlog` changed. No password column read.
- [ ] No em dashes or en dashes anywhere (run a search over the whole project).
- [ ] No code comments.

## 3. Demo script (about 8 minutes)

1. Say the problem in one line: quotation requests come by email, are slow to read and to price, and customers have no self service.
2. **Customer door.** Switch to Customer. Pick Air, press Fill example (or type), show that the button enables only when required fields are complete, press Request quotation, show the confirmation. Open My requests: `Received`.
3. **GAC user.** Switch to GAC user. Requests: new row, source `Portal`, `Draft ready`. Edit Draft: lines, each with a source, chargeable weight with its formula. Submit.
4. Approvals: Accept. Send to customer: show the preview (no cost, no margin). Send.
5. **Customer again.** `Quotation ready`, the quotation, the email. Press Revise or negotiate: "Can you lower the airfreight rate?", a target price on one line, send. `Revision requested`.
6. **GAC again.** Revision panel with message and target. Change the line, Submit, Accept, Send. Customer: Version 2, Version 1 still available.
7. **Email door.** Email simulator, load the hero sample, send, show Draft ready and the exact totals USD 2,994.00 / 2,430.00 / 564.00 (18.8%). Then the incomplete sample, show Add Information.
8. **Notes (if time).** Principal 12 sample A then B: add Fuel Surcharge with the reason, then show the suggestion on B with the basis (per kg) and Accept.
9. Close: one line on Quote to Job already existing, and on swapping the AI provider in Settings.

Backup plan: if a live AI provider fails, the rule based fallback keeps all five samples working. Warm the cache before the demo. Never claim measured time savings; say expected.
