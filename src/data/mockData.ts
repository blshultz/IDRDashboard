import { Procedure, DashboardSummary } from '../types';

export function getProceduresByProviderName(procedures: Procedure[], providerName: string): Procedure[] {
  return procedures.filter(p => p.providerName === providerName);
}

export function getProceduresByProvider(procedures: Procedure[], providerId: string): Procedure[] {
  return procedures.filter(p => p.providerId === providerId);
}

/**
 * Per-procedure pending receivable — doctor portal only.
 *
 * Formula:  MAX(totalProviderExpected − providerPaid − providerOpenBalance, 0)
 *
 * Uses the explicit doctor-facing field names so the formula is clearly
 * independent of admin/BHAC calculations.  Falls back to the admin aliases
 * (same sheet columns) only if the explicit fields were not parsed.
 *
 * Do NOT substitute bhacNetExpected or any other BHAC field here.
 */
export function computePendingReceivable(p: Procedure): number {
  const expected    = p.totalProviderExpected ?? 0;
  const paid        = p.providerPaid;
  const openBalance = p.providerOpenBalance ?? p.providerBalanceOwed; // fallback to alias
  return Math.max(expected - paid - openBalance, 0);
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
      idrTeamCommissionExpected: acc.idrTeamCommissionExpected + p.idrTeamCommissionExpected,
      bhacNetExpected:           acc.bhacNetExpected           + p.bhacNetExpected,
      bhacRetainedToDate:        acc.bhacRetainedToDate        + p.bhacRetainedToDate,
      bhacBalanceOwed:           acc.bhacBalanceOwed           + p.bhacBalanceOwed,
    }),
    {
      procedureTotal: 0, totalDeposited: 0, totalClaimsDeposited: 0, totalAwardsDeposited: 0,
      undepositedTotal: 0, pendingProviderReceivable: 0,
      providerOwed: 0, providerPaid: 0, providerBalanceOwed: 0,
      idrTeamCommission: 0, idrTeamCommissionExpected: 0,
      bhacNetExpected: 0, bhacRetainedToDate: 0, bhacBalanceOwed: 0,
    }
  );
}
