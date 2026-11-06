# 01 Product Spec

For Claude Code. A new app, built from scratch. Read all of it first.

The earlier demo built by Gemini (`http://localhost:3000`, folder `C:\reppos\hackathon\quote-copilot`) is a reference only. Read it for ideas, sample emails and data shapes. Do not copy or extend its code. The user does not like it. See `08-reference-gemini-demo.md`.

Items marked **[confirmed]** were decided by the user. Items marked **[default]** are my proposals so you can work without waiting; they are listed in `10-decisions-and-defaults.md`. Items marked **[open]** need the user.

---

## 1. What we are building

A quotation request system for a freight company (GAC) with two ways in:

1. **Email door (the old way).** A customer email arrives, the AI reads it, and it becomes a request that goes to the draft quotation and the normal flow. Incomplete emails go through an Add Information dialog.
2. **Portal door (new).** The customer opens the portal, picks a mode and fills in a form (from, to, cargo, incoterm). When all required information is in, the request is sent to GAC. The customer sees no price at this stage.

Both doors create the same kind of **request**, shown on one Requests page with a Source column (`Email` or `Portal`). The GAC user prepares a draft quotation, submits, accepts and sends it (a simulated email preview with no cost or margin). A button **Transfer Quote** (tooltip "Transfer the Quote to GML") is a hand over placeholder: Quote to Job already exists in Marlog and is not rebuilt.

The customer sees the quotation in the portal. The customer cannot accept or reject. They can press **Revise or negotiate** (message plus optional target price per line). GAC replies with a new version. No limit on revisions.

The portal look is inspired by the Kuehne+Nagel myKN portal (`07-reference-kuehne-nagel.md`). Copy the feel and layout style, not their data or branding.

---

## 2. Rules for you

1. Marlog at `C:\reppos\gac-marlog` is READ ONLY. No add, commit, push, reset, checkout or stash in any folder unless the user asks. If asked to commit: no AI attribution, no `Co-Authored-By`, no change to git name or email, no amending.
2. Made-up data only. Never read or copy the `password` column of Marlog's `Agent` table.
3. Never invent a price. Every price has a named source. No source means "Rate needed". Seed prices are invented for the demo and the About screen (if built) must say so.
4. Never add amounts of different currencies into one total.
5. The customer never sees a price, cost, margin or price source until a GAC user has accepted and sent the quotation. Even then the customer sees only services and amounts.
6. Nothing is really sent. Emails and sends are previews inside the app.
7. Use Marlog's words on screen (section 3, and `03-marlog-ground-truth.md`).
8. Simple, clean, readable on a projector. No code comments. No em dashes or en dashes anywhere.
9. Do not assume silently. Where something is **[open]**, use the default in `10-decisions-and-defaults.md`, log it in `docs/assumptions.md`, and keep going. Stop and ask one short question only when blocked (for example a decision that cannot be undone).
10. The AI service is separate. The app never calls an AI provider directly (`05-ai-service.md`).

---

## 3. Step 0: Study before coding

1. Read Marlog (read only) and write short notes to `docs/marlog-notes.md` in the new project:
   - `C:\reppos\gac-marlog\GEMINI.md` for workspace rules.
   - `C:\reppos\gac-marlog\DBScripts\schemas`: Quotation, QuotationProduct, QuotationDetail, QuotationPo, QuotationProductCost, ServiceTemplate, ServiceTemplateDetail, BranchTermsAndCondition, QuotationDocuments, and the quotation statuses.
   - The Angular and .NET quotation screens, models and services: field labels, status names, button names.
   - Chargeable weight rules for every mode. See section 9 and `03-marlog-ground-truth.md`.
2. Look at the reference demo for the sample emails and flow idea (reference only). The sample emails are already saved in `samples/`.
3. Show the user a 5 line summary of what you learned and anything that differs from this spec.

---

## 4. The two demo users and the layout

No login and no logout. A **user switcher** at the top right of the top bar (avatar with a small menu) has exactly two choices **[confirmed]**:
- **Customer**: **Blue Dune Energy** (made-up name).
- **GAC user**: **Christine Zock**. One person, any business user. She does the work of operator and approver. Do not add roles or a second GAC person.

Switching changes the whole layout immediately and keeps the data.

### 4.1 Customer layout **[confirmed]**
- Top bar only. **No left sidebar.**
- Views: **Request a quotation** and **My requests** (tab pair under the top bar). Nothing else.

### 4.2 GAC user layout **[confirmed]**
- Top bar plus left sidebar (icon rail that expands to labels, K+N style).
- Items, only what is built: **Requests**, **Approvals**, **Email simulator**, **Settings**. No Home, Book, Track, Explore, News. No separate Notes page.
- About and Home pages: **[default]** not built.

---

## 5. Customer screens

### 5.1 Request a quotation
- **Mode first.** Large cards for Air, Sea, Land, Courier, Hand Carry, Others (Marlog's job modes). One must be chosen. All modes are in scope **[confirmed]**.
- **Form**, grouped and clean (K+N style):
  - **From**: place or port. Option "Pick-up needed" with address.
  - **To**: place or port. Option "Delivery needed" with address.
  - **Cargo**: Totals (total quantity, total volume m3, total weight kg) or Package details (row per package: quantity, length, width, height, weight). Unit switch kg/cm or lb/inch. Chargeable weight shown automatically with the formula in small text. Optional PO numbers.
  - **Incoterm**: dropdown with a one line explanation under it.
  - **Cargo description** and **ready date** **[default]**.
  - Mode specific fields **[default]**, see `10-decisions-and-defaults.md`.
- **Required fields.** Each mode has a required list kept in one place in code. The submit button stays disabled and missing fields are highlighted until all are filled. A portal request can never be incomplete. No Add Information step for portal requests.
- **Button** label "Request quotation" **[default]**.
- After submit: confirmation page with request number, details entered and "We have received your request. Our team will send you a quotation." No price.

### 5.2 My requests
- List of this customer's requests: request number, mode, lane, date, status.
- Customer statuses:
  - `Received`: the request arrived.
  - `Under review`: GAC is working on the first quotation. Covers every internal state until the first send, including a rejection inside GAC. The customer never sees internal status names.
  - `Quotation ready`: GAC sent a quotation (latest version).
  - `Revision requested`: the customer pressed Revise or negotiate and GAC has not sent the next version.
- Opening a request shows the entered details (read only). When `Quotation ready`, also the **quotation page** (section 5.3) and the **email** from GAC.
- The My requests tab: **[default]** included, because the customer must see status somewhere (confirm, open item).

### 5.3 Quotation page and Revise or negotiate **[confirmed]**
- Shows services with amounts per currency, validity date, branch terms and the email from GAC. No cost, no margin, no sources.
- No Accept and no Reject anywhere.
- Button **Revise or negotiate** opens a dialog: a message box ("What would you like to change?") and next to each service line an optional **Target price** field showing the quoted amount. At least a message or one target price is required. Buttons **Send to GAC** and **Cancel**.
- After sending: status `Revision requested`. Button disabled, text "Revision requested on version N" until GAC sends the next version.
- Each sent quotation is a **version** (Version 1, 2, 3...). A version selector opens any earlier version. Latest is marked. No limit on revisions.
- The customer sees only their own messages and target prices. GAC internal notes and reasons are never shown.

---

## 6. GAC screens

### 6.1 Requests
One table of every request from both doors, newest first.
Columns: Received, Source (`Email` or `Portal`), Customer, Mode, Lane, Status, Missing information (email door only), Action.
Statuses: `Reading email` (email only), `Missing information` (email only), `Draft ready`, `Submitted`, `Accepted`, `Rejected`, `Sent to customer`, `Revision requested`.
Actions: **Add Information** (missing information), **Edit Draft** (draft ready, submitted before a decision, rejected, revision requested), **View** (accepted, sent).
Filters: All, Missing information, Draft ready, Submitted, Accepted, Sent.
A request opens to show the original email or the form data and a timeline (received, read, draft created, submitted, accepted, sent, each revision request and version) with times.

### 6.2 Portal requests and permissions
A portal request is complete on arrival, so the draft is created in the background and the status becomes `Draft ready` within seconds. It appears in Requests with source `Portal`.
**Permissions [confirmed]:** the GAC user can edit every field of any request and quotation (customer, mode, route, cargo, incoterm, service lines, prices, terms). No field is locked. She is like an admin because this is a proof of concept. The customer cannot edit anything after submitting except by pressing Revise or negotiate.

### 6.3 Draft quotation (GAC only)
- Header: request number, customer, source.
- Cargo and lane details with chargeable weight and its formula.
- Cost lines: Service, unit of measure, unit, unit price, bill amount, estimated unit cost, estimated cost, operating income, price source, confidence. Add, edit, remove lines.
- Price sources in strict order: (1) the customer's Service Template line, (2) the same customer's latest `Secured` quotation on a similar lane, (3) the median of similar `Secured` quotations, (4) empty with "Rate needed". The AI never sets a price.
- Totals per currency: revenue, estimated cost, operating income (Marlog label "Est. Op. Income"), margin.
- A **Notes** panel (section 6.8).
- When the request is a revision, a **Customer revision request** panel at the top (section 6.9).
- Main button **Submit**, blocked while any line says "Rate needed". Submit sets `Submitted` and opens Approvals on that quotation.

### 6.4 Approvals
Tabs **Waiting**, **Accepted**, **Rejected**, **Sent**. Only quotations created through the new flow appear. **Accept** and **Reject** (reject needs a reason and returns the request to the GAC user to fix and Submit again). After Accept: **Send to customer** and **Transfer Quote** (placeholder, tooltip "Transfer the Quote to GML"). Every new version goes through Submit and Accept again.
Even though there is one GAC user, the approval step stays so the business flow (prepare, approve, send) is visible in the demo.

### 6.5 Send to customer (preview dialog)
Shows To (customer email), Subject ("Quotation QT-xxxx, origin to destination"), a short cover note written by the AI from the draft, and a clean services table with amounts per currency. No cost, margin or operating income. Buttons **Send** and **Cancel**. After Send the request is `Sent to customer` with the time, and the customer user sees `Quotation ready` with the quotation and the email. For a revision the preview says "Revised quotation, version 2".

### 6.6 Email simulator (email door)
Simulates the customer's mailbox. Dropdown **Load sample email** lists every sample from data (not a fixed list in the page). The email box shows From, To, Subject, body and can be edited. Button **Send email** creates a request. The AI reads it within seconds.
- Complete email: `Draft ready` and **Edit Draft**.
- Missing information: `Missing information` and **Add Information**. The dialog lists exactly what is missing in plain words, accepts a plain text answer, and an AI task updates the request and lists what is still missing. When complete it opens the draft. The AI must not guess; it asks a short follow-up when the text is unclear.
- Required information: customer, mode, origin, destination, incoterm, cargo (total weight and volume). The list lives in one place in code and matches the portal's required list per mode.

### 6.7 Settings
Choose the AI provider and test the connection (`05-ai-service.md`).

### 6.8 Notes (inside the draft quotation) **[confirmed]**
Internal. The customer never sees notes.

1. **Suggestions from earlier notes.** On opening a draft, a **Notes** panel at the top shows suggestions from earlier notes: same customer first, then same mode and lane. Each shows: the change (add service, remove service, change price), the **price basis** (per kg, per shipment, per CBM, per package), the value, the reason given earlier, the source ("Note from QT-xxxx"). Buttons **Accept** and **Dismiss**.
   - A suggestion changes nothing until **Accept**. Before that the line is unchanged and keeps its original source. After Accept the line source says "Accepted from note".
   - A note price is used only on the basis it was saved with. A per shipment note is never applied per kg. If the draft line has a different basis, do not suggest it.
   - Sanity check: if a suggested price is more than 3 times the current price on the same basis, show a warning on the suggestion.
2. **Writing notes.** When the GAC user adds, removes or changes a cost line, a small prompt asks "Why?" with quick answers (Customer agreed new rate, This lane needs it, Wrong service, Other) and an optional text line. The app saves a note: customer, mode, origin, destination, what changed, basis, old and new value, reason, quotation. An **Add note** button adds a free text note on this quotation.

No separate confirmation step, no Notes page (only one GAC user). Seed a few notes so suggestions appear from the start (`04-seed-data-and-samples.md`).
Why this design: the Gemini demo applied a note as a per kg price to a per shipment line and the revenue became USD 109,244.00 instead of USD 2,994.00.

### 6.9 Customer revision requests (GAC side) **[confirmed]**
- When the customer sends a revision request, the system creates the next version as a copy of the last sent version, and the request becomes `Revision requested`. It shows in Requests with **Edit Draft**.
- The draft shows a **Customer revision request** panel at the top with the message, and each target price beside its line marked "Customer target". Targets are information only. Nothing is applied automatically.
- GAC edits freely, then Submit, Accept, Send. Earlier versions stay unchanged and visible to both users.
- The timeline records each revision request and each new version sent.

---

## 7. Chargeable weight (summary, details in section 9 and `03-marlog-ground-truth.md`)

Chargeable weight is the greater of actual and volume weight, rounded to 2 decimals.
- Air: volume weight = CBM x 1000 / 6.
- Courier: volume weight = CBM x 200.
- Sea, Land, Hand Carry, Others: not verified. Step 0 must search for the rule. If none is found, **[default]** show gross weight only with the small note "Weight rule not defined for this mode" and log it in `docs/assumptions.md`. Do not invent a rule.

---

## 8. AI service (separate)

See `05-ai-service.md`. Summary: own folder and container `llm-gateway`; tasks `extract`, `update_from_text`, `customer_email`, `health`; providers Ollama (default `llama3.1:8b`), Gemini, Claude, OpenAI, switchable in Settings without restart; keys only in `.env`; JSON only, validate, retry once, then rule based fallback for the sample emails; cache by input.

---

## 9. Technology and data

- MySQL 8 in Docker. Docker Compose with `db`, `llm-gateway`, `app`. Use an existing Ollama at `http://localhost:11434` if it answers, otherwise add a container. Docker can be used directly. **[confirmed in earlier instructions, reconfirm if changed]**
- Web app framework: **[default]** Next.js with TypeScript, mysql2 or Prisma. Clean light UI readable on a projector.
- Project folder: **[default]** `C:\reppos\hackathon\quote-portal`. **[open]**

Main tables (readable names, same meaning as Marlog): `branch`, `principal` (customer), `app_user` (the two demo users), `service`, `supplier`, `port`, `service_template`, `service_template_detail`, `branch_terms`, `quotation`, `quotation_product`, `quotation_detail`, `quotation_po`, `quotation_product_cost`, `approval`, `quotation_note` (with price basis on every note), `request` (source, customer, mode, data JSON, missing fields, status, quotation link, rejection reason, sent time), `request_event`, `information_update`, `outgoing_email`, `quotation_version`, `revision_request` (request, version, message, targets per line JSON, time, status), `ai_call_log`.

Seed data: see `04-seed-data-and-samples.md`.

---

## 10. Out of scope

Real email sending, real login, Quote to Job (exists in Marlog), pricing from live carrier rates, booking, tracking, a Home or About page, multi language, roles beyond the one GAC user.
