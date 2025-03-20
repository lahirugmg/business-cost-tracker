import os
from typing import Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Check for .env in backend directory first (most likely location)
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    print(f"Loading environment from {env_path}")
    load_dotenv(dotenv_path=env_path)
else:
    # Fallback to project root
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        print(f"Loading environment from {env_path}")
        load_dotenv(dotenv_path=env_path)

# Base configuration that applies to all environments
base_config: Dict[str, Any] = {
    "PROJECT_NAME": "Business Cost Tracker",
    "API_PREFIX": "",
    "SECRET_KEY": os.getenv("SECRET_KEY"),  # Must be set in .env file
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 30,
    # Default to demo mode when no credentials are available
    "DEMO_MODE": True
}

# Development environment configuration
development_config = {
    **base_config,
    "GOOGLE_CLIENT_ID": os.getenv("GOOGLE_CLIENT_ID", ""),
    "GOOGLE_CLIENT_SECRET": os.getenv("GOOGLE_CLIENT_SECRET", ""),
    "DEMO_MODE": False  # Disable demo mode to use real Google authentication
}

# Testing environment configuration
testing_config = {
    **base_config,
    "TESTING": True,
    "DEMO_MODE": True  # Always use demo mode in testing
}

# Production environment configuration
production_config = {
    **base_config,
    "GOOGLE_CLIENT_ID": os.getenv("GOOGLE_CLIENT_ID"),
    "GOOGLE_CLIENT_SECRET": os.getenv("GOOGLE_CLIENT_SECRET"),
    "SECRET_KEY": os.getenv("SECRET_KEY"),  # Must be set in production
    "DEMO_MODE": False  # Demo mode should be disabled in production
}

# Dictionary mapping environment names to their respective configurations
environments = {
    "development": development_config,
    "testing": testing_config,
    "production": production_config
}

# Get the current environment or default to development
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Load the configuration for the current environment
config = environments.get(ENVIRONMENT, development_config)

# Helper function to get a configuration value
def get_config(key: str, default=None) -> Any:
    """Get a configuration value for the current environment."""
    return config.get(key, default)

# Commonly used config values
GOOGLE_CLIENT_ID = get_config("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = get_config("GOOGLE_CLIENT_SECRET")
SECRET_KEY = get_config("SECRET_KEY")
DEMO_MODE = get_config("DEMO_MODE")
