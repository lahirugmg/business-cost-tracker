import React from 'react';
import {
  Box,
  Container,
  Text,
  Heading,
  Button,
  Center,
  VStack,
  Spinner,
} from '@chakra-ui/react';
import { useSession, signIn } from 'next-auth/react';

export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = !!session;
  const isLoading = status === 'loading';

  // Loading state
  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="50vh">
          <Spinner size="xl" />
        </Center>
      </Container>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="50vh">
          <VStack spacing={6}>
            <Heading as="h1" size="xl">Business Cost Tracker</Heading>
            <Text fontSize="lg">
              Track your business income and expenses to help manage your finances effectively.
            </Text>
            <Button
              colorScheme="blue"
              size="lg"
              onClick={() => signIn('google', { callbackUrl: '/' })}
            >
              Sign In with Google
            </Button>
          </VStack>
        </Center>
      </Container>
    );
  }

  // Authenticated state
  return (
    <Container maxW="container.xl" py={8}>
      <Center>
        <VStack spacing={6} align="stretch" w="100%">
          <Heading as="h1" size="xl">Welcome to Business Cost Tracker</Heading>
          <Text fontSize="lg">
            You are now signed in as {session.user?.name || 'User'}.
          </Text>
          
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
            <Heading size="md" mb={4}>Quick Links</Heading>
            <VStack spacing={4} align="stretch">
              <Button colorScheme="blue" as="a" href="/transactions">
                View Transactions
              </Button>
              <Button colorScheme="green" as="a" href="/add-income">
                Add Income
              </Button>
              <Button colorScheme="red" as="a" href="/add-expense">
                Add Expense
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Center>
    </Container>
  );
}
