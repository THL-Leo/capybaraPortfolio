import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/api/client';
import type { SpendingAnalyticsResponse } from '@/api/types';

export function useSpending(month?: string) {
  const [data, setData] = useState<SpendingAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = month ? `?month=${month}` : '';
      const res = await apiGet<SpendingAnalyticsResponse>(`/spending/analytics${qs}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spending');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
