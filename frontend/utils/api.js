import axios from 'axios';
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Enable demo mode if needed
let DEMO_MODE = false;

// Create an axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 8000 // Add timeout to prevent hanging requests
});

// Store the backend token
let backendToken = null;

// Exchange Google token for a backend token
export const exchangeToken = async (googleToken) => {

  try {
    console.log('[FRONTEND][API] STEP 1: Token exchange started - API utility');
    
    // Validate the token
    if (!googleToken) {
      console.error('[FRONTEND][API] ERROR: Missing Google token for exchange');
      // Don't automatically enable demo mode to respect explicit authentication
      throw new Error('No authentication token available');
    }
    
    // Identify token type
    console.log('[FRONTEND][API] STEP 2: Token type identification');
    console.log('[FRONTEND][API] First 5 chars:', googleToken.substring(0, 5));
    if (googleToken.startsWith('ya29.')) {
      console.log('[FRONTEND][API] DETECTED: Google Access Token (starts with ya29.)');
      console.log('[FRONTEND][API] INFO: Backend now supports both access tokens and ID tokens');
    } else if (googleToken.startsWith('eyJ')) {
      console.log('[FRONTEND][API] DETECTED: JWT/ID token (starts with eyJ)');
      console.log('[FRONTEND][API] INFO: This should work with the backend as expected');
    } else {
      console.log('[FRONTEND][API] UNKNOWN TOKEN TYPE, proceeding anyway');
    }

    // Log the token length and first/last few characters for debugging
    console.log(`[FRONTEND][API] STEP 3: Preparing to send token to backend`);
    console.log(`[FRONTEND][API] Token length: ${googleToken.length}`);
    console.log(`[FRONTEND][API] Token preview: ${googleToken.substring(0, 10)}...${googleToken.substring(googleToken.length - 10)}`);
    console.log(`[FRONTEND][API] Target endpoint: ${API_URL}/auth/google`);
    
    // The backend expects a TokenData object with a token field
    const tokenData = {
      token: googleToken
    };
    
    // Check if backend is available first with a health check
    let backendAvailable = false;
    let isDemoMode = false;
    try {
      console.log('[FRONTEND][API] STEP 4: Checking backend availability via health endpoint');
      console.time('[FRONTEND][API] Backend health check duration');
      const healthResponse = await axios.get(`${API_URL}/health`, { 
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      console.timeEnd('[FRONTEND][API] Backend health check duration');
      
      console.log('[FRONTEND][API] Health check response:', healthResponse.status);
      console.log('[FRONTEND][API] Health check data:', healthResponse.data);
      
      // Check for valid response
      if (healthResponse.status === 200 && healthResponse.data) {
        console.log('[FRONTEND][API] STEP 4 SUCCESS: Backend is available');
        backendAvailable = true;
        // Check if backend is in demo mode
        if (healthResponse.data.demo_mode) {
          console.log('[FRONTEND][API] DETECTED: Backend is in demo mode');
          isDemoMode = true;
          DEMO_MODE = true;
        } else {
          console.log('[FRONTEND][API] DETECTED: Backend is in normal authentication mode');
        }
      } else {
        console.warn('[FRONTEND][API] STEP 4 FAILED: Backend returned non-200 status:', healthResponse.status);
        console.log('[FRONTEND][API] This indicates the backend is not healthy or accessible');
        // Fall back to demo mode
        isDemoMode = true;
        DEMO_MODE = true;
      }
    } catch (healthError) {
      console.warn('[FRONTEND][API] STEP 4 ERROR: Backend health check failed:');
      console.log('[FRONTEND][API] Error details:', healthError.message);
      console.log('[FRONTEND][API] This indicates a network issue or the backend is not running');
      // For network errors, we could fall back to demo mode, but to respect explicit authentication,
      // we'll throw an error instead and let the user decide
      throw new Error('Backend service unavailable');
    }
    
    // If demo mode is active (either from backend or due to connectivity issues)
    // or if user has explicitly requested it, use demo mode
    if (isDemoMode || !backendAvailable || window.location.search.includes('demo=true')) {
      console.log('[FRONTEND][API] SPECIAL CASE: Enabling demo mode');
      console.log('[FRONTEND][API] Reason:', isDemoMode ? 'Backend in demo mode' : 
        (!backendAvailable ? 'Backend unavailable' : 'User requested demo mode'));
      return enableDemoMode();
    }
    
    // Send the token to the backend for verification and exchange with improved error handling
    console.log('[FRONTEND][API] STEP 5: Sending token to backend for authentication');
    console.log(`[FRONTEND][API] Request URL: ${API_URL}/auth/google`);
    console.log('[FRONTEND][API] Request payload size:', JSON.stringify(tokenData).length, 'bytes');
    console.log('[FRONTEND][API] --- SENDING REQUEST TO BACKEND ---');
    const response = await axios.post(`${API_URL}/auth/google`, tokenData, {
      timeout: 8000, // Increased timeout for auth requests
      headers: {
        'Content-Type': 'application/json',
      },
      // Custom validation function to handle different status codes
      validateStatus: function(status) {
        return status >= 200 && status < 500; // Accept 2xx and 4xx responses
      }
    });
    
    // Handle 4xx errors explicitly
    if (response.status >= 400 && response.status < 500) {
      console.error(`[FRONTEND][API] STEP 5 FAILED: Authentication rejected by backend (${response.status})`);
      console.log('[FRONTEND][API] Check backend logs for detailed error information');
      console.log('[FRONTEND][API] Response data:', response.data);
      throw new Error(`Authentication failed with status ${response.status}`);
    }
    
    // Check if we received a valid response with an access token
    if (response.data && response.data.access_token) {
      // Store the backend token for future use
      backendToken = response.data.access_token;
      console.log('[FRONTEND][API] STEP 5 SUCCESS: Token exchange completed');
      console.log(`[FRONTEND][API] Response status: ${response.status}`);
      console.log('[FRONTEND][API] Response headers:', response.headers);
      console.log('[FRONTEND][API] Backend token length:', response.data.access_token.length);
      console.log(`[FRONTEND][API] Backend token preview: ${response.data.access_token.substring(0, 15)}...`);
      console.log('[FRONTEND][API] --- AUTH FLOW COMPLETED SUCCESSFULLY ---');
      
      // Check if we're in demo mode according to the backend
      if (response.data.demo_mode) {
        console.log('[AUTH] Backend is in demo mode');
        DEMO_MODE = true;
      }
      
      return backendToken;
    }
    
    console.error('Token exchange response missing access_token:', response.data);
    throw new Error('Invalid response from authentication service');
  } catch (error) {
    // Log detailed information about the error
    console.error('[FRONTEND][API] CRITICAL ERROR during token exchange:', error.message);
    console.log('[FRONTEND][API] --- AUTH FLOW FAILED WITH ERROR ---');
    
    if (error.response) {
      // The request was made and the server responded with a non-2xx status code
      console.error('[FRONTEND][API] Error details: Server responded with error');
      console.error('[FRONTEND][API] Status code:', error.response.status);
      console.error('[FRONTEND][API] Response data:', error.response.data);
      throw new Error(`Authentication failed: ${error.response.data?.detail || 'Server rejected request'}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('[FRONTEND][API] Error details: No response received from server');
      console.error('[FRONTEND][API] This typically indicates network issues or backend down');
      throw new Error('Network error: Cannot connect to authentication service');
    } else {
      // Something happened in setting up the request
      console.error('[FRONTEND][API] Error details: Request setup failed');
      console.error('[FRONTEND][API] This indicates a client-side issue before request was sent');
      throw error; // Re-throw the error with its original message
    }
  }
};

// Track authentication in progress to prevent multiple simultaneous auth attempts
let authenticationInProgress = false;
let lastHealthCheckTime = 0;
let lastHealthCheckResult = null;
const HEALTH_CHECK_THROTTLE_MS = 5000; // Only check health every 5 seconds

// Add a request interceptor to add the auth token
api.interceptors.request.use(async (config) => {
  // Skip token exchange for auth endpoints to avoid infinite loop
  if (config.url.includes('/auth/') || config.url.includes('/health')) {
    return config;
  }
  
  // No demo mode - we only use real authentication
  
  // If we already have a backend token, use it
  if (backendToken) {
    console.log('[FRONTEND][API] Using existing backend token for request');
    config.headers.Authorization = `Bearer ${backendToken}`;
    return config;
  }
  
  // Prevent multiple simultaneous token exchanges
  if (authenticationInProgress) {
    console.log('[FRONTEND][API] Authentication already in progress, waiting...');
    // Wait for up to 3 seconds for the existing auth to complete
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (backendToken) {
        console.log('[FRONTEND][API] Token became available while waiting');
        config.headers.Authorization = `Bearer ${backendToken}`;
        return config;
      }
    }
    console.log('[FRONTEND][API] Timed out waiting for authentication, proceeding without token');
    return config;
  }
  
  // Mark authentication as in progress
  authenticationInProgress = true;
  
  try {
    // Throttle health checks
    const now = Date.now();
    let backendAvailable = false;
    
    if (now - lastHealthCheckTime > HEALTH_CHECK_THROTTLE_MS) {
      console.log('[FRONTEND][API] Performing throttled health check');
      try {
        const healthResponse = await axios.get(`${API_URL}/health`, { 
          timeout: 3000,
          validateStatus: () => true
        });
        backendAvailable = healthResponse.status === 200;
        lastHealthCheckResult = backendAvailable;
        lastHealthCheckTime = now;
        console.log(`[FRONTEND][API] Health check result: ${backendAvailable ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        console.warn('[FRONTEND][API] Health check failed with error:', error.message);
        lastHealthCheckResult = false;
        lastHealthCheckTime = now;
      }
    } else {
      console.log('[FRONTEND][API] Using cached health check result:', lastHealthCheckResult);
      backendAvailable = lastHealthCheckResult;
    }
    
    if (!backendAvailable) {
      // Skip authentication if backend is down
      console.log('[FRONTEND][API] Backend unavailable, skipping authentication');
      authenticationInProgress = false;
      return config;
    }
    
    const session = await getSession();
    
    if (session?.accessToken) {
      console.log('[FRONTEND][API] Got session with accessToken, exchanging for backend token');
      
      // Try ID token first if available
      const idToken = session.idToken || session.id_token;
      let token;
      
      if (idToken) {
        console.log('[FRONTEND][API] Using ID token for authentication');
        token = await exchangeToken(idToken);
      } else {
        console.log('[FRONTEND][API] Using access token for authentication');
        token = await exchangeToken(session.accessToken);
      }
      
      if (token) {
        console.log('[FRONTEND][API] Token exchange successful');
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn('[FRONTEND][API] Token exchange returned null, request will proceed without auth');
      }
    } else {
      console.log('[FRONTEND][API] No session token available');
    }
    // No fallbacks to demo mode to maintain explicit authentication
  } catch (error) {
    console.error('[FRONTEND][API] Auth error in interceptor:', error.message);
    // Don't show auth errors for every request - this would lead to multiple popups
    // The UI component should handle auth state through the useAuth hook
  } finally {
    // Always reset the flag to allow future authentication attempts
    authenticationInProgress = false;
  }
  
  return config;
});

// Helper function to enable demo mode
const enableDemoMode = () => {
  console.log('Enabling demo mode for authentication');
  DEMO_MODE = true;
  // Create a mock token for demo mode if we don't already have one
  if (!backendToken) {
    backendToken = 'demo_token_' + Math.random().toString(36).substring(2);
  }
  return backendToken;
};

export default api;