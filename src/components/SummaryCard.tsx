import React, { ReactNode } from 'react';
import { formatCurrency } from '../utils/format';

interface SummaryCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'teal' | 'sky' | 'orange';
  subtitle?: string;
  highlight?: boolean;
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   text: 'text-blue-700',   border: 'border-blue-100' },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600', text: 'text-green-700',  border: 'border-green-100' },
  amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700',  border: 'border-amber-100' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',     text: 'text-red-700',    border: 'border-red-100' },
  slate:  { bg: 'bg-slate-50',  icon: 'bg-slate-100 text-slate-600', text: 'text-slate-700',  border: 'border-slate-200' },
  teal:   { bg: 'bg-teal-50',   icon: 'bg-teal-100 text-teal-600',   text: 'text-teal-700',   border: 'border-teal-100' },
  sky:    { bg: 'bg-sky-50',    icon: 'bg-sky-100 text-sky-600',     text: 'text-sky-700',    border: 'border-sky-100' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', text: 'text-orange-700', border: 'border-orange-100' },
};

export default function SummaryCard({ label, value, icon, color, subtitle, highlight }: SummaryCardProps) {
  const c = colorMap[color];
  return (
    <div className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${highlight ? 'ring-2 ring-amber-400' : ''} ${c.bg} ${c.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
        {highlight && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Attention</span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>{formatCurrency(value)}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}
