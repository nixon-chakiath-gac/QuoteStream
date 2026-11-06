'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Chip, fmtDateTime, useData } from '@/lib/client';

export default function RequestPageDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error } = useData<any>(`/api/gac/requests/${id}`, 4000);
  if (error) return <div className="banner error">{error}</div>;
  if (!r) return <p className="muted">Loading</p>;
  const d = r.data ?? {};
  const rows: [string, any][] = [
    ['Customer', r.customer],
    ['Mode', r.mode],
    ['Lane', r.lane],
    ['Incoterm', d.incoterm],
    ['Job type', d.job_type],
    ['Service', d.service],
    ['Cargo description', d.description],
    ['Ready date', d.ready_date],
    ['Total quantity', d.total_quantity],
    ['Total weight (kg)', d.total_weight_kg],
    ['Total volume (m3)', d.total_volume_cbm],
    ['Chargeable weight (kg)', r.cargo?.chargeableWeight ?? (r.cargo ? `${r.cargo.grossWeight} gross` : null)],
    ['Load type', d.load_type],
    ['Vehicle type', d.vehicle_type],
    ['Service needed', d.service_description]
  ];
  return (
    <div>
      <div className="row between">
        <div>
          <h1>
            {r.number} <Chip text={r.status} />
          </h1>
          <p className="subtitle">
            Source: {r.source}. Received {fmtDateTime(r.created_at)}
          </p>
        </div>
        {r.quotation && (
          <Link href={`/gac/quotations/${r.quotation.id}`} className="btn">
            {['Accepted', 'Sent'].includes(r.quotation.flow_status) ? 'View' : 'Edit Draft'} {r.quotation.number}
          </Link>
        )}
      </div>
      {r.missing.length > 0 && <div className="banner warn">Missing information: {r.missing.join(', ')}</div>}
      <div className="two-col">
        <div>
          {r.email && (
            <div className="email-card" style={{ marginBottom: 16 }}>
              <div className="email-head">
                <div>
                  <strong>From:</strong> {r.email.from}
                </div>
                <div>
                  <strong>To:</strong> {r.email.to}
                </div>
                <div>
                  <strong>Subject:</strong> {r.email.subject}
                </div>
              </div>
              <pre>{r.email.body}</pre>
            </div>
          )}
          <div className="card">
            <h2>{r.source === 'Portal' ? 'Form data' : 'Read from the email'}</h2>
            <div className="grid3">
              {rows
                .filter((x) => x[1] !== null && x[1] !== undefined && x[1] !== '' && x[1] !== 0)
                .map(([k, v]) => (
                  <div className="field" key={k}>
                    <label>{k}</label>
                    <div>{String(v)}</div>
                  </div>
                ))}
            </div>
            {Array.isArray(d.pos) && d.pos.length > 0 && (
              <table className="t">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th className="num">Weight (kg)</th>
                    <th className="num">Volume (m3)</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pos.map((p: any) => (
                    <tr key={p.po_number}>
                      <td>{p.po_number}</td>
                      <td className="num">{p.weight_kg}</td>
                      <td className="num">{p.volume_cbm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="card">
          <h2>Timeline</h2>
          <ul className="timeline">
            {r.events.map((e: any, i: number) => (
              <li key={i}>
                {e.text}
                <div className="when">{fmtDateTime(e.created_at)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
