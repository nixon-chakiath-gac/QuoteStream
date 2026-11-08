'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { fmtDate, statusClass } from '@/lib/client';
import type { DashRow } from '@/lib/dashboard/data';
import { fmtInt } from '@/lib/dashboard/query';
import {
  applyAsk,
  colLabel,
  DEFAULT_SORT,
  freshGrid,
  GRID_COLS,
  groupKey,
  matches,
  replyFor,
  toGridRows,
  viewRows,
  type ColKey,
  type GridRow,
  type GridState
} from '@/lib/dashboard/grid';

const PROMPTS = [
  'show only quote, customer, revenue and margin',
  'air freight for Blue Dune Energy sorted by revenue',
  'group by mode',
  'highlight margin below 12',
  'revenue over 8000, top 10',
  'add source and incoterm columns',
  'hide cost and weight',
  'reset grid'
];

const PAGE = 8;
const PER_GROUP = 3;

type Msg = { id: number; who: 'u' | 'a'; text: string; hint?: string };

function Cell({ x, k }: { x: GridRow; k: ColKey }) {
  if (k === 'id') return <td className="mono">{x.id}</td>;
  if (k === 'lane')
    return (
      <td>
        <span className="lane">
          <span className="lane-place">{x.origin}</span>
          <span className="lane-to">to</span>
          <span className="lane-place">{x.destination}</span>
        </span>
      </td>
    );
  if (k === 'date') return <td className="nowrap">{fmtDate(x.date)}</td>;
  if (k === 'status')
    return (
      <td>
        <span className={statusClass(x.status)}>{x.status}</span>
      </td>
    );
  if (k === 'margin') return <td className="num">{x.margin.toFixed(1)}%</td>;
  if (k === 'revenue' || k === 'cost' || k === 'income' || k === 'chargeableKg') return <td className="num">{fmtInt(x[k])}</td>;
  return <td className="nowrap">{x[k]}</td>;
}

export default function GridAssist({ title, rows }: { title: string; rows: DashRow[] }) {
  const all = useMemo(() => toGridRows(rows), [rows]);
  const [st, setSt] = useState<GridState>(freshGrid);
  const [flash, setFlash] = useState<{ cols: ColKey[]; n: number }>({ cols: [], n: 0 });
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 0, who: 'a', text: 'Hi Christine. Tell me how you want this grid to look. I can show or hide columns, filter, sort, group and highlight.' }
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const askBtn = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const view = useMemo(() => viewRows(all, st), [all, st]);
  const cols = st.cols.map((k) => GRID_COLS.find((c) => c.key === k)!);

  const groups = useMemo(() => {
    if (!st.group) return null;
    const map = new Map<string, GridRow[]>();
    for (const x of view) {
      const k = groupKey(x, st.group);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(x);
    }
    return [...map];
  }, [view, st.group]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!flash.cols.length) return;
    const t = setTimeout(() => setFlash((f) => ({ ...f, cols: [] })), 1200);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(next: GridState, changed: ColKey[]) {
    setSt(next);
    setShowAll(false);
    if (changed.length) setFlash((f) => ({ cols: changed, n: f.n + 1 }));
  }

  function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { id: m.length, who: 'u', text }]);
    setBusy(true);
    timer.current = setTimeout(() => {
      const r = applyAsk(st, text);
      if (r) apply(r.state, r.flash);
      setMsgs((m) => [...m, { id: m.length, who: 'a', text: replyFor(r), hint: r && !r.done[0].startsWith('Grid reset') ? 'You can undo with "reset grid".' : undefined }]);
      setBusy(false);
    }, 500);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
    setInput('');
  }

  function close() {
    setOpen(false);
    askBtn.current?.focus();
  }

  function sortBy(k: ColKey) {
    const num = GRID_COLS.find((c) => c.key === k)?.num || k === 'date';
    setSt((s) => ({ ...s, sort: { key: k, dir: s.sort.key === k ? (s.sort.dir === 1 ? -1 : 1) : num ? -1 : 1 } }));
  }

  const sorted = st.sort.key !== DEFAULT_SORT.key || st.sort.dir !== DEFAULT_SORT.dir;
  const hasState = st.filters.length > 0 || sorted || st.group || st.top || st.highlight;
  const rowsShown = groups ? null : showAll ? view : view.slice(0, PAGE);
  const truncated = groups ? groups.some(([, v]) => v.length > PER_GROUP) : view.length > PAGE;

  const row = (x: GridRow) => (
    <tr key={x.id} className={st.highlight && matches(x, st.highlight) ? 'ga-hl' : undefined}>
      {cols.map((c) => (
        <Cell key={c.key} x={x} k={c.key} />
      ))}
    </tr>
  );

  return (
    <section className="card dash-card">
      <div className="ga-layout">
        <div className="ga-grid">
          <div className="dash-hd">
            <h2>
              {title}{' '}
              <span className="muted small-text">
                ({view.length} rows, {cols.length} columns)
              </span>
            </h2>
            <div className="ga-actions">
              {hasState || st.cols.join() !== freshGrid().cols.join() ? (
                <button type="button" className="btn secondary small" onClick={() => apply(freshGrid(), [])}>
                  Reset grid
                </button>
              ) : null}
              <button
                type="button"
                ref={askBtn}
                className="ga-ask"
                aria-expanded={open}
                aria-controls="grid-assistant"
                onClick={() => (open ? close() : setOpen(true))}
              >
                <span aria-hidden="true">{'✦'}</span> Ask AI
              </button>
            </div>
          </div>
          {hasState && (
            <div className="ga-state" aria-label="Grid settings">
              {st.filters.map((f) => (
                <span key={f.id} className="chip plain info ga-chip">
                  {f.label}
                  <button type="button" aria-label={`Remove ${f.label}`} onClick={() => apply({ ...st, filters: st.filters.filter((x) => x.id !== f.id) }, [])}>
                    ×
                  </button>
                </span>
              ))}
              {sorted && (
                <span className="chip plain ok ga-chip">
                  Sorted by {colLabel(st.sort.key)} {st.sort.dir === -1 ? 'high to low' : 'low to high'}
                  <button type="button" aria-label="Remove sort" onClick={() => apply({ ...st, sort: { ...DEFAULT_SORT } }, [])}>
                    ×
                  </button>
                </span>
              )}
              {st.group && (
                <span className="chip plain ok ga-chip">
                  Grouped by {colLabel(st.group)}
                  <button type="button" aria-label="Remove grouping" onClick={() => apply({ ...st, group: null }, [])}>
                    ×
                  </button>
                </span>
              )}
              {st.top && (
                <span className="chip plain ga-chip">
                  Top {st.top}
                  <button type="button" aria-label="Remove top limit" onClick={() => apply({ ...st, top: null }, [])}>
                    ×
                  </button>
                </span>
              )}
              {st.highlight && (
                <span className="chip plain warn ga-chip">
                  Highlight: {st.highlight.label}
                  <button type="button" aria-label="Remove highlight" onClick={() => apply({ ...st, highlight: null }, [])}>
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
          <div className="table-wrap dash-table">
            <table className="t">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th
                      key={`${c.key}-${flash.cols.includes(c.key) ? flash.n : 0}`}
                      className={[c.num ? 'num' : '', flash.cols.includes(c.key) ? 'ga-flash' : ''].join(' ').trim() || undefined}
                      aria-sort={st.sort.key === c.key ? (st.sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    >
                      <button type="button" className="sort-btn" onClick={() => sortBy(c.key)}>
                        {c.label}
                        <span className="arrow" aria-hidden="true">
                          {st.sort.key === c.key ? (st.sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.length === 0 && (
                  <tr>
                    <td colSpan={cols.length} className="muted">
                      No quotations match. Remove a filter or say &quot;clear filters&quot;.
                    </td>
                  </tr>
                )}
                {groups
                  ? groups.map(([k, v]) => (
                      <Fragment key={k}>
                        <tr className="ga-group">
                          <td colSpan={cols.length}>
                            {k} | {v.length} quotations | USD {fmtInt(v.reduce((s, x) => s + x.revenue, 0))}
                          </td>
                        </tr>
                        {(showAll ? v : v.slice(0, PER_GROUP)).map(row)}
                      </Fragment>
                    ))
                  : rowsShown!.map(row)}
              </tbody>
            </table>
          </div>
          {truncated && (
            <p className="mt">
              <button type="button" className="link-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer' : `Show all ${view.length}`}
              </button>
            </p>
          )}
        </div>
        {open && (
          <aside id="grid-assistant" className="ga-panel" aria-label="Grid assistant">
            <div className="ga-head">
              <strong>
                <span aria-hidden="true">{'✦'}</span> Grid assistant <span className="concept">Concept</span>
              </strong>
              <button type="button" className="ga-close" aria-label="Close grid assistant" onClick={close}>
                ×
              </button>
            </div>
            <div className="ga-msgs" ref={listRef} aria-live="polite">
              {msgs.map((m) => (
                <div key={m.id} className={`ga-msg ${m.who}`}>
                  {m.text}
                  {m.hint && <small>{m.hint}</small>}
                </div>
              ))}
              {busy && <div className="ga-msg a muted">Thinking</div>}
            </div>
            <div className="ga-prompts" aria-label="Example prompts">
              {PROMPTS.map((p) => (
                <button key={p} type="button" disabled={busy} onClick={() => ask(p)}>
                  {p}
                </button>
              ))}
            </div>
            <form className="ga-input" onSubmit={submit}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && close()}
                placeholder="Ask about this grid"
                aria-label="Message to the grid assistant"
                autoComplete="off"
              />
              <button type="submit" className="btn small" disabled={busy || !input.trim()}>
                Send
              </button>
            </form>
          </aside>
        )}
      </div>
    </section>
  );
}

