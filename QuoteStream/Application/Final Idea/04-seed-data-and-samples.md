# 04 Seed Data and Samples

All data is made up. Prices are invented for the demo and must be described that way if an About screen is ever built. The seed script must be repeatable (reset and reseed with one command).

## 1. Reference facts

- 2 branches: Dubai (currency AED) and Singapore (currency SGD).
- About 25 ports, about 20 suppliers, about 11 services.
- 12 customers: `Demo Principal 01` to `Demo Principal 12`. Plus the portal customer **Blue Dune Energy** (add as a 13th principal) and **New Client Logistics** appears only through the sea sample email (new customer, no template).
- Service templates per customer. Principal 07 has the hero template. Principal 12 deliberately has **no Fuel Surcharge** line (used for the notes demo).
- About 150 past quotations over 12 months, all modes, mixed statuses (Pending, Secured, Lost, Alternate Option Secured, Re-opened). Rates consistent per customer and lane so the price search returns sensible matches. Seed past quotations for every mode.
- Billing currency per quotation. Never sum across currencies.

These numbers match the earlier Gemini seed, which is a good size for the demo.

## 2. Hero scenario: Demo Principal 07, Air, Shanghai (SHA) to Dubai (DXB)

Cargo: 585 kg gross, 4.2 CBM. Volume weight = 4.2 x 1000 / 6 = 700.00 kg. Chargeable = 700.00 kg.

Template lines in USD (the unit price is per kg unless stated):

| Service | Basis | Unit price | Qty | Bill amount | Est. unit cost | Est. cost |
|---|---|---|---|---|---|---|
| Origin Charges | per kg | 0.12 | 700 | 84.00 | 0.08 | 56.00 |
| Airfreight | per kg | 3.10 | 700 | 2,170.00 | 2.60 | 1,820.00 |
| Fuel Surcharge | per kg | 0.45 | 700 | 315.00 | 0.35 | 245.00 |
| Security Surcharge | per kg | 0.10 | 700 | 70.00 | 0.07 | 49.00 |
| Export Customs | per shipment | 85.00 | 1 | 85.00 | 60.00 | 60.00 |
| Import Customs | per shipment | 120.00 | 1 | 120.00 | 90.00 | 90.00 |
| Transportation | per shipment | 150.00 | 1 | 150.00 | 110.00 | 110.00 |

Totals (USD): revenue **2,994.00**, estimated cost **2,430.00**, Est. Op. Income **564.00**, margin **18.8%**. Every line source is "Template". This must still be true before any note suggestion is accepted.

## 3. Notes seed (proposed, flag in assumptions)

Every note stores its price basis.

1. Demo Principal 12, Air, SHA to DXB: add service **Fuel Surcharge**, **0.45 per kg**, reason "This lane needs it", source "Note from QT-seed-1". Suggested on a Principal 12 draft because its template has no Fuel Surcharge.
2. Demo Principal 07, Air, SHA to DXB: change **Transportation** to **175.00 per shipment**, reason "Customer agreed new rate". Test purpose: it must appear as a per shipment suggestion on the hero draft, and Accept must change Transportation from 150.00 to 175.00 and nothing else (revenue becomes 3,019.00). It must never appear as a per kg price.
3. A trap note for tests only (not shown in the normal demo): Principal 07, Transportation, **152.00 per kg**. The draft line is per shipment, so the basis differs and the suggestion must NOT be offered. This is exactly the Gemini demo bug (152 per kg applied to a per shipment line gave USD 109,244.00).
4. A sanity warning test: a note on the hero draft Airfreight at **10.00 per kg** (more than 3 times 3.10). If offered, it must carry the warning.

Keep 1 and 2 as visible seeds. Add 3 and 4 only to the automated test data, or seed them but mark them so the normal demo does not show them. Log your choice.

## 4. Sample emails (verbatim in `samples/`)

The Email simulator loads these from data (a table or the `samples` folder), never from a fixed list in the page.

| File | Customer | What it tests | Expected result |
|---|---|---|---|
| `01_hero_air_3_pos.txt` | Demo Principal 07 | Complete email, 3 POs, FCA, Supplier to WH Destination | `Draft ready`. Total 585 kg, 4.2 CBM, chargeable 700.00 kg. Hero totals above. |
| `02_loop_a_principal12.txt` | Demo Principal 12 | Air SHA to DXB, FCA, PO-8812 450 kg 2.8 CBM, "standard rate structure" | `Draft ready`. Volume weight 2.8 x 1000 / 6 = 466.67 kg, chargeable 466.67 kg. No Fuel Surcharge in the template. GAC user adds Fuel Surcharge 0.45 per kg, answers "This lane needs it", note saved. |
| `03_loop_b_principal12.txt` | Demo Principal 12 | Same lane, PO-8899 500 kg 3.0 CBM | `Draft ready`. Volume weight 500.00 kg equals actual, chargeable 500.00 kg. Notes panel suggests "Add Fuel Surcharge, 0.45 per kg" (from the note made on sample 02). Not applied until Accept. |
| `04_new_customer_sea.txt` | New Client Logistics (Robert Vance) | New customer, Sea, FOB, PO-SEA-101 1200 kg 8.5 CBM, PO-SEA-102 1500 kg 10.0 CBM, services Ocean Freight, Origin Terminal Handling, Destination Port Clearance, On-carriage | Request created. Totals 2,700 kg, 18.5 CBM. Chargeable weight follows the Sea rule found in Step 0, or gross weight only with "Weight rule not defined". New customer, no template, so lines show "Rate needed" unless past Secured Sea quotations on a similar lane exist. Submit is blocked. |
| `05_incomplete_air.txt` | Alex, random trading (unknown customer) | Air SHA to DXB, electronic goods, no incoterm, no weights | `Missing information`. The Add Information dialog lists: incoterm, total weight, total volume (cargo). Never guessed. |

Note: the earlier README claimed sample 04 chargeable weight was 2,700 kg using "real weight for Sea". That rule is unverified, do not hard code it.

Sample emails have To `quotes@gac.com` and made up `.demo` domains. Keep them.

## 5. Portal demo data

Customer Blue Dune Energy has a service template for Air (a few lines) and at least one past Secured Air quotation, so a portal Air request produces a priced draft. Add past Secured quotations for the other modes on common lanes so those drafts also get sourced prices (market median). Lines with no source stay "Rate needed" and block Submit; make sure the demo path for Air has none.

Suggested portal demo request: Air, Dubai to Singapore or Shanghai to Dubai, 3 packages, 450 kg, 3.2 CBM, DAP or FCA, description "Pump spare parts", ready date next week. Chargeable weight 3.2 x 1000 / 6 = 533.33 kg.

## 6. Expected checks the agent should automate

- Hero draft totals exactly 2,994.00 / 2,430.00 / 564.00 / 18.8%.
- Weight function: unit tests for Air and Courier, rounding to 2 decimals, greater-of rule.
- Notes: basis mismatch is never suggested; accepting a per shipment note on the hero changes only Transportation.
- No total ever mixes currencies.
- A customer API call never returns cost, margin or source fields.
