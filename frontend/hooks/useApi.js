import { useState } from 'react';
import axios from 'axios';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callApi = async (method, url, data = null) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios[method](url, data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, callApi };
} 