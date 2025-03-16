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
} from '@chakra-ui/react';
import axios from 'axios';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'income', 'expense'
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
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
    } catch (err) {
      setError('Failed to fetch transactions');
      console.error('Error fetching transactions:', err);
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

        {/* Transactions Table */}
        {loading ? (
          <Box textAlign="center" py={10}>
            <Spinner size="xl" />
          </Box>
        ) : error ? (
          <Box textAlign="center" py={10} color="red.500">
            {error}
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