import React, { useState, useMemo } from 'react';
import {
  Users, ChevronDown, ChevronUp, RefreshCw, FileDown, Printer,
  DollarSign, Wallet, TrendingUp, Percent, AlertTriangle, CreditCard, CheckCircle, AlertCircle,
  Search, Filter, X, Clock
} from 'lucide-react';
import { Procedure, FilterState } from '../types';
import { getProceduresByProviderName, computeSummary } from '../data/mockData';
import { formatCurrency } from '../utils/format';
import SummaryCard from './SummaryCard';

interface Props {
  procedures: Procedure[];
  onRefetch: () => void;
}

const EMPTY_FILTERS: FilterState = { search: '', providerId: '', dateFrom: '', dateTo: '', outstandingOnly: false };

function exportAdminCsv(procedures: Procedure[]) {
  const headers = ['Procedure ID','Provider Name','Total Claim Paid','Total Awards','Total Allowed','Total Deposited','Undeposited Total','Provider Collected Funds Payable','Provider Paid','Provider Open Balance','IDR Team Commission Earned','BHAC Net Expected','BHAC Retained to Date','BHAC Receivable'];
  const rows = procedures.map(p => [p.procedureId,p.providerName,p.totalClaimPaid.toFixed(2),p.totalAwards.toFixed(2),p.procedureTotal.toFixed(2),p.totalDeposited.toFixed(2),p.undepositedTotal.toFixed(2),p.providerOwed.toFixed(2),p.providerPaid.toFixed(2),p.providerBalanceOwed.toFixed(2),p.idrTeamCommission.toFixed(2),p.bhacNetExpected.toFixed(2),p.bhacRetainedToDate.toFixed(2),p.bhacBalanceOwed.toFixed(2)]);
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`bhac-admin-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ── Claims vs Awards pie chart card ─────────────────────────────────── */
function PieChartCard({ claimsTotal, awardsTotal }: { claimsTotal: number; awardsTotal: number }) {
  const total = claimsTotal + awardsTotal;
  const r = 26;
  const sw = 10;
  const circ = 2 * Math.PI * r;
  const claimsArc = total > 0 ? (claimsTotal / total) * circ : circ / 2;
  const awardsArc = total > 0 ? (awardsTotal / total) * circ : circ / 2;
  const claimsPct = total > 0 ? Math.round((claimsTotal / total) * 100) : 0;
  const awardsPct = 100 - claimsPct;

  return (
    <div className="rounded-xl border p-5 bg-blue-50 border-blue-100 transition-shadow hover:shadow-md">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Claims vs Awards
      </p>
      <div className="flex items-center gap-3">
        {/* Donut chart — rotated -90° so arc starts at 12 o'clock */}
        <svg width="64" height="64" viewBox="0 0 64 64" className="flex-shrink-0" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track (blue-200) */}
          <circle cx="32" cy="32" r={r} fill="none" stroke="#bfdbfe" strokeWidth={sw} />
          {/* Claims arc — blue-600 */}
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke="#2563eb" strokeWidth={sw}
            strokeDasharray={`${claimsArc} ${circ}`}
            strokeLinecap="butt"
          />
          {/* Awards arc — teal-500, starts after claims arc */}
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke="#14b8a6" strokeWidth={sw}
            strokeDasharray={`${awardsArc} ${circ}`}
            strokeDashoffset={-claimsArc}
            strokeLinecap="butt"
          />
        </svg>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 min-w-0 flex-1">
          <div>
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-blue-600 flex-shrink-0" />
                <span className="text-xs text-slate-500">Claims</span>
              </div>
              <span className="text-xs text-slate-400">{claimsPct}%</span>
            </div>
            <p className="text-sm font-bold text-blue-700 tabular-nums pl-3.5">{formatCurrency(claimsTotal)}</p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-teal-500 flex-shrink-0" />
                <span className="text-xs text-slate-500">Awards</span>
              </div>
              <span className="text-xs text-slate-400">{awardsPct}%</span>
            </div>
            <p className="text-sm font-bold text-teal-700 tabular-nums pl-3.5">{formatCurrency(awardsTotal)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Per-provider accordion row ──────────────────────────────────────── */
function ProviderSection({ providerName, procedures }: { providerName: string; procedures: Procedure[] }) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => computeSummary(procedures), [procedures]);
  const hasBalance = summary.providerBalanceOwed > 0 || summary.bhacBalanceOwed > 0;
  const initials = providerName.split(' ').filter(w=>/[A-Z]/i.test(w)).map(w=>w[0].toUpperCase()).join('').slice(0,2) || providerName.slice(0,2).toUpperCase();

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${hasBalance ? 'border-amber-200' : 'border-slate-200'}`}>
      <button onClick={() => setOpen(v=>!v)} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">

        {/* Avatar + name */}
        <div className="flex items-center gap-3 flex-shrink-0 w-40">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{providerName}</p>
            <p className="text-xs text-slate-400">{procedures.length} procedure{procedures.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Total Allowed standalone + two-section summary — visible on large screens */}
        <div className="hidden lg:flex items-center gap-0 flex-1 min-w-0">

          {/* ── Total Allowed (standalone) ── */}
          <div className="flex-shrink-0 pr-5 text-right">
            <p className="text-xs text-slate-400 leading-tight">Total Allowed</p>
            <p className="text-base font-bold text-blue-700 tabular-nums mt-0.5">{formatCurrency(summary.procedureTotal)}</p>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-slate-200 mx-1 flex-shrink-0" />

          {/* ── Deposited Funds ── */}
          <div className="flex-1 min-w-0 px-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Deposited Funds</p>
            <div className="grid grid-cols-4 gap-2 text-right">
              <div>
                <p className="text-xs text-slate-400 leading-tight">Collected</p>
                <p className="text-xs font-semibold text-green-700 tabular-nums mt-0.5">{formatCurrency(summary.totalDeposited)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 leading-tight">Provider Portion</p>
                <p className="text-xs font-semibold text-slate-700 tabular-nums mt-0.5">{formatCurrency(summary.providerOwed)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 leading-tight">IDR Earned</p>
                <p className="text-xs font-semibold text-slate-700 tabular-nums mt-0.5">{formatCurrency(summary.idrTeamCommission)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 leading-tight">BHAC Retained</p>
                <p className="text-xs font-semibold text-sky-700 tabular-nums mt-0.5">{formatCurrency(summary.bhacRetainedToDate)}</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-slate-200 mx-1 flex-shrink-0" />

          {/* ── Undeposited Funds ── */}
          <div className="flex-1 min-w-0 pl-4">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Undeposited Funds</p>
            <div className="grid grid-cols-4 gap-2 text-right">
              <div>
                <p className="text-xs text-slate-400 leading-tight">Pending</p>
                <p className={`text-xs font-semibold tabular-nums mt-0.5 ${summary.undepositedTotal > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{formatCurrency(summary.undepositedTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 leading-tight">Provider Portion</p>
                <p className="text-xs font-semibold text-orange-700 tabular-nums mt-0.5">{formatCurrency(summary.pendingProviderReceivable)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 leading-tight">IDR Expected</p>
                <p className="text-xs font-semibold text-slate-700 tabular-nums mt-0.5">{formatCurrency(summary.idrTeamCommissionExpected)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 leading-tight">BHAC Net Expected</p>
                <p className="text-xs font-semibold text-teal-700 tabular-nums mt-0.5">{formatCurrency(summary.bhacNetExpected)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chevron */}
        <div className="text-slate-400 flex-shrink-0 ml-auto lg:ml-4">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-6 pb-6 pt-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Procedure ID','Claim Paid','Awards','Total Allowed','Deposited','Undeposited','Provider Open Balance','IDR Earned','BHAC Net','BHAC Retained','BHAC Receivable'].map((h,i) => (
                    <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide ${i > 0 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {procedures.map(p => (
                  <tr key={p.procedureId} className={`transition-colors ${p.providerBalanceOwed > 0 ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">{p.procedureId}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(p.totalClaimPaid)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(p.totalAwards)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-700">{formatCurrency(p.procedureTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{formatCurrency(p.totalDeposited)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{formatCurrency(p.undepositedTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-amber-700">{formatCurrency(p.providerBalanceOwed)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(p.idrTeamCommission)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-teal-700">{formatCurrency(p.bhacNetExpected)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sky-700">{formatCurrency(p.bhacRetainedToDate)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-orange-700">{formatCurrency(p.bhacBalanceOwed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function AdminDashboard({ procedures, onRefetch }: Props) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const globalSummary = useMemo(() => computeSummary(procedures), [procedures]);

  const totalClaimsAllowed = useMemo(
    () => procedures.reduce((sum, p) => sum + p.totalClaimPaid, 0),
    [procedures]
  );
  const totalAwardsAllowed = useMemo(
    () => procedures.reduce((sum, p) => sum + p.totalAwards, 0),
    [procedures]
  );

  const liveProviderNames = useMemo(() => {
    const set = new Set(procedures.map(p => p.providerName));
    return Array.from(set);
  }, [procedures]);

  const filteredProcedures = useMemo(() => {
    let result = procedures;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(p => p.procedureId.toLowerCase().includes(q) || p.providerName.toLowerCase().includes(q));
    }
    if (filters.providerId) {
      result = result.filter(p => p.providerId === filters.providerId);
    }
    if (filters.dateFrom) result = result.filter(p => p.date >= filters.dateFrom);
    if (filters.dateTo)   result = result.filter(p => p.date <= filters.dateTo);
    if (filters.outstandingOnly) result = result.filter(p => p.providerBalanceOwed > 0 || p.bhacBalanceOwed > 0);
    return result;
  }, [procedures, filters]);

  const filteredProviderNames = useMemo(() => {
    const set = new Set(filteredProcedures.map(p => p.providerName));
    return Array.from(set);
  }, [filteredProcedures]);

  const activeFilterCount = [filters.search, filters.providerId, filters.dateFrom, filters.dateTo, filters.outstandingOnly].filter(Boolean).length;

  return (
    <div className="space-y-8 print:space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Aggregate view across all providers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefetch} className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
          <button onClick={() => exportAdminCsv(filteredProcedures)} className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm">
            <FileDown className="w-4 h-4" />Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
            <Printer className="w-4 h-4" />Print
          </button>
        </div>
      </div>

      {/* ══ Practice Overview ══════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">Practice Overview</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
          <SummaryCard
            label="Total Allowed"
            value={globalSummary.procedureTotal}
            icon={<DollarSign className="w-5 h-5" />}
            color="blue"
            subtitle="All providers"
          />
          <PieChartCard claimsTotal={totalClaimsAllowed} awardsTotal={totalAwardsAllowed} />
          <SummaryCard
            label="Total Deposited"
            value={globalSummary.totalDeposited}
            icon={<Wallet className="w-5 h-5" />}
            color="blue"
          />
          <SummaryCard
            label="Total Pending"
            value={globalSummary.procedureTotal - globalSummary.totalDeposited}
            icon={<Clock className="w-5 h-5" />}
            color="blue"
          />
          <SummaryCard
            label="BHAC Net Expected"
            value={globalSummary.bhacNetExpected}
            icon={<TrendingUp className="w-5 h-5" />}
            color="green"
          />
          <SummaryCard
            label="BHAC Expected Margin %"
            value={globalSummary.procedureTotal > 0 ? globalSummary.bhacNetExpected / globalSummary.procedureTotal : 0}
            icon={<Percent className="w-5 h-5" />}
            color="green"
            format="percent"
          />
          <SummaryCard
            label="BHAC Collected Funds Retained"
            value={globalSummary.bhacRetainedToDate}
            icon={<CheckCircle className="w-5 h-5" />}
            color="green"
          />
          <SummaryCard
            label="BHAC Receivable"
            value={globalSummary.bhacBalanceOwed}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="red"
            highlight={globalSummary.bhacBalanceOwed > 0}
          />
        </div>
      </section>

      {/* ══ Provider Overview ══════════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">Provider Overview</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="Provider Collected Funds Payable"
            value={globalSummary.providerOwed}
            icon={<CreditCard className="w-5 h-5" />}
            color="yellow"
          />
          <SummaryCard
            label="Provider Paid"
            value={globalSummary.providerPaid}
            icon={<CheckCircle className="w-5 h-5" />}
            color="yellow"
          />
          <SummaryCard
            label="Provider Open Balance"
            value={globalSummary.providerBalanceOwed}
            icon={<AlertCircle className="w-5 h-5" />}
            color="red"
            highlight={globalSummary.providerBalanceOwed > 0}
          />
          <SummaryCard
            label="Pending Provider Receivables"
            value={globalSummary.pendingProviderReceivable}
            icon={<Clock className="w-5 h-5" />}
            color="orange"
          />
        </div>

        {/* Filters bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowFilters(v=>!v)} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{activeFilterCount}</span>}
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors">
                  <X className="w-3 h-3" />Clear all
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">{filteredProcedures.length} of {procedures.length} procedures</p>
          </div>
          {showFilters && (
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Search procedure ID or provider..." value={filters.search} onChange={e => setFilters(f=>({...f,search:e.target.value}))}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={filters.providerId} onChange={e => setFilters(f=>({...f,providerId:e.target.value}))}
                className="py-2 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600">
                <option value="">All providers</option>
                {liveProviderNames.map(name => {
                  const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
                  return <option key={id} value={id}>{name}</option>;
                })}
              </select>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f=>({...f,dateFrom:e.target.value}))} className="py-2 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600" />
              <input type="date" value={filters.dateTo} onChange={e => setFilters(f=>({...f,dateTo:e.target.value}))} className="py-2 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600" />
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer lg:col-span-5 lg:w-fit">
                <input type="checkbox" checked={filters.outstandingOnly} onChange={e => setFilters(f=>({...f,outstandingOnly:e.target.checked}))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Outstanding balances only
              </label>
            </div>
          )}
        </div>

        {/* Provider breakdown */}
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-700">Provider Breakdown</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{filteredProviderNames.length} providers</span>
        </div>
        {filteredProviderNames.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">No procedures match the current filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProviderNames.map(name => (
              <ProviderSection key={name} providerName={name} procedures={getProceduresByProviderName(filteredProcedures, name)} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
