import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import NetWorthChart from './homeChart';
import DashboardNav from './DashboardNav';

const CHART_HEIGHT = 240;

const formatCategory = (cat) =>
  cat ? cat.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '';

const formatShortDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Accounts = ({ csrfToken, user, onLogout }) => {
  const [linkToken, setLinkToken] = useState(null);
  const [linkTokenLoading, setLinkTokenLoading] = useState(false);
  const [shouldOpenLink, setShouldOpenLink] = useState(false);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [cardTransactions, setCardTransactions] = useState([]);
  const [spendingSummary, setSpendingSummary] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [csvPortfolio, setCsvPortfolio] = useState(null);
  const [csvHistory, setCsvHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  const hasPlaid = items.length > 0;
  const cashAccounts = accounts.filter((a) => a.type === 'depository');

  const csvHoldings = csvPortfolio?.holdings || {};
  const csvCashValue = csvHoldings.CASH?.value ?? 0;
  const csvInvestmentRows = useMemo(() => {
    const holdingsMap = csvPortfolio?.holdings || {};
    return Object.entries(holdingsMap)
      .filter(([symbol]) => symbol !== 'CASH')
      .map(([symbol, h]) => ({
        symbol,
        quantity: h.quantity,
        value: h.value,
        price: h.current_price,
      }));
  }, [csvPortfolio]);

  const chartSource = hasPlaid ? 'plaid' : 'csv';
  const chartData = hasPlaid
    ? snapshots.map((s) => ({ date: s.date, value: s.total }))
    : csvHistory;

  const cashCount = hasPlaid ? cashAccounts.length : (csvCashValue > 0 ? 1 : 0);
  const investmentCount = hasPlaid ? holdings.length : csvInvestmentRows.length;
  const creditCount = creditCards.length;

  const cardNameById = useMemo(() => {
    const map = {};
    creditCards.forEach((c) => {
      map[c.account_id] = c.name || c.official_name || 'Credit card';
    });
    return map;
  }, [creditCards]);

  const fetchNetWorthHistory = useCallback(async () => {
    if (!csrfToken) return;
    try {
      const response = await fetch('/net-worth-over-time', {
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': csrfToken },
      });
      if (response.ok) {
        const data = await response.json();
        setSnapshots(data.snapshots || []);
      }
    } catch (err) {
      console.error('Failed to load net worth history', err);
    }
  }, [csrfToken]);

  const fetchCsvPortfolio = useCallback(async () => {
    if (!csrfToken) return;
    try {
      const headers = { 'X-CSRF-TOKEN': csrfToken };
      const [valueRes, historyRes] = await Promise.all([
        fetch('/current-portfolio-value', { credentials: 'include', headers }),
        fetch('/portfolio-value-over-time', { credentials: 'include', headers }),
      ]);
      if (valueRes.ok) {
        setCsvPortfolio(await valueRes.json());
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setCsvHistory(data.portfolio_values || []);
      }
    } catch (err) {
      console.error('Failed to load CSV portfolio data', err);
    }
  }, [csrfToken]);

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
        setCreditCards(data.credit_cards || []);
        setCardTransactions(data.card_transactions || []);
        setSpendingSummary(data.spending_summary || null);
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
    if (!csrfToken) return null;
    setLinkTokenLoading(true);
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
        return data.link_token;
      }
      const data = await response.json();
      setError(data.error || 'Failed to create link token');
      return null;
    } catch (err) {
      setError('Failed to create link token');
      return null;
    } finally {
      setLinkTokenLoading(false);
    }
  }, [csrfToken]);

  useEffect(() => {
    fetchAccounts();
    fetchNetWorthHistory();
    fetchCsvPortfolio();
  }, [fetchAccounts, fetchNetWorthHistory, fetchCsvPortfolio]);

  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.offsetWidth);
      }
    };
    const timer = setTimeout(handleResize, 100);
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, chartData.length]);

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
        fetchNetWorthHistory();
        setLinkToken(null);
      } else {
        setError(data.error || 'Failed to link institution');
      }
    } catch (err) {
      setError('Failed to link institution');
    }
  }, [csrfToken, fetchAccounts, fetchNetWorthHistory]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  useEffect(() => {
    if (shouldOpenLink && linkToken && ready) {
      open();
      setShouldOpenLink(false);
    }
  }, [shouldOpenLink, linkToken, ready, open]);

  const handleConnect = () => {
    if (linkToken && ready) {
      open();
    } else {
      setShouldOpenLink(true);
      fetchLinkToken();
    }
  };

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
        fetchNetWorthHistory();
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
        fetchNetWorthHistory();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to unlink');
      }
    } catch (err) {
      setError('Failed to unlink');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      onLogout?.();
    }
  };

  const formatMoney = (n) =>
    n != null ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <div>
      <DashboardNav
        username={user?.username}
        onLogout={onLogout ? handleLogout : undefined}
      />

      <div className="dashboard-page">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
          <div>
            <h2 className="mb-0">Portfolio Details</h2>
            <p className="text-muted small mb-0 mt-1">
              Cash, holdings, and history — from Plaid or CSV import
            </p>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status" />
          </div>
        ) : (
          <>
            <div className="capy-card">
              <div className="capy-card-header">
                <h5>{chartSource === 'plaid' ? 'Net Worth Over Time' : 'Portfolio Value Over Time'}</h5>
                <span className="capy-badge">{chartSource === 'plaid' ? 'Plaid' : 'CSV'}</span>
              </div>
              <div className="capy-card-body">
                {chartData.length > 0 ? (
                  <>
                    <div
                      ref={chartContainerRef}
                      className="capy-chart-wrap"
                      style={{ height: CHART_HEIGHT }}
                    >
                      <NetWorthChart
                        width={chartWidth}
                        height={CHART_HEIGHT}
                        data={chartData}
                      />
                    </div>
                    {chartSource === 'plaid' && chartData.length === 1 && (
                      <p className="capy-chart-footnote">
                        One data point recorded — your trend line will appear after the next sync.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted mb-0 text-center py-3">
                    {hasPlaid
                      ? 'History builds after each sync. Click Refresh below to record your first snapshot.'
                      : 'No history yet. Upload a CSV on the import page or connect an institution via Plaid.'}
                  </p>
                )}
              </div>
            </div>

            <div className="capy-card">
              <div className="capy-card-header p-0 border-0">
                <ul className="nav nav-tabs capy-tabs card-header-tabs ms-2 mt-2 w-100">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link ${activeTab === 'cash' ? 'active' : ''}`}
                      onClick={() => setActiveTab('cash')}
                    >
                      Cash ({cashCount})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link ${activeTab === 'investments' ? 'active' : ''}`}
                      onClick={() => setActiveTab('investments')}
                    >
                      Investments ({investmentCount})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link ${activeTab === 'credit' ? 'active' : ''}`}
                      onClick={() => setActiveTab('credit')}
                    >
                      Credit cards ({creditCount})
                    </button>
                  </li>
                </ul>
              </div>
              <div className="capy-card-body p-0">
                {activeTab === 'cash' && (
                  hasPlaid ? (
                    cashAccounts.length === 0 ? (
                      <p className="text-muted p-3 mb-0">No cash accounts linked</p>
                    ) : (
                      <table className="table mb-0">
                        <tbody>
                          {cashAccounts.map((a) => (
                            <tr key={a.account_id}>
                              <td>
                                {a.name} {a.mask && `(••${a.mask})`}
                              </td>
                              <td className="text-end">{formatMoney(a.current_balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  ) : csvCashValue > 0 ? (
                    <table className="table mb-0">
                      <tbody>
                        <tr>
                          <td>Cash (from CSV)</td>
                          <td className="text-end">{formatMoney(csvCashValue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted p-3 mb-0">
                      No cash positions. Link a bank via Plaid or import transactions with cash balances.
                    </p>
                  )
                )}
                {activeTab === 'investments' && (
                  hasPlaid ? (
                    holdings.length === 0 ? (
                      <p className="text-muted p-3 mb-0">No holdings linked yet</p>
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
                    )
                  ) : csvInvestmentRows.length === 0 ? (
                    <p className="text-muted p-3 mb-0">
                      No holdings yet. Import a Schwab CSV or connect a brokerage via Plaid.
                    </p>
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
                        {csvInvestmentRows.map((h) => (
                          <tr key={h.symbol}>
                            <td>{h.symbol}</td>
                            <td className="text-end">
                              {h.quantity != null ? Number(h.quantity).toFixed(2) : '—'}
                            </td>
                            <td className="text-end">{formatMoney(h.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
                {activeTab === 'credit' && (
                  !hasPlaid ? (
                    <p className="text-muted p-3 mb-0">
                      Connect a bank via Plaid to track credit card balances and spending.
                    </p>
                  ) : creditCards.length === 0 ? (
                    <p className="text-muted p-3 mb-0">
                      No credit cards found on linked institutions. Re-link an institution that includes
                      credit accounts, then click Refresh.
                    </p>
                  ) : (
                    <>
                      <div className="px-3 pt-3 pb-2 border-bottom">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                          <div>
                            <div className="stat-card-label">Spending this month</div>
                            <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
                              {formatMoney(spendingSummary?.month_to_date ?? 0)}
                            </div>
                            <div className="stat-card-sub">{spendingSummary?.month_label || 'This month'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="px-3 py-2 border-bottom">
                        <div className="stat-card-label mb-2">Linked cards</div>
                        <table className="table table-sm mb-0">
                          <tbody>
                            {creditCards.map((card) => (
                              <tr key={card.account_id}>
                                <td>
                                  {card.name || card.official_name}
                                  {card.mask && ` (••${card.mask})`}
                                </td>
                                <td className="text-end text-muted small">Balance owed</td>
                                <td className="text-end">{formatMoney(card.current_balance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {cardTransactions.length === 0 ? (
                        <p className="text-muted p-3 mb-0">
                          No transactions yet. If you linked before spending tracking was added, reconnect
                          the institution and click Refresh to pull card history.
                        </p>
                      ) : (
                        <table className="table mb-0">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Description</th>
                              <th>Card</th>
                              <th className="text-end">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cardTransactions.map((tx) => (
                              <tr key={tx.transaction_id} className={tx.pending ? 'text-muted' : ''}>
                                <td className="text-nowrap">{formatShortDate(tx.transaction_date)}</td>
                                <td>
                                  {tx.merchant_name || tx.name || '—'}
                                  {tx.pending ? (
                                    <span className="badge bg-light text-muted ms-1">Pending</span>
                                  ) : null}
                                  {tx.category_primary && (
                                    <div className="small text-muted">
                                      {formatCategory(tx.category_primary)}
                                    </div>
                                  )}
                                </td>
                                <td className="small text-muted">
                                  {cardNameById[tx.account_id] || '—'}
                                </td>
                                <td className="text-end text-nowrap">
                                  {tx.amount > 0 ? (
                                    <span className="text-danger">−{formatMoney(tx.amount)}</span>
                                  ) : (
                                    <span className="text-success">+{formatMoney(Math.abs(tx.amount))}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )
                )}
              </div>
            </div>

            <div className="capy-card">
              <div className="capy-card-header">
                <h5>Link accounts (Plaid)</h5>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm capy-btn-primary"
                    onClick={handleConnect}
                    disabled={linkTokenLoading}
                  >
                    {linkTokenLoading ? 'Loading…' : 'Connect institution'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary capy-btn-outline"
                    onClick={handleSync}
                    disabled={syncing || !hasPlaid}
                  >
                    {syncing ? 'Syncing…' : 'Refresh'}
                  </button>
                </div>
              </div>
              <div className="capy-card-body">
                <details className="capy-sandbox-details mb-3">
                  <summary>Sandbox phone &amp; login hints</summary>
                  <div className="alert alert-info mb-0">
                    <strong>Sandbox phone step:</strong> Plaid may ask for a phone number before you pick a bank.
                    Real numbers often fail in Sandbox. Use test number <code>415-555-0010</code> and OTP{' '}
                    <code>123456</code>, or skip the phone step if Link offers that option. Institution login is
                    still <code>user_good</code> / <code>pass_good</code>.
                  </div>
                </details>

                {!hasPlaid ? (
                  <p className="text-muted mb-0">
                    Optional — connect a bank or brokerage to sync balances automatically. You can still use
                    the Details tab with CSV-imported data.
                  </p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {items.map((item) => (
                      <li
                        key={item.item_id}
                        className="list-group-item d-flex justify-content-between align-items-center px-0"
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
          </>
        )}
      </div>
    </div>
  );
};

export default Accounts;
