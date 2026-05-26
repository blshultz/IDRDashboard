import React, { useState, useMemo } from 'react';
import {
  Users, ChevronDown, ChevronUp, RefreshCw, FileDown, Printer,
  DollarSign, Wallet, TrendingUp, Percent, AlertTriangle, CreditCard, CheckCircle, AlertCircle,
  Search, Filter, X
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
  const headers = ['Procedure ID','Provider Name','Total Claim Paid','Total Awards','Procedure Total','Total Deposited','Undeposited Total','Provider Owed','Provider Paid','Provider Balance Owed','IDR Team Commission','BHAC Net Expected','BHAC Retained to Date','BHAC Balance Owed'];
  const rows = procedures.map(p => [p.procedureId,p.providerName,p.totalClaimPaid.toFixed(2),p.totalAwards.toFixed(2),p.procedureTotal.toFixed(2),p.totalDeposited.toFixed(2),p.undepositedTotal.toFixed(2),p.providerOwed.toFixed(2),p.providerPaid.toFixed(2),p.providerBalanceOwed.toFixed(2),p.idrTeamCommission.toFixed(2),p.bhacNetExpected.toFixed(2),p.bhacRetainedToDate.toFixed(2),p.bhacBalanceOwed.toFixed(2)]);
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`bhac-admin-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ProviderSection({ providerName, procedures }: { providerName: string; procedures: Procedure[] }) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => computeSummary(procedures), [procedures]);
  const hasBalance = summary.providerBalanceOwed > 0 || summary.bhacBalanceOwed > 0;
  const initials = providerName.split(' ').filter(w=>/[A-Z]/i.test(w)).map(w=>w[0].toUpperCase()).join('').slice(0,2) || providerName.slice(0,2).toUpperCase();

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${hasBalance ? 'border-amber-200' : 'border-slate-200'}`}>
      <button onClick={() => setOpen(v=>!v)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{providerName}</p>
            <p className="text-xs text-slate-400">{procedures.length} procedure{procedures.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 ml-4">
          <div className="hidden sm:grid grid-cols-4 gap-6 text-right">
            <div><p className="text-xs text-slate-400">Procedure Total</p><p className="text-sm font-semibold text-blue-700 tabular-nums">{formatCurrency(summary.procedureTotal)}</p></div>
            <div><p className="text-xs text-slate-400">Provider Balance</p><p className={`text-sm font-semibold tabular-nums ${summary.providerBalanceOwed > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{formatCurrency(summary.providerBalanceOwed)}</p></div>
            <div><p className="text-xs text-slate-400">BHAC Retained</p><p className="text-sm font-semibold text-sky-700 tabular-nums">{formatCurrency(summary.bhacRetainedToDate)}</p></div>
            <div><p className="text-xs text-slate-400">BHAC Balance</p><p className={`text-sm font-semibold tabular-nums ${summary.bhacBalanceOwed > 0 ? 'text-orange-700' : 'text-slate-600'}`}>{formatCurrency(summary.bhacBalanceOwed)}</p></div>
          </div>
          <div className="text-slate-400 flex-shrink-0">{open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-6 pb-6 pt-4 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Procedure Total', value: summary.procedureTotal, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Deposited', value: summary.totalDeposited, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Undeposited', value: summary.undepositedTotal, color: summary.undepositedTotal > 0 ? 'text-amber-700' : 'text-slate-600', bg: summary.undepositedTotal > 0 ? 'bg-amber-50' : 'bg-slate-50' },
              { label: 'Provider Owed', value: summary.providerOwed, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Provider Balance', value: summary.providerBalanceOwed, color: summary.providerBalanceOwed > 0 ? 'text-amber-700' : 'text-slate-600', bg: summary.providerBalanceOwed > 0 ? 'bg-amber-50' : 'bg-slate-50' },
              { label: 'IDR Commission', value: summary.idrTeamCommission, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'BHAC Balance', value: summary.bhacBalanceOwed, color: summary.bhacBalanceOwed > 0 ? 'text-orange-700' : 'text-slate-600', bg: summary.bhacBalanceOwed > 0 ? 'bg-orange-50' : 'bg-slate-50' },
            ].map(item => (
              <div key={item.label} className={`${item.bg} rounded-lg p-3`}>
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p className={`text-sm font-semibold tabular-nums ${item.color}`}>{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Procedure ID','Claim Paid','Awards','Proc. Total','Deposited','Undeposited','Prov. Balance','IDR Comm.','BHAC Net','BHAC Retained','BHAC Balance'].map((h,i) => (
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

export default function AdminDashboard({ procedures, onRefetch }: Props) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const globalSummary = useMemo(() => computeSummary(procedures), [procedures]);

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
    if (filters.dateTo) result = result.filter(p => p.date <= filters.dateTo);
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

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
        <SummaryCard label="Total Awarded"          value={globalSummary.procedureTotal}   icon={<DollarSign    className="w-5 h-5" />} color="blue"   subtitle="All providers" />
        <SummaryCard label="Total Deposited"         value={globalSummary.totalDeposited}    icon={<Wallet        className="w-5 h-5" />} color="blue"   />
        <SummaryCard label="BHAC Net Expected"       value={globalSummary.bhacNetExpected}   icon={<TrendingUp    className="w-5 h-5" />} color="green"  />
        <SummaryCard label="BHAC Expected Margin %"  value={globalSummary.procedureTotal > 0 ? globalSummary.bhacNetExpected / globalSummary.procedureTotal : 0} icon={<Percent className="w-5 h-5" />} color="green" format="percent" />
        <SummaryCard label="BHAC Balance"            value={globalSummary.bhacBalanceOwed}   icon={<AlertTriangle className="w-5 h-5" />} color="red"    highlight={globalSummary.bhacBalanceOwed > 0} />
        <SummaryCard label="Provider Owed"           value={globalSummary.providerOwed}      icon={<CreditCard    className="w-5 h-5" />} color="yellow" />
        <SummaryCard label="Provider Paid"           value={globalSummary.providerPaid}      icon={<CheckCircle   className="w-5 h-5" />} color="yellow" />
        <SummaryCard label="Provider Balance"        value={globalSummary.providerBalanceOwed} icon={<AlertCircle className="w-5 h-5" />} color="red"   highlight={globalSummary.providerBalanceOwed > 0} />
      </div>

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

      <section>
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-700">Provider Breakdown</h2>
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
