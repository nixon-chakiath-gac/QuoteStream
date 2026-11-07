import { ANCHOR_DATE, CONTACT_EMAIL, DASH_ROWS, REPLY_DAYS, dayNumber, type DashRow } from './data';

export type FollowKind = 'no_reply' | 'revision' | 'validity';

export type FollowUp = {
  id: string;
  customer: string;
  amount: number;
  mode: string;
  origin: string;
  destination: string;
  kind: FollowKind;
  chip: 'Follow up' | 'Reply to revision';
  reason: string;
  days: number;
  validUntil: string | null;
  to: string;
};

const ORDER: Record<FollowKind, number> = { no_reply: 0, revision: 1, validity: 2 };

function ago(n: number) {
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}

function endsIn(n: number) {
  return n === 0 ? 'ends today' : n === 1 ? 'ends tomorrow' : `ends in ${n} days`;
}

function check(x: DashRow, today: number): FollowUp | null {
  const base = {
    id: x.id,
    customer: x.customer,
    amount: x.revenue,
    mode: x.mode,
    origin: x.origin,
    destination: x.destination,
    validUntil: x.validUntil,
    to: CONTACT_EMAIL[x.customer] ?? 'customer@example.com'
  };
  if (x.status === 'Revision requested' && x.revisionAt && !x.revisionAnsweredAt) {
    const days = today - dayNumber(x.revisionAt);
    if (days >= 2) return { ...base, kind: 'revision', chip: 'Reply to revision', days, reason: `Revision requested ${ago(days)} and not yet answered.` };
  }
  if (x.status !== 'Sent' || !x.sentAt) return null;
  const sentDays = today - dayNumber(x.sentAt);
  const replied = x.lastReplyAt !== null && x.lastReplyAt >= x.sentAt;
  if (!replied && sentDays >= 3) {
    const usual = REPLY_DAYS[x.customer];
    const tail = usual && sentDays > usual ? ` This customer usually answers within ${usual} days.` : '';
    return { ...base, kind: 'no_reply', chip: 'Follow up', days: sentDays, reason: `Sent ${ago(sentDays)}, no reply.${tail}` };
  }
  if (x.validUntil) {
    const left = dayNumber(x.validUntil) - today;
    if (left >= 0 && left <= 2) return { ...base, kind: 'validity', chip: 'Follow up', days: sentDays, reason: `Sent ${ago(sentDays)}. Quotation validity ${endsIn(left)}.` };
  }
  return null;
}

export function needsFollowUp(rows: DashRow[] = DASH_ROWS, anchorIso = ANCHOR_DATE, limit = 5): FollowUp[] {
  const today = dayNumber(anchorIso);
  return rows
    .map((x) => check(x, today))
    .filter((x): x is FollowUp => x !== null)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || b.days - a.days || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
}

export function followUpFacts(id: string, anchorIso = ANCHOR_DATE) {
  const row = DASH_ROWS.find((x) => x.id === id);
  if (!row) return null;
  return check(row, dayNumber(anchorIso));
}

export function followUpTemplate(f: FollowUp): { subject: string; body: string } {
  const lane = `${f.origin} to ${f.destination}`;
  const opener =
    f.kind === 'revision'
      ? `Thank you for your revision request on our quotation ${f.id} for ${f.mode} from ${lane}. We are reviewing it and will come back with an updated offer shortly.`
      : `I wanted to check whether you had a chance to review our quotation ${f.id} for ${f.mode} from ${lane}.`;
  const validity = f.kind === 'validity' && f.validUntil ? ` Please note that the quotation is valid until ${f.validUntil}.` : '';
  return {
    subject: `Following up on ${f.id}`,
    body: `Dear team,\n\n${opener}${validity} We are happy to adjust the rate or the timing if that helps.\n\nKind regards,\nChristine Zock\nGAC`
  };
}
