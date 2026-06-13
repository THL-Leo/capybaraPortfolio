import { useEffect, useState } from 'react';
import { apiGet } from '@/api/client';
import type { NetWorthData, NetWorthSnapshot } from '@/api/types';

export function useNetWorth() {
  const [current, setCurrent] = useState<NetWorthData | null>(null);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [nw, history] = await Promise.all([
          apiGet<NetWorthData>('/net-worth'),
          apiGet<{ snapshots: NetWorthSnapshot[] }>('/net-worth-over-time'),
        ]);
        if (!cancelled) {
          setCurrent(nw);
          setSnapshots(history.snapshots ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { current, snapshots, loading, error };
}
