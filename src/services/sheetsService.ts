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
