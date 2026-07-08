import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/api/client';
import type {
  ChartRange,
  SearchResult,
  TrackerList,
  TrackerListId,
  TrackerListsResponse,
  TrackerSearchResponse,
  TrackerStocksResponse,
  TrackedStock,
} from '@/api/types';

export function useTracker() {
  const [lists, setLists] = useState<TrackerList[]>([]);
  const [activeListId, setActiveListId] = useState<TrackerListId | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('1D');
  const [stocks, setStocks] = useState<TrackedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [error, setError] = useState('');
  const latestStocksRequestRef = useRef<string | null>(null);

  const activeList = lists.find((list) => list.id === activeListId) ?? null;
  const isHoldingsList = activeList?.list_type === 'holdings';

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
        const holdings = nextLists.find((list) => list.list_type === 'holdings');
        if (holdings) {
          return holdings.id;
        }
        return nextLists[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load watchlists');
    }
  }, []);

  const refreshStocks = useCallback(
    async (listId: TrackerListId | null, range: ChartRange) => {
      if (listId == null) {
        latestStocksRequestRef.current = null;
        setStocks([]);
        return;
      }

      const requestKey = `${listId}:${range}`;
      latestStocksRequestRef.current = requestKey;
      setStocksLoading(true);
      setError('');
      try {
        const path =
          listId === 'holdings'
            ? `/tracker/holdings/stocks?range=${encodeURIComponent(range)}`
            : `/tracker/lists/${listId}/stocks?range=${encodeURIComponent(range)}`;
        const res = await apiGet<TrackerStocksResponse>(path);
        if (latestStocksRequestRef.current !== requestKey) return;
        setStocks(res.stocks ?? []);
      } catch (e) {
        if (latestStocksRequestRef.current !== requestKey) return;
        setError(e instanceof Error ? e.message : 'Failed to load stocks');
        setStocks([]);
      } finally {
        if (latestStocksRequestRef.current === requestKey) {
          setStocksLoading(false);
        }
      }
    },
    [],
  );

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
      refreshStocks(activeListId, chartRange);
    } else {
      setStocks([]);
    }
  }, [activeListId, chartRange, refreshStocks]);

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
      if (activeListId == null || activeListId === 'holdings') {
        throw new Error('No watchlist selected');
      }
      setError('');
      await apiPost(`/tracker/lists/${activeListId}/stocks`, { ticker });
      await refreshStocks(activeListId, chartRange);
      await refreshLists();
    },
    [activeListId, chartRange, refreshLists, refreshStocks],
  );

  const removeStock = useCallback(
    async (ticker: string) => {
      if (activeListId == null || activeListId === 'holdings') {
        return;
      }
      setError('');
      await apiDelete(`/tracker/lists/${activeListId}/stocks/${encodeURIComponent(ticker)}`);
      await refreshStocks(activeListId, chartRange);
      await refreshLists();
    },
    [activeListId, chartRange, refreshLists, refreshStocks],
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
    activeList,
    isHoldingsList,
    setActiveListId,
    chartRange,
    setChartRange,
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
