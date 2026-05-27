import React, { useMemo, useState } from 'react';
import { DollarSign, Wallet, AlertCircle, CreditCard, FileDown, Printer, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Procedure } from '../types';
import { computeSummary } from '../data/mockData';
import { formatCurrency } from '../utils/format';
import SummaryCard from './SummaryCard';

interface Props {
  procedures: Procedure[];
  providerName: string;
  onRefetch?: () => void;
}

function exportDoctorCsv(procedures: Procedure[], providerName: string) {
  const headers = ['Procedure ID', 'Claim #', 'Award Code', 'Procedure Total', 'Provider Owed', 'Provider Paid', 'Provider Balance Owed'];
  const rows = procedures.map(p => [p.procedureId, p.claimNumber ?? '', p.awardCode ?? '', p.procedureTotal.toFixed(2), p.providerOwed.toFixed(2), p.providerPaid.toFixed(2), p.providerBalanceOwed.toFixed(2)]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${providerName.replace(/\s+/g, '-')}-report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ProcedureRow({ procedure: p }: { procedure: Procedure }) {
  const [expanded, setExpanded] = useState(false);
  const hasBalance = p.providerBalanceOwed > 0;
  return (
    <>
      <tr onClick={() => setExpanded(v => !v)} className={`cursor-pointer transition-colors ${hasBalance ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
        <td className="px-4 py-3 text-sm font-mono text-slate-700">{p.procedureId}</td>
        <td className="px-4 py-3 text-sm font-mono text-slate-600">{p.claimNumber || '—'}</td>
        <td className="px-4 py-3 text-sm font-mono text-slate-600">{p.awardCode || '—'}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-700">{formatCurrency(p.procedureTotal)}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-700">{formatCurrency(p.providerOwed)}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-700">{formatCurrency(p.providerPaid)}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">
          <span className={hasBalance ? 'text-amber-700 font-medium' : 'text-slate-700'}>{formatCurrency(p.providerBalanceOwed)}</span>
        </td>
        <td className="px-4 py-3 text-slate-400">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</td>
      </tr>
      {expanded && (
        <tr className="bg-blue-50/50 border-t border-blue-100">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Procedure Total', value: p.procedureTotal, color: 'text-blue-700' },
                { label: 'Total Deposited', value: p.totalDeposited, color: 'text-green-700' },
                { label: 'Provider Owed', value: p.providerOwed, color: 'text-slate-700' },
                { label: 'Provider Paid', value: p.providerPaid, color: 'text-slate-700' },
                { label: 'Provider Balance Owed', value: p.providerBalanceOwed, color: p.providerBalanceOwed > 0 ? 'text-amber-700' : 'text-slate-700' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className={`text-sm font-semibold tabular-nums ${item.color}`}>{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DoctorDashboard({ procedures, providerName, onRefetch }: Props) {
  const summary = useMemo(() => computeSummary(procedures), [procedures]);
  const balanceOwedPct = summary.providerOwed > 0 ? ((summary.providerBalanceOwed / summary.providerOwed) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-8 print:space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{providerName}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Financial Dashboard — Procedure Summary</p>
        </div>
        <div className="flex gap-2">
          {onRefetch && (
            <button onClick={onRefetch} className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm">
              <RefreshCw className="w-4 h-4" />Refresh
            </button>
          )}
          <button onClick={() => exportDoctorCsv(procedures, providerName)} className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm">
            <FileDown className="w-4 h-4" />Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
            <Printer className="w-4 h-4" />Print Report
          </button>
        </div>
      </div>
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold text-slate-800">{providerName} — Financial Report</h1>
        <p className="text-sm text-slate-500">Generated: {new Date().toLocaleString()}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Procedure Total" value={summary.procedureTotal} icon={<DollarSign className="w-5 h-5" />} color="blue" />
        <SummaryCard label="Provider Owed" value={summary.providerOwed} icon={<Wallet className="w-5 h-5" />} color="teal" />
        <SummaryCard label="Provider Paid" value={summary.providerPaid} icon={<CreditCard className="w-5 h-5" />} color="green" />
        <SummaryCard label="Provider Balance Owed" value={summary.providerBalanceOwed} icon={<AlertCircle className="w-5 h-5" />} color="amber" highlight={summary.providerBalanceOwed > 0} subtitle={`${balanceOwedPct}% of owed`} />
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-4">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 leading-relaxed">
          This dashboard reflects live financial data based on reported claim and deposit activity. Outstanding balances are commonly tied to claims or awards that have been approved but not yet deposited. Values may update as additional insurance payments, arbitration awards, or deposits are received and processed.
        </p>
      </div>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Procedure Details</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{procedures.length} procedures — click a row to expand</span>
        </div>
        {procedures.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">No procedures found for your account.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Procedure ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Claim #</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Award Code</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Procedure Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Provider Owed</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Provider Paid</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Balance Owed</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {procedures.map(p => <ProcedureRow key={p.procedureId} procedure={p} />)}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals</td>
                    <td />
                    <td />
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-slate-800">{formatCurrency(summary.procedureTotal)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-slate-800">{formatCurrency(summary.providerOwed)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-slate-800">{formatCurrency(summary.providerPaid)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-amber-700">{formatCurrency(summary.providerBalanceOwed)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
