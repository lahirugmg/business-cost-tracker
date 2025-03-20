import React, { useEffect } from 'react';
import {
  Box,
  Container,
  Text,
  Heading,
  Button,
  Center,
  VStack,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = !!session;
  const isLoading = status === 'loading';
  const toast = useToast();
  const router = useRouter();
  
  // Handle authentication errors from URL parameters
  useEffect(() => {
    const { error } = router.query;
    
    if (error) {
      const errorMessages = {
        'AccessDenied': 'Access was denied. Please try signing in again.',
        'Verification': 'Email verification failed. Please try again.',
        'OAuthSignin': 'Error during sign in process. Please try again.',
        'OAuthCallback': 'Error during authentication callback. Please try again.',
        'default': 'An authentication error occurred. Please try again.'
      };
      
      toast({
        title: 'Authentication Error',
        description: errorMessages[error] || errorMessages.default,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      // Clean up the URL by removing the error parameter
      router.replace('/', undefined, { shallow: true });
    }
  }, [router.query, toast, router]);

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
    // Get the backend error parameter if present
    const { backendError } = router.query;
    const showDemoOption = backendError === 'unavailable';
    
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="50vh">
          <VStack spacing={6}>
            <Heading as="h1" size="xl">Business Cost Tracker</Heading>
            <Text fontSize="lg">
              Track your business income and expenses to help manage your finances effectively.
            </Text>
            
            {showDemoOption ? (
              <>
                <Text color="orange.500">
                  Backend service is currently unavailable. You can continue in demo mode or try again later.
                </Text>
                <Button
                  colorScheme="orange"
                  size="lg"
                  onClick={() => {
                    // Redirect to the same page with demo=true parameter
                    router.push('/?demo=true');
                  }}
                >
                  Use Demo Mode
                </Button>
                <Button
                  variant="outline"
                  colorScheme="blue"
                  onClick={() => {
                    // Remove error parameter and try again
                    router.replace('/');
                  }}
                >
                  Try Again
                </Button>
              </>
            ) : (
              <Button
                colorScheme="blue"
                size="lg"
                onClick={() => {
                  // Explicit sign-in - no automatic authentication
                  signIn('google', { 
                    callbackUrl: '/',
                    prompt: 'select_account' // Force account selection, don't use remembered accounts
                  });
                }}
              >
                Sign In with Google
              </Button>
            )}
            
            <Text fontSize="sm" color="gray.500" mt={2}>
              Note: You will need to sign in explicitly each time you use the application.
            </Text>
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
