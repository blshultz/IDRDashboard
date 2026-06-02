import React, { useMemo } from 'react';
import { DollarSign, AlertCircle, CreditCard, FileDown, Printer, RefreshCw, Info } from 'lucide-react';
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
  const headers = ['Procedure ID', 'Provider Portion of Collected Funds', 'Provider Paid', 'Balance Due', 'Claim No', 'Award Code'];
  const rows = procedures.map(p => [
    p.procedureId,
    p.providerOwed.toFixed(2),
    p.providerPaid.toFixed(2),
    p.providerBalanceOwed.toFixed(2),
    p.claimNumber ?? '',
    p.awardCode ?? '',
  ]);
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
  const hasBalance = p.providerBalanceOwed > 0;
  return (
    <tr className={hasBalance ? 'bg-amber-50/40' : ''}>
      <td className="px-4 py-3 text-sm font-mono text-slate-700">{p.procedureId}</td>
      <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-700">{formatCurrency(p.providerOwed)}</td>
      <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-700">{formatCurrency(p.providerPaid)}</td>
      <td className="px-4 py-3 text-sm text-right tabular-nums">
        <span className={hasBalance ? 'text-amber-700 font-medium' : 'text-slate-700'}>
          {formatCurrency(p.providerBalanceOwed)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-mono text-slate-600">{p.claimNumber || '—'}</td>
      <td className="px-4 py-3 text-sm font-mono text-slate-600">{p.awardCode || '—'}</td>
    </tr>
  );
}

export default function DoctorDashboard({ procedures, providerName, onRefetch }: Props) {
  const summary = useMemo(() => computeSummary(procedures), [procedures]);
  const balanceOwedPct = summary.providerOwed > 0
    ? ((summary.providerBalanceOwed / summary.providerOwed) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-8 print:space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{providerName}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Financial Dashboard — Procedure Summary</p>
        </div>
        <div className="flex gap-2">
          {onRefetch && (
            <button
              onClick={onRefetch}
              className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />Refresh
            </button>
          )}
          <button
            onClick={() => exportDoctorCsv(procedures, providerName)}
            className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />Print Report
          </button>
        </div>
      </div>
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold text-slate-800">{providerName} — Financial Report</h1>
        <p className="text-sm text-slate-500">Generated: {new Date().toLocaleString()}</p>
      </div>

      {/* ── 3 Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Provider Portion of Collected Funds"
          value={summary.providerOwed}
          icon={<DollarSign className="w-5 h-5" />}
          color="teal"
        />
        <SummaryCard
          label="Provider Paid"
          value={summary.providerPaid}
          icon={<CreditCard className="w-5 h-5" />}
          color="green"
        />
        <SummaryCard
          label="Balance Due"
          value={summary.providerBalanceOwed}
          icon={<AlertCircle className="w-5 h-5" />}
          color="amber"
          highlight={summary.providerBalanceOwed > 0}
          subtitle={`${balanceOwedPct}% of collected`}
        />
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-4">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 leading-relaxed">
          This dashboard reflects live financial data based on reported claim and deposit activity.
          Negative balances indicate funds deposited by the provider in excess of their portion and
          are owed back. Values may update as additional insurance payments, arbitration awards, or
          deposits are received and processed.
        </p>
      </div>

      {/* ── Procedure Details table ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Procedure Details</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {procedures.length} procedures
          </span>
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
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Provider Portion of Collected Funds</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Provider Paid</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Balance Due</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Claim No</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Award Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {procedures.map(p => <ProcedureRow key={p.procedureId} procedure={p} />)}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Totals</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-slate-800">{formatCurrency(summary.providerOwed)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-slate-800">{formatCurrency(summary.providerPaid)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-amber-700">{formatCurrency(summary.providerBalanceOwed)}</td>
                    <td />
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
