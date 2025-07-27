// backend/server.js - Modified for Vercel deployment
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database setup - Neon connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Plaid setup (unchanged)
const configuration = new Configuration({
  basePath: process.env.NODE_ENV === 'production' 
    ? PlaidEnvironments.production 
    : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.NODE_ENV === 'production' 
        ? process.env.PLAID_SECRET_PRODUCTION 
        : process.env.PLAID_SECRET_SANDBOX,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Invitation codes
const VALID_INVITATIONS = {
  'PORTFOLIO_ALPHA': { email: 'user1@example.com', used: false },
  'PORTFOLIO_BETA': { email: 'user2@example.com', used: false }
};

// Initialize database tables
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS plaid_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        access_token TEXT NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS portfolios (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        account_name VARCHAR(255),
        account_type VARCHAR(50),
        institution VARCHAR(100),
        balance DECIMAL(15,2),
        last_updated TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS holdings (
        id SERIAL PRIMARY KEY,
        portfolio_id INTEGER REFERENCES portfolios(id),
        symbol VARCHAR(10),
        shares DECIMAL(15,4),
        avg_cost DECIMAL(10,2),
        current_price DECIMAL(10,2),
        last_updated TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Initialize tables on startup
createTables();

// Middleware
const validateInvitation = async (req, res, next) => {
  const { invitationCode } = req.body;
  
  if (!VALID_INVITATIONS[invitationCode] || VALID_INVITATIONS[invitationCode].used) {
    return res.status(400).json({ error: 'Invalid or expired invitation code' });
  }
  
  req.invitation = VALID_INVITATIONS[invitationCode];
  next();
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/register', validateInvitation, async (req, res) => {
  try {
    const { email, password, invitationCode } = req.body;
    
    if (email !== req.invitation.email) {
      return res.status(400).json({ error: 'Email does not match invitation' });
    }
    
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, NOW()) RETURNING id, email',
      [email, hashedPassword]
    );
    
    VALID_INVITATIONS[invitationCode].used = true;
    
    const token = jwt.sign(
      { userId: result.rows[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.rows[0].id, email }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Plaid Routes
app.post('/api/create_link_token', authenticateToken, async (req, res) => {
  try {
    const request = {
      user: {
        client_user_id: req.user.userId.toString()
      },
      client_name: "Portfolio Tracker",
      products: ['transactions', 'liabilities'],
      optional_products: ['assets'],
      country_codes: ['US'],
      language: 'en',
    };
    
    const response = await plaidClient.linkTokenCreate(request);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Link token error:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

app.post('/api/exchange_public_token', authenticateToken, async (req, res) => {
  try {
    const { public_token } = req.body;
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token
    });
    
    const accessToken = response.data.access_token;
    
    await pool.query(
      'INSERT INTO plaid_items (user_id, access_token, item_id) VALUES ($1, $2, $3)',
      [req.user.userId, accessToken, response.data.item_id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const userTokens = await pool.query(
      'SELECT access_token FROM plaid_items WHERE user_id = $1',
      [req.user.userId]
    );
    
    const allAccounts = [];
    
    for (const tokenRow of userTokens.rows) {
      const response = await plaidClient.accountsGet({
        access_token: tokenRow.access_token
      });
      
      allAccounts.push(...response.data.accounts);
    }
    
    const investmentAccounts = allAccounts.filter(account => 
      ['investment', 'brokerage', 'ira', '401k'].includes(account.subtype)
    );
    
    res.json(investmentAccounts);
  } catch (error) {
    console.error('Accounts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const userTokens = await pool.query(
      'SELECT access_token FROM plaid_items WHERE user_id = $1',
      [req.user.userId]
    );
    
    const allTransactions = [];
    
    for (const tokenRow of userTokens.rows) {
      const response = await plaidClient.transactionsGet({
        access_token: tokenRow.access_token,
        start_date: startDate || '2024-01-01',
        end_date: endDate || new Date().toISOString().split('T')[0],
        count: 500
      });
      
      allTransactions.push(...response.data.transactions);
    }
    
    res.json(allTransactions);
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/liabilities', authenticateToken, async (req, res) => {
  try {
    const userTokens = await pool.query(
      'SELECT access_token FROM plaid_items WHERE user_id = $1',
      [req.user.userId]
    );
    
    const allLiabilities = [];
    
    for (const tokenRow of userTokens.rows) {
      const response = await plaidClient.liabilitiesGet({
        access_token: tokenRow.access_token
      });
      
      if (response.data.liabilities) {
        allLiabilities.push(response.data.liabilities);
      }
    }
    
    res.json(allLiabilities);
  } catch (error) {
    console.error('Liabilities fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch liabilities' });
  }
});

app.post('/api/refresh_transactions', authenticateToken, async (req, res) => {
  try {
    const userTokens = await pool.query(
      'SELECT access_token FROM plaid_items WHERE user_id = $1',
      [req.user.userId]
    );
    
    for (const tokenRow of userTokens.rows) {
      await plaidClient.transactionsRefresh({
        access_token: tokenRow.access_token
      });
    }
    
    res.json({ message: 'Refresh initiated' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh data' });
  }
});

// Placeholder for investments (add after approval)
app.get('/api/investments', authenticateToken, async (req, res) => {
  try {
    res.status(501).json({ 
      error: 'Investments data not available yet - waiting for Plaid approval' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Investments feature pending' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// For Vercel, we need to export the app as a serverless function
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;