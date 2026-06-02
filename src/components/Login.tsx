import React, { useState, useEffect } from 'react';
import { Activity, Lock, Mail, Eye, EyeOff, CheckCircle, UserPlus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'invite' | 'forgot' | 'reset';

interface InviteInfo {
  email: string;
  display_name: string;
  provider_name: string | null;
}

export default function Login() {
  const { login, signUp, signUpWithToken, resetPassword, updatePassword, needsPasswordUpdate } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 'done' screen state
  const [done, setDone] = useState(false);
  const [doneEmail, setDoneEmail] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  // Detect invite token in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) return;
    setInviteToken(token);
    setMode('invite');
    supabase
      .from('invitations')
      .select('email, display_name, provider_name, accepted_at, expires_at')
      .eq('token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setInviteError('This invitation link is invalid.'); return; }
        if (data.accepted_at) { setInviteError('This invitation has already been used.'); return; }
        if (new Date(data.expires_at) < new Date()) { setInviteError('This invitation has expired. Ask your administrator to resend it.'); return; }
        setInviteInfo({ email: data.email, display_name: data.display_name, provider_name: data.provider_name });
        setEmail(data.email);
      });
  }, []);

  // When auth context signals a password-recovery session, switch to reset mode
  useEffect(() => {
    if (needsPasswordUpdate) {
      setMode('reset');
      setPassword('');
      setConfirmPassword('');
      setError(null);
    }
  }, [needsPasswordUpdate]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if ((mode === 'signup' || mode === 'invite' || mode === 'reset') && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if ((mode === 'signup' || mode === 'invite' || mode === 'reset') && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await login(email, password);
        // onAuthStateChange resolves user → App re-renders dashboard

      } else if (mode === 'invite' && inviteToken) {
        const { needsVerification } = await signUpWithToken(inviteToken, password);
        if (needsVerification) {
          setDoneEmail(inviteInfo?.email ?? email);
          setDoneMessage('We sent a verification link to your email. Click it to activate your account, then return here to sign in.');
          setDone(true);
        }
        // If !needsVerification, onAuthStateChange auto-signs them in

      } else if (mode === 'signup') {
        const { needsVerification } = await signUp(email, password);
        if (needsVerification) {
          setDoneEmail(email);
          setDoneMessage('We sent a verification link to your email. Click it to activate your account, then return here to sign in.');
          setDone(true);
        }

      } else if (mode === 'forgot') {
        await resetPassword(email);
        setDoneEmail(email);
        setDoneMessage('Check your email for a password reset link. Click it to set a new password.');
        setDone(true);

      } else if (mode === 'reset') {
        await updatePassword(password);
        // needsPasswordUpdate → false, onAuthStateChange → SIGNED_IN → dashboard
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Done / confirmation screen ───────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl shadow-lg mb-6">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Check your email</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {doneMessage.split(doneEmail).map((part, i, arr) => (
              <React.Fragment key={i}>
                {part}
                {i < arr.length - 1 && <span className="font-medium text-slate-700">{doneEmail}</span>}
              </React.Fragment>
            ))}
          </p>
          <button
            onClick={() => { setDone(false); switchMode('signin'); }}
            className="mt-8 text-sm text-blue-600 hover:text-blue-700 underline underline-offset-2 transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const isInviteMode = mode === 'invite';
  const isResetMode  = mode === 'reset';
  const isForgotMode = mode === 'forgot';
  const needsConfirm = mode === 'signup' || isInviteMode || isResetMode;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">BHAC IDR Revenue Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Insurance Procedure Reporting Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

          {/* ── Mode header ── */}
          {isInviteMode ? (
            <div className="mb-6">
              {inviteError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{inviteError}</div>
              ) : inviteInfo ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">You've been invited</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {inviteInfo.display_name}{inviteInfo.provider_name ? ` — ${inviteInfo.provider_name}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-16 bg-slate-50 animate-pulse rounded-xl" />
              )}
            </div>
          ) : isResetMode ? (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Set a new password</h2>
              <p className="text-sm text-slate-500 mt-1">Choose a strong password for your account.</p>
            </div>
          ) : isForgotMode ? (
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-semibold text-slate-800">Reset your password</h2>
                <p className="text-sm text-slate-500">We'll email you a reset link.</p>
              </div>
            </div>
          ) : (
            <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
              <button type="button" onClick={() => switchMode('signin')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all duration-150 ${mode === 'signin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Sign in
              </button>
              <button type="button" onClick={() => switchMode('signup')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all duration-150 ${mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Create account
              </button>
            </div>
          )}

          {/* ── Form ── */}
          {!(isInviteMode && inviteError) && (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email — shown for all modes except reset */}
              {!isResetMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      readOnly={isInviteMode && !!inviteInfo}
                      className={`w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isInviteMode && inviteInfo ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
              )}

              {/* Password — shown for all modes except forgot */}
              {!isForgotMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {isResetMode ? 'New password' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm password */}
              {needsConfirm && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (isInviteMode && (!inviteInfo || !!inviteError))}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors duration-150 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{mode === 'signin' ? 'Signing in…' : 'Processing…'}</>
                  : mode === 'signin'  ? 'Sign in'
                  : isInviteMode       ? 'Activate account'
                  : isResetMode        ? 'Update password'
                  : isForgotMode       ? 'Send reset link'
                  :                      'Create account'
                }
              </button>
            </form>
          )}

          {/* ── Forgot password link ── */}
          {mode === 'signin' && (
            <p className="mt-4 text-center">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot your password?
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p className="mt-4 text-xs text-slate-400 text-center leading-relaxed">
              Only pre-authorized email addresses can create accounts. Contact your administrator if you need access.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          BHAC IDR Revenue Reporting System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
