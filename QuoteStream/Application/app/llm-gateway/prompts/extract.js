export const schemaHint = `{"customer":string|null,"contact_name":string|null,"contact_email":string|null,"mode":"Air"|"Sea"|"Land"|"Courier"|"Hand Carry"|"Others"|null,"origin":string|null,"destination":string|null,"incoterm":string|null,"job_type":string|null,"service":"Direct"|"Consolidation"|null,"pos":[{"po_number":string,"weight_kg":number,"volume_cbm":number}],"total_weight_kg":number|null,"total_volume_cbm":number|null,"requested_services":[string],"notes":string}`;

const str = { type: ['string', 'null'] };
const num = { type: ['number', 'null'] };

export const jsonSchema = {
  type: 'object',
  properties: {
    customer: str,
    contact_name: str,
    contact_email: str,
    mode: { type: ['string', 'null'], enum: ['Air', 'Sea', 'Land', 'Courier', 'Hand Carry', 'Others', null] },
    origin: str,
    destination: str,
    incoterm: str,
    job_type: str,
    service: { type: ['string', 'null'], enum: ['Direct', 'Consolidation', null] },
    pos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { po_number: { type: 'string' }, weight_kg: { type: 'number' }, volume_cbm: { type: 'number' } },
        required: ['po_number', 'weight_kg', 'volume_cbm']
      }
    },
    total_weight_kg: num,
    total_volume_cbm: num,
    requested_services: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' }
  },
  required: ['customer', 'mode', 'origin', 'destination', 'incoterm', 'pos', 'total_weight_kg', 'total_volume_cbm', 'requested_services']
};

export const system = `You extract a freight quotation request from an email. Reply with one JSON object only.
Rules:
- Copy values as written in the email. If a value is not stated, use null. Never guess.
- customer: the shipper company (for example "Demo Principal 07", or X in "We are X"), else the signature company line.
- mode: Air, Sea, Land, Courier or Hand Carry, from a Mode line or clear words such as air freight, ocean freight, or a destination airport. Others only if another mode is named. Else null.
- contact_name: the person who signed. contact_email: the From address.
- origin: where the goods are collected or shipped from, only if the email says so. A vessel ETA, arrival port or the sender's location is never the origin. If the email does not say where the goods ship from, origin is null.
- destination: where the goods must be delivered, as written, for example "Dubai (DXB)". Write "City (CODE)" when the email gives a city and a 3 letter airport or port code for the same place.
- Use the Subject route only if the body has none.
- incoterm: a 3 letter code only if stated.
- job_type and service (Consolidation or Direct): only if stated.
- pos: one entry per PO with weight in kg and volume in cbm.
- total_weight_kg and total_volume_cbm: stated totals, else the sum of the POs, else null.
- requested_services: only names from this list that the email asks for: Origin Charges, Airfreight, Fuel Surcharge, Security Surcharge, Export Customs, Import Customs, Transportation, Ocean Freight, Origin Terminal Handling, Destination Port Clearance, On-carriage, Courier Service, Road Freight, Hand Carry Service, Special Handling.
- notes: "" unless something is inconsistent.`;

export function user(input) {
  return `Extract this email.\n\nFrom: ${input.from}\nTo: ${input.to || ''}\nSubject: ${input.subject}\n\n${input.body}`;
}
