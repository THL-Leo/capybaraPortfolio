# Portfolio Tracker Frontend

A React frontend for the Portfolio Tracker application that connects to Charles Schwab and Fidelity accounts via Plaid.

## Features

- **Authentication**: Login/register with invitation codes
- **Portfolio Line Chart**: Shows portfolio worth over time
- **Stock History Gantt Chart**: Displays stock holdings with profit/loss visualization
- **Plaid Integration**: Connect accounts securely
- **Responsive Design**: Built with Chakra UI

## Tech Stack

- React 18
- Chakra UI for styling
- React Router for navigation
- Recharts for data visualization
- React Plaid Link for account connection
- Axios for API calls

## Getting Started

### Prerequisites

- Node.js 16+ 
- Backend server running (see `../backend/`)
- Valid invitation code for registration

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your API URL:
```
REACT_APP_API_URL=https://capybara-portfolio-git-dev-thlleos-projects.vercel.app
```

### Development

Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Usage

### First Time Setup

1. **Get Invitation Code**: Contact admin for invitation code
2. **Register**: Visit `/register` and verify invitation code
3. **Login**: Use your credentials to sign in
4. **Connect Accounts**: Click "Connect Account" to link Plaid accounts
5. **View Charts**: See portfolio data in the dashboard

### Dashboard Features

- **Portfolio Worth Chart**: Line chart showing portfolio value over time
- **Stock History Chart**: Gantt chart with:
  - Green bars: Profitable stock positions
  - Red bars: Loss-making positions  
  - Blue bars: Currently held positions
- **Connected Accounts**: Summary of linked accounts
- **Refresh Data**: Update transaction data from Plaid

## Components

### Pages
- `LoginPage`: User authentication
- `RegisterPage`: Account creation with invitation
- `Dashboard`: Main portfolio overview

### Components  
- `PortfolioChart`: Line chart of portfolio value
- `StockHistoryChart`: Gantt chart of stock holdings
- `PlaidLink`: Account connection interface
- `ProtectedRoute`: Route guards for authentication

### Context
- `AuthContext`: JWT token and user state management

## API Integration

The frontend connects to these backend endpoints:

- `POST /api/login` - User login
- `POST /api/register` - User registration  
- `POST /api/verify-invitation` - Validate invitation codes
- `GET /api/accounts` - Fetch connected accounts
- `GET /api/transactions` - Get transaction history
- `POST /api/create_link_token` - Plaid Link setup
- `POST /api/exchange_public_token` - Save Plaid connection

## Environment Variables

- `REACT_APP_API_URL`: Backend API base URL

## Sample Data

When no real transaction data is available, the charts display sample data to demonstrate functionality.

## Development Notes

- Backend must be running for full functionality
- Uses proxy configuration for local development
- JWT tokens stored in localStorage
- Responsive design works on mobile devices

## Troubleshooting

### Common Issues

1. **Login fails**: Check backend is running and API URL is correct
2. **Charts not loading**: Verify accounts are connected via Plaid
3. **Build errors**: Ensure all dependencies are installed

### Debug Mode

Check browser console for detailed error messages and network requests. 