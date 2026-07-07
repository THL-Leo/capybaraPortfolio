import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/api/client';
import type { NetWorthData, NetWorthSnapshot } from '@/api/types';

export const PORTFOLIO_SYNCED_EVENT = 'portfolio-synced';

export function notifyPortfolioSynced() {
  window.dispatchEvent(new Event(PORTFOLIO_SYNCED_EVENT));
}

export function useNetWorth() {
  const [current, setCurrent] = useState<NetWorthData | null>(null);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nw, history] = await Promise.all([
        apiGet<NetWorthData>('/net-worth'),
        apiGet<{ snapshots: NetWorthSnapshot[] }>('/net-worth-over-time'),
      ]);
      setCurrent(nw);
      setSnapshots(history.snapshots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const onSynced = () => {
      refresh();
    };
    window.addEventListener(PORTFOLIO_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(PORTFOLIO_SYNCED_EVENT, onSynced);
  }, [refresh]);

  return { current, snapshots, loading, error, refresh };
}
