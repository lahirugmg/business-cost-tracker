import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Checkbox,
  Select,
  Card,
  CardBody,
  Badge,
  Image,
  Flex,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { CheckIcon, CloseIcon, DeleteIcon, EditIcon, AddIcon } from '@chakra-ui/icons';

// Import our custom auth hook
import useAuth from '../hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Receipts() {
  const { session, status, isAuthenticated, getAuthenticatedApi } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const { isOpen: isReceiptModalOpen, onOpen: onReceiptModalOpen, onClose: onReceiptModalClose } = useDisclosure();
  const { isOpen: isTransactionModalOpen, onOpen: onTransactionModalOpen, onClose: onTransactionModalClose } = useDisclosure();

  useEffect(() => {
    if (status === 'loading') return;
    
    // If not authenticated, do nothing (the UI will show a sign-in prompt)
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    
    // Load receipts if authenticated
    fetchReceipts();
  }, [status, isAuthenticated]);

  const fetchReceipts = async () => {
    try {
      // Check if user is authenticated first
      if (!isAuthenticated) {
        console.log('User not authenticated, showing empty receipts list');
        setReceipts([]);
        // We don't show a toast here to respect explicit authentication preference
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      // Get an authenticated API instance
      const api = getAuthenticatedApi();
      
      try {
        // Add additional error handling around the API call
        const response = await api.get('/receipts', {
          // Add explicit validation status handling
          validateStatus: function(status) {
            return status >= 200 && status < 300; // Only accept 2xx status codes
          },
          // Add longer timeout for slower connections
          timeout: 10000
        });
        
        // Make sure we always have an array of receipts, even when in demo mode
        if (Array.isArray(response.data)) {
          setReceipts(response.data);
        } else if (response.data && response.data.status === 'demo') {
          console.log('Using demo mode data for receipts');
          // Set empty array for demo mode
          setReceipts([]);
          toast({
            title: 'Demo Mode Active',
            description: 'Using demo mode. Some features may be limited.',
            status: 'info',
            duration: 5000,
            isClosable: true,
          });
        } else {
          // Ensure receipts is always an array
          console.warn('Received non-array receipts data:', response.data);
          setReceipts([]);
        }
      } catch (apiError) {
        // Handle API-specific errors
        console.error('API error fetching receipts:', apiError);
        
        // Set receipts to empty array to prevent map errors
        setReceipts([]);
        
        // Handle different types of errors
        if (apiError.response) {
          // The request was made and the server responded with an error status
          if (apiError.response.status === 401 || apiError.response.status === 403) {
            // Auth error - respect explicit authentication preference
            toast({
              title: 'Authentication Required',
              description: 'Please sign in to view your receipts',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
          } else {
            // Other server error
            toast({
              title: 'Error fetching receipts',
              description: apiError.response.data?.detail || `Server error: ${apiError.response.status}`,
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
          }
        } else if (apiError.request) {
          // The request was made but no response was received (network error)
          toast({
            title: 'Network Error',
            description: 'Could not connect to the server. Please check your connection.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        } else {
          // Something happened in setting up the request
          toast({
            title: 'Error fetching receipts',
            description: apiError.message || 'An unexpected error occurred',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      }
    } catch (error) {
      // Handle any errors in our component logic
      console.error('Component error in fetchReceipts:', error);
      setReceipts([]);
      toast({
        title: 'Error fetching receipts',
        description: 'An unexpected application error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a receipt file to upload',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const api = getAuthenticatedApi();
      const response = await api.post('/receipts', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      toast({
        title: 'Receipt uploaded successfully',
        description: 'The receipt has been processed with AI and is ready for verification',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Add the new receipt to the list
      setReceipts([response.data, ...receipts]);

      // Clear the file input
      setSelectedFile(null);
      const fileInput = document.getElementById('receipt-file');
      if (fileInput) fileInput.value = '';

      // Open the modal to review the extracted data
      setSelectedReceipt(response.data);
      onReceiptModalOpen();
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: 'Error uploading receipt',
        description: error.response?.data?.detail || 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    if (!confirm('Are you sure you want to delete this receipt?')) {
      return;
    }

    try {
      const api = getAuthenticatedApi();
      await api.delete(`/receipts/${receiptId}`);

      toast({
        title: 'Receipt deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Remove the deleted receipt from the list
      setReceipts(receipts.filter(receipt => receipt.id !== receiptId));
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast({
        title: 'Error deleting receipt',
        description: error.response?.data?.detail || 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleViewReceipt = (receipt) => {
    setSelectedReceipt(receipt);
    onReceiptModalOpen();
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    onTransactionModalOpen();
  };

  const handleUpdateTransaction = async () => {
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(editingTransaction)) {
        if (key !== 'id' && key !== 'receipt_id' && key !== 'expense_id' && key !== 'receipt') {
          formData.append(key, value);
        }
      }

      const response = await axios.put(`${API_URL}/receipts/transactions/${editingTransaction.id}`, formData, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });

      // Update the transaction in the receipts list
      const updatedReceipts = receipts.map(receipt => {
        if (receipt.id === selectedReceipt.id) {
          const updatedTransactions = receipt.extracted_transactions.map(transaction => {
            if (transaction.id === editingTransaction.id) {
              return response.data;
            }
            return transaction;
          });
          return { ...receipt, extracted_transactions: updatedTransactions };
        }
        return receipt;
      });

      setReceipts(updatedReceipts);
      
      // Also update the selected receipt if it's open in the modal
      if (selectedReceipt) {
        const updatedTransactions = selectedReceipt.extracted_transactions.map(transaction => {
          if (transaction.id === editingTransaction.id) {
            return response.data;
          }
          return transaction;
        });
        setSelectedReceipt({ ...selectedReceipt, extracted_transactions: updatedTransactions });
      }

      toast({
        title: 'Transaction updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onTransactionModalClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast({
        title: 'Error updating transaction',
        description: error.response?.data?.detail || 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleVerifyTransaction = async (transactionId, verified) => {
    try {
      const formData = new FormData();
      formData.append('verified', verified);

      const response = await axios.put(`${API_URL}/receipts/transactions/${transactionId}`, formData, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });

      // Update the transaction in the receipts list
      const updatedReceipts = receipts.map(receipt => {
        if (receipt.id === selectedReceipt.id) {
          const updatedTransactions = receipt.extracted_transactions.map(transaction => {
            if (transaction.id === transactionId) {
              return response.data;
            }
            return transaction;
          });
          return { ...receipt, extracted_transactions: updatedTransactions };
        }
        return receipt;
      });

      setReceipts(updatedReceipts);
      
      // Also update the selected receipt if it's open in the modal
      if (selectedReceipt) {
        const updatedTransactions = selectedReceipt.extracted_transactions.map(transaction => {
          if (transaction.id === transactionId) {
            return response.data;
          }
          return transaction;
        });
        setSelectedReceipt({ ...selectedReceipt, extracted_transactions: updatedTransactions });
      }

      toast({
        title: verified ? 'Transaction verified' : 'Transaction unmarked',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error verifying transaction:', error);
      toast({
        title: 'Error updating transaction',
        description: error.response?.data?.detail || 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleAddToExpenses = async (transactionId) => {
    try {
      const response = await axios.post(`${API_URL}/receipts/transactions/${transactionId}/add-to-expenses`, {}, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });

      // Update the transaction in the receipts list
      const updatedReceipts = receipts.map(receipt => {
        if (receipt.id === selectedReceipt.id) {
          const updatedTransactions = receipt.extracted_transactions.map(transaction => {
            if (transaction.id === transactionId) {
              return { ...transaction, added_to_expenses: true, expense_id: response.data.expense_id };
            }
            return transaction;
          });
          return { ...receipt, extracted_transactions: updatedTransactions };
        }
        return receipt;
      });

      setReceipts(updatedReceipts);
      
      // Also update the selected receipt if it's open in the modal
      if (selectedReceipt) {
        const updatedTransactions = selectedReceipt.extracted_transactions.map(transaction => {
          if (transaction.id === transactionId) {
            return { ...transaction, added_to_expenses: true, expense_id: response.data.expense_id };
          }
          return transaction;
        });
        setSelectedReceipt({ ...selectedReceipt, extracted_transactions: updatedTransactions });
      }

      toast({
        title: 'Added to expenses',
        description: 'Transaction has been added to your expenses',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding to expenses:', error);
      toast({
        title: 'Error adding to expenses',
        description: error.response?.data?.detail || 'An unexpected error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Show loading state
  if (status === 'loading') {
    return (
      <Container maxW="container.xl" py={8}>
        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
          <Spinner size="xl" />
        </Box>
      </Container>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!session) {
    return (
      <Container maxW="container.xl" py={8}>
        <Box textAlign="center" py={10} px={6}>
          <Heading as="h2" size="xl" mt={6} mb={2}>
            Authentication Required
          </Heading>
          <Text color={'gray.500'} mb={6}>
            Please sign in to access receipt processing features
          </Text>
          <Button
            colorScheme="blue"
            size="lg"
            onClick={() => signIn('google', { callbackUrl: '/receipts' })}
          >
            Sign In
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <Heading as="h1" mb={6}>Receipt Processing</Heading>
      
      {/* Upload section */}
      <Card mb={8}>
        <CardBody>
          <VStack spacing={4} align="start">
            <Heading size="md">Upload New Receipt</Heading>
            <Text>Upload a receipt (PDF, JPG, PNG) to automatically extract expense details using AI</Text>
            
            <FormControl>
              <FormLabel htmlFor="receipt-file">Select Receipt</FormLabel>
              <HStack>
                <Input
                  id="receipt-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  isDisabled={isUploading}
                />
                <Button
                  colorScheme="blue"
                  onClick={handleUpload}
                  isLoading={isUploading}
                  loadingText={`Uploading ${uploadProgress}%`}
                  isDisabled={!selectedFile || isUploading}
                >
                  Upload & Process
                </Button>
              </HStack>
            </FormControl>
            
            {isUploading && (
              <Box w="100%">
                <Text mb={2}>{uploadProgress}% - AI is processing your receipt...</Text>
                <Box bg="gray.100" borderRadius="md" h="10px" w="100%">
                  <Box
                    bg="blue.500"
                    borderRadius="md"
                    h="100%"
                    w={`${uploadProgress}%`}
                    transition="width 0.3s ease-in-out"
                  />
                </Box>
              </Box>
            )}
          </VStack>
        </CardBody>
      </Card>
      
      {/* Receipts List */}
      <Box mb={8}>
        <Heading size="md" mb={4}>Your Receipts</Heading>
        
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <Spinner />
          </Box>
        ) : receipts.length === 0 ? (
          <Alert status="info">
            <AlertIcon />
            <AlertTitle>No receipts found</AlertTitle>
            <AlertDescription>Upload a receipt to get started.</AlertDescription>
          </Alert>
        ) : (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Merchant</Th>
                <Th>Date</Th>
                <Th isNumeric>Total</Th>
                <Th>Status</Th>
                <Th>Transactions</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {receipts.map((receipt) => (
                <Tr key={receipt.id}>
                  <Td>{receipt.merchant_name || 'Unknown'}</Td>
                  <Td>{receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString() : 'Unknown'}</Td>
                  <Td isNumeric>${receipt.receipt_total?.toFixed(2) || '0.00'}</Td>
                  <Td>
                    {receipt.verified ? (
                      <Badge colorScheme="green">Verified</Badge>
                    ) : receipt.processed ? (
                      <Badge colorScheme="yellow">Needs Review</Badge>
                    ) : (
                      <Badge colorScheme="red">Processing</Badge>
                    )}
                  </Td>
                  <Td>{receipt.extracted_transactions?.length || 0}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button size="sm" onClick={() => handleViewReceipt(receipt)}>
                        Review
                      </Button>
                      <IconButton
                        size="sm"
                        aria-label="Delete receipt"
                        icon={<DeleteIcon />}
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => handleDeleteReceipt(receipt.id)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
      
      {/* Receipt Review Modal */}
      <Modal isOpen={isReceiptModalOpen} onClose={onReceiptModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Review Receipt
            {selectedReceipt?.merchant_name && ` - ${selectedReceipt.merchant_name}`}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedReceipt && (
              <VStack spacing={4} align="stretch">
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <GridItem>
                    <Text fontWeight="bold">Merchant:</Text>
                    <Text>{selectedReceipt.merchant_name || 'Unknown'}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontWeight="bold">Date:</Text>
                    <Text>
                      {selectedReceipt.receipt_date
                        ? new Date(selectedReceipt.receipt_date).toLocaleDateString()
                        : 'Unknown'}
                    </Text>
                  </GridItem>
                  <GridItem>
                    <Text fontWeight="bold">Total:</Text>
                    <Text>${selectedReceipt.receipt_total?.toFixed(2) || '0.00'}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontWeight="bold">Status:</Text>
                    <Text>
                      {selectedReceipt.verified
                        ? 'Verified'
                        : selectedReceipt.processed
                        ? 'Needs Review'
                        : 'Processing'}
                    </Text>
                  </GridItem>
                </Grid>

                <Box mt={4}>
                  <Heading size="sm" mb={2}>Extracted Transactions</Heading>
                  <Alert status="info" mb={4}>
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Review each transaction</AlertTitle>
                      <AlertDescription>
                        Verify that the AI correctly extracted each transaction, then add to your expenses
                      </AlertDescription>
                    </Box>
                  </Alert>
                  
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Description</Th>
                        <Th>Category</Th>
                        <Th isNumeric>Amount</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {selectedReceipt.extracted_transactions?.map((transaction) => (
                        <Tr key={transaction.id}>
                          <Td>{transaction.description}</Td>
                          <Td>{transaction.category}</Td>
                          <Td isNumeric>${transaction.amount.toFixed(2)}</Td>
                          <Td>
                            <HStack spacing={1}>
                              <IconButton
                                size="xs"
                                aria-label="Edit transaction"
                                icon={<EditIcon />}
                                onClick={() => handleEditTransaction(transaction)}
                              />
                              <IconButton
                                size="xs"
                                aria-label={transaction.verified ? "Unmark as verified" : "Mark as verified"}
                                icon={transaction.verified ? <CloseIcon /> : <CheckIcon />}
                                colorScheme={transaction.verified ? "red" : "green"}
                                onClick={() => handleVerifyTransaction(transaction.id, !transaction.verified)}
                              />
                              {transaction.verified && !transaction.added_to_expenses && (
                                <IconButton
                                  size="xs"
                                  aria-label="Add to expenses"
                                  icon={<AddIcon />}
                                  colorScheme="blue"
                                  onClick={() => handleAddToExpenses(transaction.id)}
                                />
                              )}
                              {transaction.added_to_expenses && (
                                <Badge colorScheme="green" ml={1}>Added</Badge>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                  
                  {!selectedReceipt.extracted_transactions?.length && (
                    <Alert status="warning">
                      <AlertIcon />
                      No transactions were extracted from this receipt.
                    </Alert>
                  )}
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onReceiptModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Edit Transaction Modal */}
      <Modal isOpen={isTransactionModalOpen} onClose={onTransactionModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Transaction</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editingTransaction && (
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Input
                    value={editingTransaction.description}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      description: e.target.value
                    })}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Amount</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      amount: parseFloat(e.target.value)
                    })}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Date</FormLabel>
                  <Input
                    type="date"
                    value={editingTransaction.date ? new Date(editingTransaction.date).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      date: e.target.value
                    })}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={editingTransaction.category || ''}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      category: e.target.value
                    })}
                  >
                    <option value="Food">Food</option>
                    <option value="Drink">Drink</option>
                    <option value="Travel">Travel</option>
                    <option value="Accommodation">Accommodation</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Services">Services</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <Checkbox
                    isChecked={editingTransaction.verified}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      verified: e.target.checked
                    })}
                  >
                    Mark as verified
                  </Checkbox>
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onTransactionModalClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleUpdateTransaction}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
