import React, { useMemo } from 'react';
import { DollarSign, AlertCircle, CreditCard, FileDown, Printer, RefreshCw, Info, Clock, TrendingUp } from 'lucide-react';
import { Procedure } from '../types';
import { computeSummary, computePendingReceivable } from '../data/mockData';
import { formatCurrency } from '../utils/format';
import SummaryCard from './SummaryCard';

interface Props {
  procedures: Procedure[];
  providerName: string;
  onRefetch?: () => void;
}

function exportDoctorCsv(procedures: Procedure[], providerName: string) {
  const collectedHeaders = [
    'Procedure ID',
    'Collected Provider Funds',
    'Provider Payments Received',
    'Collected Funds Awaiting Payment',
    'Claim No',
    'Award Code',
  ];
  const collectedRows = procedures.map(p => [
    p.procedureId,
    p.providerOwed.toFixed(2),
    p.providerPaid.toFixed(2),
    p.providerBalanceOwed.toFixed(2),
    p.claimNumber ?? '',
    p.awardCode ?? '',
  ]);

  const pendingHeaders = ['Procedure ID', 'Pending Provider Receivable'];
  const pendingRows = procedures
    .map(p => ({ id: p.procedureId, val: computePendingReceivable(p) }))
    .filter(r => r.val > 0)
    .map(r => [r.id, r.val.toFixed(2)]);

  const sections = [
    'Collected Funds Procedure Details',
    [collectedHeaders, ...collectedRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n'),
    '',
    'Pending Receivables',
    [pendingHeaders, ...pendingRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n'),
  ];

  const csv = sections.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${providerName.replace(/\s+/g, '-')}-report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Collected Funds table row ────────────────────────────────────── */
function CollectedRow({ procedure: p }: { procedure: Procedure }) {
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

/* ── Pending Receivables table row ────────────────────────────────── */
function PendingRow({ procedure: p, pending }: { procedure: Procedure; pending: number }) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm font-mono text-slate-700">{p.procedureId}</td>
      <td className="px-4 py-3 text-sm text-right tabular-nums font-medium text-sky-700">
        {formatCurrency(pending)}
      </td>
    </tr>
  );
}

/* ── Main component ───────────────────────────────────────────────── */
export default function DoctorDashboard({ procedures, providerName, onRefetch }: Props) {
  const summary = useMemo(() => computeSummary(procedures), [procedures]);

  const balanceOwedPct = summary.providerOwed > 0
    ? ((summary.providerBalanceOwed / summary.providerOwed) * 100).toFixed(1)
    : '0';

  /** Only show rows where something has already been collected for the doctor.
   *  Zero-providerOwed rows (e.g. pure-award procedures with no deposits yet)
   *  are excluded from the Collected Funds table — they may still appear below
   *  in Pending Receivables if they have a positive pending amount. */
  const collectedRows = useMemo(
    () => procedures.filter(p => p.providerOwed > 0),
    [procedures]
  );

  /** Rows with a positive pending receivable, sorted by amount descending.
   *  Independent of collectedRows — a procedure can appear here even if
   *  providerOwed is $0. */
  const pendingRows = useMemo(
    () =>
      procedures
        .map(p => ({ procedure: p, pending: computePendingReceivable(p) }))
        .filter(r => r.pending > 0)
        .sort((a, b) => b.pending - a.pending),
    [procedures]
  );

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

      {/* ── 4 Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Collected Provider Funds"
          value={summary.providerOwed}
          icon={<DollarSign className="w-5 h-5" />}
          color="teal"
        />
        <SummaryCard
          label="Provider Payments Received"
          value={summary.providerPaid}
          icon={<CreditCard className="w-5 h-5" />}
          color="green"
        />
        <SummaryCard
          label="Collected Funds Awaiting Payment"
          value={summary.providerBalanceOwed}
          icon={<AlertCircle className="w-5 h-5" />}
          color="amber"
          highlight={summary.providerBalanceOwed > 0}
          subtitle={summary.providerBalanceOwed > 0 ? `${balanceOwedPct}% of collected` : undefined}
        />
        <SummaryCard
          label="Pending Provider Receivables"
          value={summary.pendingProviderReceivable}
          icon={<Clock className="w-5 h-5" />}
          color="sky"
          subtitle={summary.pendingProviderReceivable > 0 ? 'From allowed funds not yet collected' : 'No pending receivables'}
        />
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-4">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 leading-relaxed">
          This dashboard reflects live financial data based on reported claim and deposit activity.
          <strong className="font-semibold"> Collected Provider Funds</strong> represent your share of amounts already deposited.
          <strong className="font-semibold"> Pending Provider Receivables</strong> represent your estimated share of allowed award
          funds that have not yet been collected or deposited. Pending amounts may change as payments are processed.
        </p>
      </div>

      {/* ── Collected Funds Procedure Details table ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Collected Funds Procedure Details</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {collectedRows.length} procedure{collectedRows.length !== 1 ? 's' : ''}
          </span>
        </div>
        {collectedRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">No collected procedures found for your account.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Procedure ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Collected Provider Funds</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Provider Payments Received</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Collected Funds Awaiting Payment</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Claim No</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Award Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collectedRows.map(p => <CollectedRow key={p.procedureId} procedure={p} />)}
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

      {/* ── Pending Receivables section ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-500" />
            <h2 className="text-lg font-semibold text-slate-700">Pending Receivables</h2>
          </div>
          {pendingRows.length > 0 && (
            <span className="text-xs text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">
              {pendingRows.length} procedure{pendingRows.length !== 1 ? 's' : ''} pending
            </span>
          )}
        </div>

        {pendingRows.length === 0 ? (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-8 text-center">
            <Clock className="w-8 h-8 text-sky-300 mx-auto mb-3" />
            <p className="text-sky-700 text-sm font-medium">No pending receivables</p>
            <p className="text-sky-500 text-xs mt-1">All expected funds have been collected or are accounted for.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
            <div className="bg-sky-50 border-b border-sky-100 px-4 py-2.5 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
              <p className="text-xs text-sky-700">
                Estimated provider share of allowed award funds not yet collected or deposited. Amounts are subject to change.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-sky-100 bg-sky-50/60">
                    <th className="px-4 py-3 text-xs font-semibold text-sky-700 uppercase tracking-wide">Procedure ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-sky-700 uppercase tracking-wide text-right">Pending Provider Receivable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingRows.map(({ procedure, pending }) => (
                    <PendingRow key={procedure.procedureId} procedure={procedure} pending={pending} />
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-sky-200 bg-sky-50/60">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold text-sky-700 uppercase tracking-wide">Total Pending</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-sky-700">
                      {formatCurrency(summary.pendingProviderReceivable)}
                    </td>
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
