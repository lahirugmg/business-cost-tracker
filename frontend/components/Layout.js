import { Box, Container, Flex, Spacer, Button } from '@chakra-ui/react';
import { useSession } from 'next-auth/react';
import LoginButton from './LoginButton';
import UserProfile from './UserProfile';
import Link from 'next/link';

export default function Layout({ children }) {
  const { data: session } = useSession();

  return (
    <Box minH="100vh">
      <Box bg="gray.100" py={4} mb={8}>
        <Container maxW="container.xl">
          <Flex alignItems="center">
            <Flex gap={6}>
              <Link href="/" passHref legacyBehavior>
                <Button as="a" variant="ghost">Dashboard</Button>
              </Link>
              {session && (
                <>
                  <Link href="/transactions" passHref legacyBehavior>
                    <Button as="a" variant="ghost">Transactions</Button>
                  </Link>
                  <Link href="/add-income" passHref legacyBehavior>
                    <Button as="a" variant="ghost">Add Income</Button>
                  </Link>
                  <Link href="/add-expense" passHref legacyBehavior>
                    <Button as="a" variant="ghost">Add Expense</Button>
                  </Link>
                </>
              )}
            </Flex>
            <Spacer />
            {session ? <UserProfile /> : <LoginButton />}
          </Flex>
        </Container>
      </Box>
      <Container maxW="container.xl">
        {children}
      </Container>
    </Box>
  );
} 