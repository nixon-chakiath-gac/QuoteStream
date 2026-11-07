import type { Metric } from '@/lib/dashboard/parse';
import { fmtMetric, type Bucket } from '@/lib/dashboard/query';

const W = 760;
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];

function compact(metric: Metric, v: number): string {
  if (metric === 'margin') return `${v.toFixed(0)}%`;
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k` : `${Math.round(v)}`;
  return metric === 'revenue' || metric === 'income' ? s : metric === 'kg' ? `${s} kg` : s;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function tip(b: Bucket, metric: Metric) {
  return `${b.key}: ${fmtMetric(metric, b.value)} (${b.count} quotation${b.count === 1 ? '' : 's'})`;
}

function textWidth(s: string, size = 14) {
  return s.length * size * 0.56;
}

export function HBarChart({ data, metric }: { data: Bucket[]; metric: Metric }) {
  const row = 40;
  const labelW = Math.min(260, Math.max(...data.map((d) => textWidth(d.key))) + 14);
  const valueW = Math.max(...data.map((d) => textWidth(fmtMetric(metric, d.value)))) + 16;
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const span = W - labelW - valueW;
  const H = data.length * row + 8;
  return (
    <svg className="dash-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Horizontal bar chart">
      {data.map((d, i) => {
        const w = Math.max((Math.max(d.value, 0) / max) * span, 2);
        const y = i * row + 6;
        return (
          <g key={d.key}>
            <text x={labelW - 12} y={y + 20} textAnchor="end" className="lbl">
              {d.key}
            </text>
            <rect x={labelW} y={y} width={w} height={26} rx={4} fill={COLORS[i % COLORS.length]}>
              <title>{tip(d, metric)}</title>
            </rect>
            <text x={labelW + w + 8} y={y + 19} className="val">
              {fmtMetric(metric, d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Grid({ max, metric, left, top, h }: { max: number; metric: Metric; left: number; top: number; h: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((g) => {
        const y = top + (h * g) / 4;
        return (
          <g key={g}>
            <line x1={left} x2={W - 8} y1={y} y2={y} className="grid" />
            <text x={left - 8} y={y + 5} textAnchor="end" className="axis">
              {compact(metric, max * (1 - g / 4))}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function ColumnChart({ data, metric }: { data: Bucket[]; metric: Metric }) {
  const left = 70;
  const top = 12;
  const band = (W - left - 8) / Math.max(data.length, 1);
  const rotate = data.some((d) => textWidth(d.key, 13) > band - 6);
  const bottom = rotate ? Math.min(150, Math.max(...data.map((d) => textWidth(d.key, 13))) * 0.72 + 24) : 34;
  const h = 240;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  return (
    <svg className="dash-svg" viewBox={`0 0 ${W} ${top + h + bottom}`} role="img" aria-label="Column chart">
      <Grid max={max} metric={metric} left={left} top={top} h={h} />
      {data.map((d, i) => {
        const bh = (Math.max(d.value, 0) / max) * h;
        const cx = left + i * band + band / 2;
        const ly = top + h + 20;
        return (
          <g key={d.key}>
            <rect x={cx - band * 0.32} y={top + h - bh} width={band * 0.64} height={Math.max(bh, 1)} rx={3} fill="var(--c1)">
              <title>{tip(d, metric)}</title>
            </rect>
            <text
              x={cx}
              y={ly}
              textAnchor={rotate ? 'end' : 'middle'}
              transform={rotate ? `rotate(-40 ${cx} ${ly - 6})` : undefined}
              className="axis"
            >
              {d.key}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ data, metric }: { data: Bucket[]; metric: Metric }) {
  const left = 70;
  const top = 12;
  const h = 240;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const step = (W - left - 50) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => [left + 10 + i * step, top + h - (Math.max(d.value, 0) / max) * h] as const);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
  const every = data.length > 8 ? 2 : 1;
  return (
    <svg className="dash-svg" viewBox={`0 0 ${W} ${top + h + 36}`} role="img" aria-label="Line chart">
      <Grid max={max} metric={metric} left={left} top={top} h={h} />
      {pts.length > 1 && (
        <>
          <path d={`M${line} L${pts[pts.length - 1][0]},${top + h} L${pts[0][0]},${top + h} Z`} fill="var(--c1)" opacity={0.12} />
          <path d={`M${line}`} fill="none" stroke="var(--c1)" strokeWidth={3} />
        </>
      )}
      {data.map((d, i) => (
        <g key={d.key}>
          <circle cx={pts[i][0]} cy={pts[i][1]} r={5} fill="var(--c1)">
            <title>{tip(d, metric)}</title>
          </circle>
          {(i % every === 0 || i === data.length - 1) && (
            <text x={pts[i][0]} y={top + h + 24} textAnchor="middle" className="axis">
              {d.key}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function DonutChart({ data, metric }: { data: Bucket[]; metric: Metric }) {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const R = 110;
  const r = 70;
  let a = -Math.PI / 2;
  const pt = (ang: number, rad: number) => `${(Math.cos(ang) * rad).toFixed(2)},${(Math.sin(ang) * rad).toFixed(2)}`;
  return (
    <div className="donut-wrap">
      <svg className="dash-svg donut" viewBox="-120 -120 240 240" role="img" aria-label="Donut chart">
        {data.map((d, i) => {
          const f = Math.max(d.value, 0) / total;
          if (f <= 0) return null;
          const e = a + Math.min(f, 0.99999) * 2 * Math.PI;
          const large = f > 0.5 ? 1 : 0;
          const path = `M${pt(a, R)} A${R},${R} 0 ${large} 1 ${pt(e, R)} L${pt(e, r)} A${r},${r} 0 ${large} 0 ${pt(a, r)} Z`;
          a = e;
          return (
            <path key={d.key} d={path} fill={COLORS[i % COLORS.length]}>
              <title>{tip(d, metric)}</title>
            </path>
          );
        })}
        <text textAnchor="middle" y={6} className="center">
          {(metric === 'revenue' || metric === 'income' ? 'USD ' : '') + compact(metric, metric === 'margin' ? total / data.length : total)}
        </text>
      </svg>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.key} title={tip(d, metric)}>
            <i style={{ background: COLORS[i % COLORS.length] }} />
            <span className="name">{d.key}</span>
            <span className="pct">{Math.round((Math.max(d.value, 0) / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
