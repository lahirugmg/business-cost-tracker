import { Text } from '@chakra-ui/react';

export function FormErrorMessage({ message }) {
  return (
    <Text color="red.500" fontSize="sm" mt={1}>
      {message}
    </Text>
  );
} 