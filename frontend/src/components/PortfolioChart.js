import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Box, Text, Spinner, Center } from '@chakra-ui/react';
import { format, subDays, eachDayOfInterval } from 'date-fns';

const PortfolioChart = ({ accounts, transactions, loading }) => {
  const chartData = useMemo(() => {
    if (!accounts.length || !transactions.length) {
      // Generate sample data if no real data available
      const endDate = new Date();
      const startDate = subDays(endDate, 30);
      const dates = eachDayOfInterval({ start: startDate, end: endDate });
      
      return dates.map((date, index) => ({
        date: format(date, 'MMM dd'),
        value: 50000 + (Math.random() - 0.5) * 10000 + index * 100
      }));
    }

    // Calculate portfolio value over time from transactions
    const endDate = new Date();
    const startDate = subDays(endDate, 90); // Last 90 days
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Get total account balance as starting point
    const totalBalance = accounts.reduce((sum, account) => 
      sum + (account.balances?.current || 0), 0
    );
    
    // Create daily values based on transactions
    let runningValue = totalBalance;
    const dailyData = dates.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Find transactions for this date
      const dayTransactions = transactions.filter(tx => 
        tx.date === dateStr && tx.account_type === 'investment'
      );
      
      // Adjust value based on transactions (simplified calculation)
      const dayChange = dayTransactions.reduce((sum, tx) => {
        // Negative amount means money going out (purchase), positive means coming in (sale)
        return sum - (tx.amount || 0);
      }, 0);
      
      runningValue += dayChange;
      
      return {
        date: format(date, 'MMM dd'),
        value: Math.max(runningValue, 0) // Ensure non-negative
      };
    }).reverse(); // Reverse to show oldest to newest

    return dailyData;
  }, [accounts, transactions]);

  if (loading) {
    return (
      <Center h="300px">
        <Spinner size="lg" />
      </Center>
    );
  }

  if (!chartData.length) {
    return (
      <Center h="300px">
        <Text color="gray.500">No portfolio data available</Text>
      </Center>
    );
  }

  const formatCurrency = (value) => {
    return `$${value.toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          bg="white"
          p={3}
          border="1px"
          borderColor="gray.200"
          borderRadius="md"
          shadow="sm"
        >
          <Text fontWeight="semibold">{label}</Text>
          <Text color="blue.500">
            Portfolio Value: {formatCurrency(payload[0].value)}
          </Text>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box h="400px" w="100%">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            fontSize={12}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            stroke="#666"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3182CE"
            strokeWidth={2}
            dot={{ fill: '#3182CE', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#3182CE', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default PortfolioChart; 