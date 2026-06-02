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
  totalProviderExpected?: number;  // Net Awards Allowed after IDR commission — used to compute pending receivable
  providerOwed: number;
  providerPaid: number;
  providerBalanceOwed: number;
  idrTeamCommission: number;
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
  pendingProviderReceivable: number; // MAX(totalProviderExpected − providerPaid − providerBalanceOwed, 0) summed
  providerOwed: number;
  providerPaid: number;
  providerBalanceOwed: number;
  idrTeamCommission: number;
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
