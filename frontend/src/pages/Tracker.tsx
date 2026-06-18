import { useState } from 'react';
import { TrackerGrid } from '@/components/TrackerGrid';
import { TickerSearch } from '@/components/TickerSearch';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTracker } from '@/hooks/useTracker';
import { cn } from '@/lib/utils';

export default function Tracker() {
  const {
    lists,
    activeListId,
    setActiveListId,
    stocks,
    loading,
    stocksLoading,
    error,
    setError,
    createList,
    deleteList,
    addStock,
    removeStock,
    searchTickers,
  } = useTracker();

  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [showNewList, setShowNewList] = useState(false);

  const activeList = lists.find((list) => list.id === activeListId);
  const hasLists = lists.length > 0;

  const handleCreateList = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) {
      return;
    }
    setCreatingList(true);
    setError('');
    try {
      await createList(name);
      setNewListName('');
      setShowNewList(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create list');
    } finally {
      setCreatingList(false);
    }
  };

  const handleAddStock = async (ticker: string) => {
    setError('');
    try {
      await addStock(ticker);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add stock');
      throw e;
    }
  };

  const handleRemoveStock = async (ticker: string) => {
    setError('');
    try {
      await removeStock(ticker);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove stock');
    }
  };

  const handleDeleteList = async () => {
    if (activeListId == null) {
      return;
    }
    setError('');
    try {
      await deleteList(activeListId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete list');
    }
  };

  if (loading && !hasLists) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tracker</h1>
          <p className="text-sm text-capy-muted">Track stocks across your watchlists</p>
        </div>
        {hasLists && (
          <div className="flex flex-wrap items-center gap-2">
            {activeListId != null && (
              <Button variant="outline" size="sm" onClick={handleDeleteList}>
                Delete list
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowNewList((value) => !value)}>
              + New list
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {!hasLists ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create a list to see stock trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-capy-muted">
              Build a watchlist to track live prices, daily changes, and intraday charts for the
              stocks you care about.
            </p>
            <form onSubmit={handleCreateList} className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
              <Input
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="List name"
                disabled={creatingList}
                className="min-w-[200px] flex-1"
              />
              <Button type="submit" disabled={creatingList || !newListName.trim()}>
                {creatingList ? 'Creating…' : 'Create list'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {showNewList && (
            <Card>
              <CardHeader>
                <CardTitle>Create watchlist</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateList} className="flex flex-wrap gap-2">
                  <Input
                    value={newListName}
                    onChange={(event) => setNewListName(event.target.value)}
                    placeholder="List name"
                    disabled={creatingList}
                    className="max-w-sm"
                  />
                  <Button type="submit" disabled={creatingList || !newListName.trim()}>
                    {creatingList ? 'Creating…' : 'Create'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setActiveListId(list.id)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium text-capy-muted hover:bg-capy-primary/10 hover:text-capy-primary',
                  activeListId === list.id && 'bg-capy-primary/15 text-capy-primary',
                )}
              >
                {list.name}
                {list.stock_count != null && (
                  <span className="ml-1 text-xs opacity-70">({list.stock_count})</span>
                )}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{activeList?.name ?? 'Watchlist'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TickerSearch
                onAdd={handleAddStock}
                onSearch={searchTickers}
                disabled={activeListId == null}
              />
              {stocksLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <TrackerGrid stocks={stocks} onRemove={handleRemoveStock} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
