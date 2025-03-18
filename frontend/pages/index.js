import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Text,
  Stack,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Spinner,
  Heading,
  Button,
  Flex,
  Badge,
} from '@chakra-ui/react';
import { useSession, signIn } from 'next-auth/react';
import axios from 'axios';
import api from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Home() {
  const { data: session } = useSession();
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    const fetchData = async () => {
      if (!session) return; // Don't fetch if not authenticated
      
      try {
        setLoading(true);
        setError(null);
        
        // Try to fetch data from the API
        try {
          console.log('Attempting to fetch data from backend...');
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          
          // Try direct axios call first
          const [incomesResponse, expensesResponse] = await Promise.all([
            axios.get(`${API_URL}/incomes/`),
            axios.get(`${API_URL}/expenses/`)
          ]);
          
          console.log('Data fetched successfully from backend');
          setIncomes(incomesResponse.data);
          setExpenses(expensesResponse.data);
        } catch (apiError) {
          console.log('Direct API call failed:', apiError);
          
          // Try with api utility as fallback
          try {
            console.log('Trying api utility as fallback...');
            const [incomesResponse, expensesResponse] = await Promise.all([
              api.get('/incomes/'),
              api.get('/expenses/')
            ]);
            
            console.log('Data fetched successfully via api utility');
            setIncomes(incomesResponse.data);
            setExpenses(expensesResponse.data);
          } catch (fallbackError) {
            // If both methods fail, use mock data
            console.log('Fallback also failed, using mock data:', fallbackError);
            setIncomes(mockIncomeData);
            setExpenses(mockExpenseData);
            setError('The backend service is not currently accessible. Showing demo data.');
          }
        }
      } catch (err) {
        console.error('Error in data handling:', err);
        setError('Failed to load data. Using demo data instead.');
        // Fallback to mock data
        setIncomes(mockIncomeData);
        setExpenses(mockExpenseData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]); // Re-fetch when session changes

  const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balance = totalIncome - totalExpenses;

  // If no session, show a landing page instead of any financial data
  useEffect(() => {
    if (!session) {
      // Set mock data for demo mode
      setIncomes(mockIncomeData);
      setExpenses(mockExpenseData);
      setLoading(false);
    }
  }, [session]);
  
  // If the user is not logged in, show the landing page
  if (!session) {
    return (
      <Container maxW="container.xl" py={10}>
        <Box textAlign="center" py={10} px={6}>
          <Heading
            display="inline-block"
            as="h1"
            size="2xl"
            bgGradient="linear(to-r, red.400, red.600)"
            backgroundClip="text">
            Business Cost Tracker
          </Heading>
          <Text fontSize="xl" mt={6} mb={8}>
            Track your business expenses, income, and manage your finances efficiently.
          </Text>
          
          <Box
            p={8}
            mt={8}
            bg="white"
            rounded="xl"
            boxShadow="lg"
            textAlign="left">
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
              <Box>
                <Heading as="h3" size="lg" mb={6}>
                  Features
                </Heading>
                <Stack spacing={5}>
                  <Box>
                    <Text fontWeight="bold">Expense Tracking</Text>
                    <Text>Record and categorize all your business expenses.</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Income Management</Text>
                    <Text>Keep track of all your income sources.</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Tax Management</Text>
                    <Text>Mark expenses as tax deductible for easier tax filing.</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Financial Reports</Text>
                    <Text>View visual reports of your financial activity.</Text>
                  </Box>
                </Stack>
              </Box>
              <Box>
                <Heading as="h3" size="lg" mb={6}>
                  Get Started
                </Heading>
                <Text mb={4}>
                  Sign in with your Google account to start tracking your business finances.
                </Text>
                <Text mb={6}>
                  All your data is securely stored and accessible only to you.
                </Text>
                <Button 
                  colorScheme="red" 
                  size="lg" 
                  onClick={() => signIn('google')}
                >
                  Sign In Now
                </Button>
              </Box>
            </SimpleGrid>
          </Box>
        </Box>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxW="container.xl" centerContent py={10}>
        <Spinner size="xl" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.xl" centerContent py={10}>
        <Text color="red.500">{error}</Text>
      </Container>
    );
  }

  // Prepare data for the chart
  const prepareMonthlyData = () => {
    const months = {};
    
    // Process incomes
    incomes.forEach(income => {
      const date = new Date(income.date);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!months[monthYear]) {
        months[monthYear] = { name: monthYear, income: 0, expense: 0 };
      }
      
      months[monthYear].income += income.amount;
    });
    
    // Process expenses
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!months[monthYear]) {
        months[monthYear] = { name: monthYear, income: 0, expense: 0 };
      }
      
      months[monthYear].expense += expense.amount;
    });
    
    // Convert to array and sort by date
    return Object.values(months).sort((a, b) => {
      return new Date(a.name) - new Date(b.name);
    });
  };
  
  const monthlyData = prepareMonthlyData();

  // Format month-year for better display
  const formatXAxis = (monthYear) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'short', year: '2-digit' });
  };

  return (
    <Container maxW="container.xl" py={8}>
      {!session && <DemoBanner />}
      <Stack spacing={8}>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <Stat
            px={4}
            py={3}
            shadow="base"
            borderColor="green.500"
            borderWidth={1}
            rounded="lg"
          >
            <StatLabel>Total Income</StatLabel>
            <StatNumber color="green.500">
              ${totalIncome.toFixed(2)}
            </StatNumber>
          </Stat>
          
          <Stat
            px={4}
            py={3}
            shadow="base"
            borderColor="red.500"
            borderWidth={1}
            rounded="lg"
          >
            <StatLabel>Total Expenses</StatLabel>
            <StatNumber color="red.500">
              ${totalExpenses.toFixed(2)}
            </StatNumber>
          </Stat>
          
          <Stat
            px={4}
            py={3}
            shadow="base"
            borderColor={balance >= 0 ? "blue.500" : "red.500"}
            borderWidth={1}
            rounded="lg"
          >
            <StatLabel>Balance</StatLabel>
            <StatNumber color={balance >= 0 ? "blue.500" : "red.500"}>
              ${balance.toFixed(2)}
            </StatNumber>
          </Stat>
        </SimpleGrid>
        
        {/* Monthly Income vs Expenses Chart */}
        <Box
          p={5}
          shadow="md"
          borderWidth="1px"
          borderRadius="lg"
          bg="white"
        >
          <Heading size="md" mb={4}>Monthly Income vs Expenses</Heading>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tickFormatter={formatXAxis} />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`$${value.toFixed(2)}`, undefined]}
                labelFormatter={formatXAxis}
              />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#38A169" />
              <Bar dataKey="expense" name="Expenses" fill="#E53E3E" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Stack>
    </Container>
  );
} 