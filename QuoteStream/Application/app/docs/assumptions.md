# Assumptions and gaps

Date of all entries: 2026-11-06. Please review each one. Format: what I assumed, why, where it applies.

## Environment and paths

1. The brief folder is named `Final Idea` (not `brief`). It was not modified. The app lives in `app` next to it. Why: that is how the folders exist on this machine. Applies to: whole project.
2. Marlog (`C:\reppos\gac-marlog`) and the legacy project do not exist on this machine, so Step 0 was done from `03-marlog-ground-truth.md` only. Nothing was read from Marlog. See `marlog-notes.md`.
3. Ollama runs in Docker (container `ollama`, port 11434) with one model, `llama3.1:8b`. It is used as the default model. The gateway container reaches it at `http://host.docker.internal:11434` (set in `.env` as `OLLAMA_URL`, with `extra_hosts host-gateway` in compose so it also works on Linux).
4. MySQL is published on host port 3307 and the AI gateway on host port 8090 (both changeable in `.env`) to avoid clashes with local services.
5. The `.env` file holds local demo passwords only. `.env.example` shows the shape. No provider keys are present, so Gemini, Claude and OpenAI show "Key missing" until you add keys.

## Weight rules and modes

6. Sea, Land, Hand Carry and Others: no rule could be verified, so only gross weight is shown with the text "Weight rule not defined for this mode". Chargeable weight is empty for these modes. Per kg lines on these modes use gross weight as the quantity. Per CBM lines use volume.
7. Mode list (Air, Sea, Land, Courier, Hand Carry, Others) and the incoterm list (EXW, FCA, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP) are taken from the brief and common practice. Job types ("Supplier to WH Destination", "Supplier to Customer", "WH to Customer", "Origin to Destination") are my guess apart from the first one. Field labels follow the brief's wording.
8. Package row weight is treated as weight per package; totals multiply by quantity. Imperial input is converted to kg and cm at the edge (1 lb = 0.45359237 kg, 1 inch = 2.54 cm). Total volume stays in m3 in both unit settings.

## Required fields and forms

9. Email door required list is exactly: customer, mode, origin, destination, incoterm, total weight, total volume (as in 01 and sample 05). Portal required lists follow default 4 and 5 in `10-decisions-and-defaults.md`: base is origin, destination, incoterm, total quantity, total weight, total volume, cargo description, ready date; Sea adds load type (and container type and count for FCL); Land adds vehicle type; Hand Carry needs origin, destination, weight, ready date; Others needs only the description of the service. Both lists live in `src/lib/required.ts`.
10. For Hand Carry totals, quantity defaults to 1 when left empty.
11. Port lists: Air shows air capable places, Sea shows sea capable places, other modes show all places. About 26 made up places and ports (Shanghai appears once as SHA for both air and sea, as in the sample emails).

## Pricing

12. "Similar lane" means same mode, same origin port and same destination port (exact). Lane matching treats missing origin and destination as equal (used for mode Others). Why: the brief does not define similarity and a loose rule would hide "Rate needed" on the new customer sea sample.
13. Market median needs at least 2 distinct Secured quotations. One quotation is not a median, so it falls to "Rate needed". Confidence: Template High, Past quotation Medium, Market median Medium (5 or more quotations) or Low, Manual entry Manual.
14. Median and "latest" are computed per currency and basis group, and the most common group wins. Lines keep their own currency; totals are per currency and never summed across currencies.
15. A customer with a service template gets only the template services plus any services the email asked for. A customer without a template gets the default service set for the mode (Air has seven lines, Sea four, and so on). Why: Principal 12 deliberately has no Fuel Surcharge line.
16. Editing a price on a line sets its source to "Manual" (with "Edited from Template" and so on). A price typed on a "Rate needed" line also becomes Manual.
17. Seed prices are invented, with rate cards per service and lane factors, USD for most customers and AED or SGD for a few. There are 164 past quotations, 72 of them Secured. The sea lane Shanghai to Jebel Ali has no Secured quotation on purpose, so sample 04 shows "Rate needed" and Submit is blocked. Blue Dune Energy's other-mode portal requests use market medians on Ningbo to Jebel Ali (Sea), Dubai to Riyadh (Land), Shanghai to Dubai (Courier), Singapore to Dubai (Hand Carry). Others uses lane-less quotations.

## Notes

18. Seed notes 1 and 2 are visible. Seed notes 3 (152 per kg trap) and 4 (10.00 per kg sanity) are seeded with `is_test = 1` and hidden in the normal demo. They are shown only when the draft API is called with `include_test=1` (used by the automated tests).
19. Because seed note 1 (Add Fuel Surcharge, 0.45 per kg, Principal 12) is visible, the suggestion already appears on the sample 02 draft too, not only on sample 03. Identical suggestions collapse into one. If you want the notes demo to show the suggestion only on sample 03, set `is_test` to 1 on that seed note. Either way adding the line by hand on sample 02 saves a new note that is then suggested on sample 03.
20. Notes are matched on mode, origin and destination (exact). Same customer notes rank first, then notes from other customers on the same mode and lane. Add service suggestions are hidden when the service already exists. Change price suggestions are hidden when the basis differs or the price is unchanged. The 3 times warning compares only on the same basis.
21. A note is saved when the GAC user answers the "Why?" prompt. Pressing Skip saves nothing.

## Flow and statuses

22. The customer sees `Received` until the GAC user opens the draft (or the request moves on), then `Under review`. After a send it is `Quotation ready`. While a revision is open (even while GAC submits and accepts version 2) it stays `Revision requested`.
23. A quotation can be edited while Draft, Submitted (before a decision) or Rejected. Accepted and Sent quotations are read only (the Requests action is View, as in the brief). A customer revision request reopens the draft.
24. A portal draft is created in the same request that submits the form (takes well under a second), so the status is `Draft ready` at once.
25. Validity date is the send date plus 30 days. Branch terms are made up text per branch.
26. A new customer in an email (for example New Client Logistics, Random Trading) is created as a customer on the fly with the Dubai branch.
27. Quotation numbers start after the seeded past quotations (QT-0001 to QT-0164 are past), so new ones start at QT-0165. Requests are REQ-0001 style.
28. `quotation_detail` and `quotation_product` from the brief's table list are folded into `quotation` (one row per quotation) to keep the model small. Lines, POs, notes, versions, revision requests, outgoing emails, approvals, events, information updates and AI call logs have their own tables.
29. The customer identity is a plain `role` cookie set by the user switcher (no login). The API checks it, so GAC endpoints return 403 for the customer and the other way round.
30. The AI call log (`ai_call_log`) is written by the app from the metadata the gateway returns, so the gateway needs no database.

## UI

31. Not built (as per defaults): Home, About, paste multiple packages, Save as template.
32. Next.js generates `next-env.d.ts`, which contains generated comments. That file is generated, not hand written.

33. The Email simulator reads emails through the local `llama3.1:8b`. On this machine Ollama is slow (about 10 to 55 seconds per call), so a request can show "Reading email" for up to a minute. Answers are cached by input, so repeat runs are instant. `start.ps1` and `start.sh` trigger the gateway warm up (`POST /warm`) in the background. If a call goes over `LLM_TIMEOUT_MS` (60 seconds) the rule based fallback answers and a "fallback used" tag appears.
34. After changing prompts or fallback rules, delete the gateway cache (`docker compose exec llm-gateway rm -f /data/cache.json` and restart the gateway), because cache keys do not include a prompt version.
35. The customer email subject is always built in the exact format "Quotation QT-xxxx, origin to destination" (with ", version N" from version 2) by code. Only the body comes from the AI. If the AI service is down the app uses a plain template body.
36. Clicking Send in the preview stores the subject and body shown in the dialog (they can be edited there).
