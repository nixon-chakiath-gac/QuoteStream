'use client';

import './assist.css';

type Why = { line_id: number; kind: 'price' | 'none'; text: string; flag: string | null };
type Check = { kind: 'weight' | 'duplicate'; text: string; request_id: number | null; request_number: string | null };

export function WhyBox({ why }: { why: Why }) {
  const warn = why.kind === 'none' || Boolean(why.flag);
  return (
    <div className={`why-box${warn ? ' warn' : ''}`}>
      <strong>{why.kind === 'none' ? 'Why no price.' : 'Why this price.'}</strong> {why.text}
      {why.flag && <span className="chip warn plain">{why.flag}</span>}
      {why.flag && <span className="flag">Flag only. The price is unchanged. Edit it or keep it.</span>}
    </div>
  );
}

export function CheckBanner({
  checks,
  onIgnore,
  onReviewWeight,
  onReviewRequest
}: {
  checks: Check[];
  onIgnore: () => void;
  onReviewWeight: () => void;
  onReviewRequest: (id: number) => void;
}) {
  const first = checks[0];
  function review() {
    if (first.kind === 'weight') onReviewWeight();
    else if (first.request_id) onReviewRequest(first.request_id);
  }
  return (
    <div className="banner warn check-banner" role="status">
      <div>
        <strong>
          {checks.length} {checks.length === 1 ? 'thing looks' : 'things look'} unusual
        </strong>
        <span className="ai-tag">AI assist</span>
        <ul>
          {checks.map((c) => (
            <li key={c.kind}>
              {c.text}
              {c.kind === 'duplicate' && c.request_id && first.kind !== 'duplicate' && (
                <>
                  {' '}
                  <button type="button" className="link-btn" onClick={() => onReviewRequest(c.request_id as number)}>
                    Open {c.request_number}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="hint">This check never blocks Submit.</div>
      </div>
      <div className="actions">
        <button type="button" className="btn secondary small" onClick={review}>
          Review
        </button>
        <button type="button" className="btn secondary small" onClick={onIgnore}>
          Ignore
        </button>
      </div>
    </div>
  );
}
