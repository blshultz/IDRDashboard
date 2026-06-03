export type Role = 'admin' | 'doctor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  providerId?: string;
  providerName?: string;
}

export interface Procedure {
  procedureId: string;
  providerName: string;
  providerId: string;
  date: string;
  claimNumber?: string;
  awardCode?: string;
  totalClaimPaid: number;
  totalAwards: number;
  procedureTotal: number;
  totalDeposited: number;
  totalClaimsDeposited?: number;
  totalAwardsDeposited?: number;
  undepositedTotal: number;

  // ── Doctor-facing fields (explicit sheet column names) ───────────────────
  // Used only for doctor portal display and pending-receivable calculation.
  // Do NOT use these for admin/BHAC calculations.
  providerPayable?: number;      // Sheet: "Provider Payable"   — doctor's share of collected funds
  totalProviderExpected?: number;// Sheet: "Total Provider Expected" — doctor's total expected earnings
  providerOpenBalance?: number;  // Sheet: "Provider Open Balance" — balance still owed from collected funds

  // ── Admin/internal fields ────────────────────────────────────────────────
  // providerOwed and providerBalanceOwed are legacy aliases for the same sheet
  // columns as providerPayable / providerOpenBalance. Kept for admin dashboard
  // compatibility; do not use for doctor pending-receivable formula.
  providerOwed: number;
  providerPaid: number;          // Sheet: "Provider Paid" — shared by both portals
  providerBalanceOwed: number;
  idrTeamCommission: number;
  idrTeamCommissionExpected: number; // Sheet: "IDR Team Commission Expected"

  // ── BHAC admin calculations — do not use for doctor portal ──────────────
  bhacNetExpected: number;
  bhacRetainedToDate: number;
  bhacBalanceOwed: number;
}

export interface DashboardSummary {
  procedureTotal: number;
  totalDeposited: number;
  totalClaimsDeposited: number;
  totalAwardsDeposited: number;
  undepositedTotal: number;
  pendingProviderReceivable: number; // SUM of MAX(totalProviderExpected − providerPaid − providerOpenBalance, 0)
  providerOwed: number;
  providerPaid: number;
  providerBalanceOwed: number;
  idrTeamCommission: number;
  idrTeamCommissionExpected: number;
  bhacNetExpected: number;
  bhacRetainedToDate: number;
  bhacBalanceOwed: number;
}

export interface FilterState {
  search: string;
  providerId: string;
  dateFrom: string;
  dateTo: string;
  outstandingOnly: boolean;
}

export interface UserRoleRow {
  id: string;
  email: string;
  role: Role;
  provider_id: string | null;
  provider_name: string | null;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  provider_name: string | null;
  display_name: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export type SortField = keyof Procedure;
export type SortDir = 'asc' | 'desc';
export type AdminTab = 'dashboard' | 'users';
