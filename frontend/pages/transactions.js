import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Select,
  HStack,
  Spinner,
  Text,
  Card,
  CardBody,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import axios from 'axios';
import api from '../utils/api';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'income', 'expense'
  const [error, setError] = useState(null);
  const [useMockData, setUseMockData] = useState(false);
  
  // Sample mock data for demonstration when API is unavailable
  const mockIncomeData = [
    { id: 1, amount: 3500, description: "Salary", date: "2025-01-15", category: "Employment" },
    { id: 2, amount: 1200, description: "Freelance Work", date: "2025-02-10", category: "Side Gig" },
    { id: 3, amount: 4000, description: "Salary", date: "2025-02-15", category: "Employment" },
    { id: 4, amount: 950, description: "Consulting", date: "2025-03-05", category: "Side Gig" },
    { id: 5, amount: 4000, description: "Salary", date: "2025-03-15", category: "Employment" }
  ];
  
  const mockExpenseData = [
    { id: 1, amount: 1200, description: "Rent", date: "2025-01-05", category: "Housing" },
    { id: 2, amount: 350, description: "Groceries", date: "2025-01-12", category: "Food" },
    { id: 3, amount: 120, description: "Internet", date: "2025-01-15", category: "Utilities" },
    { id: 4, amount: 65, description: "Phone", date: "2025-01-20", category: "Utilities" },
    { id: 5, amount: 1200, description: "Rent", date: "2025-02-05", category: "Housing" },
    { id: 6, amount: 400, description: "Groceries", date: "2025-02-15", category: "Food" },
    { id: 7, amount: 120, description: "Internet", date: "2025-02-15", category: "Utilities" },
    { id: 8, amount: 85, description: "Business Dinner", date: "2025-02-22", category: "Food", tax_deductible: true },
    { id: 9, amount: 1200, description: "Rent", date: "2025-03-05", category: "Housing" },
    { id: 10, amount: 320, description: "Groceries", date: "2025-03-10", category: "Food" },
    { id: 11, amount: 120, description: "Internet", date: "2025-03-15", category: "Utilities" }
  ];

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setUseMockData(false);
      
      try {
        // Try to use the API utility first with correct auth headers
        const [incomesResponse, expensesResponse] = await Promise.all([
          api.get('/incomes/'),
          api.get('/expenses/')
        ]);

        const incomes = incomesResponse.data.map(income => ({
          ...income,
          type: 'income'
        }));

        const expenses = expensesResponse.data.map(expense => ({
          ...expense,
          type: 'expense'
        }));

        const allTransactions = [...incomes, ...expenses].sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );

        setTransactions(allTransactions);
      } catch (apiError) {
        // If API approach fails, try direct axios call as fallback
        try {
          const [incomesResponse, expensesResponse] = await Promise.all([
            axios.get('http://localhost:8000/incomes/'),
            axios.get('http://localhost:8000/expenses/')
          ]);

          const incomes = incomesResponse.data.map(income => ({
            ...income,
            type: 'income'
          }));

          const expenses = expensesResponse.data.map(expense => ({
            ...expense,
            type: 'expense'
          }));

          const allTransactions = [...incomes, ...expenses].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
          );

          setTransactions(allTransactions);
        } catch (axiosError) {
          // Both approaches failed, use mock data
          console.log('Using mock data due to API errors');
          
          const mockIncomes = mockIncomeData.map(income => ({
            ...income,
            type: 'income'
          }));
          
          const mockExpenses = mockExpenseData.map(expense => ({
            ...expense,
            type: 'expense'
          }));
          
          const mockTransactions = [...mockIncomes, ...mockExpenses].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
          );
          
          setTransactions(mockTransactions);
          setUseMockData(true);
          setError('Using demo data - backend not accessible');
        }
      }
    } catch (err) {
      console.error('Error in transaction handling:', err);
      
      // Ultimate fallback to mock data
      const mockIncomes = mockIncomeData.map(income => ({
        ...income,
        type: 'income'
      }));
      
      const mockExpenses = mockExpenseData.map(expense => ({
        ...expense,
        type: 'expense'
      }));
      
      const mockTransactions = [...mockIncomes, ...mockExpenses].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      setTransactions(mockTransactions);
      setUseMockData(true);
      setError('Using demo data - backend not accessible');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    return transaction.type === filter;
  });

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Container maxW="container.xl" py={8}>
      <Box mb={8}>
        <Heading mb={6}>Transactions</Heading>
        
        {/* Summary Cards */}
        <HStack spacing={4} mb={6}>
          <Card flex={1}>
            <CardBody>
              <Text>Total Income</Text>
              <Heading size="md" color="green.500">${totalIncome.toFixed(2)}</Heading>
            </CardBody>
          </Card>
          <Card flex={1}>
            <CardBody>
              <Text>Total Expenses</Text>
              <Heading size="md" color="red.500">${totalExpenses.toFixed(2)}</Heading>
            </CardBody>
          </Card>
          <Card flex={1}>
            <CardBody>
              <Text>Balance</Text>
              <Heading 
                size="md" 
                color={(totalIncome - totalExpenses) >= 0 ? "blue.500" : "red.500"}
              >
                ${(totalIncome - totalExpenses).toFixed(2)}
              </Heading>
            </CardBody>
          </Card>
        </HStack>

        {/* Filter */}
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          width="200px"
          mb={4}
        >
          <option value="all">All Transactions</option>
          <option value="income">Income Only</option>
          <option value="expense">Expenses Only</option>
        </Select>

        {/* Mock Data Alert */}
        {useMockData && (
          <Alert status="info" mb={4} borderRadius="md">
            <AlertIcon />
            Showing demo data: The backend service is not currently accessible.
          </Alert>
        )}
        
        {/* Transactions Table */}
        {loading ? (
          <Box textAlign="center" py={10}>
            <Spinner size="xl" />
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Category</Th>
                  <Th>Description</Th>
                  <Th isNumeric>Amount</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredTransactions.map((transaction, index) => (
                  <Tr key={`${transaction.type}-${transaction.id}-${index}`}>
                    <Td>{new Date(transaction.date).toLocaleDateString()}</Td>
                    <Td>
                      <Badge
                        colorScheme={transaction.type === 'income' ? 'green' : 'red'}
                      >
                        {transaction.type}
                      </Badge>
                    </Td>
                    <Td>{transaction.category}</Td>
                    <Td>{transaction.description}</Td>
                    <Td isNumeric>
                      <Text
                        color={transaction.type === 'income' ? 'green.500' : 'red.500'}
                        fontWeight="bold"
                      >
                        ${transaction.amount.toFixed(2)}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>
    </Container>
  );
} 