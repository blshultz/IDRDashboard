import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  signUpWithToken: (token: string, password: string) => Promise<{ needsVerification: boolean }>;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        resolveUserRole(session.user.email).then(u => { setUser(u); setLoading(false); });
      } else {
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user?.email) {
        (async () => {
          const u = await resolveUserRole(session.user.email!);
          setUser(u);
          setLoading(false);
        })();
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
    // Use a fresh anon client to avoid any stale session interfering with the RLS check
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string
    );
    const { data: roleRow } = await anonClient.from('user_roles').select('email').eq('email', email.toLowerCase()).maybeSingle();
    if (!roleRow) throw new Error('Your email is not authorized to access this portal. Contact your administrator.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { needsVerification: !data.session };
  }

  async function signUpWithToken(token: string, password: string): Promise<{ needsVerification: boolean }> {
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string
    );
    const { data: invite } = await anonClient.from('invitations').select('*').eq('token', token).maybeSingle();
    if (!invite) throw new Error('Invalid or expired invitation link.');
    if (invite.accepted_at) throw new Error('This invitation has already been used.');
    if (new Date(invite.expires_at) < new Date()) throw new Error('This invitation link has expired. Ask your administrator to resend it.');

    const providerName = invite.provider_name || null;
    await supabase.from('user_roles').upsert({
      email: invite.email.toLowerCase(),
      role: invite.role ?? 'doctor',
      provider_name: providerName,
      provider_id: providerName
        ? providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : null,
      display_name: invite.display_name,
      is_active: true,
    }, { onConflict: 'email' });

    const { data, error } = await supabase.auth.signUp({ email: invite.email, password });
    if (error) throw new Error(error.message);
    await supabase.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('token', token);
    return { needsVerification: !data.session };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, login, signUp, signUpWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
