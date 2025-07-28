// Application constants and configuration

export const APP_CONFIG = {
  name: 'Portfolio Tracker',
  version: '1.0.0',
  description: 'Personal Portfolio Tracker with Plaid Integration'
};

export const API_ENDPOINTS = {
  auth: {
    login: '/api/login',
    register: '/api/register',
    verifyInvitation: '/api/verify-invitation'
  },
  plaid: {
    createLinkToken: '/api/create_link_token',
    exchangePublicToken: '/api/exchange_public_token'
  },
  portfolio: {
    accounts: '/api/accounts',
    transactions: '/api/transactions',
    refreshTransactions: '/api/refresh_transactions',
    investments: '/api/investments'
  }
};

export const STORAGE_KEYS = {
  token: 'token',
  user: 'user'
};

export const RATE_LIMITS = {
  auth: {
    maxAttempts: 5,
    windowMs: 60000 // 1 minute
  },
  api: {
    maxRequests: 100,
    windowMs: 60000 // 1 minute
  }
};

export const TIMEOUTS = {
  api: 10000, // 10 seconds
  plaidLink: 15000 // 15 seconds
}; 