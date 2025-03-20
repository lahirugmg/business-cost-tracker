# Financial Tracker Application

A web application for tracking income and expenses, built with FastAPI and Next.js.

## Production Deployment Guide

### Backend Deployment (PostgreSQL Setup)

#### 1. Prerequisites
- PostgreSQL installed on your server
- Python 3.8+
- pip
- virtualenv

#### 2. PostgreSQL Setup

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE financial_tracker;
CREATE USER financial_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE financial_tracker TO financial_user;
\q
```

#### 3. Environment Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://financial_user:your_secure_password@localhost:5432/financial_tracker"
```

## Authentication Mechanism

The Business Cost Tracker implements a secure authentication flow between the frontend and backend API that ensures explicit user authentication is always required. Here's how it works:

### Frontend Authentication (NextAuth.js)

1. **Sign-In Process**:
   - The application uses NextAuth.js with Google OAuth provider.
   - When a user clicks "Sign In with Google", they're redirected to Google's authentication page.
   - The `prompt: 'select_account'` parameter is explicitly set to force account selection, preventing automatic sign-in from remembered accounts.

2. **Token Exchange**:
   - After successful Google authentication, Google returns an ID token.
   - The frontend exchanges this Google token for a custom JWT token from the backend.
   - This is done in the `exchangeToken` function in `utils/api.js`.

3. **Token Storage & Use**:
   - Once authenticated, the backend token is stored in memory (not persisted).
   - This token is added to all subsequent API requests via the Axios interceptor.
   - Importantly, there's no persistent storage of tokens to avoid automatic sign-in.

### Backend Authentication (FastAPI)

1. **Google Token Verification**:
   - The backend receives the Google ID token at `/auth/google` endpoint.
   - It verifies this token using Google's libraries in the `verify_google_token` function.
   - This ensures the token is valid, unexpired, and issued by Google.

2. **JWT Token Generation**:
   - After verification, the backend extracts user information (email, name, etc.).
   - It then generates a custom JWT token using the application's secret key.
   - This token is sent back to the frontend.

3. **Request Authorization**:
   - For protected routes, the backend extracts and validates the JWT token.
   - The `get_current_user` function checks this token against the secret key.
   - If valid, the request proceeds; if invalid or missing, a 401 error is returned.

### Troubleshooting Authentication Issues

1. **Check Google OAuth Credentials**:
   - Ensure the correct Google client ID and secret are configured in the backend `.env` file.
   - Make sure the Google Cloud Console project has the correct redirect URIs configured.

2. **Check Backend Logs**:
   - Authentication failures are logged in detail in the backend console.
   - Look for specific error messages about token validation.

3. **Check Frontend Network Requests**:
   - Use browser developer tools to inspect the token exchange request.
   - Check for any error responses from the backend.

4. **Verify Environment Variables**:
   - Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are properly set in backend `.env`.
   - Check that the Next.js frontend has the correct API URL configured.

#### 4. Database Migration

```bash
# Generate initial migration
alembic revision --autogenerate -m "Initial migration"

# Run migrations
alembic upgrade head
```

#### 5. Production Server Setup

```bash
# Install Gunicorn
pip install gunicorn

# Start the application with Gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Using Docker (Optional)

#### 1. Create Dockerfile

```dockerfile
FROM python:3.9

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://financial_user:your_secure_password@db:5432/financial_tracker
    depends_on:
      - db

  db:
    image: postgres:13
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=financial_user
      - POSTGRES_PASSWORD=your_secure_password
      - POSTGRES_DB=financial_tracker

volumes:
  postgres_data:
```

### Security Considerations

1. **Environment Variables**
   - Never commit sensitive information to version control
   - Use environment variables for:
     - Database credentials
     - Secret keys
     - API keys

2. **SSL/TLS**
   - Always use HTTPS in production
   - Set up SSL certificates (Let's Encrypt is free)

3. **Database Backups**
   ```bash
   # Backup
   pg_dump -U financial_user financial_tracker > backup.sql

   # Restore
   psql -U financial_user financial_tracker < backup.sql
   ```

### Monitoring and Maintenance

1. **Logging**
   - Set up logging to file or logging service
   - Monitor application logs regularly

2. **Database Maintenance**
   - Regular backups
   - Database optimization
   - Index maintenance

3. **Performance Monitoring**
   - Set up monitoring tools (e.g., Prometheus, Grafana)
   - Monitor server resources
   - Track API response times

### Scaling Considerations

1. **Database Scaling**
   - Connection pooling
   - Read replicas for heavy read operations
   - Proper indexing

2. **Application Scaling**
   - Multiple application instances
   - Load balancing
   - Caching strategies

### Troubleshooting

Common issues and solutions:

1. **Database Connection Issues**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql

   # Check logs
   sudo tail -f /var/log/postgresql/postgresql-13-main.log
   ```

2. **Application Errors**
   ```bash
   # Check application logs
   tail -f app.log

   # Check system resources
   htop
   ```

### Maintenance Commands

```bash
# Database backup
pg_dump -U financial_user financial_tracker > backup_$(date +%Y%m%d).sql

# Update dependencies
pip install --upgrade -r requirements.txt

# Run migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## Support

For issues and support:
- Create an issue in the GitHub repository
- Contact the development team 