import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/api/client';
import type {
  SearchResult,
  TrackerList,
  TrackerListsResponse,
  TrackerSearchResponse,
  TrackerStocksResponse,
  TrackedStock,
} from '@/api/types';

export function useTracker() {
  const [lists, setLists] = useState<TrackerList[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [stocks, setStocks] = useState<TrackedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [error, setError] = useState('');
  const latestStocksListIdRef = useRef<number | null>(null);

  const refreshLists = useCallback(async () => {
    setError('');
    try {
      const res = await apiGet<TrackerListsResponse>('/tracker/lists');
      const nextLists = res.lists ?? [];
      setLists(nextLists);
      setActiveListId((current) => {
        if (current && nextLists.some((list) => list.id === current)) {
          return current;
        }
        return nextLists[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load watchlists');
    }
  }, []);

  const refreshStocks = useCallback(async (listId: number | null) => {
    if (listId == null) {
      latestStocksListIdRef.current = null;
      setStocks([]);
      return;
    }

    latestStocksListIdRef.current = listId;
    setStocksLoading(true);
    setError('');
    try {
      const res = await apiGet<TrackerStocksResponse>(`/tracker/lists/${listId}/stocks`);
      if (latestStocksListIdRef.current !== listId) return;
      setStocks(res.stocks ?? []);
    } catch (e) {
      if (latestStocksListIdRef.current !== listId) return;
      setError(e instanceof Error ? e.message : 'Failed to load stocks');
      setStocks([]);
    } finally {
      if (latestStocksListIdRef.current === listId) {
        setStocksLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await refreshLists();
    setLoading(false);
  }, [refreshLists]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (activeListId != null) {
      refreshStocks(activeListId);
    } else {
      setStocks([]);
    }
  }, [activeListId, refreshStocks]);

  const createList = useCallback(
    async (name: string) => {
      setError('');
      const res = await apiPost<{ list: TrackerList }>('/tracker/lists', { name });
      await refreshLists();
      setActiveListId(res.list.id);
      return res.list;
    },
    [refreshLists],
  );

  const deleteList = useCallback(
    async (listId: number) => {
      setError('');
      await apiDelete(`/tracker/lists/${listId}`);
      await refreshLists();
    },
    [refreshLists],
  );

  const addStock = useCallback(
    async (ticker: string) => {
      if (activeListId == null) {
        throw new Error('No watchlist selected');
      }
      setError('');
      await apiPost(`/tracker/lists/${activeListId}/stocks`, { ticker });
      await refreshStocks(activeListId);
      await refreshLists();
    },
    [activeListId, refreshLists, refreshStocks],
  );

  const removeStock = useCallback(
    async (ticker: string) => {
      if (activeListId == null) {
        return;
      }
      setError('');
      await apiDelete(`/tracker/lists/${activeListId}/stocks/${encodeURIComponent(ticker)}`);
      await refreshStocks(activeListId);
      await refreshLists();
    },
    [activeListId, refreshLists, refreshStocks],
  );

  const searchTickers = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) {
      return [];
    }
    const res = await apiGet<TrackerSearchResponse>(
      `/tracker/search?q=${encodeURIComponent(query.trim())}`,
    );
    return res.results ?? [];
  }, []);

  return {
    lists,
    activeListId,
    setActiveListId,
    stocks,
    loading,
    stocksLoading,
    error,
    setError,
    refresh,
    createList,
    deleteList,
    addStock,
    removeStock,
    searchTickers,
  };
}
