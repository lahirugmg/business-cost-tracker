import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Custom hook to handle authentication with the backend
 * This handles the exchange of Google OAuth tokens for backend JWT tokens
 * and respects explicit authentication preference
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const [backendToken, setBackendToken] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Exchange the Google token for a backend token
  const exchangeToken = async (googleToken) => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      
      console.log('[FRONTEND][AUTH] STEP 1: Initiating token exchange with backend');
      console.log('[FRONTEND][AUTH] Flow: User Sign-in → NextAuth → Our Hook → Backend');
      
      // Check if token is valid
      if (!googleToken) {
        console.error('[FRONTEND][AUTH] FAILED: No Google token available for exchange');
        console.log('[FRONTEND][AUTH] This might happen if the OAuth flow was interrupted');
        setAuthError('No authentication token available');
        // Don't auto-enable demo mode to respect explicit authentication preference
        return null;
      }
      
      console.log('[FRONTEND][AUTH] STEP 2: Google token received, length:', googleToken.length);
      console.log('[FRONTEND][AUTH] Token type:', googleToken.substring(0, 5));
      console.log('[FRONTEND][AUTH] Token likely type:', googleToken.startsWith('ya29.') ? 'Access Token' : (googleToken.startsWith('eyJ') ? 'ID Token' : 'Unknown'));
      
      // Use the exchangeToken function from api.js but handle any errors
      try {
        // Import the exchangeToken function from our utils/api.js
        const { exchangeToken: apiExchangeToken } = await import('../utils/api');
        
        console.log('[FRONTEND][AUTH] STEP 3: Calling token exchange utility function in api.js');
        console.log('[FRONTEND][AUTH] This function will send the token to the backend endpoint');
        
        // Call the API utility to exchange the token
        console.time('[FRONTEND][AUTH] Backend token exchange duration');
        const token = await apiExchangeToken(googleToken);
        console.timeEnd('[FRONTEND][AUTH] Backend token exchange duration');
        
        // If token exchange was successful, update our state
        if (token) {
          console.log('[FRONTEND][AUTH] STEP 4: SUCCESS! Received valid backend token');
          console.log('[FRONTEND][AUTH] Backend token length:', token.length);
          console.log('[FRONTEND][AUTH] Backend token preview:', token.substring(0, 15) + '...');
          setBackendToken(token);
          return token;
        } else {
          console.warn('[FRONTEND][AUTH] STEP 4: FAILED - Token exchange returned null or empty token');
          console.log('[FRONTEND][AUTH] This suggests the backend rejected the authentication');
          setAuthError('Authentication failed - invalid token');
          return null;
        }
      } catch (apiError) {
        // Handle errors from the API utility token exchange
        console.error('[FRONTEND][AUTH] ERROR in STEP 3-4: Token exchange failed:', apiError.message);
        console.log('[FRONTEND][AUTH] Error stack:', apiError.stack);
        console.log('[FRONTEND][AUTH] This error occurred in the api.js utility or during backend communication');
        
        // Set a user-friendly error message based on the error
        if (apiError.message.includes('Network error') || 
            apiError.message.includes('unavailable')) {
          console.log('[FRONTEND][AUTH] Diagnosis: Network connectivity issue to backend');
          setAuthError('Network error: Cannot connect to authentication service');
        } else if (apiError.message.includes('Authentication failed')) {
          console.log('[FRONTEND][AUTH] Diagnosis: Backend rejected the token (401 Unauthorized)');
          setAuthError('Authentication failed - please sign in again');
        } else if (apiError.message.includes('timeout')) {
          console.log('[FRONTEND][AUTH] Diagnosis: Backend request timed out');
          setAuthError('Backend authentication service timeout - please try again');
        } else {
          console.log('[FRONTEND][AUTH] Diagnosis: Unknown authentication error');
          setAuthError(apiError.message || 'Authentication error');
        }
        
        // Explicitly return null to respect explicit authentication
        console.log('[FRONTEND][AUTH] Authentication failed, returning null (no token)');
        return null;
      }
    } catch (error) {
      // Handle any unexpected errors in our hook
      console.error('[FRONTEND][AUTH] CRITICAL ERROR: Unexpected error in authentication hook:', error);
      console.log('[FRONTEND][AUTH] Error details:', error.message);
      console.log('[FRONTEND][AUTH] Error stack:', error.stack);
      console.log('[FRONTEND][AUTH] This is an unexpected error in the useAuth hook itself');
      setAuthError('Unexpected authentication error');
      // Don't auto-enable demo mode for unexpected errors to respect explicit authentication
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  // Helper function to enable demo mode
  const enableDemoMode = () => {
    console.log('Enabling demo mode for authentication');
    setIsDemoMode(true);
    
    // Generate a demo token if we don't have one
    if (!backendToken) {
      const demoToken = 'demo_token_' + Math.random().toString(36).substring(2);
      setBackendToken(demoToken);
      return demoToken;
    }
    
    return backendToken;
  };

  // Get an authenticated API instance
  const getAuthenticatedApi = () => {
    const api = axios.create({
      baseURL: API_URL,
      // Add timeout to prevent hanging requests
      timeout: 10000
    });
    
    // Add auth token to all requests
    api.interceptors.request.use(
      (config) => {
        // Skip token for auth endpoints to avoid circular dependencies
        if (config.url.includes('/auth/')) {
          return config;
        }
        
        if (backendToken) {
          config.headers.Authorization = `Bearer ${backendToken}`;
          console.log('Using backend token for request');
        } else {
          console.log('No backend token available');
        }
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor to handle common errors
    api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        // Handle authentication errors
        if (error.response && error.response.status === 401) {
          console.error('Authentication error with API request');
          setAuthError('Authentication failed. Please sign in again.');
          
          // If we're in demo mode, try to continue anyway
          if (isDemoMode) {
            console.log('Continuing in demo mode despite auth error');
            // Return mock successful response for demo mode
            return Promise.resolve({ 
              data: { 
                status: 'demo',
                message: 'Using demo mode' 
              } 
            });
          }
        }
        return Promise.reject(error);
      }
    );
    
    return api;
  };

  // Attempt to exchange the token whenever the session changes
  useEffect(() => {
    const authenticateWithBackend = async () => {
      // Clear any previous errors
      setAuthError(null);
      
      // Only proceed with authentication if user is explicitly signed in
      // This strictly respects the user's preference for explicit authentication
      if (status === 'authenticated') {
        console.log('Session authenticated, checking for token');
        
        if (session?.accessToken && !backendToken) {
          console.log('Found session token, exchanging with backend');
          try {
            // Use a try/catch to handle any errors during token exchange
            // This prevents network errors from breaking the authentication flow
            await exchangeToken(session.accessToken);
          } catch (error) {
            console.error('Error during token exchange effect:', error);
            // Don't enable demo mode automatically to respect explicit authentication
            setAuthError('Authentication failed - please try signing in again');
          }
        } else if (!session?.accessToken && !backendToken) {
          console.error('No access token in session');
          setAuthError('Missing authentication token');
        }
      } else if (status === 'unauthenticated') {
        // Ensure demo mode is never automatically applied when not authenticated
        // This strictly enforces explicit authentication preference
        if (backendToken) {
          console.log('Removing backend token to respect explicit authentication');
          setBackendToken(null);
        }
        if (isDemoMode) {
          console.log('Disabling demo mode to respect explicit authentication');
          setIsDemoMode(false);
        }
      }
    };
    
    authenticateWithBackend();
  }, [session, status]);
  
  // Add this effect to detect and clear any stale authentication state
  useEffect(() => {
    // This effect ensures that we maintain explicit authentication preferences
    // by cleaning up any auth state when the session ends
    if (status === 'unauthenticated') {
      if (backendToken || isDemoMode) {
        console.log('Session ended, clearing authentication state to enforce explicit authentication');
        setBackendToken(null);
        setIsDemoMode(false);
        // Clear any previous errors to avoid confusing messages
        setAuthError(null);
      }
    }
  }, [status]);
  
  // Additional check to ensure we don't auto-sign in with demo mode
  useEffect(() => {
    // If there's no session but we have a token/demo mode, clear it to respect explicit auth
    if (status === 'unauthenticated' && (backendToken || isDemoMode)) {
      console.log('Clearing authentication state to respect explicit authentication');
      setBackendToken(null);
      setIsDemoMode(false);
    }
  }, [status, backendToken, isDemoMode]);

  return {
    session,
    status: status === 'loading' || isAuthenticating ? 'loading' : status,
    backendToken,
    isAuthenticated: !!backendToken,
    authError,
    isDemoMode,
    signIn,
    getAuthenticatedApi,
    exchangeToken
  };
}

export default useAuth;
