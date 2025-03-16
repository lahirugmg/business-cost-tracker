import { Box, Container, Flex, Link as ChakraLink } from '@chakra-ui/react';
import NextLink from 'next/link';

export default function Layout({ children }) {
  return (
    <Box minH="100vh">
      <Box bg="gray.100" py={4} mb={8}>
        <Container maxW="container.xl">
          <Flex gap={6}>
            <NextLink href="/" passHref legacyBehavior>
              <ChakraLink fontWeight="bold" p={2}>
                Dashboard
              </ChakraLink>
            </NextLink>
            <NextLink href="/transactions" passHref legacyBehavior>
              <ChakraLink p={2}>
                Transactions
              </ChakraLink>
            </NextLink>
            <NextLink href="/add-income" passHref legacyBehavior>
              <ChakraLink p={2}>
                Add Income
              </ChakraLink>
            </NextLink>
            <NextLink href="/add-expense" passHref legacyBehavior>
              <ChakraLink p={2}>
                Add Expense
              </ChakraLink>
            </NextLink>
          </Flex>
        </Container>
      </Box>
      <Container maxW="container.xl" py={8}>
        {children}
      </Container>
    </Box>
  );
} 