# 03 Marlog Ground Truth

Marlog 2.0 is GAC's system: Angular front end, .NET back end, SQL Server. Project: `C:\reppos\gac-marlog` (READ ONLY). Legacy project: `c:\reppos\gml-legacy`.

This file separates what is verified from what is not. Do not treat unverified items as fact.

## Verified

**Quotation tables:** `Quotation`, `QuotationProduct`, `QuotationDetail`, `QuotationPo`, `QuotationProductCost`, `ServiceTemplate`, `ServiceTemplateDetail`, `BranchTermsAndCondition`, `QuotationDocuments`.

**Meaning of the main tables (from the earlier study notes):**
- `Quotation`: `QuotationNumber`, `BranchFk`, `StatusFk`, `PartyFk` (principal), `PartyName`, `PartyPIC`, dates, terms.
- `QuotationProduct`: airline or shipping line, `BillingCurrencyFk`, remarks.
- `QuotationDetail`: `ModeFk` (JobMode), `JobTypeFk`, `Service` (`Direct` or `Consolidation`), `IncotermFk`, `OriginFk`, `DestinationFk`, `GrossWeight`, `ChargeableWeight`, `Volume`.
- `QuotationPo`: linked POs with gross weight, chargeable weight, volume.
- `QuotationProductCost`: cost lines linked to `ServiceFk`, currency, `Unit`, `UnitPrice`, `BillAmount`, `EstimatedCostCurrencyFk`, `EstimatedUnitCost`, `EstimatedCost`, `EstimatedCostInBillingCurrency`, `RevenueInBillingCurrency`, `OperatingIncomeLocalCurrency`.
- `ServiceTemplate` and `ServiceTemplateDetail`: standard customer pricing templates with services, unit prices, estimated unit costs, suppliers.

**Quotation statuses:** `Pending`, `Lost`, `Secured`, `Alternate Option Secured` (Id 4), `Re-opened`.

**UI words:** sections Quotation Details, Product Options, Cost Lines, PO list, Print Documents. Summary cards Revenue, Est. Cost and **"Est. Op. Income"**. Actions: Import Service Template, Add service, Remove service, reason capture on changes and on Lost.

**Chargeable weight (from `GEMINI.md`):**
- Air: volume weight = CBM x 1000 / 6. Per package: individual = CBM x 1000 / 6, total = individual x number of packages.
- Courier: volume weight = CBM x 200. Same per package logic.
- Chargeable = the greater of actual and volume weight, rounded to 2 decimals.

**Dev DB facts (investigated earlier):** 1,389 quotations; about 60% Air; statuses Pending 76%, Secured 20%, Lost 4%. Only 140 of 1,389 have an enquiry date.
Consequence: the real data cannot prove time saved baselines (for example "2 hours" or "4 hours"). Never claim a measured baseline in the demo or in slides. Describe time saving as expected, not measured.

## Not verified (do not assume)

- **Sea, Land, Hand Carry, Others weight rules.** The Gemini demo's notes say "Sea and Land use real weight directly" but that is not confirmed anywhere. Search Marlog and `c:\reppos\gml-legacy` (look for `unit-converter.js`, `PoControllerPartial.js`). If nothing is found or the legacy folder is unreadable: show gross weight only, add the note "Weight rule not defined for this mode", log it in `docs/assumptions.md`, and tell the user in the Step 0 summary. Do not use generic industry factors (for example 1000 kg per CBM for sea, 333 kg per CBM for road) unless Marlog confirms them.
- **Job modes list.** Taken as Air, Sea, Land, Courier, Hand Carry, Others from earlier notes. Confirm the exact names in Marlog's `JobMode`.
- **Incoterm list and job types** (for example "Supplier to WH Destination"). Read the real lists from Marlog and use the same names.
- **Real field labels and button names** in the Angular quotation screens. Read them in Step 0 and prefer them over mine.

## Hero numbers (invented for the demo, not Marlog data)

Demo Principal 07, Air, Shanghai to Dubai, 585 kg and 4.2 CBM. Volume weight 4.2 x 1000 / 6 = 700.00 kg, so chargeable 700.00 kg. See `04-seed-data-and-samples.md` for the lines and totals.

## Safety

- Never write to Marlog. Never run its database scripts. Never copy real names, rates or quotation numbers.
- Never read or copy the `password` column of the `Agent` table.
