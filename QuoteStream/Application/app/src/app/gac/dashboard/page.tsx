'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fmtDate, statusClass } from '@/lib/client';
import { DASH_ROWS, RATE_NEEDED_LINES, type DashRow } from '@/lib/dashboard/data';
import { chipsFor, GROUP_LABEL, METRIC_LABEL, parse, type Parsed } from '@/lib/dashboard/parse';
import { buildSql, filterRows, fmtInt, groupRows, kpis, overviewSpec, type Kpi } from '@/lib/dashboard/query';
import { ColumnChart, DonutChart, HBarChart, LineChart } from '@/components/DashCharts';
import NeedsFollowUp from '@/components/FollowUp';
import GridAssist from '@/components/GridAssist';
import { needsFollowUp } from '@/lib/dashboard/followup';
import './dashboard.css';

const EXAMPLES = [
  'air freight margin by customer last 6 months',
  'sea freight revenue by lane',
  'Blue Dune Energy quotations by mode',
  'revisions requested last month',
  'email vs portal requests',
  'Shanghai to Dubai trend this year',
  'courier weight by month'
];

const STEPS = ['Understood the question', 'Chose the view', 'Built the query', 'Drew the charts'];

type Kind = 'hbar' | 'columns' | 'donut' | 'line';
type SortKey = 'id' | 'customer' | 'mode' | 'lane' | 'date' | 'status' | 'revenue' | 'income' | 'chargeableKg';

const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'id', label: 'Quote' },
  { key: 'customer', label: 'Customer' },
  { key: 'mode', label: 'Mode' },
  { key: 'lane', label: 'Lane' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
  { key: 'revenue', label: 'Revenue', num: true },
  { key: 'income', label: 'Op. income', num: true },
  { key: 'chargeableKg', label: 'Chargeable kg', num: true }
];

function sortValue(x: DashRow, k: SortKey): string | number {
  if (k === 'lane') return `${x.origin} to ${x.destination}`;
  if (k === 'income') return x.revenue - x.cost;
  return x[k];
}

function kindsFor(p: Parsed): Kind[] {
  if (p.group === 'month') return ['line', 'columns'];
  return p.metric === 'margin' ? ['hbar', 'columns'] : ['hbar', 'columns', 'donut'];
}

function greeting(h: number) {
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="dash-kpis">
      {items.map((k) => (
        <div key={k.label} className="dash-kpi">
          <div className="k">{k.label}</div>
          <div className="v">{k.value}</div>
          <div className={k.change >= 0 ? 'chg up' : 'chg down'}>
            {k.change >= 0 ? '▲' : '▼'} {Math.abs(k.change).toFixed(1)}% vs previous period
          </div>
        </div>
      ))}
    </div>
  );
}

function QuoteTable({ rows, pageSize, showAllToggle }: { rows: DashRow[]; pageSize: number; showAllToggle: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const A = sortValue(a, sort.key);
      const B = sortValue(b, sort.key);
      const c = A > B ? 1 : A < B ? -1 : 0;
      return (c || (a.id > b.id ? 1 : -1)) * sort.dir;
    });
  }, [rows, sort]);
  const shown = all ? sorted : sorted.slice(0, pageSize);
  function toggle(key: SortKey) {
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'date' || COLS.find((c) => c.key === key)?.num ? -1 : 1 }));
  }
  return (
    <>
      <div className="table-wrap dash-table">
        <table className="t">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : undefined} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="sort-btn" onClick={() => toggle(c.key)}>
                    {c.label}
                    <span className="arrow" aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id}>
                <td className="mono">{x.id}</td>
                <td className="nowrap">{x.customer}</td>
                <td>{x.mode}</td>
                <td>
                  <span className="lane">
                    <span className="lane-place">{x.origin}</span>
                    <span className="lane-to">to</span>
                    <span className="lane-place">{x.destination}</span>
                  </span>
                </td>
                <td className="nowrap">{fmtDate(x.date)}</td>
                <td>
                  <span className={statusClass(x.status)}>{x.status}</span>
                </td>
                <td className="num">{fmtInt(x.revenue)}</td>
                <td className="num">{fmtInt(x.revenue - x.cost)}</td>
                <td className="num">{fmtInt(x.chargeableKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAllToggle && rows.length > pageSize && (
        <p className="mt">
          <button type="button" className="link-btn" onClick={() => setAll(!all)}>
            {all ? 'Show first 10' : `Show all ${rows.length}`}
          </button>
        </p>
      )}
    </>
  );
}

function Overview() {
  const spec = useMemo(overviewSpec, []);
  const rows = useMemo(() => filterRows(spec), [spec]);
  const byMonth = groupRows(rows, { ...spec, group: 'month', metric: 'revenue' });
  const byMode = groupRows(rows, { ...spec, group: 'mode', metric: 'revenue' });
  const byCustomer = groupRows(rows, { ...spec, group: 'customer', metric: 'income' }, 6);
  const followUps = useMemo(() => needsFollowUp(), []);
  const count = (s: DashRow['status']) => rows.filter((x) => x.status === s).length;
  return (
    <>
      <Kpis items={kpis(rows, spec)} />
      <div className="dash-cols">
        <section className="card dash-card">
          <h2>Revenue by month</h2>
          <LineChart data={byMonth} metric="revenue" />
        </section>
        <section className="card dash-card">
          <h2>Revenue by mode</h2>
          <DonutChart data={byMode} metric="revenue" />
        </section>
      </div>
      <div className="dash-cols">
        <section className="card dash-card">
          <h2>Top customers by operating income</h2>
          <HBarChart data={byCustomer} metric="income" />
        </section>
        <section className="card dash-card">
          <h2>Needs attention</h2>
          <ul className="attn">
            <li>
              <span>Waiting for your Accept</span>
              <span className="chip warn">{count('Submitted')} quotations</span>
            </li>
            <li>
              <span>Customer asked for a revision</span>
              <span className="chip info">{count('Revision requested')} quotations</span>
            </li>
            <li>
              <span>Drafts not yet submitted</span>
              <span className="chip">{count('Draft')} quotations</span>
            </li>
            <li>
              <span>Lines showing Rate needed</span>
              <span className="chip bad">{RATE_NEEDED_LINES} lines</span>
            </li>
          </ul>
        </section>
      </div>
      <NeedsFollowUp items={followUps} />
      <GridAssist title="Latest requests" rows={rows} />
    </>
  );
}

function Result({ spec, runId, onBack }: { spec: Parsed; runId: number; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState(0);
  const rows = useMemo(() => filterRows(spec), [spec]);
  const buckets = useMemo(() => groupRows(rows, spec), [rows, spec]);
  const kinds = kindsFor(spec);
  const current = kinds[kind % kinds.length];

  useEffect(() => {
    setStep(0);
    setKind(0);
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 250 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [runId]);

  const title = `${spec.metric === 'count' ? 'Quotations' : METRIC_LABEL[spec.metric]} by ${GROUP_LABEL[spec.group].toLowerCase()}`;
  const done = step >= STEPS.length;

  return (
    <div className="dash-result">
      <button type="button" className="link-btn back" onClick={onBack}>
        {'←'} Back to overview
      </button>
      <ol className="dash-steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'on' : ''}>
            <i aria-hidden="true" />
            {s}
          </li>
        ))}
      </ol>
      <div className="dash-chips">
        <strong>Interpreted as</strong>
        {chipsFor(spec).map((c) => (
          <span key={c.label} className={`chip plain ${c.kind === 'filter' ? 'info' : c.kind === 'shape' ? 'ok' : ''}`}>
            {c.label}
          </span>
        ))}
        <span className="concept">Concept</span>
      </div>
      {spec.recognised === 0 && (
        <div className="dash-note">
          Concept only, this prototype understands modes, customers, lanes, status, source, periods and measures such as revenue, margin and weight, and
          shows the overall picture instead.
        </div>
      )}
      {done &&
        (rows.length === 0 ? (
          <section className="card dash-card">
            <h2>No quotations match</h2>
            <p className="muted">Try a longer period or fewer filters, for example &quot;air freight last 12 months&quot;.</p>
          </section>
        ) : (
          <>
            <Kpis items={kpis(rows, spec)} />
            <section className="card dash-card">
              <div className="dash-hd">
                <h2>{title}</h2>
                <button type="button" className="btn secondary small" onClick={() => setKind((k) => k + 1)}>
                  Shuffle chart
                </button>
              </div>
              {current === 'line' && <LineChart data={buckets} metric={spec.metric} />}
              {current === 'columns' && <ColumnChart data={buckets} metric={spec.metric} />}
              {current === 'hbar' && <HBarChart data={buckets} metric={spec.metric} />}
              {current === 'donut' && <DonutChart data={buckets} metric={spec.metric} />}
            </section>
            <section className="card dash-card">
              <h2>
                Matching quotations <span className="muted small-text">({rows.length})</span>
              </h2>
              <QuoteTable key={runId} rows={rows} pageSize={10} showAllToggle />
            </section>
            <section className="card dash-card">
              <h2>How the full version would do this</h2>
              <p className="muted">
                An AI model would turn the sentence into a read only query over a reporting view and pick a chart from a fixed set. Here the same result is
                computed by a word list over made up data.
              </p>
              <details className="dash-sql">
                <summary>Show the query it would write</summary>
                <pre>{buildSql(spec)}</pre>
              </details>
            </section>
          </>
        ))}
    </div>
  );
}

export default function DashboardPage() {
  const [hello, setHello] = useState('Hello');
  const [text, setText] = useState('');
  const [spec, setSpec] = useState<Parsed | null>(null);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    setHello(greeting(new Date().getHours()));
  }, []);

  function run(q: string) {
    const t = q.trim();
    setText(q);
    if (!t) {
      setSpec(null);
      return;
    }
    setSpec(parse(t));
    setRunId((n) => n + 1);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(text);
  }

  return (
    <div className="dash">
      <h1>{hello}, Christine</h1>
      <p className="subtitle">Ask anything about your quotations. The dashboard builds the view for you.</p>
      <section className="card dash-hero">
        <form className="dash-search" role="search" onSubmit={submit}>
          <span className="icon" aria-hidden="true">
            {'\u{1F50D}'}
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Try: air freight margin by customer last 6 months"
            aria-label="Search your quotations"
            autoComplete="off"
          />
          <button type="submit" className="btn">
            Search
          </button>
        </form>
        <div className="dash-examples" aria-label="Example searches">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" onClick={() => run(q)}>
              {q}
            </button>
          ))}
        </div>
      </section>
      {spec ? (
        <Result
          spec={spec}
          runId={runId}
          onBack={() => {
            setText('');
            setSpec(null);
          }}
        />
      ) : (
        <Overview />
      )}
      <p className="dash-foot">
        Concept preview. All figures are made up for the demo. The search understands a fixed set of words. In the full version an AI model would write
        the query and choose the chart.
      </p>
    </div>
  );
}
