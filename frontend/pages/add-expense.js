import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import api from '../utils/api';
import axios from 'axios';
import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';

export default function AddExpense() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, status } = useSession();
  const isAuthenticated = !!session;
  
  // Check authentication on page load
  useEffect(() => {
    // If explicitly not authenticated, redirect to home
    if (status === 'unauthenticated') {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to add expenses',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      router.push('/');
    }
  }, [status, router, toast]);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    property_type: '',
  });
  const [attachment, setAttachment] = useState(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleAmountChange = (value) => {
    setFormData({ ...formData, amount: value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachment(file);
      setAttachmentName(file.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let attachmentData = null;
      
      // If there's an attachment, upload it first
      if (attachment) {
        setUploading(true);
        
        // Create FormData for file upload
        const fileFormData = new FormData();
        fileFormData.append('file', attachment);
        
        // Upload file to backend
        try {
          const uploadResponse = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/upload-attachment/`,
            fileFormData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            }
          );
          
          attachmentData = uploadResponse.data;
          console.log('File uploaded successfully:', attachmentData);
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          toast({
            title: 'File upload failed',
            description: 'There was a problem uploading your file. The expense will be saved without an attachment.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        } finally {
          setUploading(false);
        }
      }
      
      // Prepare expense data for submission using the regular API method
      const expenseData = {
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        category: formData.category,
        property_type: formData.property_type || '',
        tax_deductible: formData.category === 'Other - not tax deductible' ? false : true,
      };
      
      // Add attachment info if available
      if (attachmentData) {
        expenseData.attachment_filename = attachmentData.filename;
        expenseData.attachment_path = attachmentData.path;
      }
      
      // Submit expense data using the API utility
      const response = await api.post('/expenses/', expenseData);
      
      console.log('Expense successfully added:', response.data);
      
      toast({
        title: 'Expense added successfully!',
        description: "We've added your expense to your account.",
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      router.push('/');
    } catch (error) {
      console.error('Error adding expense:', error);
      
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
            title: 'Error adding expense',
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxW="container.md" py={10}>
      <Box p={8} borderWidth={1} borderRadius={8} boxShadow="lg">
        <Heading size="lg" mb={6}>Add New Expense</Heading>
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
                <option value="Repairs">Repairs</option>
                <option value="Supplies">Supplies</option>
                <option value="Real Estate Taxes">Real Estate Taxes</option>
                <option value="Utilities">Utilities</option>
                <option value="Travel">Travel (not auto)</option>
                <option value="Commissions">Commissions</option>
                <option value="Legal and Professional Fees">Legal and Professional Fees</option>
                <option value="Other Interest Paid">Other Interest Paid</option>
                <option value="Excess Real Estate Taxes">Excess Real Estate Taxes</option>
                <option value="Advertising">Advertising</option>
                <option value="Cleaning and Maintenance">Cleaning and Maintenance</option>
                <option value="Insurance">Insurance</option>
                <option value="Management Fees">Management Fees</option>
                <option value="Mortgage Interest Paid to Banks">Mortgage Interest Paid to Banks</option>
                <option value="Other - not tax deductible">Other - not tax deductible</option>
              </Select>
            </FormControl>

            <FormControl id="property_type" isRequired>
              <FormLabel>Property Type</FormLabel>
              <Select
                name="property_type"
                value={formData.property_type}
                onChange={handleChange}
                placeholder="Select property type"
              >
                <option value="Real property">Real property</option>
                <option value="Building components and systems">Building components and systems</option>
                <option value="Appliances and equipment">Appliances and equipment</option>
                <option value="Vehicle and transportation">Vehicle and transportation</option>
                <option value="Tools and small equipment">Tools and small equipment</option>
              </Select>
            </FormControl>



            <FormControl id="attachment">
              <FormLabel>Receipt or Invoice (Optional)</FormLabel>
              <Input
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                p={1}
              />
              {attachmentName && (
                <Box mt={2} p={2} bg="gray.100" borderRadius="md">
                  <Text fontSize="sm">Selected file: {attachmentName}</Text>
                </Box>
              )}
            </FormControl>

            <Button
              type="submit"
              colorScheme="red"
              isLoading={isSubmitting}
              loadingText="Submitting"
            >
              Add Expense
            </Button>
          </Stack>
        </form>
      </Box>
    </Container>
  );
} 