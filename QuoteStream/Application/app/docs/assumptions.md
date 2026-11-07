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

## Email simulator as a customer mailbox (added 2026-11-06)

37. The mock in `design-reference/mailbox` and the brief differ in three places, and the brief or your later instructions were followed. (a) Brief 6.6 says From and To can be edited. Your instructions say From is read only and To is quotes@gac.com, so both are read only now. (b) Brief 6.6 and S12 describe a "Load sample email" dropdown and a "Latest requests from email" list. These are replaced by the Templates and Sent folders. Templates still come from data, never from a fixed list in the page. (c) The mock has a "Simulate GAC sending the latest quotation" button. It is not built. The quotation email appears only when GAC presses Send to customer.
38. The "Mailbox of" picker has one entry per distinct sender address in `sample_email`. The company shown comes from a new `company` column filled by the seed, because some senders (New Client Logistics, Random Trading and the new made up customers) are not customers until their first email is read.
39. Template labels, company names and the "Expect:" presenter lines live in one map in `scripts/seed.ts` (`SAMPLE_META`), not in the page. A new sample file without an entry gets a label made from its file name and no expect line.
40. Sent lists request rows with source Email whose `email_json.from` equals the mailbox address (case insensitive). Inbox lists `outgoing_email` rows sent to that address, plus any row linked to one of those requests. So the Blue Dune Energy mailbox also shows quotation emails for its portal requests, because they go to the same address. Quotation emails still go to the customer's main address (the `principal` email), not to the address that sent the request; for Demo Principal 12 that means the quotation email shows in its mailbox only through the request link.
41. In the customer mailbox the request status `Sent to customer` is shown as `Quotation sent`. Other statuses (Submitted, Accepted, Rejected, Revision requested) are shown as they are, because this page is a GAC demo tool.
42. A clarification email is written by code (no AI) every time an email read ends in Missing information, including after a reply that still leaves something missing. It lists the missing fields with the same plain labels as the Add Information dialog. Only the newest clarification for a request that is still Missing information shows the reply box. The reply goes through `addInformation`, the same path as the Add Information dialog, and that dialog still works on the Requests page.
43. A customer reply is not stored as a separate Sent email. It is stored as an `information_update` row, as before.
44. The live strip shows the provider, model and duration of the extract call as returned by the gateway, stored in a new `request.ai_meta` JSON column. When the answer comes from the gateway cache the duration is near zero and the strip says "(cached)". When the rule reader answered, the "fallback used" tag is shown. The Sent folder polls every 2 seconds only while one of its emails is Reading email.
45. "Open in GAC Requests" opens `/gac/requests?focus=<id>`, which highlights and scrolls to that row.
46. `outgoing_email` now has `kind` (quotation or clarification) and `request_id`. `quotation_id` and `version_no` became optional because a clarification has neither. On an already seeded database `scripts/init.ts` adds the missing columns, fills `request_id` for existing quotation emails, and reloads `sample_email` from the samples folder at every start. A full reset is not needed.

## New samples

47. Four new samples, all made up and ending in .demo: `06_courier_blue_dune.txt` (Blue Dune Energy, Courier, Dubai to Singapore, DAP, 2 boxes, 30 kg, 0.4 CBM), `07_land_oasis_build.txt` (Oasis Build Supplies, Land, Dubai to Riyadh, DAP, FTL, 8,000 kg, 20 CBM), `08_sea_fcl_harbor_light.txt` (Harbor Light Foods, Sea FCL, 2 x 40 ft standard, Ningbo to Jebel Ali, FOB, 18,000 kg, 60 CBM), `09_incomplete_weight_cedar_point.txt` (Cedar Point Medical, Air, Hong Kong to Dubai, FCA, 1.2 CBM, no weight). The five original files are unchanged. Sample 04 keeps its `.com` address as before.
48. The gateway reads totals only from "Total Gross Weight" and "Total Volume" lines or from PO lines (the existing anti guess guard), so the new samples state their totals that way. The package count "2 boxes" is not extracted; quantity for email requests stays as before (number of POs, else 1).
49. The fallback reader now also reads Load Type (FCL or LCL), Container Type, Container Count and Vehicle Type. The AI path takes these four values from the rule reader, so they are never guessed. They are stored on the request and are not required for the email door (the required list is unchanged).
50. The gateway warm up already reads every `.txt` file in the samples folder, so the new samples are warmed without a code change. A test now checks this.

## Fixes

51. Submit, Accept, Reject and Send use a conditional UPDATE on `quotation.flow_status` and check the affected row count. A second click gets "Already submitted", "Only submitted quotations can be decided" or "This quotation was already sent" (HTTP 409) and writes nothing.
52. At server start (`src/instrumentation.ts`) every email request still in Reading email is read again with `processEmail`.
53. `src/lib/db.ts` has no default password any more. `DB_PASSWORD` must be set (Docker Compose sets it from `.env`).
54. `dev.log` sits in `Application/`, outside `app/`, so the ignore rule is in a new `Application/.gitignore`. The file is already tracked by git, so it stays tracked until someone runs `git rm --cached Application/dev.log`. I did not run it because you asked me not to change git state.
55. The existing dash cleaner and the e2e dash check used literal long dash characters in code. They now build the character class with `String.fromCharCode(0x2013, 0x2014)`, so no source file contains those characters.
56. Sample 06 (Courier, Dubai to Singapore) gives Rate needed on every line, because no past courier quotation exists on that lane and the pricing rules were not changed. Sample 08 is priced per CBM and per shipment by the existing rules; container count does not change the price.
57. The optional item (a reply to a quotation email creates a revision) was not built.

## AI provider: Gemini only (added 2026-11-06)

58. Root cause of "every email read by the rule reader": no Ollama was running on this machine (no container, image, volume or native install), so every call failed in about 10 ms as "unreachable", and those fallback answers were then cached.
59. Gemini is the default provider (`DEFAULT_PROVIDER=gemini` in compose, `.env.example`, `.env` and the gateway's own default). Order for every AI task: Gemini, then the rule based reader. Ollama is never called and never checked unless someone selects it in Settings. The Ollama adapter and the Settings option stay. A compose service for Ollama exists under the profile `ollama` and is not started by default.
60. Model: `gemini-3.5-flash-lite`, the only Gemini 3.5 Flash Lite id the key lists through the models API. `gemini-2.0-flash` (the old default) is not offered to this key, and `gemini-2.5-flash` is listed but answers HTTP 404.
61. Timeout diagnosis: DNS 15 ms, TLS 274 ms with a genuine Google certificate, no proxy on the host (WinHTTP direct, ProxyEnable 0) and none needed in the container; direct tiny calls took 0.5 to 1.0 s. The earlier timeouts came from `gemini-3.6-flash`, a thinking model that was slow and over quota (HTTP 429). It is not used.
62. Gemini request: `responseMimeType: application/json`, a JSON schema for the extract task, temperature 0, `thinkingLevel: minimal` (Gemini 3 models only, `GEMINI_THINKING_LEVEL`), output capped at 2,048 tokens (`GEMINI_MAX_OUTPUT_TOKENS`), timeout 10 s (`GEMINI_TIMEOUT_MS`). The slowest call seen was 3.1 s. The key is sent only in the `x-goog-api-key` header.
63. One retry after 0.5 s on a transient error (network unreachable, HTTP 500, 502, 503, 504). No retry on 429 or other 4xx.
64. The "fallback used" tag shows the real reason on hover and as a small line, for example "Gemini unavailable: HTTP 429 RESOURCE_EXHAUSTED", "Gemini unavailable: no API key", "Gemini timed out after 10 s", "Invalid answer from the model (Gemini)". The Email simulator and Settings show a red banner when the active provider is unreachable or has no key.
65. The key's rate limit is reached when many emails are sent within a minute (the e2e run): 5 of 50 calls got HTTP 429 and were answered by the rule reader with that reason shown. Normal demo pace stays well below it.
66. Only answers from Gemini are cached. The cache key includes a prompt version (`PROMPT_VERSION` in `llm-gateway/server.js`, now `p3`); change it whenever a prompt changes. The old cache file (22 entries, all fallback answers) was deleted once. The start scripts call `/warm`, which reads every sample with Gemini once.
67. The extract prompt is shorter (the worked example was removed). It now says that a vessel ETA, arrival port or the sender's location is never the origin, and that a destination airport means mode Air.
68. The anti guess guard also accepts a value shaped "City (CODE)" when the city and the 3 letter code both appear in the email, even apart. A customer value that is only a domain or an email address (Gemini once returned "randomtrading.demo") is replaced by the name derived from the domain.
69. The demo sends made up email text to Google's Gemini API. All sample data is invented. Sample 04 keeps its original `newclientlogistics.com` address and the name Robert Vance because the brief asks for that file verbatim; both are invented but the domain is a real looking `.com`.
70. New sample `10_stocklist_dispatch_istanbul.txt`: a made up shipping agent (Tulip Harbor Agency, tulipharbor.demo) asks to dispatch stocklist orders to a made up consignee in Istanbul, with a vessel ETA at Mersin, "Destination airport should be IST airport", a placeholder phone number and a deadline. Gemini returns mode Air, destination Istanbul (IST), missing origin, incoterm, total weight and total volume. The rule reader does not understand this email and leaves mode and destination empty rather than guessing.
71. Istanbul is not in the seeded port list, so that request keeps the destination text without a port id. Pricing data was not changed.

## Dashboard concept (added 2026-11-07)

72. The dashboard data is anchored at 7 Nov 2026, so the 341 rows (340 generated with seed 7 plus the hero row QT-0340) and every figure are identical on every start. Periods such as "last 6 months" count back from that date, not from the real clock.
73. The change "vs previous period" on each KPI tile is a made up figure derived from the parsed filters, because the dataset covers only 12 months and the default view has no previous period to compare with.
74. Needs attention counts come from the dashboard data (Submitted, Revision requested, Draft), not from the real requests tables. Lines showing Rate needed is a fixed 6.
75. Following the prompt, "quotations" and "requests" alone do not switch the measure to a count; only "how many", "count" or "number" do. So "Blue Dune Energy quotations by mode" shows revenue by mode. The mockup counted these instead.
76. "email vs portal" groups by source and applies no source filter. The mockup filtered to Email first, which left a single bar.
77. "Al" alone does not match Al Noor Trading (it would match too many sentences); "al noor" or the full name does.
78. The app has no dark theme, so the dashboard and its charts use only the app's light CSS variables plus chart colours defined on `.dash`. They follow the variables if a dark theme is added later.
79. The SQL shown under "Show the query it would write" is generated from the parsed filters against a hypothetical view `v_quotation_report`; it is never run.
80. The parser has no unit test file, as requested for this task; it was checked with the example searches and edge cases in the browser and a one-off script.
