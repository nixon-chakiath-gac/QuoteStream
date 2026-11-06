# Design reference

Visual and behaviour references for the agent. These are clickable mockups with made up data. They are not production code.

How to use them:
- Open the `.html` files in a browser to click through them. They need no server.
- Rebuild the screens inside the real app (Next.js, existing components, existing CSS tokens). Do not paste the mock code into the app and do not copy its dummy data. Keep the app's real data, API and rules.
- Where a mock and the written brief (`Final Idea`) disagree, the brief wins. Tell the user about the difference.

## mailbox/

The email door as a mock customer mailbox. This is the target for the Email simulator page (`/gac/email`).

| File | What it shows |
|---|---|
| `mailbox-mockup.html` | The clickable mock. Choose a customer, send a template email, see Sent and Inbox. |
| `01-templates.png` | Templates folder with an editable email and Send email button. |
| `02-sent-reading-email.png` | Right after Send. Status Reading email. |
| `03-sent-draft-ready.png` | Status moves to Draft ready with the request number. |
| `04-inbox-quotation-email.png` | The quotation email in the customer's Inbox: services table, no cost, margin or source. |
| `05-inbox-clarification-email.png` | Clarification email for an incomplete request, with a reply box. |

Notes on the mock:
- The "Simulate GAC sending the latest quotation" button is a demo helper only. In the real app the email appears when GAC presses Send to customer.
- Request and quotation numbers in the mock are examples.
- Not in the mock but wanted in the app: a live strip under Send (Received, AI reading, Draft ready or Missing information) with provider, model, duration and the "fallback used" tag; a link from each sent email to its row in GAC Requests; presenter lines on templates such as "Expect: Draft ready, USD 2,994.00 revenue".

## portal/

The whole portal as a clickable mock (customer and GAC user, switch from the avatar menu at the top right).

| File | What it shows |
|---|---|
| `quote-portal-mockup.html` | Customer: mode cards, form, confirmation, My requests, quotation page with versions, Revise or negotiate. GAC: Requests, draft with Notes, Approvals, send preview, email simulator, settings. |
| `01-customer-mode-cards.png` | Customer entry screen. |
| `02-gac-requests.png` | GAC Requests list. |
| `03-gac-draft-quotation.png` | Draft quotation with Notes suggestions and totals. |

## current-app/

Screenshots of the email simulator as it is today (a single form). Shown only for comparison. The window was narrow, so the layout looks like a phone.
