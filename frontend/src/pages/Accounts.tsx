import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { apiDelete, apiPost } from '@/api/client';
import { useAccounts } from '@/hooks/useAccounts';
import { notifyPortfolioSynced } from '@/hooks/useNetWorth';
import { AccountsGroupedTable } from '@/components/AccountsGroupedTable';
import { HoldingsGrid } from '@/components/HoldingsGrid';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { groupAccountsBySection } from '@/lib/accountGroups';

export default function Accounts() {
  const { data, loading, error, refresh } = useAccounts();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shouldOpen, setShouldOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setLocalError('');
      try {
        await apiPost('/plaid/exchange-token', { public_token: publicToken });
        setMessage('Institution linked');
        setLinkToken(null);
        refresh();
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : 'Link failed');
      }
    },
    [refresh],
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  useEffect(() => {
    if (shouldOpen && linkToken && ready) {
      open();
      setShouldOpen(false);
    }
  }, [shouldOpen, linkToken, ready, open]);

  const fetchLinkToken = async (itemId?: string) => {
    const res = await apiPost<{ link_token: string }>(
      '/plaid/link-token',
      itemId ? { item_id: itemId } : {},
    );
    setLinkToken(res.link_token);
    return res.link_token;
  };

  const handleConnect = async () => {
    setLocalError('');
    if (linkToken && ready) {
      open();
    } else {
      setShouldOpen(true);
      await fetchLinkToken();
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setLocalError('');
    setMessage('');
    try {
      const res = await apiPost<{ results: { ok: boolean; error?: string }[] }>('/plaid/sync');
      const failed = res.results?.filter((r) => !r.ok) ?? [];
      if (failed.length) {
        setLocalError(failed.map((r) => r.error ?? 'Sync failed').join('; '));
      } else {
        setMessage('Sync complete');
      }
      notifyPortfolioSynced();
      await refresh({ silent: true });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async (itemId: string) => {
    if (!window.confirm('Unlink this institution?')) return;
    try {
      await apiDelete(`/plaid/items/${itemId}`);
      setMessage('Institution unlinked');
      refresh();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Unlink failed');
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const items = data?.items ?? [];
  const accounts = data?.accounts ?? [];
  const holdings = data?.holdings_analytics ?? [];
  const sections = groupAccountsBySection(accounts);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Accounts"
        description="Linked institutions, holdings, and balances"
        actions={
          <>
            <Button onClick={handleConnect}>Connect institution</Button>
            <Button variant="outline" onClick={handleSync} disabled={syncing || !items.length}>
              {syncing ? 'Syncing…' : 'Sync'}
            </Button>
          </>
        }
      />

      {(error || localError) && <Alert variant="destructive">{error || localError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Institutions</CardTitle>
        </CardHeader>
        <CardContent>
          {!items.length ? (
            <p className="text-sm text-muted-foreground">
              No institutions linked. Connect a bank or brokerage via Plaid Sandbox.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((item) => (
                <li
                  key={item.item_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{item.institution_name || item.item_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status}
                      {item.last_sync_at && ` · ${new Date(item.last_sync_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setLinkToken(null);
                        setShouldOpen(true);
                        await fetchLinkToken(item.item_id);
                      }}
                    >
                      Update login
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleUnlink(item.item_id)}>
                      Unlink
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-sm text-muted-foreground">No accounts synced yet.</p>
          </CardContent>
        </Card>
      ) : (
        <AccountsGroupedTable sections={sections} />
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Holdings</CardTitle>
          <Badge>{holdings.length} positions</Badge>
        </CardHeader>
        <CardContent className="p-0 pb-5">
          {holdings.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">No holdings linked yet</p>
          ) : (
            <HoldingsGrid holdings={holdings} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
