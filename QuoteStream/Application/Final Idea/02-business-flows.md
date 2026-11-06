# 02 Business Flows

Plain business view. No technical detail. Diagrams are Mermaid; render them in any Mermaid viewer.

## 1. Big picture: two doors, one list

```mermaid
flowchart LR
    A[Customer email arrives] --> B[AI reads the email]
    B -->|all information present| R[Request created]
    B -->|something missing| M[Missing information]
    M -->|GAC user answers in plain text| B
    P[Customer fills the portal form] -->|required fields complete| R
    R --> L[Requests list: Source = Email or Portal]
    L --> D[GAC user prepares draft quotation]
    D --> S[Submit]
    S --> AP[Approvals]
    AP -->|Reject with reason| D
    AP -->|Accept| SD[Send to customer: preview]
    SD --> C[Customer sees quotation: Quotation ready]
    C -->|Revise or negotiate| V[New version: Revision requested]
    V --> D
    AP -->|Open in job portal| J[Hand over to Marlog Quote to Job: placeholder]
```

## 2. Swimlane: who does what

```mermaid
sequenceDiagram
    participant CU as Customer
    participant PO as Portal and Email
    participant AI as AI reader
    participant GU as GAC user
    CU->>PO: Email request OR portal form
    PO->>AI: Email only: read it
    AI-->>PO: Request data and missing fields
    PO-->>CU: Portal: confirmation, status Received
    PO->>GU: Request in list (Draft ready or Missing information)
    GU->>PO: Add Information (email door, if needed)
    GU->>PO: Edit draft, check sources, Submit
    GU->>PO: Accept (Approvals)
    GU->>CU: Send to customer (simulated email)
    CU->>PO: Open quotation page, read, maybe Revise or negotiate
    PO->>GU: New version, status Revision requested
    GU->>CU: Submit, Accept, Send version 2
```

## 3. Request statuses

GAC side (internal): `Reading email`, `Missing information`, `Draft ready`, `Submitted`, `Accepted`, `Rejected`, `Sent to customer`, `Revision requested`.

Customer side (simple) and the mapping:

| GAC status | Customer sees |
|---|---|
| Reading email, Missing information | not visible (email door) |
| Portal request just created | Received |
| Draft ready, Submitted, Accepted, Rejected (first quotation) | Under review |
| Sent to customer | Quotation ready |
| Revision requested | Revision requested |
| After a revision is sent again | Quotation ready (new version) |

`Received` is shown for a portal request until GAC starts the first draft. The customer never sees `Rejected` or any internal word.

## 4. Draft quotation: where prices come from

```mermaid
flowchart TD
    Q[Cost line needs a price] --> T{Customer service template has this service?}
    T -->|yes| T1[Use it. Source: Template]
    T -->|no| S{Same customer has a Secured quotation on a similar lane?}
    S -->|yes| S1[Use the latest one. Source: Past quotation QT-xxxx]
    S -->|no| M{Other Secured quotations on a similar lane?}
    M -->|yes| M1[Use the median. Source: Market median of N quotations]
    M -->|no| N[Leave empty: Rate needed. Submit is blocked]
```

Notes can add suggestions on top. A suggestion never changes a number until the GAC user presses Accept, and only on its own price basis.

## 5. Revise or negotiate loop

```mermaid
flowchart LR
    V1[Version 1 sent: Quotation ready] --> RV[Customer: Revise or negotiate, message and optional target prices]
    RV --> RR[Status: Revision requested. New version 2 created as copy of version 1]
    RR --> ED[GAC edits, sees message and targets]
    ED --> SA[Submit, Accept, Send]
    SA --> V2[Version 2 sent: Quotation ready]
    V2 --> RV
```

No limit on rounds. Earlier versions stay visible to both users.

## 6. Who sees what

| Item | Customer | GAC user |
|---|---|---|
| Request details | yes (own) | yes |
| Prices and services | only after Send | always |
| Cost, margin, operating income | never | yes |
| Price source and confidence | never | yes |
| Internal notes and reasons | never | yes |
| Customer message and target prices | yes (own) | yes |
| Versions | yes | yes |
| Rejection reason | never | yes |

## 7. Customer journey (portal)

Pick mode, fill form, Request quotation, confirmation with request number, My requests shows `Received`, later `Quotation ready`, open the quotation page, optionally Revise or negotiate.

## 8. GAC user journey

Requests list, open a row (Edit Draft or Add Information), check lines and sources, handle Notes suggestions, Submit, Approvals, Accept, Send to customer, preview, Send. On a revision: read the customer panel, edit, Submit, Accept, Send again.
