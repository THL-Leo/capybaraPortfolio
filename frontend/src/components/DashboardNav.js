import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const DashboardNav = ({ username, onLogout }) => {
  const location = useLocation();
  const isOverview = location.pathname === '/';
  const isDetails = location.pathname === '/accounts';

  return (
    <nav className="navbar navbar-expand-lg capy-nav">
      <div className="container-fluid dashboard-page py-0">
        <Link to="/" className="navbar-brand">
          <img src="/capyb.png" alt="Capybara Portfolio" />
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#capyNav"
          aria-controls="capyNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="capyNav">
          <div className="capy-view-tabs mx-lg-auto my-2 my-lg-0">
            <Link
              to="/"
              className={`capy-view-tab ${isOverview ? 'active' : ''}`}
            >
              Overview
            </Link>
            <Link
              to="/accounts"
              className={`capy-view-tab ${isDetails ? 'active' : ''}`}
            >
              Details
            </Link>
          </div>
          <ul className="navbar-nav ms-lg-auto mb-2 mb-lg-0 align-items-lg-center">
            <li className="nav-item">
              <Link
                className={`nav-link text-muted-fallback ${location.pathname === '/upload' ? 'active' : ''}`}
                to="/upload"
              >
                CSV import
              </Link>
            </li>
          </ul>
          <div className="d-flex align-items-center gap-2 ms-lg-2">
            {username && (
              <span className="navbar-text text-muted small d-none d-md-inline">
                {username}
              </span>
            )}
            {onLogout && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary capy-btn-outline"
                onClick={onLogout}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default DashboardNav;
