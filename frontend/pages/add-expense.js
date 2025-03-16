import { useState } from 'react';
import { useRouter } from 'next/router';
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
  useToast,
} from '@chakra-ui/react';

export default function AddExpense() {
  const router = useRouter();
  const toast = useToast();
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    tax_deductible: false,
  });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await axios.post('http://localhost:8000/expenses/', {
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        category: formData.category,
        tax_deductible: formData.tax_deductible,
      });

      toast({
        title: 'Expense added.',
        description: "We've added your expense to your account.",
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      router.push('/');
    } catch (error) {
      toast({
        title: 'An error occurred.',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
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
                <option value="Food">Food</option>
                <option value="Housing">Housing</option>
                <option value="Transportation">Transportation</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Utilities">Utilities</option>
                <option value="Other">Other</option>
              </Select>
            </FormControl>

            <FormControl id="tax_deductible">
              <Checkbox
                name="tax_deductible"
                isChecked={formData.tax_deductible}
                onChange={handleChange}
              >
                Tax Deductible
              </Checkbox>
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