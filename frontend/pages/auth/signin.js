import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, useSession } from 'next-auth/react';
import { Box, Button, Container, Heading, VStack } from '@chakra-ui/react';

export default function SignIn() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);

  return (
    <Container maxW="container.sm" py={10}>
      <VStack spacing={8}>
        <Heading>Sign in to Financial Tracker</Heading>
        <Box>
          <Button
            size="lg"
            colorScheme="blue"
            onClick={() => signIn('google', { callbackUrl: '/' })}
          >
            Sign in with Google
          </Button>
        </Box>
      </VStack>
    </Container>
  );
} 