import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button, useToast } from '@chakra-ui/react';
import axios from 'axios';

const PlaidLink = ({ onSuccess }) => {
  const [linkToken, setLinkToken] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    createLinkToken();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const createLinkToken = async () => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/create_link_token`);
      setLinkToken(response.data.link_token);
    } catch (error) {
      console.error('Link token creation failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize account linking',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const onPlaidSuccess = async (public_token, metadata) => {
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/exchange_public_token`, {
        public_token
      });
      
      toast({
        title: 'Success',
        description: 'Account linked successfully!',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Token exchange failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to link account',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const onPlaidExit = (err, metadata) => {
    if (err) {
      console.error('Plaid Link exit with error:', err);
    }
  };

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || loading}
      isLoading={loading}
      loadingText="Connecting..."
      colorScheme="blue"
      size="lg"
    >
      Connect Account
    </Button>
  );
};

export default PlaidLink; 