import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import HomeChart from './homeChart';

const Home = ({ user: userProp, csrfToken, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [chartWidth, setChartWidth] = useState(800);
  const [portfolioData, setPortfolioData] = useState([]);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true);
  const [currentPortfolioValue, setCurrentPortfolioValue] = useState(0);
  const [isLoadingCurrentValue, setIsLoadingCurrentValue] = useState(true);
  const [netWorth, setNetWorth] = useState(null);
  const [plaidInfo, setPlaidInfo] = useState(null);
  const chartContainerRef = useRef(null);
  const location = useLocation();

  const getCsrfToken = useCallback(() => {
    return csrfToken;
  }, [csrfToken]);

  const fetchHomeData = useCallback(async () => {
    try {
      const token = getCsrfToken();
      if (!token) return;

      const response = await fetch('/home', {
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        setMessage(data.message);
        setStats(data.stats);
        setPlaidInfo(data.plaid || null);
      } else {
        console.error('Failed to fetch home data');
      }
    } catch (error) {
      console.error('Error fetching home data:', error);
    }
  }, [csrfToken]);

  const fetchPortfolioData = useCallback(async () => {
    try {
      setIsLoadingPortfolio(true);
      const token = getCsrfToken();
      if (!token) return;

      const response = await fetch('/portfolio-value-over-time', {
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Portfolio data received:', data);
        setPortfolioData(data.portfolio_values || []);
      } else {
        console.error('Failed to fetch portfolio data');
        setError('Failed to load portfolio data');
      }
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      setError('Error loading portfolio data');
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [csrfToken]);

  const fetchNetWorth = useCallback(async () => {
    try {
      const token = getCsrfToken();
      if (!token) return;

      const response = await fetch('/net-worth', {
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': token },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.source === 'plaid') {
          setNetWorth(data);
          setCurrentPortfolioValue(data.total || 0);
        }
      }
    } catch (err) {
      console.error('Error fetching net worth:', err);
    }
  }, [csrfToken]);

  const fetchCurrentPortfolioValue = useCallback(async () => {
    try {
      setIsLoadingCurrentValue(true);
      const token = getCsrfToken();
      if (!token) return;

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

      const response = await fetch('/current-portfolio-value', {
        credentials: 'include',
        headers: {
          'X-CSRF-TOKEN': token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Current portfolio value received:', data);
        setCurrentPortfolioValue(data.current_value || 0);
      } else {
        console.error('Failed to fetch current portfolio value');
      }
    } catch (error) {
      console.error('Error fetching current portfolio value:', error);
    } finally {
      setIsLoadingCurrentValue(false);
    }
  }, [csrfToken]);

  useEffect(() => {
    if (csrfToken) {
      fetchHomeData();
      fetchNetWorth();
      fetchPortfolioData();
      fetchCurrentPortfolioValue();
    }
  }, [csrfToken, fetchHomeData, fetchNetWorth, fetchPortfolioData, fetchCurrentPortfolioValue]);

  // Effect to handle chart resizing
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.offsetWidth);
      }
    };

    // Set initial width after a short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      handleResize();
    }, 100);

    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies
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

  return (
    <div>
      {/* Full-width navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light border-bottom">
        <div className="container-fluid">
          <img src="/capyb.png" alt="Capybara Portfolio" className="navbar-brand" style={{height: '50px', width: 'auto'}} />
          <button 
            className="navbar-toggler" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#navbarSupportedContent" 
            aria-controls="navbarSupportedContent" 
            aria-expanded="false" 
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link 
                  className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} 
                  to="/"
                >
                  Dashboard
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className={`nav-link ${location.pathname === '/accounts' ? 'active' : ''}`}
                  to="/accounts"
                >
                  Accounts
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className="nav-link text-muted"
                  to="/upload"
                >
                  CSV fallback
                </Link>
              </li>
              {/* <li className="nav-item">
                <a className="nav-link" href="/portfolio">Portfolio</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/transactions">Transactions</a>
              </li>
              <li className="nav-item dropdown">
                <a 
                  className="nav-link dropdown-toggle" 
                  href="#" 
                  role="button" 
                  data-bs-toggle="dropdown" 
                  aria-expanded="false"
                >
                  Reports
                </a>
                <ul className="dropdown-menu">
                  <li><a className="dropdown-item" href="/reports/performance">Performance Report</a></li>
                  <li><a className="dropdown-item" href="/reports/tax">Tax Report</a></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><a className="dropdown-item" href="/reports/custom">Custom Report</a></li>
                </ul>
              </li> */}
            </ul>
            <div className="d-flex align-items-center">
              <span className="navbar-text me-3">
                Welcome, {currentUser?.username || 'User'}
              </span>
              <button className="btn btn-outline-danger" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content container */}
      <div className="container mt-4">
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">Portfolio Value Over Time</h5>
              </div>
              <div className="card-body">
                {isLoadingPortfolio ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading portfolio data...</p>
                  </div>
                ) : error ? (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                ) : portfolioData.length > 0 ? (
                  <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }}>
                    <HomeChart 
                      width={chartWidth} 
                      height={400} 
                      portfolioData={portfolioData}
                    />
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No portfolio data available. Upload some transactions to see your portfolio value over time.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="row">
          {/* Welcome Card */}
          <div className="col-md-8">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Welcome Back!</h5>
                <p className="card-text">
                  {message || 'Welcome to your portfolio dashboard!'}
                </p>
                
                {stats && (
                  <div className="row mt-4">
                    {plaidInfo?.has_items ? (
                      <>
                        <div className="col-sm-4">
                          <div className="border rounded p-3 text-center">
                            <h4 className="text-success">
                              ${(netWorth?.total ?? plaidInfo.net_worth ?? 0).toLocaleString()}
                            </h4>
                            <small className="text-muted">Net worth (Plaid)</small>
                          </div>
                        </div>
                        <div className="col-sm-4">
                          <div className="border rounded p-3 text-center">
                            <h4 className="text-primary">${(netWorth?.investments_total ?? plaidInfo.investments_total ?? 0).toLocaleString()}</h4>
                            <small className="text-muted">Investments</small>
                          </div>
                        </div>
                        <div className="col-sm-4">
                          <div className="border rounded p-3 text-center">
                            <h4 className="text-info">${(netWorth?.cash_total ?? plaidInfo.cash_total ?? 0).toLocaleString()}</h4>
                            <small className="text-muted">Cash</small>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-sm-6">
                          <div className="border rounded p-3 text-center">
                            <h4 className="text-primary">{stats.total_transactions}</h4>
                            <small className="text-muted">CSV transactions</small>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="border rounded p-3 text-center">
                            <h4 className="text-success">
                              {isLoadingCurrentValue ? (
                                <div className="spinner-border spinner-border-sm text-success" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </div>
                              ) : (
                                `$${currentPortfolioValue.toLocaleString()}`
                              )}
                            </h4>
                            <small className="text-muted">Portfolio (CSV + yfinance)</small>
                          </div>
                        </div>
                        <div className="col-12 mt-3">
                          <Link to="/accounts" className="btn btn-primary">
                            Connect an institution via Plaid
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Quick Actions</h5>
                <div className="d-grid gap-2">
                  <Link to="/accounts" className="btn btn-primary">
                    Link accounts (Plaid)
                  </Link>
                  <Link to="/upload" className="btn btn-outline-secondary btn-sm">
                    CSV import (fallback)
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Session Info */}
          <div className="col-12 mt-4">
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              Your session will expire after 15 minutes of inactivity. Moving your mouse, clicking, or typing will keep you logged in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
