import { Procedure, DashboardSummary } from '../types';

export function getProceduresByProviderName(procedures: Procedure[], providerName: string): Procedure[] {
  return procedures.filter(p => p.providerName === providerName);
}

export function getProceduresByProvider(procedures: Procedure[], providerId: string): Procedure[] {
  return procedures.filter(p => p.providerId === providerId);
}

/** Per-procedure pending receivable: expected total earnings minus already-paid and still-owed-from-collected. */
export function computePendingReceivable(p: Procedure): number {
  return Math.max((p.totalProviderExpected ?? 0) - p.providerPaid - p.providerBalanceOwed, 0);
}

export function computeSummary(procedures: Procedure[]): DashboardSummary {
  return procedures.reduce(
    (acc, p) => ({
      procedureTotal:            acc.procedureTotal            + p.procedureTotal,
      totalDeposited:            acc.totalDeposited            + p.totalDeposited,
      totalClaimsDeposited:      acc.totalClaimsDeposited      + (p.totalClaimsDeposited ?? 0),
      totalAwardsDeposited:      acc.totalAwardsDeposited      + (p.totalAwardsDeposited ?? 0),
      undepositedTotal:          acc.undepositedTotal          + p.undepositedTotal,
      pendingProviderReceivable: acc.pendingProviderReceivable + computePendingReceivable(p),
      providerOwed:              acc.providerOwed              + p.providerOwed,
      providerPaid:              acc.providerPaid              + p.providerPaid,
      providerBalanceOwed:       acc.providerBalanceOwed       + p.providerBalanceOwed,
      idrTeamCommission:         acc.idrTeamCommission         + p.idrTeamCommission,
      bhacNetExpected:           acc.bhacNetExpected           + p.bhacNetExpected,
      bhacRetainedToDate:        acc.bhacRetainedToDate        + p.bhacRetainedToDate,
      bhacBalanceOwed:           acc.bhacBalanceOwed           + p.bhacBalanceOwed,
    }),
    {
      procedureTotal: 0, totalDeposited: 0, totalClaimsDeposited: 0, totalAwardsDeposited: 0,
      undepositedTotal: 0, pendingProviderReceivable: 0,
      providerOwed: 0, providerPaid: 0, providerBalanceOwed: 0,
      idrTeamCommission: 0, bhacNetExpected: 0, bhacRetainedToDate: 0, bhacBalanceOwed: 0,
    }
  );
}
