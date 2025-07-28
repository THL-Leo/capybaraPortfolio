import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Flex,
  Heading,
  Button,
  VStack,
  HStack,
  Text,
  Alert,
  AlertIcon,
  Spinner,
  Center
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';
import PortfolioChart from '../components/PortfolioChart';
import StockHistoryChart from '../components/StockHistoryChart';
import PlaidLink from '../components/PlaidLink';
import axios from 'axios';
import { config } from '../config/environment';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch accounts
      const accountsResponse = await axios.get(`${config.apiUrl}/api/accounts`);
      setAccounts(accountsResponse.data);
      
      if (accountsResponse.data.length > 0) {
        setConnectedAccounts(true);
        
        // Fetch transactions if we have accounts
        const transactionsResponse = await axios.get(`${config.apiUrl}/api/transactions`, {
          params: {
            startDate: '2024-01-01',
            endDate: new Date().toISOString().split('T')[0]
          }
        });
        setTransactions(transactionsResponse.data);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountLinked = () => {
    // Refresh data after account is linked
    fetchData();
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await axios.post(`${config.apiUrl}/api/refresh_transactions`);
      // Wait a moment then fetch fresh data
      setTimeout(() => {
        fetchData();
      }, 2000);
    } catch (err) {
      console.error('Refresh error:', err);
      setError('Failed to refresh data');
      setLoading(false);
    }
  };

  if (loading && !connectedAccounts) {
    return (
      <Center h="100vh">
        <VStack>
          <Spinner size="xl" />
          <Text>Loading your portfolio...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Box bg="white" shadow="sm" borderBottom="1px" borderColor="gray.200">
        <Container maxW="7xl" py={4}>
          <Flex justify="space-between" align="center">
            <HStack>
              <Heading size="lg" color="gray.700">
                Portfolio Tracker
              </Heading>
              <Text color="gray.500">Welcome, {user?.email}</Text>
            </HStack>
            <HStack spacing={4}>
              {connectedAccounts && (
                <Button
                  size="sm"
                  onClick={refreshData}
                  isLoading={loading}
                  loadingText="Refreshing..."
                >
                  Refresh Data
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={logout}>
                Logout
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" py={8}>
        {error && (
          <Alert status="error" mb={6}>
            <AlertIcon />
            {error}
          </Alert>
        )}

        {!connectedAccounts ? (
          <Center py={20}>
            <VStack spacing={6} textAlign="center">
              <Heading size="lg" color="gray.600">
                Connect Your Accounts
              </Heading>
              <Text color="gray.500" maxW="md">
                Link your Charles Schwab or Fidelity accounts to start tracking your portfolio.
              </Text>
              <PlaidLink onSuccess={handleAccountLinked} />
            </VStack>
          </Center>
        ) : (
          <VStack spacing={8} align="stretch">
            {/* Portfolio Overview */}
            <Box>
              <Heading size="md" mb={4} color="gray.700">
                Portfolio Worth Over Time
              </Heading>
              <Box bg="white" p={6} rounded="lg" shadow="sm">
                <PortfolioChart 
                  accounts={accounts} 
                  transactions={transactions}
                  loading={loading}
                />
              </Box>
            </Box>

            {/* Stock History */}
            <Box>
              <Heading size="md" mb={4} color="gray.700">
                Stock Holdings History
              </Heading>
              <Box bg="white" p={6} rounded="lg" shadow="sm">
                <StockHistoryChart 
                  transactions={transactions}
                  loading={loading}
                />
              </Box>
            </Box>

            {/* Account Summary */}
            {accounts.length > 0 && (
              <Box>
                <Heading size="md" mb={4} color="gray.700">
                  Connected Accounts
                </Heading>
                <VStack spacing={3} align="stretch">
                  {accounts.map((account, index) => (
                    <Box
                      key={account.account_id || index}
                      bg="white"
                      p={4}
                      rounded="lg"
                      shadow="sm"
                      border="1px"
                      borderColor="gray.200"
                    >
                      <Flex justify="space-between" align="center">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="semibold">
                            {account.name || 'Investment Account'}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {account.subtype} • {account.institution_id}
                          </Text>
                        </VStack>
                        <Text fontWeight="bold" fontSize="lg">
                          ${account.balances?.current?.toLocaleString() || '0.00'}
                        </Text>
                      </Flex>
                    </Box>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard; 