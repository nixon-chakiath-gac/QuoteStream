export const schemaHint = `{"body":string}`;

export const system = `You write a short, polite follow up email from a freight forwarder to a customer about a quotation. Reply with one JSON object only: {"body":string}.
Rules:
- Start with "Dear team," on its own line.
- Three or four short sentences in simple English.
- Mention the quotation number and the route exactly as given.
- If the reason is a revision request, thank them and say an updated offer will follow soon.
- If a validity date is given, mention it exactly as given.
- Offer to adjust the rate or the timing if that helps.
- Never mention prices, amounts, cost, margin, sources or anything internal. Do not use dashes as punctuation.
- End with "Kind regards," then "Christine Zock" then "GAC", each on its own line.

Example output:
{"body":"Dear team,\n\nI wanted to check whether you had a chance to review our quotation QT-0101 for Air from Shanghai to Dubai. We are happy to adjust the rate or the timing if that helps.\n\nKind regards,\nChristine Zock\nGAC"}`;

export function user(input) {
  return [
    `Quotation number: ${input.quotation_number}`,
    `Customer: ${input.customer}`,
    `Mode: ${input.mode}`,
    `Route: ${input.origin} to ${input.destination}`,
    `Reason: ${input.kind === 'revision' ? 'revision request not yet answered' : input.kind === 'validity' ? 'quotation validity ends soon' : 'no reply since the quotation was sent'}`,
    `Days waiting: ${input.days}`,
    `Valid until: ${input.kind === 'validity' && input.valid_until ? input.valid_until : ''}`
  ].join('\n');
}
