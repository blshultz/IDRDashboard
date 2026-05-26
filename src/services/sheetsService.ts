import { Procedure } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function fetchProcedures(): Promise<Procedure[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sheets-data`, {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch sheet data (${res.status}): ${body}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(json.error);
  }

  return json.rows as Procedure[];
}
