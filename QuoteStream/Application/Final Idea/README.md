# Final Idea: Quotation Portal and Copilot for GAC

This folder is the complete brief for a Claude Code agent that builds the app on its own. Nothing has been coded yet. The agent starts from an empty project folder.

Event: GAC AI Hackathon, 6 to 9 November 2026. Demos on Monday 9 November, 11:00 to 13:00. Owner: Rehan (Software Engineer, GAC Dubai).

## One paragraph summary

A quotation request system for a freight forwarder with two ways in. Door 1 (the old way): a customer email arrives, an AI reads it and it becomes a request. Door 2 (new): the customer uses a portal, picks a mode and fills in a form. Both create a request in one list. A GAC user prepares a draft quotation (prices come only from known sources, the AI never invents a price), submits it, accepts it and sends it. The customer then sees the quotation and can press Revise or negotiate, which creates a new version. Quote to Job already exists in Marlog and is not rebuilt.

## Reading order

| File | What it gives you |
|---|---|
| `01-product-spec.md` | The full product: users, screens, rules, data. The main document. |
| `02-business-flows.md` | Flows and statuses in plain business terms, who sees what. |
| `03-marlog-ground-truth.md` | What is verified about Marlog and what is not. |
| `04-seed-data-and-samples.md` | Seed data, the five sample emails (in `samples/`), expected results. |
| `05-ai-service.md` | The separate AI service: tasks, providers, JSON contracts, fallback. |
| `06-ui-guide-and-stitch-prompts.md` | Layout, look, and one prompt per screen for a UI generator. |
| `07-reference-kuehne-nagel.md` | What the Kuehne+Nagel myKN portal looks like (reference only). |
| `08-reference-gemini-demo.md` | What to keep and what to avoid from the earlier Gemini demo. |
| `09-acceptance-and-demo-script.md` | Build order, acceptance checks, the demo script. |
| `10-decisions-and-defaults.md` | What the user confirmed, what is a proposed default, what is still open. |
| `samples/` | The five sample emails, verbatim. |
| `screenshots/` | Eight reference screenshots (Gemini demo and Kuehne+Nagel). |

## How to work

1. Read every file once before doing anything.
2. Do Step 0 in `01-product-spec.md` section 3 (study Marlog read only, write notes).
3. Read `10-decisions-and-defaults.md`. Use the defaults there. Write every assumption you make into `docs/assumptions.md` in the new project so the user can review it later. Ask the user only when blocked, and ask one short question.
4. Follow the build order in `09-acceptance-and-demo-script.md`. Get the demo story working end to end early, then widen.

## Hard rules (repeated because they matter most)

- `C:\reppos\gac-marlog` is read only. Never change anything in it. Never copy the `password` column of the `Agent` table.
- Made-up data only. No real customers, suppliers, rates, quotation numbers or emails.
- The AI never sets a price. No source means "Rate needed".
- Never add amounts of different currencies into one total.
- The customer never sees cost, margin or price source. Nothing is really sent anywhere.
- No em dashes or en dashes anywhere (screens, data, docs, messages).
- No code comments.
- Git: do not run anything that changes a repository unless the user asks. If asked to commit, add no AI attribution and no `Co-Authored-By` line, do not change the git user name or email, and do not amend or rewrite commits.
- The reference screenshots are for understanding only. Never copy Kuehne+Nagel logos, colours, images or wording, and never copy Gemini demo code.
