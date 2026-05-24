import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import HomeChart from './homeChart';
import DashboardNav from './DashboardNav';
import StatCard from './StatCard';

const CHART_HEIGHT = 320;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const formatMoney = (n) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Home = ({ csrfToken, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [chartWidth, setChartWidth] = useState(800);
  const [portfolioData, setPortfolioData] = useState([]);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true);
  const [currentPortfolioValue, setCurrentPortfolioValue] = useState(0);
  const [isLoadingCurrentValue, setIsLoadingCurrentValue] = useState(true);
  const [netWorth, setNetWorth] = useState(null);
  const [plaidInfo, setPlaidInfo] = useState(null);
  const [chartSource, setChartSource] = useState('csv');
  const chartContainerRef = useRef(null);

  const getCsrfToken = useCallback(() => csrfToken, [csrfToken]);

  const fetchHomeData = useCallback(async () => {
    try {
      const token = getCsrfToken();
      if (!token) return null;

      const response = await fetch('/home', {
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': token },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        setPlaidInfo(data.plaid || null);
        return data.plaid?.has_items ?? false;
      }
      return false;
    } catch (err) {
      console.error('Error fetching home data:', err);
      return false;
    }
  }, [getCsrfToken]);

  const fetchChartData = useCallback(async (hasPlaid) => {
    try {
      setIsLoadingPortfolio(true);
      setError('');
      const token = getCsrfToken();
      if (!token) return;

      if (hasPlaid) {
        const response = await fetch('/net-worth-over-time', {
          credentials: 'include',
          headers: { 'X-CSRF-TOKEN': token },
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          setPortfolioData(
            (data.snapshots || []).map((s) => ({ date: s.date, value: s.total })),
          );
          setChartSource('plaid');
        } else {
          setPortfolioData([]);
          setChartSource('plaid');
          setError(data.error || `Unable to load net worth history (${response.status})`);
        }
      } else {
        const response = await fetch('/portfolio-value-over-time', {
          credentials: 'include',
          headers: { 'X-CSRF-TOKEN': token },
        });
        if (response.ok) {
          const data = await response.json();
          setPortfolioData(data.portfolio_values || []);
          setChartSource('csv');
        } else {
          setError('Failed to load portfolio data');
        }
      }
    } catch (err) {
      setError('Error loading chart data');
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [getCsrfToken]);

  const fetchCurrentPortfolioValue = useCallback(async (hasPlaid) => {
    try {
      setIsLoadingCurrentValue(true);
      const token = getCsrfToken();
      if (!token) return;

      if (hasPlaid) {
        const nwResponse = await fetch('/net-worth', {
          credentials: 'include',
          headers: { 'X-CSRF-TOKEN': token },
        });
        if (nwResponse.ok) {
          const nwData = await nwResponse.json();
          if (nwData.source === 'plaid' && nwData.total != null) {
            setNetWorth(nwData);
            setCurrentPortfolioValue(nwData.total);
            return;
          }
        }
      }

      const response = await fetch('/current-portfolio-value', {
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': token },
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentPortfolioValue(data.current_value || 0);
      }
    } catch (err) {
      console.error('Error fetching current portfolio value:', err);
    } finally {
      setIsLoadingCurrentValue(false);
    }
  }, [getCsrfToken]);

  useEffect(() => {
    if (!csrfToken) return;
    const load = async () => {
      const hasPlaid = await fetchHomeData();
      await Promise.all([
        fetchChartData(hasPlaid),
        fetchCurrentPortfolioValue(hasPlaid),
      ]);
    };
    load();
  }, [csrfToken, fetchHomeData, fetchChartData, fetchCurrentPortfolioValue]);

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
  }, [isLoadingPortfolio, portfolioData.length]);

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
      onLogout();
    }
  };

  const displayTotal = plaidInfo?.has_items
    ? (netWorth?.total ?? plaidInfo.net_worth ?? 0)
    : currentPortfolioValue;
  const cashTotal = netWorth?.cash_total ?? plaidInfo?.cash_total ?? 0;
  const investTotal = netWorth?.investments_total ?? plaidInfo?.investments_total ?? 0;
  const institutionCount = plaidInfo?.linked_institutions ?? 0;

  return (
    <div>
      <DashboardNav
        username={currentUser?.username}
        onLogout={handleLogout}
      />

      <div className="dashboard-page">
        <div className="capy-hero">
          <div>
            <h1 className="capy-hero-greeting">
              {getGreeting()}, {currentUser?.username || 'there'}
            </h1>
            <p className="capy-hero-sub">
              {plaidInfo?.has_items
                ? 'Your linked accounts at a glance'
                : 'Connect accounts or import CSV to get started'}
            </p>
          </div>
          <div className="text-md-end">
            <p className="capy-hero-label">Total net worth</p>
            <p className="capy-hero-value">
              {isLoadingCurrentValue ? '…' : formatMoney(displayTotal)}
            </p>
          </div>
        </div>

        {plaidInfo?.has_items ? (
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <StatCard
                label="Cash"
                value={formatMoney(cashTotal)}
                icon="💵"
                accent="var(--capy-accent-cash)"
              />
            </div>
            <div className="col-md-4">
              <StatCard
                label="Investments"
                value={formatMoney(investTotal)}
                icon="📈"
                accent="var(--capy-accent-invest)"
              />
            </div>
            <div className="col-md-4">
              <StatCard
                label="Institutions"
                value={institutionCount}
                subtitle="Linked via Plaid"
                icon="🏦"
                accent="var(--capy-accent-inst)"
              />
            </div>
          </div>
        ) : (
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <StatCard
                label="Portfolio value"
                value={isLoadingCurrentValue ? '…' : formatMoney(currentPortfolioValue)}
                subtitle="CSV + yfinance"
                icon="📊"
                accent="var(--capy-primary)"
              />
            </div>
            <div className="col-md-6">
              <StatCard
                label="Linked accounts"
                value="None yet"
                subtitle="Connect via Plaid on Accounts"
                icon="🔗"
                accent="var(--capy-muted)"
              />
            </div>
          </div>
        )}

        <div className="capy-card">
          <div className="capy-card-header">
            <h5>
              {chartSource === 'plaid' ? 'Net Worth Over Time' : 'Portfolio Value Over Time'}
            </h5>
            <span className="capy-badge">{chartSource === 'plaid' ? 'Plaid' : 'CSV'}</span>
          </div>
          <div className="capy-card-body">
            {isLoadingPortfolio ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status" />
                <p className="mt-2 text-muted">Loading chart…</p>
              </div>
            ) : error ? (
              <div className="alert alert-danger mb-0">{error}</div>
            ) : portfolioData.length > 0 ? (
              <>
                <div ref={chartContainerRef} className="capy-chart-wrap" style={{ height: CHART_HEIGHT }}>
                  <HomeChart
                    width={chartWidth}
                    height={CHART_HEIGHT}
                    portfolioData={portfolioData}
                  />
                </div>
                {chartSource === 'plaid' && portfolioData.length === 1 && (
                  <p className="capy-chart-footnote">
                    One data point recorded — your trend line will appear after the next daily sync.
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted mb-0">
                  {chartSource === 'plaid'
                    ? 'History builds after each sync — go to Accounts and click Refresh.'
                    : 'No portfolio data yet. Upload transactions or connect accounts via Plaid.'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="capy-actions">
          <Link to="/accounts" className="btn capy-btn-primary">
            View details
          </Link>
          <Link to="/upload" className="btn btn-outline-secondary capy-btn-outline">
            CSV import
          </Link>
        </div>

        <p className="capy-footer-note">
          Session expires after 15 minutes of inactivity.
        </p>
      </div>
    </div>
  );
};

export default Home;
