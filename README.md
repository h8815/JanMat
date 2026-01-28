# JanMat - Secure Biometric E-Voting Booth System (Online Module)

## 🎯 Overview

JanMat is a **production-grade voter verification system** that ensures secure, biometric-based voter authentication before they proceed to physical EVMs. This system **DOES NOT CAST VOTES** - it only verifies voter identity and prevents duplicate voting through biometric matching.

### Key Features

- **Tenant Isolation**: Each Election Commission Admin has completely isolated data
- **Biometric Fraud Detection**: Prevents duplicate voting through biometric template matching
- **Aadhaar + OTP Verification**: Real integration with Sandbox.co.in API
- **Comprehensive Audit Trail**: Every action is logged with admin scoping
- **Docker Deployment**: Production-ready containerized deployment
- **Environment-Only Configuration**: Switch between local/staging/production with just .env changes

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin UI      │    │  Operator UI    │    │   Django Admin  │
│ (Election Comm) │    │ (Booth Staff)   │    │   (Superuser)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Django Backend │
                    │   (REST APIs)   │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │ (Tenant Isolated)│
                    └─────────────────┘
```

## 🔐 Security Model

### Tenant Isolation (CRITICAL)
- Every Admin is a **tenant**
- All data is scoped by `admin_id`
- No Admin can see another Admin's data
- Biometric matching is **admin-scoped only**

### Biometric Security
- **NO raw biometric data stored**
- Only secure hashes using HMAC-SHA256
- Duplicate detection within admin scope
- Pluggable for real biometric SDKs

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin/Operator)
- Session management with expiry
- CSRF protection enabled

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Valid Sandbox.co.in API credentials (for Aadhaar verification)

### 1. Clone and Setup
```bash
cd janmat/
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start the System
```bash
docker compose up -d
```

### 3. Create Superuser Admin
```bash
docker exec -it janmat_backend python manage.py createsuperuser
```

### 4. Access the System
- **Frontend**: http://localhost
- **Django Admin**: http://localhost/admin
- **API**: http://localhost/api

## 📋 User Roles & Workflow

### 1. Superuser (System Administrator)
- Created via `python manage.py createsuperuser`
- Can create Election Commission Admins
- Has system-wide access

### 2. Admin (Election Commission)
- Created by Superuser via Django Admin
- Each Admin is a **tenant** with isolated data
- Can create and manage Operators
- Can view fraud logs and statistics
- **Cannot perform voter verification**

### 3. Operator (Booth Staff)
- Created by Admin via Django Admin or API
- Can only verify voters
- Cannot see admin data or other operators' data
- Must change password on first login

## 🔄 Verification Flow

### Step 1: Operator Login
```
POST /api/auth/operator/login/
{
  "email": "operator@booth1.com",
  "password": "secure_password"
}
```

### Step 2: Aadhaar + OTP Verification
```
POST /api/verification/send-otp/
{
  "aadhaar_number": "123456789012"
}

POST /api/verification/verify-otp/
{
  "aadhaar_number": "123456789012",
  "otp_code": "123456"
}
```

### Step 3: Biometric Verification
```
POST /api/verification/biometric-scan/
{
  "biometric_data": "base64_encoded_fingerprint",
  "quality_score": 85
}
```

### Outcomes:
- **Unique Biometric**: Voter verified → Proceed to EVM
- **Duplicate Biometric**: FRAUD detected → Block and log

## 🗄 Database Schema

### Core Tables (All with `admin_id` for tenant isolation)
- `users` - Admin and Operator accounts
- `operators` - Booth operator profiles
- `voters` - Voter records from Aadhaar verification
- `biometric_templates` - Secure biometric hashes
- `otp_codes` - OTP verification records
- `fraud_logs` - Fraud detection logs
- `audit_logs` - Complete audit trail

### Key Indexes
- `admin_id + biometric_hash` (Critical for duplicate detection)
- `admin_id + aadhaar_number` (Voter lookup)
- `admin_id + fraud_type + flagged_at` (Fraud analysis)

## 🐳 Docker Deployment

### Development
```bash
# Start in development mode
BUILD_TARGET=development docker compose up -d

# View logs
docker compose logs -f backend
```

### Production
```bash
# Start in production mode
BUILD_TARGET=production docker compose up -d

# Health checks
curl http://localhost/api/health/
```

### Database Operations
```bash
# Run migrations
docker exec -it janmat_backend python manage.py migrate

# Create superuser
docker exec -it janmat_backend python manage.py createsuperuser

# Backup database
docker exec janmat_postgres pg_dump -U janmat_user janmat_db > backup.sql
```

## ⚙️ Environment Configuration

### Critical Environment Variables
```bash
# Database
DB_NAME=janmat_db
DB_USER=janmat_user
DB_PASSWORD=your_secure_password
DB_HOST=janmat_postgres

# Django
SECRET_KEY=your_secret_key
DEBUG=False
ALLOWED_HOSTS=your_domain.com,localhost

# Aadhaar API (Sandbox.co.in)
SANDBOX_AUTHORIZATION=your_jwt_token
SANDBOX_API_KEY=your_api_key

# Biometric Security
BIOMETRIC_SALT=your_biometric_salt
BIOMETRIC_HASH_ALGORITHM=SHA256

# Security
OTP_EXPIRY_MINUTES=5
MAX_OTP_ATTEMPTS=3
SESSION_TIMEOUT_MINUTES=30
```

## 🔍 API Endpoints

### Authentication
- `POST /api/auth/admin/login/` - Admin login
- `POST /api/auth/operator/login/` - Operator login
- `GET /api/auth/current-user/` - Get current user info

### Admin Only
- `POST /api/auth/admin/create-operator/` - Create operator
- `GET /api/auth/admin/operators/` - List operators
- `GET /api/auth/admin/stats/` - Dashboard statistics
- `GET /api/auth/admin/fraud-logs/` - Fraud logs

### Operator Only
- `POST /api/verification/send-otp/` - Send OTP
- `POST /api/verification/verify-otp/` - Verify OTP
- `POST /api/verification/biometric-scan/` - Biometric verification
- `GET /api/verification/current-session/` - Session info

## 🚨 Fraud Detection

### Automatic Detection
- **Duplicate Biometric**: Same fingerprint used twice
- **Multiple OTP Attempts**: Excessive OTP requests
- **Already Voted**: Voter marked as voted attempts verification
- **Invalid Session**: Session tampering attempts

### Fraud Response
1. **Log**: All fraud attempts logged with details
2. **Block**: Prevent further verification
3. **Alert**: Admin dashboard shows fraud alerts
4. **Audit**: Complete audit trail maintained

## 📊 Monitoring & Logging

### Health Checks
- `GET /api/health/` - Backend health
- Docker health checks configured
- Database connection monitoring

### Logging Levels
- **INFO**: Normal operations
- **WARNING**: Fraud attempts, failed logins
- **ERROR**: System errors, API failures
- **CRITICAL**: Security breaches

### Audit Trail
Every action is logged with:
- User ID and type (admin/operator)
- Admin ID (tenant isolation)
- Timestamp and IP address
- Action details and outcomes

## 🔧 Development

### Local Development Setup
```bash
# Backend
cd backend/
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend (if developing)
cd frontend/
# Serve static files via nginx or simple HTTP server
```

### Testing
```bash
# Run tests
docker exec -it janmat_backend python manage.py test

# Check migrations
docker exec -it janmat_backend python manage.py makemigrations --check
```

## 🛡 Security Considerations

### Production Checklist
- [ ] Change all default passwords
- [ ] Use strong SECRET_KEY
- [ ] Set DEBUG=False
- [ ] Configure HTTPS
- [ ] Set up proper firewall rules
- [ ] Regular database backups
- [ ] Monitor fraud logs daily
- [ ] Update dependencies regularly

### Biometric Security Note
**IMPORTANT**: Current implementation uses simulated biometric template hashing for demo purposes. For production deployment, integrate with:
- SourceAFIS (open source)
- NBIS (NIST Biometric Image Software)
- Commercial biometric SDKs

## 📞 Support

### Common Issues
1. **Database Connection**: Check PostgreSQL container health
2. **OTP Not Sending**: Verify Sandbox.co.in API credentials
3. **Biometric Errors**: Check biometric data format
4. **Permission Denied**: Verify user roles and admin assignment

### Logs Location
- Backend: `/app/logs/janmat.log`
- Access: `/app/logs/access.log`
- Error: `/app/logs/error.log`

## 📄 License

This system is designed for election security and should be deployed only by authorized election authorities with proper security audits.

---

**⚠️ CRITICAL REMINDER**: This system verifies voters but **DOES NOT CAST VOTES**. Voters must proceed to physical EVMs after verification.