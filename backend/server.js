// backend/server.js - Complete server with database invitation codes
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

// Plaid setup
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

// Initialize database tables (updated for invitation codes)
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS invitation_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        used_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        used_at TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
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

// Database-based invitation validation middleware
const validateInvitation = async (req, res, next) => {
  try {
    const { invitationCode } = req.body;
    
    if (!invitationCode) {
      return res.status(400).json({ error: 'Invitation code required' });
    }
    
    // Check invitation code in database
    const result = await pool.query(
      'SELECT * FROM invitation_codes WHERE code = $1',
      [invitationCode]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid invitation code' });
    }
    
    const invitation = result.rows[0];
    
    // Check if already used
    if (invitation.used) {
      return res.status(400).json({ error: 'Invitation code already used' });
    }
    
    // Check if expired
    if (invitation.expires_at && new Date() > new Date(invitation.expires_at)) {
      return res.status(400).json({ error: 'Invitation code has expired' });
    }
    
    req.invitation = invitation;
    next();
  } catch (error) {
    console.error('Invitation validation error:', error);
    res.status(500).json({ error: 'Failed to validate invitation' });
  }
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

// Registration (using database invitation codes)
app.post('/api/register', validateInvitation, async (req, res) => {
  try {
    const { email, password, invitationCode } = req.body;
    
    // Verify email matches invitation
    if (email !== req.invitation.email) {
      return res.status(400).json({ error: 'Email does not match invitation' });
    }
    
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, NOW()) RETURNING id, email',
        [email, hashedPassword]
      );
      
      const userId = userResult.rows[0].id;
      
      // Mark invitation as used
      await client.query(
        'UPDATE invitation_codes SET used = TRUE, used_by = $1, used_at = NOW() WHERE id = $2',
        [userId, req.invitation.id]
      );
      
      await client.query('COMMIT');
      
      const token = jwt.sign(
        { userId: userId, email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.status(201).json({
        message: 'Registration successful',
        token,
        user: { id: userId, email }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Email already registered' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
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

// Admin endpoint to check invitation codes
app.get('/api/admin/invitations', async (req, res) => {
  try {
    // Basic security
    const adminPassword = req.query.admin_key;
    if (adminPassword !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await pool.query(`
      SELECT 
        id,
        code,
        email,
        used,
        used_by,
        created_at,
        used_at,
        expires_at,
        CASE 
          WHEN expires_at < NOW() THEN true 
          ELSE false 
        END as expired
      FROM invitation_codes 
      ORDER BY created_at DESC
    `);
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE used = true) as used_count,
        COUNT(*) FILTER (WHERE used = false AND (expires_at IS NULL OR expires_at > NOW())) as available,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired
      FROM invitation_codes
    `);
    
    res.json({
      invitations: result.rows,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Admin invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Admin endpoint to create new invitation codes
app.post('/api/admin/invitations', async (req, res) => {
  try {
    const adminPassword = req.headers['x-admin-key'];
    if (adminPassword !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { code, email, expiresInDays = 30 } = req.body;
    
    if (!code || !email) {
      return res.status(400).json({ error: 'Code and email are required' });
    }
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    const result = await pool.query(
      'INSERT INTO invitation_codes (code, email, expires_at) VALUES ($1, $2, $3) RETURNING *',
      [code, email, expiresAt]
    );
    
    res.status(201).json({
      message: 'Invitation code created',
      invitation: result.rows[0]
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Invitation code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create invitation' });
    }
  }
});

// Endpoint to verify if an invitation code is valid (public)
app.post('/api/verify-invitation', async (req, res) => {
  try {
    const { invitationCode } = req.body;
    
    if (!invitationCode) {
      return res.status(400).json({ error: 'Invitation code required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM invitation_codes WHERE code = $1',
      [invitationCode]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        valid: false, 
        error: 'Invalid invitation code' 
      });
    }
    
    const invitation = result.rows[0];
    
    if (invitation.used) {
      return res.status(409).json({ 
        valid: false, 
        error: 'Invitation code already used' 
      });
    }
    
    if (invitation.expires_at && new Date() > new Date(invitation.expires_at)) {
      return res.status(410).json({ 
        valid: false, 
        error: 'Invitation code has expired' 
      });
    }
    
    res.json({
      valid: true,
      message: 'Invitation code is valid',
      emailDomain: invitation.email.split('@')[1]
    });
  } catch (error) {
    console.error('Verify invitation error:', error);
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      VERCEL_ENV: process.env.VERCEL_ENV, // Vercel's internal env
      all_env: Object.keys(process.env).filter(key => 
        key.includes('NODE') || key.includes('VERCEL') || key.includes('DATABASE')
      )
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