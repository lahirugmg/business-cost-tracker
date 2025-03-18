import { Button } from '@chakra-ui/react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function LoginButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <Button onClick={() => signOut()} colorScheme="red">
        Sign out
      </Button>
    );
  }
  return (
    <Button onClick={() => signIn('google')} colorScheme="blue">
      Sign in with Google
    </Button>
  );
} 