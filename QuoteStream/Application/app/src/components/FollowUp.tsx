'use client';

import { useEffect, useRef, useState } from 'react';
import { api, FallbackTag } from '@/lib/client';
import './assist.css';
import { fmtUsd } from '@/lib/dashboard/query';
import type { FollowUp } from '@/lib/dashboard/followup';

type Draft = { quotation: string; to: string; subject: string; body: string; fallback_used: boolean; reason: string | null };

function FollowUpDialog({ item, onClose }: { item: FollowUp; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex="0"]')].filter((x) => !x.hasAttribute('disabled'));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    api<Draft>('/api/gac/follow-up', { body: { id: item.id } })
      .then(setDraft)
      .catch((e) => setErr(e.message));
  }, [item.id]);

  const title = preview ? 'Email preview' : 'Follow-up draft';

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog assist-dialog" role="dialog" aria-modal="true" aria-labelledby="fu-title" tabIndex={-1} ref={box}>
        <h2 id="fu-title">
          {title} <span className="ai-tag">AI draft</span>
          {draft?.fallback_used && <FallbackTag reason={draft.reason} />}
        </h2>
        {!draft && !err && (
          <p>
            <span className="spinner" />
            Writing the draft
          </p>
        )}
        {err && <div className="banner error">{err}</div>}
        {draft && !preview && (
          <>
            <p className="muted small-text">To: {draft.to}</p>
            <div className="assist-draft">
              <strong>Subject: {draft.subject}</strong>
              <pre>{draft.body}</pre>
            </div>
          </>
        )}
        {draft && preview && (
          <div className="email-card">
            <div className="email-head">
              <div>
                <strong>From:</strong> Christine Zock, GAC
              </div>
              <div>
                <strong>To:</strong> {draft.to}
              </div>
              <div>
                <strong>Subject:</strong> {draft.subject}
              </div>
            </div>
            <pre>{draft.body}</pre>
          </div>
        )}
        <p className="hint">Nothing is sent. This opens in the simulated email preview. Review before use.</p>
        <div className="dialog-actions">
          {preview ? (
            <>
              <button type="button" className="btn secondary" onClick={() => setPreview(false)}>
                Back to draft
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn" disabled={!draft} onClick={() => setPreview(true)}>
                Open in preview
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NeedsFollowUp({ items }: { items: FollowUp[] }) {
  const [open, setOpen] = useState<FollowUp | null>(null);
  return (
    <section className="card dash-card">
      <h2>
        Needs follow-up <span className="ai-tag">AI assist</span>
      </h2>
      {items.length === 0 ? (
        <p className="muted">Nothing needs a follow-up right now.</p>
      ) : (
        <ul className="fu-list">
          {items.map((f) => (
            <li key={f.id}>
              <div className="fu-main">
                <strong>
                  {f.id} | {f.customer} | {fmtUsd(f.amount)}
                </strong>
                <span className="muted">{f.reason}</span>
              </div>
              <span className="chip warn plain">{f.chip}</span>
              <button type="button" className="btn small" onClick={() => setOpen(f)}>
                Draft follow-up
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <FollowUpDialog item={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
