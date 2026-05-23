import React, { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePlaidLink } from 'react-plaid-link';

const Accounts = ({ csrfToken }) => {
  const location = useLocation();
  const [linkToken, setLinkToken] = useState(null);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchAccounts = useCallback(async () => {
    if (!csrfToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/accounts', {
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': csrfToken },
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        setAccounts(data.accounts || []);
        setHoldings(data.holdings || []);
      } else {
        setError('Failed to load accounts');
      }
    } catch (err) {
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  const fetchLinkToken = useCallback(async () => {
    if (!csrfToken) return;
    try {
      const response = await fetch('/plaid/link-token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setLinkToken(data.link_token);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create link token');
      }
    } catch (err) {
      setError('Failed to create link token');
    }
  }, [csrfToken]);

  useEffect(() => {
    fetchAccounts();
    fetchLinkToken();
  }, [fetchAccounts, fetchLinkToken]);

  const onSuccess = useCallback(async (publicToken) => {
    setError('');
    setMessage('');
    try {
      const response = await fetch('/plaid/exchange-token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Institution linked');
        fetchAccounts();
        fetchLinkToken();
      } else {
        setError(data.error || 'Failed to link institution');
      }
    } catch (err) {
      setError('Failed to link institution');
    }
  }, [csrfToken, fetchAccounts, fetchLinkToken]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/plaid/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Sync complete');
        fetchAccounts();
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async (itemId) => {
    if (!window.confirm('Unlink this institution?')) return;
    try {
      const response = await fetch(`/plaid/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': csrfToken },
      });
      if (response.ok) {
        setMessage('Institution unlinked');
        fetchAccounts();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to unlink');
      }
    } catch (err) {
      setError('Failed to unlink');
    }
  };

  const formatMoney = (n) =>
    n != null ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light border-bottom mb-4">
        <div className="container-fluid">
          <Link to="/" className="navbar-brand">
            <img src="/capyb.png" alt="Capybara Portfolio" style={{ height: '50px', width: 'auto' }} />
          </Link>
          <div className="navbar-nav">
            <Link className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} to="/">Dashboard</Link>
            <Link className={`nav-link ${location.pathname === '/accounts' ? 'active' : ''}`} to="/accounts">Accounts</Link>
            <Link className="nav-link text-muted" to="/upload">CSV fallback</Link>
          </div>
        </div>
      </nav>

      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Linked Accounts</h2>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => open()}
              disabled={!ready || !linkToken}
            >
              Connect institution
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleSync}
              disabled={syncing || items.length === 0}
            >
              {syncing ? 'Syncing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : (
          <>
            <div className="card mb-4">
              <div className="card-header">Institutions</div>
              <div className="card-body">
                {items.length === 0 ? (
                  <p className="text-muted mb-0">
                    No institutions linked yet. In Plaid Sandbox, choose a test bank or brokerage when connecting.
                  </p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {items.map((item) => (
                      <li
                        key={item.item_id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <strong>{item.institution_name || item.item_id}</strong>
                          <br />
                          <small className="text-muted">
                            Status: {item.status}
                            {item.last_sync_at && ` · Last sync: ${new Date(item.last_sync_at).toLocaleString()}`}
                          </small>
                          {item.error_message && (
                            <div className="text-warning small">{item.error_message}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleUnlink(item.item_id)}
                        >
                          Unlink
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-4">
                <div className="card h-100">
                  <div className="card-header">Cash accounts</div>
                  <div className="card-body p-0">
                    {accounts.filter((a) => a.type === 'depository').length === 0 ? (
                      <p className="text-muted p-3 mb-0">No cash accounts</p>
                    ) : (
                      <table className="table mb-0">
                        <tbody>
                          {accounts
                            .filter((a) => a.type === 'depository')
                            .map((a) => (
                              <tr key={a.account_id}>
                                <td>
                                  {a.name} {a.mask && `(••${a.mask})`}
                                </td>
                                <td className="text-end">{formatMoney(a.current_balance)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-md-6 mb-4">
                <div className="card h-100">
                  <div className="card-header">Investment holdings</div>
                  <div className="card-body p-0">
                    {holdings.length === 0 ? (
                      <p className="text-muted p-3 mb-0">No holdings yet</p>
                    ) : (
                      <table className="table mb-0">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th className="text-end">Qty</th>
                            <th className="text-end">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.map((h) => (
                            <tr key={`${h.account_id}-${h.security_id}`}>
                              <td>{h.ticker_symbol || h.security_name || '—'}</td>
                              <td className="text-end">
                                {h.quantity != null ? Number(h.quantity).toFixed(2) : '—'}
                              </td>
                              <td className="text-end">{formatMoney(h.institution_value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Accounts;
