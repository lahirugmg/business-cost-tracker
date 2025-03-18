import React, { useState, useEffect, useRef } from 'react';
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
  Button,
  IconButton,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import axios from 'axios';
import api from '../utils/api';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'income', 'expense'
  const [error, setError] = useState(null);
  const [useMockData, setUseMockData] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef();
  
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

  // Handler for delete button click
  const handleDeleteClick = (transaction) => {
    setDeleteItem(transaction);
    onOpen();
  };

  // Function to handle actual deletion
  const handleDelete = async () => {
    if (!deleteItem) return;
    
    try {
      setDeleteLoading(true);
      
      if (useMockData) {
        // Simulate deletion in mock data
        setTransactions(prevTransactions => 
          prevTransactions.filter(t => 
            !(t.type === deleteItem.type && t.id === deleteItem.id)
          )
        );
        
        toast({
          title: 'Deleted successfully',
          description: `${deleteItem.type === 'income' ? 'Income' : 'Expense'} record deleted (simulated)`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Real API deletion
        const endpoint = deleteItem.type === 'income' 
          ? `/incomes/${deleteItem.id}` 
          : `/expenses/${deleteItem.id}`;
          
        try {
          await api.delete(endpoint);
        } catch (apiError) {
          // Fallback to direct axios if API utility fails
          await axios.delete(`http://localhost:8000${endpoint}`);
        }
        
        // Update local state to remove the deleted item
        setTransactions(prevTransactions => 
          prevTransactions.filter(t => 
            !(t.type === deleteItem.type && t.id === deleteItem.id)
          )
        );
        
        toast({
          title: 'Deleted successfully',
          description: `${deleteItem.type === 'income' ? 'Income' : 'Expense'} record deleted`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error('Error deleting:', err);
      toast({
        title: 'Error',
        description: `Failed to delete ${deleteItem.type}. Please try again.`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setDeleteLoading(false);
      setDeleteItem(null);
      onClose();
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
                  <Th>Actions</Th>
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
                    <Td>
                      <IconButton
                        aria-label="Delete transaction"
                        icon={<DeleteIcon />}
                        colorScheme="red"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(transaction)}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete {deleteItem?.type === 'income' ? 'Income' : 'Expense'} Record
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this {deleteItem?.type} record? 
              This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>Cancel</Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                ml={3}
                isLoading={deleteLoading}
                loadingText="Deleting..."
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Container>
  );
}