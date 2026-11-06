'use client';

import { useRouter } from 'next/navigation';
import { Chip, LaneText, ModeTag, fmtDate, useData } from '@/lib/client';

export default function MyRequests() {
  const router = useRouter();
  const { data, loading, error } = useData<any[]>('/api/portal/requests', 4000);
  return (
    <div>
      <h1>My requests</h1>
      <p className="subtitle">Follow the status of your quotation requests</p>
      {error && <div className="banner error">{error}</div>}
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Request number</th>
              <th>Mode</th>
              <th>Lane</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="click" onClick={() => router.push(`/portal/requests/${r.id}`)}>
                <td>
                  <strong>{r.number}</strong>
                </td>
                <td>
                  <ModeTag mode={r.mode} />
                </td>
                <td>
                  <LaneText lane={r.lane} empty="Not given" />
                </td>
                <td>{fmtDate(r.created_at)}</td>
                <td>
                  <Chip text={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (data ?? []).length === 0 && <div className="empty">No requests yet. Choose Request a quotation to send your first one.</div>}
      </div>
    </div>
  );
}
