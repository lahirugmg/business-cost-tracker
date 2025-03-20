import { useSession } from 'next-auth/react';
import {
  Box,
  Container,
  Heading,
  Text,
  Stack,
  Avatar,
  Card,
  CardHeader,
  CardBody,
  Flex,
  Badge,
  Divider,
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Profile() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Show a message and redirect to home if not authenticated
  // This respects explicit authentication preference
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Use next/router to redirect to home page instead of directly to sign-in
      // This respects the user's preference for explicit authentication
      console.log('User not authenticated, redirecting to home');
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <Container maxW="container.md" py={10}>
        <Box textAlign="center" py={10}>
          <Text fontSize="xl">Loading your profile...</Text>
        </Box>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container maxW="container.md" py={10}>
        <Box textAlign="center" py={10}>
          <Heading size="lg" mb={4}>Authentication Required</Heading>
          <Text mb={4}>Please sign in to view your profile information.</Text>
          <Box as="button"
            p={4}
            color="white"
            fontWeight="bold"
            borderRadius="md"
            bgGradient="linear(to-r, teal.500, green.500)"
            _hover={{
              bgGradient: 'linear(to-r, teal.600, green.600)',
            }}
            onClick={() => router.push('/')}
          >
            Return to Homepage
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="container.md" py={10}>
      <Card mb={8}>
        <CardHeader>
          <Flex spacing="4">
            <Flex flex="1" gap="4" alignItems="center" flexWrap="wrap">
              <Avatar 
                size="xl" 
                name={session.user.name || 'User'} 
                src={session.user.image || undefined} 
              />
              <Box>
                <Heading size="md">{session.user.name}</Heading>
                <Text>{session.user.email}</Text>
                <Badge colorScheme="green">Active Account</Badge>
              </Box>
            </Flex>
          </Flex>
        </CardHeader>
        <CardBody>
          <Stack spacing={4}>
            <Text fontWeight="bold">Account Information</Text>
            <Divider />
            
            <Box>
              <Text fontSize="sm" color="gray.500">Email</Text>
              <Text>{session.user.email}</Text>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.500">Name</Text>
              <Text>{session.user.name}</Text>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.500">Account Type</Text>
              <Text>Standard User</Text>
            </Box>
            
            <Box>
              <Text fontSize="sm" color="gray.500">Authentication Method</Text>
              <Text>Google</Text>
            </Box>
          </Stack>
        </CardBody>
      </Card>
      
      <Card>
        <CardHeader>
          <Heading size="md">Privacy & Settings</Heading>
        </CardHeader>
        <CardBody>
          <Text>
            Your data is securely stored and is only accessible to you. We use industry-standard
            encryption to protect your financial information.
          </Text>
        </CardBody>
      </Card>
    </Container>
  );
}
