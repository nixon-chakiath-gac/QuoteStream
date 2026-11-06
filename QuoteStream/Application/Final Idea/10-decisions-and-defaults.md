# 10 Decisions and Defaults

Three groups. Use the defaults so you can work on your own. Log each default you rely on in `docs/assumptions.md` in the project. Ask the user only when blocked.

## A. Confirmed by the user

| Topic | Decision |
|---|---|
| App | New app built from scratch with Claude Code. The Gemini demo is reference only. |
| Doors | Email door (AI reads the email, Add Information for incomplete ones) and Portal door (form). Both create a request. |
| Requests page | One page, Source column Email or Portal. |
| Modes | All modes (Air, Sea, Land, Courier, Hand Carry, Others). |
| Customer sees prices | Not until GAC accepts and sends. |
| Users | Two demo users switched from the top right menu. No login, no logout. Customer: Blue Dune Energy. GAC user: Christine Zock. |
| Customer layout | No sidebar. Request a quotation (and My requests). |
| GAC user | One person, any business user, admin like power: can edit any field of any request or quotation. |
| Sidebar | K+N style icon rail that expands. Only built items. |
| Send | Simulated email preview, no cost or margin. Transfer Quote (tooltip "Transfer the Quote to GML") is a placeholder. Quote to Job is not rebuilt. |
| Customer actions | No accept or reject. Revise or negotiate with a message plus optional target price per line. |
| Revisions | A new version (copy of the last sent version), status Revision requested, no limit, earlier versions stay visible. |
| Notes | Inside the draft quotation, no separate page, no lead confirmation. A suggestion changes nothing until Accept. Every note stores its price basis. Sanity warning above 3 times. Never visible to the customer. |
| Stack (from earlier instructions) | MySQL 8 in Docker. Docker Compose with `db`, `llm-gateway`, `app`. Separate AI service. Providers Ollama (Llama, default `llama3.1:8b`), Gemini, Claude, OpenAI, switchable in Settings without restart. Keys only in `.env`. JSON only with one retry, rule based fallback, caching. |
| Data | Made up only. Marlog read only. |
| Style | No em dashes, no code comments, simple and readable on a projector. |

## B. Proposed defaults (my choices so you can work autonomously; the user may change them)

| # | Topic | Default |
|---|---|---|
| 1 | Project folder | `C:\reppos\hackathon\quote-portal`. Mention it in your first message and proceed unless told otherwise. |
| 2 | Web framework | Next.js with TypeScript, mysql2 or Prisma. |
| 3 | Portal button label | "Request quotation". |
| 4 | Required fields, all modes | From, To, Incoterm, cargo (total quantity, total weight, total volume or package rows), cargo description, ready date. |
| 5 | Extra fields per mode | Air: none extra. Courier: none extra. Sea: load type FCL or LCL; if FCL, container type and container count. Land: vehicle type (FTL or LTL). Hand Carry: required From, To, weight, ready date; volume optional. Others: required description of the service needed, From, To optional. |
| 6 | Weight rules for Sea, Land, Hand Carry, Others | Search Marlog and legacy first. If not found, show gross weight only and the note "Weight rule not defined for this mode". |
| 7 | Seed rates for non Air modes | Invent consistent made up rates per customer and lane, with real Marlog service names where possible. |
| 8 | Notes seed | Seeds 1 and 2 in `04-seed-data-and-samples.md` visible; trap notes only for tests. |
| 9 | Home and About pages | Not built. |
| 10 | My requests tab | Included (the customer needs a place to see status). |
| 11 | Fill example button | Included on the portal form for faster demos. |
| 12 | Paste multiple packages, Save as template | Not built. |
| 13 | Customer for the portal | Blue Dune Energy gets an Air template and past Secured quotations on common lanes. |
| 14 | Email sample list | Loaded from the `samples` data, never hard coded in the page. |
| 15 | Request numbers | `REQ-0001` style for requests, `QT-0001` style for quotations, made up. |

## C. Still open (ask the user only when you cannot continue)

1. Confirm the project folder.
2. Confirm Sea, Land, Hand Carry and Others weight rules if Marlog has none.
3. Confirm required and extra fields per mode against GAC practice.
4. Confirm that My requests stays as a second customer tab.
5. Whether to add Home or About pages later.

## D. How to report assumptions

`docs/assumptions.md` with one line per assumption: date, what you assumed, why, where it applies. Mention the file in your first and last message so the user can review it.
