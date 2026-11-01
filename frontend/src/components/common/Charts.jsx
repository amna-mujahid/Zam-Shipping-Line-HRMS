import React, { useRef, useState } from 'react';

// Categorical slots in fixed order (validated reference palette, light mode).
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

const Tooltip = ({ tip }) =>
  tip ? (
    <div
      className="pointer-events-none absolute z-10 bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-[11px] min-w-[120px]"
      style={{ left: tip.x, top: tip.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
    >
      <div className="text-slate-500 mb-1">{tip.title}</div>
      {tip.rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="w-3 h-0.5 rounded" style={{ background: r.color }} />}
          <span className="font-bold text-slate-900 font-tabular-data">{r.value}</span>
          <span className="text-slate-500">{r.label}</span>
        </div>
      ))}
    </div>
  ) : null;

const ViewToggle = ({ table, setTable }) => (
  <button type="button" onClick={() => setTable(!table)} className="text-[10px] font-mono font-bold text-sky-700 hover:underline">
    {table ? 'Show chart' : 'Show table'}
  </button>
);

const DataTable = ({ head, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] font-mono uppercase text-slate-500 border-b border-slate-200">
          {head.map((h) => <th key={h} className="py-1.5 pr-3">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className={`py-1.5 pr-3 ${j ? 'font-tabular-data' : ''}`}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Horizontal single-series bar chart. data: [{ label, value }] */
export const HBarChart = ({ data, format = (v) => v, color = SERIES_COLORS[0], valueLabel = 'Value' }) => {
  const [tip, setTip] = useState(null);
  const [table, setTable] = useState(false);
  const ref = useRef(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  const show = (e, d) => {
    const box = ref.current.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title: d.label, rows: [{ label: valueLabel, value: format(d.value), color }] });
  };

  return (
    <div>
      <div className="flex justify-end mb-1"><ViewToggle table={table} setTable={setTable} /></div>
      {table ? (
        <DataTable head={['Category', valueLabel]} rows={data.map((d) => [d.label, format(d.value)])} />
      ) : (
        <div ref={ref} className="relative space-y-1.5" onPointerLeave={() => setTip(null)}>
          {data.map((d) => (
            <div
              key={d.label}
              className="grid grid-cols-[minmax(90px,30%)_1fr_auto] items-center gap-2 text-[11px] py-0.5 rounded hover:bg-slate-50 cursor-default"
              onPointerMove={(e) => show(e, d)}
              tabIndex={0}
              onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); const b = ref.current.getBoundingClientRect(); setTip({ x: r.left - b.left + r.width / 2, y: r.top - b.top, title: d.label, rows: [{ label: valueLabel, value: format(d.value), color }] }); }}
              onBlur={() => setTip(null)}
            >
              <span className="text-slate-600 truncate">{d.label}</span>
              <span className="h-4 bg-slate-100/60 rounded-r">
                <span className="block h-full rounded-r" style={{ width: `${(d.value / max) * 100}%`, background: color, minWidth: d.value > 0 ? 2 : 0 }} />
              </span>
              <span className="text-slate-900 font-bold font-tabular-data text-right min-w-[48px]">{format(d.value)}</span>
            </div>
          ))}
          <Tooltip tip={tip} />
        </div>
      )}
    </div>
  );
};

const topRounded = (x, y, w, h, r) => {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};

/**
 * Stacked column chart.
 * series: [{ key, label }]  rows: [{ label, short, values: { [key]: n } }]
 */
export const StackedColumns = ({ series, rows, height = 180 }) => {
  const [tip, setTip] = useState(null);
  const [table, setTable] = useState(false);
  const ref = useRef(null);
  const W = 640;
  const padL = 28;
  const padB = 22;
  const plotH = height - padB - 6;
  const max = Math.max(1, ...rows.map((r) => series.reduce((a, s) => a + (r.values[s.key] || 0), 0)));
  const colW = (W - padL) / Math.max(1, rows.length);
  const barW = Math.max(3, Math.min(22, colW - 4));
  const ticks = [0, Math.ceil(max / 2), max];
  const labelEvery = Math.ceil(rows.length / 12);
  const colored = series.map((s, i) => ({ ...s, color: s.color || SERIES_COLORS[i] }));

  const showFor = (r, cx) => {
    const box = ref.current.getBoundingClientRect();
    const scale = box.width / W;
    setTip({
      x: cx * scale,
      y: 12,
      title: r.label,
      rows: colored.map((s) => ({ label: s.label, value: r.values[s.key] || 0, color: s.color })),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {colored.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <ViewToggle table={table} setTable={setTable} />
      </div>
      {table ? (
        <DataTable head={['Date', ...colored.map((s) => s.label)]} rows={rows.map((r) => [r.label, ...colored.map((s) => r.values[s.key] || 0)])} />
      ) : (
        <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" role="img" aria-label="Stacked attendance by day">
            {ticks.map((t) => {
              const y = 6 + plotH - (t / max) * plotH;
              return (
                <g key={t}>
                  <line x1={padL} x2={W} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">{t}</text>
                </g>
              );
            })}
            {rows.map((r, i) => {
              const cx = padL + i * colW + colW / 2;
              let yCursor = 6 + plotH;
              const segs = colored
                .map((s) => ({ s, v: r.values[s.key] || 0 }))
                .filter((x) => x.v > 0);
              return (
                <g key={r.label}>
                  {segs.map(({ s, v }, j) => {
                    const h = (v / max) * plotH;
                    const y = yCursor - h;
                    yCursor = y;
                    const hh = Math.max(0, h - (j > 0 ? 2 : 0)); // 2px surface gap between segments
                    return j === segs.length - 1 ? (
                      <path key={s.key} d={topRounded(cx - barW / 2, y, barW, hh, 3)} fill={s.color} />
                    ) : (
                      <rect key={s.key} x={cx - barW / 2} y={y} width={barW} height={hh} fill={s.color} />
                    );
                  })}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={height - 6} textAnchor="middle" fontSize="9" fill="#64748b">{r.short}</text>
                  )}
                  <rect
                    x={cx - colW / 2} y={0} width={colW} height={6 + plotH} fill="transparent"
                    onPointerMove={() => showFor(r, cx)}
                  />
                </g>
              );
            })}
          </svg>
          <Tooltip tip={tip} />
        </div>
      )}
    </div>
  );
};
