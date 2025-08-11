import React, { useState, useEffect } from 'react';

const Home = ({ user, token, onLogout }) => {
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const response = await fetch('/home', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok) {
          setHomeData(data);
        } else {
          if (response.status === 401) {
            // Token expired or invalid
            alert('Session expired. Please log in again.');
            onLogout();
          } else {
            setError(data.error || 'Failed to load home page');
          }
        }
      } catch (err) {
        setError('Network error. Please try again.');
        console.error('Home page error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchHomeData();
    }
  }, [token, onLogout]);

  const handleLogout = async () => {
    try {
      await fetch('/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      onLogout();
    }
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card">
              <div className="card-body text-center">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading your portfolio...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
            <button className="btn btn-primary" onClick={handleLogout}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row">
        {/* Header */}
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="h3">Portfolio Dashboard</h1>
            <div>
              <span className="me-3">Welcome, {user?.username || 'User'}!</span>
              <button className="btn btn-outline-secondary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Welcome Card */}
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Welcome Back!</h5>
              <p className="card-text">
                {homeData?.message || 'Welcome to your portfolio dashboard!'}
              </p>
              
              {homeData?.stats && (
                <div className="row mt-4">
                  <div className="col-sm-6">
                    <div className="border rounded p-3 text-center">
                      <h4 className="text-primary">{homeData.stats.total_transactions}</h4>
                      <small className="text-muted">Total Transactions</small>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="border rounded p-3 text-center">
                      <h4 className="text-success">$0.00</h4>
                      <small className="text-muted">Portfolio Value</small>
                    </div>
                  </div>
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
                <button className="btn btn-primary" disabled>
                  Add Transaction
                </button>
                <button className="btn btn-outline-primary" disabled>
                  View Portfolio
                </button>
                <button className="btn btn-outline-secondary" disabled>
                  Generate Report
                </button>
              </div>
              <small className="text-muted mt-2 d-block">
                Features coming soon!
              </small>
            </div>
          </div>
        </div>

        {/* Session Info */}
        <div className="col-12 mt-4">
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            Your session will expire in 15 minutes of inactivity. The page will automatically redirect you to login when your session expires.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
