from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2AuthorizationCodeBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
import time
import os
import requests as http_requests
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SECRET_KEY, DEMO_MODE

# Import Google OAuth libraries for authentication
from google.oauth2 import id_token
from google.auth.transport import requests

# Authentication constants
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl="https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl="https://oauth2.googleapis.com/token",
)

def verify_google_token(token: str):
    # Proper authentication using Google OAuth
    try:
        # Detailed debug logging with [BACKEND] prefix
        print(f"[BACKEND][AUTH] STEP 1: Authentication request received")
        print(f"[BACKEND][AUTH] Server environment: {os.getenv('ENVIRONMENT', 'unknown')}")
        print(f"[BACKEND][AUTH] Configuration: GOOGLE_CLIENT_ID={GOOGLE_CLIENT_ID[:10]}...")
        print(f"[BACKEND][AUTH] Has GOOGLE_CLIENT_SECRET: {'Yes' if GOOGLE_CLIENT_SECRET else 'No'}")
        
        # Check if token is valid
        if not token:
            print("[BACKEND][AUTH] ERROR: No token provided in request")
            print("[BACKEND][AUTH] This indicates a client error - missing token in request")
            raise ValueError('No token provided')
        
        print(f"[BACKEND][AUTH] STEP 2: Token validation - Length check")
        print(f"[BACKEND][AUTH] Token length: {len(token)}")
        print(f"[BACKEND][AUTH] Token preview: {token[:10]}...{token[-10:]}")
        
        if len(token) < 10:
            print("[BACKEND][AUTH] ERROR: Token too short (< 10 chars)")
            print("[BACKEND][AUTH] This indicates an invalid token format")
            raise ValueError('Invalid token format - token too short')
        
        # Check token type - handle both ID tokens and access tokens
        is_access_token = token.startswith('ya29.')
        print(f"[BACKEND][AUTH] STEP 3: Token type identification")
        print(f"[BACKEND][AUTH] Token appears to be an access token: {is_access_token}")
        print(f"[BACKEND][AUTH] Token starts with: {token[:5]}")
        
        idinfo = None
        
        if is_access_token:
            # For access tokens, we need to use Google's tokeninfo endpoint
            print(f"[BACKEND][AUTH] STEP 4A: Verifying Access Token via Google tokeninfo endpoint")
            print(f"[BACKEND][AUTH] Using endpoint: https://oauth2.googleapis.com/tokeninfo")
            try:
                # Call Google's tokeninfo endpoint
                print(f"[BACKEND][AUTH] Sending request to Google tokeninfo API...")
                response = http_requests.get(f"https://oauth2.googleapis.com/tokeninfo?access_token={token}")
                if response.status_code == 200:
                    print(f"[BACKEND][AUTH] SUCCESS: Access token verified by Google")
                    idinfo = response.json()
                    print(f"[BACKEND][AUTH] User info received: email={idinfo.get('email', 'unknown')}")
                    print(f"[BACKEND][AUTH] Token audience: {idinfo.get('aud', 'unknown')}")
                    print(f"[BACKEND][AUTH] Token expiration: {idinfo.get('exp', 'unknown')}")
                else:
                    print(f"[BACKEND][AUTH] FAILED: Token verification failed with status: {response.status_code}")
                    print(f"[BACKEND][AUTH] Error details: {response.text}")
                    raise ValueError(f"Invalid access token: {response.text}")
            except Exception as ve:
                print(f"[BACKEND][AUTH] CRITICAL ERROR during token verification: {str(ve)}")
                print(f"[BACKEND][AUTH] Exception type: {type(ve).__name__}")
                raise ve
        else:
            # For ID tokens, use the traditional verification
            print(f"[BACKEND][AUTH] STEP 4B: Verifying ID Token via Google library")
            print(f"[BACKEND][AUTH] Using google.oauth2.id_token.verify_oauth2_token")
            try:
                print(f"[BACKEND][AUTH] Calling Google's verify_oauth2_token method...")
                idinfo = id_token.verify_oauth2_token(
                    token, requests.Request(), GOOGLE_CLIENT_ID)
                print(f"[BACKEND][AUTH] SUCCESS: ID token verified successfully")
                print(f"[BACKEND][AUTH] Token details: issuer={idinfo.get('iss', 'unknown')}")
                print(f"[BACKEND][AUTH] Token audience: {idinfo.get('aud', 'unknown')}")
                print(f"[BACKEND][AUTH] Token subject: {idinfo.get('sub', 'unknown')}")
            except Exception as ve:
                print(f"[BACKEND][AUTH] FAILED: ID token verification error: {str(ve)}")
                print(f"[BACKEND][AUTH] Exception type: {type(ve).__name__}")
                raise ve
            
            # Validate the issuer for ID tokens
            print(f"[BACKEND][AUTH] STEP 5: Validating token issuer")
            if idinfo.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
                print(f"[BACKEND][AUTH] ERROR: Invalid token issuer: {idinfo.get('iss')}")
                print(f"[BACKEND][AUTH] Expected issuers: accounts.google.com or https://accounts.google.com")
                raise ValueError(f"Invalid issuer: {idinfo.get('iss')}")
            else:
                print(f"[BACKEND][AUTH] Issuer validation passed: {idinfo.get('iss')}")
        
        # Log successful authentication    
        print(f"[BACKEND][AUTH] STEP 6: Authentication completed successfully")
        print(f"[BACKEND][AUTH] Authenticated user: {idinfo.get('email', 'unknown')}")
        print(f"[BACKEND][AUTH] User ID: {idinfo.get('sub', 'unknown')}")
        print(f"[BACKEND][AUTH] Token expiration: {idinfo.get('exp', 'unknown')}")
        print(f"[BACKEND][AUTH] --- AUTHENTICATION SUCCESSFUL ---")
        return idinfo
    except Exception as e:
        print(f"[BACKEND][AUTH] CRITICAL ERROR: Authentication failed: {str(e)}")
        print(f"[BACKEND][AUTH] Error type: {type(e).__name__}")
        import traceback
        print(f"[BACKEND][AUTH] Stack trace: {traceback.format_exc()}")
        print(f"[BACKEND][AUTH] --- AUTHENTICATION FAILED ---")
        
        # No more fallbacks to demo mode - properly raise authentication errors
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # In demo mode, always return the demo user
    if DEMO_MODE:
        return "demo@example.com"
    
    # Real token validation if not in demo mode
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return email
    except JWTError:
        raise credentials_exception 