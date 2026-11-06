# Marlog notes (Step 0)

Marlog and the legacy project are not on this machine. These notes come only from `Final Idea/03-marlog-ground-truth.md`. Nothing was read from Marlog.

## Verified in the brief

- Quotation tables: Quotation, QuotationProduct, QuotationDetail, QuotationPo, QuotationProductCost, ServiceTemplate, ServiceTemplateDetail, BranchTermsAndCondition, QuotationDocuments.
- Statuses: Pending, Lost, Secured, Alternate Option Secured, Re-opened.
- Words used on screen: Quotation Details, Product Options, Cost Lines, PO list, Print Documents, Revenue, Est. Cost, Est. Op. Income, Import Service Template, Add service, Remove service.
- Chargeable weight: Air volume weight = CBM x 1000 / 6. Courier volume weight = CBM x 200. Chargeable is the greater of actual and volume weight, rounded to 2 decimals. Per package: individual weight times number of packages.

## Not verifiable here (defaults used, see assumptions.md)

- Weight rules for Sea, Land, Hand Carry and Others: gross weight only, with "Weight rule not defined for this mode".
- Exact job mode names, incoterm list, job type list and field labels.

## Differences from the product spec

None found. Where the spec mentions reading Marlog, the defaults in `10-decisions-and-defaults.md` were used instead.
