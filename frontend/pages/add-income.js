import { useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
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
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    try {
      await axios.post('http://localhost:8000/incomes/', {
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        category: formData.category,
      });

      toast({
        title: 'Income added.',
        description: "We've added your income to your account.",
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