import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import api from '../utils/api';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Stack,
  useToast,
} from '@chakra-ui/react';

export default function AddIncome() {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const [backendStatus, setBackendStatus] = useState('checking');
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check authentication status and backend availability
  useEffect(() => {
    // Check authentication first
    if (!session && session === null) {
      console.log('User is not authenticated');
    }
    
    const checkBackendStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000');
        if (response.ok) {
          setBackendStatus('online');
          console.log('Backend is online');
        } else {
          setBackendStatus('error');
          console.log('Backend returned error status:', response.status);
        }
      } catch (error) {
        setBackendStatus('offline');
        console.log('Backend connection error:', error);
      }
    };
    
    checkBackendStatus();
  }, [session]);
  
  // Add authentication check - redirect if not authenticated
  useEffect(() => {
    if (session === null) { // explicitly check for null (unauthenticated) 
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to add income transactions',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      router.push('/');
    }
  }, [session, router, toast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAmountChange = (value) => {
    setFormData({ ...formData, amount: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Check explicit authentication before submitting
    if (!session) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to add income transactions',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      setIsSubmitting(false);
      router.push('/');
      return;
    }

    // Prepare the income data
    const incomeData = {
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      category: formData.category,
    };

    try {
      // Debug info
      console.log('Session data:', session);
      console.log('Backend status:', backendStatus);
      
      // Get the auth token if available
      const authToken = session?.accessToken || '';
      console.log('Auth token available:', !!authToken);
      
      // Try using the API_URL from the environment or fallback to direct backend URL
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      console.log('Using API URL:', API_URL);
      
      // Try direct API call with all possible CORS headers
      const response = await axios.post(`${API_URL}/incomes/`, incomeData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Accept': 'application/json',
          'Origin': window.location.origin,
        },
        withCredentials: false, // Try without credentials
      });
      
      console.log('Income successfully added:', response.data);
      
      toast({
        title: 'Income added successfully!',
        description: "We've added your income to your account.",
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      router.push('/');
    } catch (error) {
      console.error('Error adding income:', error);
      
      // Try the fallback method with api utility
      try {
        console.log('Direct API call failed, trying fallback with api utility...');
        const fallbackResponse = await api.post('/incomes/', incomeData);
        console.log('Fallback succeeded:', fallbackResponse.data);
        
        toast({
          title: 'Income added successfully!',
          description: "We've added your income to your account using fallback method.",
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        router.push('/');
        return;
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        
        // Original error handling if both methods fail
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
          
          // Handle authentication errors specifically
          if (error.response.status === 401 || error.response.status === 403) {
            toast({
              title: 'Authentication Required',
              description: 'Your session may have expired. Please sign in again.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
            // Redirect to home page for authentication
            setTimeout(() => router.push('/'), 1000);
          } else {
            toast({
              title: 'Error adding income',
              description: error.response.data.detail || "There was a problem processing your request.",
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
          }
        } else if (error.request) {
          // The request was made but no response was received
          console.error('No response received:', error.request);
          
          toast({
            title: 'Server unavailable',
            description: "We couldn't reach the server. Please try again later.",
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error setting up request:', error.message);
          
          toast({
            title: 'Request failed',
            description: error.message || "An unexpected error occurred.",
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxW="container.md" py={10}>
      <Box p={8} borderWidth={1} borderRadius={8} boxShadow="lg">
        <Heading size="lg" mb={6}>Add New Income</Heading>
        <form onSubmit={handleSubmit}>
          <Stack spacing={4}>
            <FormControl id="amount" isRequired>
              <FormLabel>Amount</FormLabel>
              <NumberInput min={0} onChange={handleAmountChange}>
                <NumberInputField
                  name="amount"
                  value={formData.amount}
                  placeholder="Enter amount"
                />
              </NumberInput>
            </FormControl>

            <FormControl id="description" isRequired>
              <FormLabel>Description</FormLabel>
              <Input
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter description"
              />
            </FormControl>

            <FormControl id="date" isRequired>
              <FormLabel>Date</FormLabel>
              <Input
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
              />
            </FormControl>

            <FormControl id="category" isRequired>
              <FormLabel>Category</FormLabel>
              <Select
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="Select category"
              >
                <option value="Salary">Salary</option>
                <option value="Freelance">Freelance</option>
                <option value="Investment">Investment</option>
                <option value="Other">Other</option>
              </Select>
            </FormControl>

            <Button
              type="submit"
              colorScheme="green"
              isLoading={isSubmitting}
              loadingText="Submitting"
            >
              Add Income
            </Button>
          </Stack>
        </form>
      </Box>
    </Container>
  );
} 