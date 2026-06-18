import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TickerSearchProps {
  onAdd: (ticker: string) => Promise<void>;
  onSearch: (query: string) => Promise<SearchResult[]>;
  disabled?: boolean;
}

export function TickerSearch({ onAdd, onSearch, disabled }: TickerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const next = await onSearch(query);
        setResults(next);
        setOpen(next.length > 0);
        setHighlightIndex(-1);
      } catch {
        setResults([]);
        setOpen(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = useCallback(
    async (ticker: string) => {
      const symbol = ticker.trim();
      if (!symbol) {
        return;
      }
      setAdding(true);
      try {
        await onAdd(symbol);
        setQuery('');
        setResults([]);
        setOpen(false);
      } finally {
        setAdding(false);
      }
    },
    [onAdd],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (highlightIndex >= 0 && results[highlightIndex]) {
      await handleAdd(results[highlightIndex].symbol);
      return;
    }
    await handleAdd(query);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2">
      <div ref={containerRef} className="relative min-w-[240px] flex-1">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by ticker or company name"
          disabled={disabled || adding}
          autoComplete="off"
        />
        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-md">
            {results.map((result, index) => (
              <button
                key={result.symbol}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-capy-primary/10',
                  index === highlightIndex && 'bg-capy-primary/15',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleAdd(result.symbol)}
              >
                <span className="font-medium">{result.symbol}</span>
                <span className="ml-3 truncate text-capy-muted">{result.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button type="submit" disabled={disabled || adding || !query.trim()}>
        {adding ? 'Adding…' : 'Add'}
      </Button>
    </form>
  );
}
