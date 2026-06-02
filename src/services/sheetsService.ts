import { Procedure } from '../types';
import { supabase } from '../lib/supabase';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL      as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function getJwt(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? SUPABASE_ANON_KEY;
}

async function callEdge(path: string): Promise<Response> {
  const jwt = await getJwt();
  return fetch(`${SUPABASE_URL}/functions/v1/sheets-data${path}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function fetchProcedures(): Promise<Procedure[]> {
  const res = await callEdge('');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch sheet data (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.rows as Procedure[];
}

export interface InviteEmailPayload {
  email: string;
  displayName: string;
  providerName: string | null;
  inviteLink: string;
  /** Human-readable expiry date, e.g. "June 8, 2026" */
  expiresAt: string;
}

/**
 * Sends the invitation email via the send-invite-email edge function.
 * The Make webhook URL is held server-side in the function's environment —
 * it is never exposed in the client bundle.
 */
export async function sendInviteEmail(payload: InviteEmailPayload): Promise<void> {
  const jwt = await getJwt();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invite-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
}

/** Returns the sorted, deduplicated list of provider names from the sheet.
 *  Only succeeds when called by an authenticated admin. */
export async function fetchProviderNames(): Promise<string[]> {
  try {
    const res = await callEdge('?providers=1');
    if (!res.ok) return [];
    const json = await res.json();
    return (json.providers as string[]) ?? [];
  } catch {
    return [];
  }
}
