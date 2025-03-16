import { Center, Spinner } from '@chakra-ui/react';

export default function LoadingSpinner() {
  return (
    <Center h="200px">
      <Spinner size="xl" color="blue.500" />
    </Center>
  );
} 