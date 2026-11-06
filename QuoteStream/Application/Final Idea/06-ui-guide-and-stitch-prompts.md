# 06 UI Guide and Prompts

Use this for the look and for generating screens (for example in Google Stitch). The prompts describe layout and content only. Build the real app in code; use generated screens as a visual guide.

## 1. Look

- Light, clean, lots of white space, readable on a projector (body text at least 16px, high contrast).
- One accent colour (a calm blue or teal). Neutral greys. No gradients, no stock photos, no logos of other companies.
- Top bar: dark accent colour, product name on the left, search box in the middle (GAC user only, optional), bell and user avatar on the right. The avatar opens the **user switcher** (Customer: Blue Dune Energy, GAC user: Christine Zock).
- GAC sidebar: thin icon rail that expands to labels, "Close sidebar" at the bottom. Items: Requests, Approvals, Email simulator, Settings.
- Customer: no sidebar. Under the top bar a tab pair: Request a quotation, My requests.
- Status chips with colour plus text (never colour alone).
- Use Marlog words: Est. Cost, Est. Op. Income, Service, Unit, Unit Price, Bill Amount, Chargeable Weight, Incoterm, Secured, Pending.
- No em dashes or en dashes in any text.

## 2. Shared style block (put at the top of every prompt)

> Style: modern B2B logistics web app, light theme, white cards on a very light grey background, one accent colour (calm blue), dark blue top bar, 16px readable text, rounded 8px corners, thin borders, clear hierarchy, generous spacing, status chips with text labels, no stock photos, no logos, no gradients. Use plain business English. Do not use em dashes. Desktop layout 1440 wide, readable on a projector.

## 3. Screen prompts

### S1. Customer: Request a quotation (mode cards)
Customer view. Top bar with product name "Quotation Portal", user avatar menu top right showing "Blue Dune Energy". No sidebar. Under the top bar two tabs: "Request a quotation" (active) and "My requests". Page title "Request a quotation", subtitle "Choose how your cargo will travel". Six large selectable cards in two rows of three: Air, Sea, Land, Courier, Hand Carry, Others, each with a simple line icon and a one line description. A disabled "Continue" button below.

### S2. Customer: the request form (Air)
Same shell. A summary row at the top: From, By Air, To. Sections as white cards: "From" (place or port dropdown, switch "Pick-up needed" revealing an address field), "To" (place or port dropdown, switch "Delivery needed"), "Cargo" with two tabs "Totals" and "Package details", a kg/cm and lb/inch switch, fields Total quantity, Total volume (m3), Total weight (kg), and a read only "Chargeable weight" value with small text "Volume weight = volume x 1000 / 6, the greater of actual and volume weight". Optional PO numbers field. "Incoterm" dropdown with a one line explanation below it. "Cargo description" and "Ready date". Primary button "Request quotation", disabled until required fields are filled, with missing fields outlined and a small list "2 fields still needed". A secondary text button "Fill example".

### S3. Customer: confirmation
Centered card with a check icon, title "We have received your request", request number "REQ-0001", a summary of the details entered (mode, lane, cargo, incoterm), text "Our team will send you a quotation." and a button "View my requests". No prices.

### S4. Customer: My requests
Tab "My requests" active. A table: Request number, Mode, Lane, Date, Status. Status chips: Received (grey), Under review (amber), Quotation ready (green), Revision requested (blue). Row click opens the request.

### S5. Customer: quotation page with versions
Header with request number, lane, status chip "Quotation ready", a version selector "Version 2 (latest)" with earlier versions. Left: a clean table of services with columns Service, Unit, Unit price, Amount and totals per currency, validity date, branch terms. Right: the email received from GAC shown as a message card. Primary button "Revise or negotiate". No Accept and no Reject. No cost, margin or source.

### S6. Customer: Revise or negotiate dialog
Modal over the quotation page. Title "Revise or negotiate". A message box labelled "What would you like to change?". Below, a list of the quoted service lines each with its quoted amount shown for reference and an optional "Target price" field. Buttons "Send to GAC" and "Cancel". Helper text "Add a message or at least one target price."

### S7. GAC: Requests list
GAC view with dark blue top bar and left icon rail (Requests active). Title "Requests". Filter chips: All, Missing information, Draft ready, Submitted, Accepted, Sent. A table: Received, Source (chip Email or Portal), Customer, Mode, Lane, Status chip, Missing information, Action (button Add Information, Edit Draft or View). Include rows for each status, one Portal row, one Revision requested row.

### S8. GAC: Draft quotation
Page for QT-0001 with header (request number, customer, source chip). Top banner panel "Customer revision request" (shown only on revisions) with the message and note "Target prices shown beside lines". Panel "Notes" with suggestion cards: "Add Fuel Surcharge, 0.45 per kg, reason: This lane needs it, from QT-seed-1" with Accept and Dismiss, one with a warning icon "Price is more than 3 times the current price". Cargo block with gross weight, volume, chargeable weight and formula. A cost lines table: Service, Unit of measure, Unit, Unit price, Bill amount, Est. unit cost, Est. cost, Est. Op. Income, Source chip (Template, Past quotation, Market median, Accepted from note, Rate needed in red), Confidence, and a "Customer target" column. Buttons Add service, Add note. Summary cards per currency: Revenue, Est. Cost, Est. Op. Income, Margin. Primary button "Submit", disabled when a line says Rate needed.

### S9. GAC: "Why?" prompt
Small popover after editing a line: "Why this change?" with quick chips Customer agreed new rate, This lane needs it, Wrong service, Other, an optional text line and a Save button.

### S10. GAC: Approvals
Title "Approvals" with tabs Waiting, Accepted, Rejected, Sent. Cards or rows with quotation number, customer, lane, revenue by currency, and buttons Accept and Reject (reject opens a reason box). In Accepted: buttons "Send to customer" and "Open in job portal".

### S11. GAC: Send to customer preview
Modal "Send to customer". Fields To, Subject, a short cover note, and a clean services table with amounts per currency. No cost or margin. Buttons Send and Cancel. A revision shows "Revised quotation, version 2".

### S12. GAC: Email simulator
Left: dropdown "Load sample email" and an email box (From, To, Subject, Body) with button "Send email". Right: a live list of the latest requests created from emails with status chips. A modal "Add Information" listing what is missing in plain words (for example "Incoterm, total weight, total volume"), a text box for the answer and buttons "Update request" and "Cancel", then a result area "Still missing: ...".

### S13. GAC: Settings
Title "Settings". Card "AI provider": dropdown (Ollama, Gemini, Claude, OpenAI), model field, "Key found in environment" status (never show the key), button "Save and test connection" with a green or red result line.

## 4. Behaviour notes for the build

- Switching user at the top right changes layout immediately and keeps data.
- The Submit button, Request quotation button and Accept button show clear disabled states and reasons.
- Empty states for every list ("No requests yet").
- Loading states while the AI reads an email ("Reading email").
- All text in plain business English.
