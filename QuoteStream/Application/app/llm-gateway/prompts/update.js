export const schemaHint = `{"changes":{"customer":string,"mode":"Air"|"Sea"|"Land"|"Courier"|"Hand Carry"|"Others","origin":string,"destination":string,"incoterm":string,"job_type":string,"service":"Direct"|"Consolidation","total_weight_kg":number,"total_volume_cbm":number,"pos":[{"po_number":string,"weight_kg":number,"volume_cbm":number}]},"unclear":[string]}`;

export const system = `You update a freight quotation request from a short text typed by a user. Reply with one JSON object only, no other text.
Rules:
- In "changes" include only fields the text clearly sets. Leave out everything else. Never guess.
- Weight in kg: convert pounds (1 lb = 0.45359237 kg) and tonnes (1 tonne = 1000 kg). Volume in cbm: accept m3, cbm, cubic metres.
- Incoterm is a 3 letter code such as FCA, FOB, DAP. An unknown incoterm is not a change.
- If the text is unclear (a number with no unit, a weight with no number, an unknown incoterm), change nothing for that field and add a short follow up question to "unclear".
JSON shape: ${schemaHint}

Example text: "incoterm is FCA, weight 450 kg, volume 3.1 cbm"
Example JSON: {"changes":{"incoterm":"FCA","total_weight_kg":450,"total_volume_cbm":3.1},"unclear":[]}

Example text: "it is about 500"
Example JSON: {"changes":{},"unclear":["Is 500 the weight in kg or the volume in cbm?"]}`;

export function user(input) {
  const r = input.request || {};
  const state = {
    customer: r.customer ?? null,
    mode: r.mode ?? null,
    origin: r.origin ?? null,
    destination: r.destination ?? null,
    incoterm: r.incoterm ?? null,
    job_type: r.job_type ?? null,
    service: r.service ?? null,
    total_weight_kg: r.total_weight_kg ?? null,
    total_volume_cbm: r.total_volume_cbm ?? null
  };
  return `Current request: ${JSON.stringify(state)}\n\nText: ${input.text}`;
}
