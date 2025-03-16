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