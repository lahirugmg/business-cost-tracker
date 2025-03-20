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
  Center,
  VStack,
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { useSession, signIn } from 'next-auth/react';
import axios from 'axios';
import api from '../utils/api';

export default function Transactions() {
  // Get session data for authentication
  const { data: session, status } = useSession();
  const isAuthenticated = !!session;
  const isLoading = status === 'loading';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'income', 'expense'
  const [error, setError] = useState(null);
  const [useMockData, setUseMockData] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
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

  // Add useEffect hook to fetch data only when authenticated
  useEffect(() => {
    // Only fetch data when the user is authenticated
    if (status === 'authenticated' && isAuthenticated) {
      console.log('User authenticated, fetching transactions');
      fetchTransactions();
    } else if (status === 'unauthenticated') {
      // If explicitly not authenticated, set empty transactions and stop loading
      console.log('User is not authenticated, showing empty transactions');
      setTransactions([]);
      setLoading(false);
      // We don't show a toast here to respect explicit authentication preference
    }
    // We don't include isAuthenticated in the dependency array to prevent re-fetching
    // when it changes during the session
  }, [status]);

  const fetchTransactions = async () => {
    try {
      // Check if user is authenticated first
      if (!isAuthenticated) {
        console.log('User not authenticated, showing empty transactions list');
        setTransactions([]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setUseMockData(false);
      setError(null);
      
      try {
        // No demo mode - use real authentication only
        
        // Use the API utility with improved error handling
        const [incomesResponse, expensesResponse] = await Promise.all([
          api.get('/incomes/', {
            // Add explicit validation status handling
            validateStatus: function(status) {
              return status >= 200 && status < 300; // Only accept 2xx status codes
            },
            // Add longer timeout for slower connections
            timeout: 10000
          }),
          api.get('/expenses/', {
            validateStatus: function(status) {
              return status >= 200 && status < 300;
            },
            timeout: 10000
          })
        ]);

        // Process successful responses
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
        console.log('Successfully fetched', allTransactions.length, 'transactions');
      } catch (apiError) {
        // Handle API-specific errors with better error messages
        console.error('API error fetching transactions:', apiError);
        
        // Handle different types of errors
        if (apiError.response) {
          // The request was made and the server responded with an error status
          if (apiError.response.status === 401 || apiError.response.status === 403) {
            // Authentication error - respect explicit authentication preference
            setError('Authentication required. Please sign in to view your transactions.');
            toast({
              title: 'Authentication Required',
              description: 'Please sign in to view your transactions',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
            
            // Don't try to fall back to direct API call for auth issues
            setTransactions([]);
            return;
          } else {
            // Other server error - try direct API call as fallback
            setError(`Server error: ${apiError.response.status} - Trying alternative connection`);
            tryDirectApiCall();
          }
        } else if (apiError.request) {
          // Network error - backend might be unavailable
          console.error('Network error - Backend might be unavailable');
          setError('Backend service unavailable');
          
          toast({
            title: 'Backend Service Unavailable',
            description: 'Unable to connect to the backend. You can try demo mode on the home page.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          
          // Redirect to home page with backend error parameter
          // This respects explicit authentication preference by not automatically enabling demo mode
          router.push('/?backendError=unavailable');
          return;
        } else {
          // Unknown error - try direct API call as fallback
          setError(`Error: ${apiError.message} - Trying alternative connection`);
          tryDirectApiCall();
        }
      }
    } catch (err) {
      console.error('Error in transaction handling:', err);
      // Show error toast to user
      toast({
        title: 'Error Loading Transactions',
        description: 'An unexpected error occurred while loading your transactions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      // Fall back to demo data
      useDemoData();
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to try direct API call (without authentication)
  const tryDirectApiCall = async () => {
    try {
      const [incomesResponse, expensesResponse] = await Promise.all([
        axios.get('http://localhost:8000/incomes/', { timeout: 8000 }),
        axios.get('http://localhost:8000/expenses/', { timeout: 8000 })
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
      console.log('Successfully fetched transactions via direct API call');
    } catch (directError) {
      console.error('Direct API call failed:', directError);
      // Fall back to demo data
      useDemoData();
    }
  };
  
  // Helper function to use demo data
  const useDemoData = () => {
    console.log('Using demo data due to API errors');
    
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
    
    toast({
      title: "Demo Mode",
      description: "Using example data since the API is unavailable.",
      status: "info",
      duration: 5000,
      isClosable: true,
    });
  };

  // Handler for edit button click
  const handleEditClick = (transaction) => {
    // Create a copy of the transaction for editing
    setEditItem({...transaction});
    onEditOpen();
  };

  // Function to handle transaction update
  const handleUpdateTransaction = async () => {
    if (!editItem) return;
    
    try {
      setEditLoading(true);
      
      // Prepare the update data (exclude user_id and type which are not part of the schema)
      const updateData = {
        amount: editItem.amount,
        description: editItem.description,
        date: editItem.date,
        category: editItem.category
      };
      
      // For expenses, include tax_deductible if available
      if (editItem.type === 'expense' && editItem.tax_deductible !== undefined) {
        updateData.tax_deductible = editItem.tax_deductible;
        
        // Include other expense-specific fields if they exist
        if (editItem.property_type !== undefined) updateData.property_type = editItem.property_type;
        if (editItem.attachment_filename !== undefined) updateData.attachment_filename = editItem.attachment_filename;
        if (editItem.attachment_path !== undefined) updateData.attachment_path = editItem.attachment_path;
      }
      
      if (useMockData) {
        // Simulate update in mock data
        setTransactions(prevTransactions => 
          prevTransactions.map(t => {
            if (t.type === editItem.type && t.id === editItem.id) {
              return {...editItem};
            }
            return t;
          })
        );
        
        toast({
          title: 'Updated successfully',
          description: `${editItem.type === 'income' ? 'Income' : 'Expense'} record updated (simulated)`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Determine the endpoint based on transaction type
        const endpoint = editItem.type === 'income' 
          ? `/incomes/${editItem.id}`
          : `/expenses/${editItem.id}`;
        
        // Send the update request
        const response = await api.put(endpoint, updateData);
        
        // Update the transactions list with the updated item
        setTransactions(transactions.map(t => {
          // Match by both type and id to ensure we update the correct transaction
          if (t.type === editItem.type && t.id === editItem.id) {
            return {...response.data, type: editItem.type};
          }
          return t;
        }));
        
        // Show success message
        toast({
          title: 'Transaction updated',
          description: `Your ${editItem.type} transaction has been updated successfully.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Close the edit dialog
      onEditClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      
      // Show error message
      toast({
        title: 'Update failed',
        description: `Unable to update ${editItem.type}: ${error.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setEditLoading(false);
      setEditItem(null);
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

  // Only run fetchTransactions if authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      fetchTransactions();
    }
  }, [isAuthenticated, isLoading]);
  
  // Render different content based on authentication state
  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="50vh">
          <Spinner size="xl" />
        </Center>
      </Container>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="50vh">
          <VStack spacing={6}>
            <Heading>Authentication Required</Heading>
            <Text>You need to sign in to view your transactions.</Text>
            <Button
              colorScheme="blue"
              size="lg"
              onClick={() => signIn('google', { callbackUrl: '/transactions' })}
            >
              Sign In with Google
            </Button>
          </VStack>
        </Center>
      </Container>
    );
  }
  
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
                      <HStack spacing={2}>
                        <IconButton
                          aria-label="Edit transaction"
                          icon={<EditIcon />}
                          colorScheme="blue"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(transaction)}
                        />
                        <IconButton
                          aria-label="Delete transaction"
                          icon={<DeleteIcon />}
                          colorScheme="red"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(transaction)}
                        />
                      </HStack>
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

      {/* Edit Transaction Modal */}
      <AlertDialog
        isOpen={isEditOpen}
        leastDestructiveRef={cancelRef}
        onClose={onEditClose}
        size="lg"
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Edit {editItem?.type === 'income' ? 'Income' : 'Expense'}
            </AlertDialogHeader>

            <AlertDialogBody>
              {editItem && (
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Text mb={1}>Description</Text>
                    <input
                      type="text"
                      value={editItem.description}
                      onChange={(e) => setEditItem({...editItem, description: e.target.value})}
                      className="chakra-input css-1kp110w"
                    />
                  </Box>
                  
                  <Box>
                    <Text mb={1}>Amount</Text>
                    <input
                      type="number"
                      step="0.01"
                      value={editItem.amount}
                      onChange={(e) => setEditItem({...editItem, amount: parseFloat(e.target.value)})}
                      className="chakra-input css-1kp110w"
                    />
                  </Box>
                  
                  <Box>
                    <Text mb={1}>Date</Text>
                    <input
                      type="date"
                      value={editItem.date}
                      onChange={(e) => setEditItem({...editItem, date: e.target.value})}
                      className="chakra-input css-1kp110w"
                    />
                  </Box>
                  
                  <Box>
                    <Text mb={1}>Category</Text>
                    <input
                      type="text"
                      value={editItem.category}
                      onChange={(e) => setEditItem({...editItem, category: e.target.value})}
                      className="chakra-input css-1kp110w"
                    />
                  </Box>
                  
                  {editItem.type === 'expense' && (
                    <Box>
                      <Text mb={1}>Tax Deductible</Text>
                      <input
                        type="checkbox"
                        checked={editItem.tax_deductible}
                        onChange={(e) => setEditItem({...editItem, tax_deductible: e.target.checked})}
                      />
                    </Box>
                  )}
                </VStack>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onEditClose}>Cancel</Button>
              <Button
                colorScheme="blue"
                onClick={handleUpdateTransaction}
                ml={3}
                isLoading={editLoading}
                loadingText="Updating..."
              >
                Update
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Container>
  );
}