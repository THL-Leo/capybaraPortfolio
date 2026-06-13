import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlaidLink } from 'react-plaid-link';
import { apiDelete, apiPost } from '@/api/client';
import { useAccounts } from '@/hooks/useAccounts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/lib/utils';

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
    try {
      await apiPost('/plaid/sync');
      setMessage('Sync complete');
      refresh();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="text-sm text-capy-muted">Linked institutions, holdings, and balances</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleConnect}>Connect institution</Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing || !items.length}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>

      {(error || localError) && <Alert variant="destructive">{error || localError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Institutions</CardTitle>
        </CardHeader>
        <CardContent>
          {!items.length ? (
            <p className="text-sm text-capy-muted">
              No institutions linked. Connect a bank or brokerage via Plaid Sandbox.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.item_id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{item.institution_name || item.item_id}</p>
                    <p className="text-xs text-capy-muted">
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Accounts</CardTitle>
          <Badge>{accounts.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.account_id}>
                  <TableCell>
                    <Link to={`/accounts/${acc.account_id}`} className="text-capy-primary hover:underline">
                      {acc.name}
                      {acc.mask && <span className="text-capy-muted"> ···{acc.mask}</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize text-capy-muted">
                    {acc.subtype || acc.type}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(acc.current_balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Holdings</CardTitle>
          <Badge>{holdings.length} positions</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {holdings.length === 0 ? (
            <p className="p-6 text-sm text-capy-muted">No holdings linked yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Gain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => (
                  <TableRow key={`${h.account_id}-${h.security_id}`}>
                    <TableCell>{h.ticker_symbol || h.security_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      {h.quantity != null ? Number(h.quantity).toFixed(2) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(h.market_value)}</TableCell>
                    <TableCell className="text-right">
                      {h.unrealized_gain != null ? (
                        <span className={h.unrealized_gain >= 0 ? 'text-capy-primary' : 'text-destructive'}>
                          {formatMoney(h.unrealized_gain)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
