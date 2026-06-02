import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Mail, RefreshCw, MoreVertical, Check, X, CreditCard as Edit2, Clock, UserCheck, UserX, Send, Shield, Stethoscope, Copy, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserRoleRow, Invitation, Role } from '../types';
import { formatDateTime } from '../utils/format';
import { fetchProviderNames } from '../services/sheetsService';

interface LoginInfo {
  last_sign_in_at: string | null;
  confirmed_at: string | null;
}

function copyToClipboard(text: string) { navigator.clipboard.writeText(text).catch(() => {}); }
function getInviteLink(token: string) { return `${window.location.origin}${window.location.pathname}?invite=${token}`; }

/* ── Invite Modal ─────────────────────────────────────────────────────── */
function InviteModal({
  onClose,
  onSuccess,
  providerNames,
}: {
  onClose: () => void;
  onSuccess: () => void;
  providerNames: string[];
}) {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [role, setRole] = useState<Role>('doctor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from('invitations').insert({
        email: email.toLowerCase().trim(),
        role,
        provider_name: role === 'doctor' ? providerName.trim() || null : null,
        display_name: displayName.trim(),
        invited_by: session?.user.id,
      }).select('token').single();
      if (err) throw new Error(err.message);
      setCreatedToken(data.token);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!createdToken) return;
    copyToClipboard(getInviteLink(createdToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (createdToken) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Invitation created</h2>
              <p className="text-sm text-slate-500">Share this link with {displayName || email}</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-mono text-slate-600 break-all leading-relaxed">{getInviteLink(createdToken)}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Done
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">Expires in 7 days. Only this specific email can use it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Invite user</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@example.com"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Dr. Jane Smith"
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <div className="flex gap-3">
              {(['doctor', 'admin'] as Role[]).map(r => (
                <label
                  key={r}
                  className={`flex-1 flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-all ${role === r ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                  {r === 'doctor'
                    ? <Stethoscope className={`w-4 h-4 ${role === r ? 'text-blue-600' : 'text-slate-400'}`} />
                    : <Shield className={`w-4 h-4 ${role === r ? 'text-blue-600' : 'text-slate-400'}`} />
                  }
                  <span className={`text-sm font-medium capitalize ${role === r ? 'text-blue-700' : 'text-slate-600'}`}>{r}</span>
                </label>
              ))}
            </div>
          </div>
          {role === 'doctor' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Provider Name</label>
              <select
                value={providerName}
                onChange={e => setProviderName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select provider —</option>
                {providerNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {providerNames.length === 0 && (
                  <option value="" disabled>Loading providers…</option>
                )}
              </select>
              <p className="text-xs text-slate-400 mt-1">Must match the provider name in the Google Sheet exactly.</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Creating...' : 'Generate invite link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Modal ───────────────────────────────────────────────────────── */
function EditModal({
  user,
  onClose,
  onSuccess,
  providerNames,
}: {
  user: UserRoleRow;
  onClose: () => void;
  onSuccess: () => void;
  providerNames: string[];
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [role, setRole] = useState<Role>(user.role);
  const [providerName, setProviderName] = useState(user.provider_name ?? '');
  const [isActive, setIsActive] = useState(user.is_active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When role switches away from doctor, clear the provider selection
  function handleRoleChange(r: Role) {
    setRole(r);
    if (r !== 'doctor') setProviderName('');
  }

  // If the stored provider_name isn't in the live list (old/backfilled data),
  // prepend it so the current value stays selected until the admin changes it.
  const providerOptions: string[] =
    providerName && !providerNames.includes(providerName)
      ? [providerName, ...providerNames]
      : providerNames;

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const trimmedProvider = role === 'doctor' ? providerName.trim() : '';
      const { error: err } = await supabase.from('user_roles').update({
        display_name: displayName.trim(),
        role,
        is_active: isActive,
        provider_name: trimmedProvider || null,
        provider_id: trimmedProvider
          ? trimmedProvider.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          : null,
      }).eq('email', user.email);
      if (err) throw new Error(err.message);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Edit user</h2>
            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <div className="flex gap-3">
              {(['doctor', 'admin'] as Role[]).map(r => (
                <label
                  key={r}
                  className={`flex-1 flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-all ${role === r ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <input type="radio" name="edit-role" value={r} checked={role === r} onChange={() => handleRoleChange(r)} className="sr-only" />
                  {r === 'doctor'
                    ? <Stethoscope className={`w-4 h-4 ${role === r ? 'text-blue-600' : 'text-slate-400'}`} />
                    : <Shield className={`w-4 h-4 ${role === r ? 'text-blue-600' : 'text-slate-400'}`} />
                  }
                  <span className={`text-sm font-medium capitalize ${role === r ? 'text-blue-700' : 'text-slate-600'}`}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Provider — only visible when role is doctor */}
          {role === 'doctor' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Provider Name</label>
              <select
                value={providerName}
                onChange={e => setProviderName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select provider —</option>
                {providerOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {providerOptions.length === 0 && (
                  <option value="" disabled>Loading providers…</option>
                )}
              </select>
              <p className="text-xs text-slate-400 mt-1">Must match the provider name in the Google Sheet exactly.</p>
            </div>
          )}

          {/* Active status */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Account active</p>
              <p className="text-xs text-slate-400 mt-0.5">Inactive users cannot sign in</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${isActive ? 'bg-blue-600' : 'bg-slate-200'}`}
              role="switch"
              aria-checked={isActive}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */
export default function UserManagement() {
  const [users, setUsers] = useState<UserRoleRow[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [providerNames, setProviderNames] = useState<string[]>([]);
  const [loginData, setLoginData] = useState<Map<string, LoginInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRoleRow | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [usersResult, invitesResult, providers] = await Promise.all([
      supabase
        .from('user_roles')
        .select('id, email, role, provider_id, provider_name, display_name, is_active, created_at')
        .order('display_name'),
      supabase
        .from('invitations')
        .select('id, email, role, provider_name, display_name, token, accepted_at, expires_at, created_at')
        .order('created_at', { ascending: false }),
      fetchProviderNames(),
    ]);

    setUsers((usersResult.data as UserRoleRow[]) ?? []);
    setInvitations((invitesResult.data as Invitation[]) ?? []);
    setProviderNames(providers);

    // Load last-login data via admin RPC (may fail gracefully if migration not yet applied)
    try {
      const { data: loginRows } = await supabase.rpc('admin_get_users_with_login');
      const map = new Map<string, LoginInfo>();
      ((loginRows ?? []) as Array<{ email: string } & LoginInfo>).forEach(row => {
        map.set(row.email.toLowerCase(), {
          last_sign_in_at: row.last_sign_in_at,
          confirmed_at: row.confirmed_at,
        });
      });
      setLoginData(map);
    } catch {
      setLoginData(new Map());
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(user: UserRoleRow) {
    await supabase.from('user_roles').update({ is_active: !user.is_active }).eq('email', user.email);
    setActiveMenu(null);
    load();
  }

  async function resendInvite(invite: Invitation) {
    // Use a plain UUID string — valid for both uuid and text column types.
    // The previous format (stripped dashes + timestamp suffix) is not a valid
    // UUID and would fail if the invitations.token column is uuid type.
    const newToken = crypto.randomUUID();
    await supabase.from('invitations').update({
      token: newToken,
      accepted_at: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', invite.id);
    copyToClipboard(getInviteLink(newToken));
    load();
  }

  async function deleteInvite(invite: Invitation) {
    await supabase.from('invitations').delete().eq('id', invite.id);
    setConfirmDeleteId(null);
    load();
  }

  // Build a map of email → accepted_at for cross-referencing active users
  const acceptedInviteMap = new Map(
    invitations
      .filter(i => !!i.accepted_at)
      .map(i => [i.email.toLowerCase(), i.accepted_at as string])
  );

  const activeUsers  = users.filter(u => u.is_active);
  const inactiveUsers = users.filter(u => !u.is_active);
  const pendingInvites = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) > new Date());
  const expiredInvites = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) <= new Date());

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage portal access for doctors and administrators</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />Invite user
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-6 h-6 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Active Users ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              Active users <span className="text-slate-400 font-normal text-sm">({activeUsers.length})</span>
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {activeUsers.length === 0 ? (
                <p className="p-8 text-center text-slate-400 text-sm">No active users.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Provider</th>
                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Invite Status</th>
                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Created</th>
                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Last Login</th>
                        <th className="px-5 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeUsers.map(user => {
                        const inviteAcceptedAt = acceptedInviteMap.get(user.email.toLowerCase());
                        const loginInfo = loginData.get(user.email.toLowerCase());
                        return (
                          <tr key={user.email} className="hover:bg-slate-50 transition-colors">
                            {/* User */}
                            <td className="px-5 py-3.5">
                              <p className="text-sm font-medium text-slate-800">{user.display_name}</p>
                              <p className="text-xs text-slate-400">{user.email}</p>
                            </td>
                            {/* Role */}
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                                {user.role === 'admin'
                                  ? <Shield className="w-3 h-3" />
                                  : <Stethoscope className="w-3 h-3" />
                                }
                                {user.role}
                              </span>
                            </td>
                            {/* Provider */}
                            <td className="px-5 py-3.5 text-sm text-slate-600">
                              {user.provider_name ?? <span className="text-slate-300">—</span>}
                            </td>
                            {/* Invite Status */}
                            <td className="px-5 py-3.5">
                              {inviteAcceptedAt ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" />Via invite
                                </span>
                              ) : (
                                <span className="text-slate-300 text-sm">—</span>
                              )}
                            </td>
                            {/* Created */}
                            <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                              {formatDateTime(user.created_at)}
                            </td>
                            {/* Last Login */}
                            <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                              {loginInfo?.last_sign_in_at ? (
                                <span className="text-slate-500">{formatDateTime(loginInfo.last_sign_in_at)}</span>
                              ) : (
                                <span className="text-slate-300">Never</span>
                              )}
                            </td>
                            {/* Actions */}
                            <td className="px-5 py-3.5 text-right relative">
                              <button
                                onClick={() => setActiveMenu(activeMenu === user.email ? null : user.email)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {activeMenu === user.email && (
                                <div className="absolute right-4 top-10 bg-white border border-slate-200 rounded-xl shadow-xl z-10 w-44 py-1">
                                  <button
                                    onClick={() => { setEditingUser(user); setActiveMenu(null); }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <Edit2 className="w-4 h-4" />Edit user
                                  </button>
                                  <button
                                    onClick={() => toggleActive(user)}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <UserX className="w-4 h-4" />Deactivate
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* ── Deactivated Users ── */}
          {inactiveUsers.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-slate-700 mb-3">
                Deactivated <span className="text-slate-400 font-normal text-sm">({inactiveUsers.length})</span>
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-70">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    {inactiveUsers.map(user => (
                      <tr key={user.email} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-slate-500 line-through">{user.display_name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => toggleActive(user)}
                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 ml-auto"
                          >
                            <UserCheck className="w-3.5 h-3.5" />Reactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Pending Invitations ── */}
          {pendingInvites.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-slate-700 mb-3">
                Pending invitations <span className="text-slate-400 font-normal text-sm">({pendingInvites.length})</span>
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                      <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Provider</th>
                      <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                      <th className="px-5 py-3 w-40 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingInvites.map(invite => (
                      <tr key={invite.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-slate-700">{invite.display_name || invite.email}</p>
                          <p className="text-xs text-slate-400">{invite.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {invite.provider_name ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1.5 text-xs text-amber-600">
                            <Clock className="w-3.5 h-3.5" />{formatDateTime(invite.expires_at)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {confirmDeleteId === invite.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">Delete this invite?</span>
                              <button
                                onClick={() => deleteInvite(invite)}
                                className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-md transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => copyToClipboard(getInviteLink(invite.token))}
                                className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />Copy link
                              </button>
                              <button
                                onClick={() => resendInvite(invite)}
                                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                              >
                                <Send className="w-3.5 h-3.5" />Resend
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(invite.id)}
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-600 transition-colors"
                                title="Delete invitation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Expired Invitations ── */}
          {expiredInvites.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-slate-700 mb-3">
                Expired invitations <span className="text-slate-400 font-normal text-sm">({expiredInvites.length})</span>
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-60">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    {expiredInvites.map(invite => (
                      <tr key={invite.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-slate-500">{invite.display_name || invite.email}</p>
                          <p className="text-xs text-slate-400">{invite.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {confirmDeleteId === invite.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">Delete this invite?</span>
                              <button
                                onClick={() => deleteInvite(invite)}
                                className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-md transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => resendInvite(invite)}
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <Send className="w-3.5 h-3.5" />Resend
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(invite.id)}
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-600 transition-colors"
                                title="Delete invitation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={load}
          providerNames={providerNames}
        />
      )}
      {editingUser && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={load}
          providerNames={providerNames}
        />
      )}
      {activeMenu && <div className="fixed inset-0 z-0" onClick={() => setActiveMenu(null)} />}
    </div>
  );
}
