export const schemaHint = `{"customer":string|null,"contact_name":string|null,"contact_email":string|null,"mode":"Air"|"Sea"|"Land"|"Courier"|"Hand Carry"|"Others"|null,"origin":string|null,"destination":string|null,"incoterm":string|null,"job_type":string|null,"service":"Direct"|"Consolidation"|null,"pos":[{"po_number":string,"weight_kg":number,"volume_cbm":number}],"total_weight_kg":number|null,"total_volume_cbm":number|null,"requested_services":[string],"notes":string}`;

export const system = `You extract a freight quotation request from an email. Reply with one JSON object only, no other text.
Rules:
- Copy values exactly as written in the email. If a value is not stated, use null. Never guess.
- customer: the shipper company (for example "Demo Principal 07" or the company in "We are X"), else the signature company line, else null.
- mode: one of Air, Sea, Land, Courier, Hand Carry, from the Mode line or from words such as air freight or ocean freight. Use Others only if another mode is named, else null.
- contact_name: the person or team who signed the email.
- contact_email: the From address.
- origin and destination: as written, for example "Shanghai (SHA)". If the body has no Origin or Destination lines, use the route in the Subject, for example "Shanghai".
- incoterm: the 3 letter code only if the email states one, else null.
- job_type: only if a Job Type line exists, else null.
- service: Consolidation or Direct only if stated, else null.
- pos: one entry per PO with weight in kg and volume in cbm.
- total_weight_kg and total_volume_cbm: the totals stated in the email, else the sum of the POs, else null.
- requested_services: only names from this list that the email asks for: Origin Charges, Airfreight, Fuel Surcharge, Security Surcharge, Export Customs, Import Customs, Transportation, Ocean Freight, Origin Terminal Handling, Destination Port Clearance, On-carriage, Courier Service, Road Freight, Hand Carry Service, Special Handling. Use [] if the email lists none.
- notes: "" unless something is inconsistent.
JSON shape: ${schemaHint}

Example email:
From: shipping@newclientlogistics.com
Subject: Rate enquiry for ocean freight Shanghai to Dubai
We are New Client Logistics and would like an ocean freight quote:
- Origin: Shanghai (SHA)
- Destination: Dubai (JEA)
- Mode: Sea
- Incoterm: FOB
- PO-SEA-101: 1200 kg, 8.5 CBM
- PO-SEA-102: 1500 kg, 10.0 CBM
- Services needed: Ocean Freight and On-carriage.
Best regards,
Robert Vance
New Client Logistics

Example JSON:
{"customer":"New Client Logistics","contact_name":"Robert Vance","contact_email":"shipping@newclientlogistics.com","mode":"Sea","origin":"Shanghai (SHA)","destination":"Dubai (JEA)","incoterm":"FOB","job_type":null,"service":null,"pos":[{"po_number":"PO-SEA-101","weight_kg":1200,"volume_cbm":8.5},{"po_number":"PO-SEA-102","weight_kg":1500,"volume_cbm":10}],"total_weight_kg":2700,"total_volume_cbm":18.5,"requested_services":["Ocean Freight","On-carriage"],"notes":""}`;

export function user(input) {
  return `Extract this email.\n\nFrom: ${input.from}\nTo: ${input.to || ''}\nSubject: ${input.subject}\n\n${input.body}`;
}
