import { useState } from 'react';
import { TrackerGrid } from '@/components/TrackerGrid';
import { TickerSearch } from '@/components/TickerSearch';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
    <div className="space-y-8">
      <PageHeader
        title="Tracker"
        description="Track stocks across your watchlists"
        actions={
          hasLists ? (
            <>
              {activeListId != null && (
                <Button variant="outline" size="sm" onClick={handleDeleteList}>
                  Delete list
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowNewList((value) => !value)}>
                + New list
              </Button>
            </>
          ) : undefined
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      {!hasLists ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create a list to see stock trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
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

          <div className="flex flex-wrap gap-1 border-b border-border/60">
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setActiveListId(list.id)}
                className={cn(
                  'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  activeListId === list.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {list.name}
                {list.stock_count != null && (
                  <span className="ml-1 text-xs opacity-60">({list.stock_count})</span>
                )}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{activeList?.name ?? 'Watchlist'}</CardTitle>
            </CardHeader>
            {stocksLoading && <Progress className="rounded-none" />}
            <CardContent className="space-y-4">
              <TickerSearch
                onAdd={handleAddStock}
                onSearch={searchTickers}
                disabled={activeListId == null || stocksLoading}
              />
              {stocksLoading ? (
                <div className="min-h-48" aria-hidden />
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
