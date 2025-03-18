import { useSession } from 'next-auth/react';
import {
  Box,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Text,
  Button,
  Flex,
} from '@chakra-ui/react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

export default function UserProfile() {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <Menu>
      <MenuButton
        as={Button}
        rounded="full"
        variant="link"
        cursor="pointer"
        minW={0}
      >
        <Avatar
          size="sm"
          src={session.user?.image || undefined}
          name={session.user?.name || 'User'}
        />
      </MenuButton>
      <MenuList zIndex={1000}>
        <Box px={4} py={2}>
          <Text fontWeight="bold">{session.user?.name}</Text>
          <Text fontSize="sm" color="gray.600">
            {session.user?.email}
          </Text>
        </Box>
        <MenuDivider />
        <Link href="/profile" passHref legacyBehavior>
          <MenuItem as="a">Profile</MenuItem>
        </Link>
        <MenuItem onClick={() => signOut()}>Sign Out</MenuItem>
      </MenuList>
    </Menu>
  );
}
