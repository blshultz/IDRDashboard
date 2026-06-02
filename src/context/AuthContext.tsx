import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  needsPasswordUpdate: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  signUpWithToken: (token: string, password: string) => Promise<{ needsVerification: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveUserRole(email: string): Promise<User | null> {
  const { data } = await supabase
    .from('user_roles')
    .select('email, role, provider_id, provider_name, display_name, is_active')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return {
    id: email,
    name: data.display_name,
    email: data.email,
    role: data.role as 'admin' | 'doctor',
    providerId: data.provider_id ?? undefined,
    providerName: data.provider_name ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);

  useEffect(() => {
    // Initial session hydration (handles persistent login across page reloads).
    // Skip if there is a Supabase auth redirect in the URL — onAuthStateChange
    // will process that (PASSWORD_RECOVERY or email-verify SIGNED_IN).
    const hash = window.location.hash;
    const isAuthRedirect = hash.includes('type=recovery') || hash.includes('type=signup');

    if (!isAuthRedirect) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.user?.email) {
          resolveUserRole(s.user.email).then(u => {
            setUser(u);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked a password-reset link. Surface the update-password form;
        // do NOT log them into the dashboard yet.
        setNeedsPasswordUpdate(true);
        setSession(s);
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setNeedsPasswordUpdate(false);
        setLoading(false);
        return;
      }

      // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION, etc.
      setSession(s);
      if (s?.user?.email) {
        resolveUserRole(s.user.email).then(u => {
          setUser(u);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const u = await resolveUserRole(email);
    if (!u) throw new Error('Your account is not authorized or has been deactivated. Contact your administrator.');
  }

  async function signUp(email: string, password: string): Promise<{ needsVerification: boolean }> {
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string
    );
    const { data: roleRow } = await anonClient
      .from('user_roles')
      .select('email')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (!roleRow) throw new Error('Your email is not authorized to access this portal. Contact your administrator.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw new Error(error.message);
    return { needsVerification: !data.session };
  }

  async function signUpWithToken(token: string, password: string): Promise<{ needsVerification: boolean }> {
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string
    );

    // 1. Read invite details for display / pre-validation
    const { data: invite } = await anonClient
      .from('invitations')
      .select('email, display_name, provider_name, accepted_at, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (!invite) throw new Error('Invalid or expired invitation link.');
    if (invite.accepted_at) throw new Error('This invitation has already been used.');
    if (new Date(invite.expires_at) < new Date()) throw new Error('This invitation link has expired. Ask your administrator to resend it.');

    // 2. Set up user_roles and mark invitation accepted (SECURITY DEFINER, safe for anon)
    const { error: setupErr } = await anonClient.rpc('setup_user_from_invite', { p_token: token });
    if (setupErr) {
      // Log full error so the exact Postgres error is visible in the browser console
      console.error('[setup_user_from_invite] RPC error:', {
        message: setupErr.message,
        hint:    (setupErr as Record<string, unknown>).hint,
        details: (setupErr as Record<string, unknown>).details,
        code:    (setupErr as Record<string, unknown>).code,
      });
      const hint = (setupErr as { hint?: string }).hint;
      throw new Error(hint ?? setupErr.message);
    }

    // 3. Create the Supabase Auth account
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (signUpErr) {
      // "User already registered" means they created an account before — just let them sign in
      if (signUpErr.message.toLowerCase().includes('already registered')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      throw new Error(signUpErr.message);
    }

    // Fast path: email confirmation is disabled in Supabase project settings
    if (data.session) return { needsVerification: false };

    // Auto-confirm: invite-based onboarding skips the extra verification email.
    // The RPC gate checks that the invitation was accepted within the last 15 minutes,
    // so this only fires for the legitimate invite-token path — never open signup.
    try {
      await anonClient.rpc('confirm_invited_user', { p_email: invite.email });
    } catch (confirmErr) {
      console.warn('[invite] Auto-confirm RPC failed, falling back to email verification:', confirmErr);
      return { needsVerification: true };
    }

    // Sign the user in directly — their email is now confirmed server-side
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });
    if (signInErr) {
      console.warn('[invite] Auto sign-in after confirm failed:', signInErr.message);
      return { needsVerification: true };
    }

    return { needsVerification: false };
  }

  async function resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw new Error(error.message);
  }

  async function updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    setNeedsPasswordUpdate(false);
    // onAuthStateChange fires SIGNED_IN after updateUser → resolves user normally
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setNeedsPasswordUpdate(false);
  }

  return (
    <AuthContext.Provider value={{
      user, session, loading, needsPasswordUpdate,
      login, signUp, signUpWithToken, resetPassword, updatePassword, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
