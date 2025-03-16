import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Heading,
  Container,
  Text,
  Button,
  Stack,
  Flex,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
} from '@chakra-ui/react';
import Link from 'next/link';

export default function Home() {
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const incomesResponse = await axios.get('http://localhost:8000/incomes/');
        const expensesResponse = await axios.get('http://localhost:8000/expenses/');
        
        setIncomes(incomesResponse.data);
        setExpenses(expensesResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const profit = totalIncome - totalExpenses;
  
  return (
    <Container maxW={'5xl'}>
      <Stack
        textAlign={'center'}
        align={'center'}
        spacing={{ base: 8, md: 10 }}
        py={{ base: 20, md: 28 }}>
        <Heading
          fontWeight={600}
          fontSize={{ base: '3xl', sm: '4xl', md: '6xl' }}
          lineHeight={'110%'}>
          Financial{' '}
          <Text as={'span'} color={'green.400'}>
            Tracker
          </Text>
        </Heading>
        
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10} width="100%">
          <Stat
            px={{ base: 2, md: 4 }}
            py={'5'}
            shadow={'xl'}
            border={'1px solid'}
            borderColor={'green.500'}
            rounded={'lg'}>
            <StatLabel fontWeight={'medium'}>Total Income</StatLabel>
            <StatNumber fontSize={'3xl'} fontWeight={'medium'}>
              ${totalIncome.toFixed(2)}
            </StatNumber>
          </Stat>
          
          <Stat
            px={{ base: 2, md: 4 }}
            py={'5'}
            shadow={'xl'}
            border={'1px solid'}
            borderColor={'red.500'}
            rounded={'lg'}>
            <StatLabel fontWeight={'medium'}>Total Expenses</StatLabel>
            <StatNumber fontSize={'3xl'} fontWeight={'medium'}>
              ${totalExpenses.toFixed(2)}
            </StatNumber>
          </Stat>
          
          <Stat
            px={{ base: 2, md: 4 }}
            py={'5'}
            shadow={'xl'}
            border={'1px solid'}
            borderColor={profit >= 0 ? 'blue.500' : 'red.500'}
            rounded={'lg'}>
            <StatLabel fontWeight={'medium'}>Profit</StatLabel>
            <StatNumber fontSize={'3xl'} fontWeight={'medium'} color={profit >= 0 ? 'blue.500' : 'red.500'}>
              ${profit.toFixed(2)}
            </StatNumber>
          </Stat>
        </SimpleGrid>
        
        <Stack spacing={6} direction={'row'}>
          <Link href="/add-income">
            <Button
              rounded={'full'}
              px={6}
              colorScheme={'green'}
              bg={'green.400'}
              _hover={{ bg: 'green.500' }}>
              Add Income
            </Button>
          </Link>
          <Link href="/add-expense">
            <Button
              rounded={'full'}
              px={6}
              colorScheme={'red'}
              bg={'red.400'}
              _hover={{ bg: 'red.500' }}>
              Add Expense
            </Button>
          </Link>
        </Stack>
      </Stack>
    </Container>
  );
} 