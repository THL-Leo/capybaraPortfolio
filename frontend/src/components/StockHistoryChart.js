import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Box, Text, Spinner, Center, VStack, HStack, Badge } from '@chakra-ui/react';
import { format, parseISO, differenceInDays } from 'date-fns';

const StockHistoryChart = ({ transactions, loading }) => {
  const stockHoldings = useMemo(() => {
    if (!transactions.length) {
      // Generate sample data for demonstration
      const sampleHoldings = [
        {
          symbol: 'AAPL',
          startDate: new Date(2024, 0, 15),
          endDate: new Date(2024, 2, 20),
          profitLoss: 2500,
          duration: 65,
          shares: 100
        },
        {
          symbol: 'GOOGL',
          startDate: new Date(2024, 1, 1),
          endDate: new Date(2024, 3, 15),
          profitLoss: -800,
          duration: 74,
          shares: 50
        },
        {
          symbol: 'MSFT',
          startDate: new Date(2024, 2, 10),
          endDate: new Date(2024, 4, 25),
          profitLoss: 1200,
          duration: 76,
          shares: 75
        },
        {
          symbol: 'TSLA',
          startDate: new Date(2024, 1, 20),
          endDate: new Date(2024, 2, 30),
          profitLoss: -1500,
          duration: 39,
          shares: 25
        },
        {
          symbol: 'NVDA',
          startDate: new Date(2024, 3, 1),
          endDate: null, // Still holding
          profitLoss: 3200,
          duration: differenceInDays(new Date(), new Date(2024, 3, 1)),
          shares: 80
        }
      ];
      
      return sampleHoldings.map((holding, index) => ({
        ...holding,
        id: index,
        status: holding.endDate ? 'sold' : 'holding',
        startDay: differenceInDays(holding.startDate, new Date(2024, 0, 1)),
        endDay: holding.endDate ? 
          differenceInDays(holding.endDate, new Date(2024, 0, 1)) :
          differenceInDays(new Date(), new Date(2024, 0, 1))
      }));
    }

    // Process actual transactions to find stock holdings
    const investmentTransactions = transactions.filter(tx => 
      tx.investment_transaction_id || 
      tx.category?.includes('Transfer') || 
      tx.account_type === 'investment'
    );

    // Group by stock symbol and find buy/sell pairs
    const stockMap = new Map();
    
    investmentTransactions.forEach(tx => {
      // Extract stock symbol from transaction (this would need to be adapted based on actual data structure)
      const symbol = tx.security_id || tx.name?.match(/[A-Z]{2,5}/)?.[0] || 'UNKNOWN';
      
      if (!stockMap.has(symbol)) {
        stockMap.set(symbol, []);
      }
      
      stockMap.get(symbol).push({
        date: parseISO(tx.date),
        amount: tx.amount,
        type: tx.amount < 0 ? 'buy' : 'sell', // Negative amount = purchase
        shares: Math.abs(tx.amount / 100) // Simplified calculation
      });
    });

    // Convert to holdings periods
    const holdings = [];
    let holdingId = 0;

    stockMap.forEach((txList, symbol) => {
      if (symbol === 'UNKNOWN') return;
      
      txList.sort((a, b) => a.date - b.date);
      
      let currentPosition = 0;
      let avgCost = 0;
      let positionStart = null;
      
      txList.forEach(tx => {
        if (tx.type === 'buy') {
          if (currentPosition === 0) {
            positionStart = tx.date;
          }
          const newShares = currentPosition + tx.shares;
          avgCost = ((currentPosition * avgCost) + (tx.shares * Math.abs(tx.amount / tx.shares))) / newShares;
          currentPosition = newShares;
                 } else if (tx.type === 'sell' && currentPosition > 0) {
           const profitLoss = (tx.amount - (tx.shares * avgCost));
          
          holdings.push({
            id: holdingId++,
            symbol,
            startDate: positionStart,
            endDate: tx.date,
            profitLoss,
            duration: differenceInDays(tx.date, positionStart),
            shares: tx.shares,
            status: 'sold',
            startDay: differenceInDays(positionStart, new Date(2024, 0, 1)),
            endDay: differenceInDays(tx.date, new Date(2024, 0, 1))
          });
          
          currentPosition -= tx.shares;
          if (currentPosition <= 0) {
            currentPosition = 0;
            positionStart = null;
          }
        }
      });
      
      // Add current holdings
      if (currentPosition > 0 && positionStart) {
        holdings.push({
          id: holdingId++,
          symbol,
          startDate: positionStart,
          endDate: null,
          profitLoss: currentPosition * 50, // Estimated current gain
          duration: differenceInDays(new Date(), positionStart),
          shares: currentPosition,
          status: 'holding',
          startDay: differenceInDays(positionStart, new Date(2024, 0, 1)),
          endDay: differenceInDays(new Date(), new Date(2024, 0, 1))
        });
      }
    });

    return holdings;
  }, [transactions]);

  // Prepare data for gantt chart
  const chartData = useMemo(() => {
    return stockHoldings.map(holding => ({
      symbol: holding.symbol,
      start: holding.startDay,
      duration: holding.endDay - holding.startDay,
      profitLoss: holding.profitLoss,
      status: holding.status,
      shares: holding.shares,
      startDate: holding.startDate,
      endDate: holding.endDate
    }));
  }, [stockHoldings]);

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
        <Text color="gray.500">No stock holdings data available</Text>
      </Center>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          bg="white"
          p={4}
          border="1px"
          borderColor="gray.200"
          borderRadius="md"
          shadow="md"
          minW="200px"
        >
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold" fontSize="lg">{data.symbol}</Text>
            <HStack>
              <Text fontSize="sm">Status:</Text>
              <Badge colorScheme={data.status === 'holding' ? 'blue' : 'gray'}>
                {data.status}
              </Badge>
            </HStack>
            <Text fontSize="sm">
              Start: {format(data.startDate, 'MMM dd, yyyy')}
            </Text>
            {data.endDate && (
              <Text fontSize="sm">
                End: {format(data.endDate, 'MMM dd, yyyy')}
              </Text>
            )}
            <Text fontSize="sm">
              Duration: {data.duration} days
            </Text>
            <Text fontSize="sm">
              Shares: {data.shares}
            </Text>
            <Text 
              fontSize="sm" 
              fontWeight="bold"
              color={data.profitLoss >= 0 ? 'green.500' : 'red.500'}
            >
              P&L: {data.profitLoss >= 0 ? '+' : ''}${data.profitLoss.toLocaleString()}
            </Text>
          </VStack>
        </Box>
      );
    }
    return null;
  };

  const getBarColor = (profitLoss, status) => {
    if (status === 'holding') return '#3182CE'; // Blue for current holdings
    return profitLoss >= 0 ? '#38A169' : '#E53E3E'; // Green for profit, red for loss
  };

  return (
    <Box h="400px" w="100%">
      <VStack align="stretch" spacing={4} h="100%">
        {/* Legend */}
        <HStack spacing={6} justify="center">
          <HStack>
            <Box w={4} h={4} bg="#38A169" borderRadius="sm" />
            <Text fontSize="sm">Profit</Text>
          </HStack>
          <HStack>
            <Box w={4} h={4} bg="#E53E3E" borderRadius="sm" />
            <Text fontSize="sm">Loss</Text>
          </HStack>
          <HStack>
            <Box w={4} h={4} bg="#3182CE" borderRadius="sm" />
            <Text fontSize="sm">Currently Holding</Text>
          </HStack>
        </HStack>

        {/* Chart */}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              type="number" 
              domain={[0, 'dataMax']}
              tickFormatter={(value) => {
                const date = new Date(2024, 0, 1);
                date.setDate(date.getDate() + value);
                return format(date, 'MMM');
              }}
              fontSize={12}
            />
            <YAxis 
              type="category" 
              dataKey="symbol" 
              width={60}
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="duration" stackId="a">
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarColor(entry.profitLoss, entry.status)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </VStack>
    </Box>
  );
};

export default StockHistoryChart; 