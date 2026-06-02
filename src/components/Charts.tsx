import React, { useMemo } from 'react';
import { Procedure } from '../types';
import { formatCurrency } from '../utils/format';

/* ─── Shared types ─────────────────────────────────────────── */
interface BarData {
  label: string;
  values: { value: number; color: string; name: string }[];
}

/* ─── Grouped Bar Chart ─────────────────────────────────────── */
function GroupedBarChart({
  title,
  data,
  height = 240,
}: {
  title: string;
  data: BarData[];
  height?: number;
}) {
  const PAD = { top: 24, right: 16, bottom: 52, left: 80 };
  const W = 600;
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = data.flatMap(d => d.values.map(v => v.value));
  const maxVal = Math.max(...allValues, 1);

  const groupW = innerW / data.length;
  const barPad = groupW * 0.15;
  const barW = (groupW - barPad * 2) / (data[0]?.values.length || 1);

  const yTicks = 5;
  const colors = data[0]?.values.map(v => v.color) ?? [];
  const names = data[0]?.values.map(v => v.name) ?? [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {names.map((name, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colors[i] }} />
            {name}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Y-axis gridlines */}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const y = innerH - (i / yTicks) * innerH;
            const val = (i / yTicks) * maxVal;
            return (
              <g key={i}>
                <line x1={0} y1={y} x2={innerW} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                <text x={-8} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
                  {val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val.toFixed(0)}`}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((group, gi) => {
            const gx = gi * groupW + barPad;
            return (
              <g key={gi}>
                {group.values.map((v, vi) => {
                  const bh = (v.value / maxVal) * innerH;
                  const bx = gx + vi * barW;
                  const by = innerH - bh;
                  return (
                    <g key={vi}>
                      <rect
                        x={bx} y={by}
                        width={barW - 2} height={bh}
                        fill={v.color}
                        rx={3}
                        className="transition-all duration-300"
                      />
                      {bh > 24 && (
                        <text
                          x={bx + (barW - 2) / 2}
                          y={by + 14}
                          textAnchor="middle"
                          fontSize={9}
                          fill="white"
                          fontWeight="600"
                        >
                          {v.value >= 1000 ? `$${(v.value / 1000).toFixed(0)}k` : `$${v.value}`}
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* X label */}
                <text
                  x={gx + (groupW - barPad * 2) / 2}
                  y={innerH + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  {group.label.length > 14 ? group.label.slice(0, 13) + '…' : group.label}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#cbd5e1" strokeWidth={1} />
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#cbd5e1" strokeWidth={1} />
        </g>
      </svg>
    </div>
  );
}

/* ─── Donut Chart ───────────────────────────────────────────── */
export function DonutChart({
  title,
  segments,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 70;
  const CX = 100;
  const CY = 100;

  let angle = -Math.PI / 2;
  const paths = segments.map(seg => {
    const frac = total > 0 ? seg.value / total : 0;
    const sweep = frac * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const ir = R * 0.55;
    const ix1 = CX + ir * Math.cos(angle);
    const iy1 = CY + ir * Math.sin(angle);
    const ix2 = CX + ir * Math.cos(angle - sweep);
    const iy2 = CY + ir * Math.sin(angle - sweep);
    return { ...seg, frac, path: `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${largeArc} 0 ${ix2} ${iy2} Z` };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-40 h-40 flex-shrink-0">
          {paths.map((p, i) => (
            <path key={i} d={p.path} fill={p.color} stroke="white" strokeWidth={2} />
          ))}
          <text x={CX} y={CY - 6} textAnchor="middle" fontSize={9} fill="#94a3b8">Total</text>
          <text x={CX} y={CY + 8} textAnchor="middle" fontSize={10} fill="#1e293b" fontWeight="700">
            {total >= 1000000 ? `$${(total / 1000000).toFixed(1)}M` : `$${(total / 1000).toFixed(0)}K`}
          </text>
        </svg>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 truncate">{seg.label}</p>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(seg.value)}</p>
              </div>
              <span className="text-xs text-slate-400">
                {total > 0 ? ((seg.value / total) * 100).toFixed(1) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Horizontal Bar Chart (provider breakdown) ─────────────── */
function HorizontalBarChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((d, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span className="truncate max-w-[160px]">{d.label}</span>
              <span className="font-medium text-slate-700">{formatCurrency(d.value)}</span>
            </div>
            <div className="h-6 bg-slate-100 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Charts component ─────────────────────────────────── */
interface ChartsProps {
  procedures: Procedure[];
}

const PROVIDER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Charts({ procedures }: ChartsProps) {
  const depositData = useMemo((): BarData[] => {
    if (procedures.length <= 6) {
      return procedures.map(p => ({
        label: p.procedureId.slice(-6),
        values: [
          { value: p.totalDeposited, color: '#3b82f6', name: 'Deposited' },
          { value: p.undepositedTotal, color: '#f59e0b', name: 'Undeposited' },
        ],
      }));
    }
    // Aggregate by month
    const months = new Map<string, { deposited: number; undeposited: number }>();
    procedures.forEach(p => {
      const key = p.date.slice(0, 7);
      const cur = months.get(key) ?? { deposited: 0, undeposited: 0 };
      months.set(key, {
        deposited: cur.deposited + p.totalDeposited,
        undeposited: cur.undeposited + p.undepositedTotal,
      });
    });
    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, val]) => ({
        label: key,
        values: [
          { value: val.deposited, color: '#3b82f6', name: 'Deposited' },
          { value: val.undeposited, color: '#f59e0b', name: 'Undeposited' },
        ],
      }));
  }, [procedures]);

  const providerTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    procedures.forEach(p => {
      const cur = map.get(p.providerId) ?? { name: p.providerName, total: 0 };
      map.set(p.providerId, { name: cur.name, total: cur.total + p.procedureTotal });
    });
    return Array.from(map.entries())
      .map(([, v], i) => ({ label: v.name, value: v.total, color: PROVIDER_COLORS[i % PROVIDER_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [procedures]);

  const providerFinancials = useMemo(() => {
    const paid = procedures.reduce((s, p) => s + p.providerPaid, 0);
    const owed = procedures.reduce((s, p) => s + p.providerBalanceOwed, 0);
    return [
      { label: 'Provider Paid', value: paid, color: '#10b981' },
      { label: 'Balance Owed', value: owed, color: '#ef4444' },
    ];
  }, [procedures]);

  const bhacFinancials = useMemo(() => {
    const retained = procedures.reduce((s, p) => s + p.bhacRetainedToDate, 0);
    const owed = procedures.reduce((s, p) => s + p.bhacBalanceOwed, 0);
    return [
      { label: 'BHAC Retained', value: retained, color: '#3b82f6' },
      { label: 'BHAC Balance Owed', value: owed, color: '#f59e0b' },
    ];
  }, [procedures]);

  if (!procedures.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-5">
      {depositData.length > 0 && (
        <div className="lg:col-span-2">
          <GroupedBarChart
            title="Total Deposited vs Undeposited by Period"
            data={depositData}
          />
        </div>
      )}

      <DonutChart
        title="Provider Paid vs Balance Owed"
        segments={providerFinancials}
      />

      <DonutChart
        title="BHAC Retained to Date vs Balance Owed"
        segments={bhacFinancials}
      />

      {providerTotals.length > 1 && (
        <div className="lg:col-span-2">
          <HorizontalBarChart
            title="Procedure Total by Provider"
            data={providerTotals}
          />
        </div>
      )}
    </div>
  );
}
