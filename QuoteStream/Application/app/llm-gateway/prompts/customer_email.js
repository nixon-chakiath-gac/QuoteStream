import { totalLines } from '../validate.js';

export const schemaHint = `{"subject":string,"body":string}`;

export const system = `You write a short customer facing email about a freight quotation. Reply with one JSON object only: {"subject":string,"body":string}.
Rules:
- Short, simple English. Greet the contact by name.
- Say the quotation number, the route and the mode if given.
- List each total on its own line exactly as given, one per currency. Never add different currencies together.
- Mention the validity date exactly as given.
- Invite the customer to review the quotation in the portal and to use Revise or negotiate if they want changes.
- If the quotation is revised, say clearly that it is a revised quotation.
- Never mention internal matters, prices breakdowns, sources or notes. Do not use dashes as punctuation.
- Sign off as the GAC Quotations Team.

Example output:
{"subject":"Quotation Q-1001, Shanghai to Dubai","body":"Dear Priya,\n\nThank you for your enquiry. Please find our quotation Q-1001 for your air shipment from Shanghai to Dubai.\n\nTotal:\nUSD 1,250.00\n\nThis quotation is valid until 2026-12-31.\n\nPlease review it in the portal. If you would like any changes, use Revise or negotiate.\n\nKind regards,\nGAC Quotations Team"}`;

export function user(input) {
  const names = Array.isArray(input.services) ? input.services.map((s) => s && s.service).filter(Boolean) : [];
  return [
    `Customer: ${input.customer || ''}`,
    `Contact: ${input.contact_name || input.customer || ''}`,
    `Quotation number: ${input.quotation_number}`,
    `Version: ${input.version || 1}`,
    `Route: ${input.origin} to ${input.destination}`,
    `Mode: ${input.mode || ''}`,
    `Valid until: ${input.valid_until || ''}`,
    `Revised: ${input.revised ? 'yes' : 'no'}`,
    `Services: ${names.join(', ')}`,
    `Totals (write each line exactly):`,
    ...totalLines(input.totals)
  ].join('\n');
}
