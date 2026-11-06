'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AddInfoDialog from '@/components/AddInfoDialog';
import { Chip, FallbackTag, fmtDateTime, useData } from '@/lib/client';

const FILTERS: { label: string; match: (s: string) => boolean }[] = [
  { label: 'All', match: () => true },
  { label: 'Missing information', match: (s) => s === 'Missing information' },
  { label: 'Draft ready', match: (s) => s === 'Draft ready' },
  { label: 'Submitted', match: (s) => s === 'Submitted' },
  { label: 'Accepted', match: (s) => s === 'Accepted' },
  { label: 'Sent', match: (s) => s === 'Sent to customer' }
];

export default function RequestsPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useData<any[]>('/api/gac/requests', 3000);
  const [filter, setFilter] = useState('All');
  const [info, setInfo] = useState<any | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    const f = Number(new URLSearchParams(window.location.search).get('focus'));
    if (f) setFocus(f);
  }, []);

  useEffect(() => {
    if (!focus || scrolled.current || !data) return;
    const el = document.getElementById(`req-${focus}`);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      scrolled.current = true;
    }
  }, [focus, data]);
  const rows = (data ?? []).filter((r) => FILTERS.find((f) => f.label === filter)!.match(r.status));

  function act(r: any) {
    if (r.action === 'Add Information') setInfo(r);
    else if (r.quotation_id) router.push(`/gac/quotations/${r.quotation_id}`);
  }

  return (
    <div>
      <h1>Requests</h1>
      <p className="subtitle">Every request from the portal and from email, newest first</p>
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.label} className={`filter${filter === f.label ? ' active' : ''}`} onClick={() => setFilter(f.label)}>
            {f.label}
          </button>
        ))}
      </div>
      {error && <div className="banner error">{error}</div>}
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Received</th>
              <th>Source</th>
              <th>Customer</th>
              <th>Mode</th>
              <th>Lane</th>
              <th>Status</th>
              <th>Missing information</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} id={`req-${r.id}`} className={`click${r.id === focus ? ' focus' : ''}`} onClick={() => router.push(`/gac/requests/${r.id}`)}>
                <td>
                  {fmtDateTime(r.created_at)}
                  <div className="hint">{r.number}</div>
                </td>
                <td>
                  <Chip text={r.source} kind={r.source === 'Portal' ? 'chip info plain' : 'chip plain'} />
                </td>
                <td>{r.customer}</td>
                <td>{r.mode ?? 'Not known'}</td>
                <td>{r.lane || 'Not known'}</td>
                <td>
                  {r.status === 'Reading email' ? (
                    <span className="chip">
                      <span className="spinner" />
                      Reading email
                    </span>
                  ) : (
                    <Chip text={r.status} />
                  )}
                  {r.ai_fallback && <FallbackTag reason={r.ai_reason} />}
                </td>
                <td>{r.missing.length > 0 ? r.missing.join(', ') : ''}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {r.action && (
                    <button className={`btn small${r.action === 'View' ? ' secondary' : ''}`} onClick={() => act(r)}>
                      {r.action}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="empty">No requests yet</div>}
      </div>
      {info && (
        <AddInfoDialog
          request={info}
          onClose={() => setInfo(null)}
          onDone={(qid) => {
            setInfo(null);
            reload();
            if (qid) router.push(`/gac/quotations/${qid}`);
          }}
        />
      )}
    </div>
  );
}
