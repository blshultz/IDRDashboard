import { useState, useEffect, useCallback } from 'react';
import { Procedure } from '../types';
import { fetchProcedures } from '../services/sheetsService';

interface UseProceduresResult {
  procedures: Procedure[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProcedures(): UseProceduresResult {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchProcedures();
      setProcedures(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { procedures, loading, error, refetch: load };
}
