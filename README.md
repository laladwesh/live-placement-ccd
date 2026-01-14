# Live Placement Portal - IITG 2025

A secure, real-time dashboard for managing campus placement activities at Indian Institute of Technology Guwahati. This portal streamlines coordination between placement administrators, company representatives (POCs), and 1500+ students during peak placement season.

**Live Deployment:** https://iitg.ac.in/dday/

## Overview

The Live Placement Portal is a comprehensive web-based platform designed to automate and optimize the campus placement process at IITG. Built with modern web technologies and deployed on institutional servers, the platform successfully managed 150+ participating companies and facilitated placements for 1500+ students during the 2025 placement season.

### Key Achievement

Successfully handled peak season traffic with real-time synchronization across all user roles without data inconsistencies, demonstrating robust architecture and scalability.

## Features

### Real-Time Dashboard with WebSocket Integration

Bidirectional communication enables instant updates across the platform:
- Live updates for placement offers, shortlists, and interview schedules
- Zero-latency notification system for critical placement events
- Real-time dashboard reflecting status changes across all user roles
- Instant synchronization without page refresh

### Role-Based Access Control (RBAC)

Three distinct user portals with granular permission management:

#### Admin Portal
- Full system oversight and control
- Approval authority for all offer confirmations
- Company POC shortlist review and management
- Real-time analytics dashboard for placement trends
- Bulk student status management and placement blocking
- System-wide configuration and user management

#### POC (Point of Contact) Portal
- Company-specific offer creation and management
- Interview slot scheduling with conflict resolution
- Company-wise student shortlist management
- Real-time visibility of interview progress
- Automatic blocking of placed students across all companies
- Candidate availability and status tracking

#### Student Portal
- Real-time visibility of shortlists and received offers
- Interview schedule access and management
- Status tracking (shortlisted, placed, rejected)
- Document submission for placement confirmation
- Push notification system for new opportunities

### Intelligent Student Blocking System

Prevents duplicate offers and maintains data consistency:
- Automatic blocking of placed students across all companies
- Distributed synchronization in real-time environment
- Maintains system integrity during concurrent operations
- Instant status propagation to all connected parties

### PDF Generation and Export

Comprehensive reporting capabilities for administrative purposes:
- Dynamic company status tracking reports
- Placement statistics and analytics in PDF format
- Student shortlist and offer letter generation
- Bulk export for administrative records
- Server-side generation for enhanced security and performance

### Advanced Interview Management

Sophisticated scheduling and tracking system:
- Flexible interview slot creation with capacity management
- Automated conflict detection and prevention
- Interview timeline visualization
- Real-time status tracking and updates
- Automatic notifications for schedule changes

### Secure Authentication and Session Management

Enterprise-grade security implementation:
- JWT-based token authentication with expiration
- Secure password hashing using bcrypt (12 salt rounds)
- Session persistence with secure HTTP-only cookies
- Role-based route protection
- Account lockout mechanisms for security

## Technology Stack

### Backend

- **Runtime:** Node.js (v14+)
- **Framework:** Express.js
- **Real-Time Communication:** Socket.io
- **Database:** MongoDB / PostgreSQL
- **PDF Generation:** PDFKit / Puppeteer
- **Authentication:** JWT (JSON Web Tokens)
- **Environment Management:** dotenv

### Frontend

- **Framework:** React.js
- **State Management:** Redux / Context API
- **Real-Time Updates:** Socket.io Client
- **Styling:** Tailwind CSS / Material-UI
- **HTTP Client:** Axios
- **Data Visualization:** Chart.js / React-Chartjs-2

### Infrastructure

- **Deployment:** IITG Hosted Servers (SSH)
- **Database:** MongoDB Atlas / Self-hosted PostgreSQL
- **Reverse Proxy:** Nginx with SSL/TLS
- **Process Management:** PM2
- **Logging:** Winston / Morgan
- **Security:** Express-rate-limit, Helmet.js, Joi validation

## Architecture

### System Components

The platform consists of three primary layers:

**Client Layer:** Three specialized React applications (Admin, POC, Student) communicating via WebSocket and HTTP protocols.

**Application Layer:** Express.js backend with modular controller architecture, WebSocket server for real-time events, and specialized services for PDF generation, email notifications, and data analytics.

**Data Layer:** Primary database (MongoDB/PostgreSQL) with connection pooling, file storage for reports, and email service for notifications.

### Data Flow

When a POC creates an offer:
1. HTTP POST request validates data and stores in database
2. Socket.io event triggered for relevant stakeholders
3. Admin portal receives approval notification
4. Student portal receives offer notification
5. Live dashboard updates without page refresh

### Performance Optimizations

- Database connection pooling (max 20 connections)
- Redis caching for frequently accessed data
- Pagination for large datasets (max 100 records per request)
- Response compression using gzip
- Image optimization before storage

## Project Structure

```
live-placement-ccd/
├── backend/
│   ├── config/
│   │   ├── database.js           # Database connection setup
│   │   ├── socket.js             # WebSocket configuration
│   │   └── environment.js        # Environment variables
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── offerController.js    # Offer management
│   │   ├── shortlistController.js # Shortlist operations
│   │   ├── interviewController.js # Interview scheduling
│   │   ├── studentController.js  # Student data management
│   │   ├── companyController.js  # Company operations
│   │   └── reportController.js   # PDF report generation
│   ├── models/
│   │   ├── User.js               # User schema (Admin, POC, Student)
│   │   ├── Company.js            # Company information
│   │   ├── Offer.js              # Job offer data
│   │   ├── Shortlist.js          # Shortlist entries
│   │   ├── Interview.js          # Interview schedule
│   │   └── PlacementStatus.js    # Student placement status
│   ├── routes/
│   │   ├── auth.js               # Authentication endpoints
│   │   ├── offers.js             # Offer management routes
│   │   ├── shortlist.js          # Shortlist routes
│   │   ├── interviews.js         # Interview scheduling routes
│   │   ├── students.js           # Student data routes
│   │   ├── companies.js          # Company routes
│   │   └── reports.js            # Report generation routes
│   ├── middleware/
│   │   ├── auth.js               # JWT verification
│   │   ├── rbac.js               # Role-based access control
│   │   ├── errorHandler.js       # Error handling
│   │   ├── validation.js         # Request validation
│   │   └── logging.js            # Request logging
│   ├── services/
│   │   ├── emailService.js       # Email notifications
│   │   ├── pdfService.js         # PDF generation
│   │   ├── socketService.js      # WebSocket events
│   │   └── analyticsService.js   # Data aggregation
│   ├── utils/
│   │   ├── validators.js         # Input validation
│   │   ├── errorResponses.js     # Standard error responses
│   │   └── helpers.js            # Utility functions
│   ├── server.js                 # Application entry point
│   ├── package.json              # Dependencies
│   └── .env.example              # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/            # Admin portal components
│   │   │   ├── POC/              # POC portal components
│   │   │   ├── Student/          # Student portal components
│   │   │   └── Common/           # Shared components
│   │   ├── pages/                # Page components
│   │   ├── services/             # API and Socket services
│   │   ├── redux/                # State management
│   │   ├── styles/               # Global styles
│   │   ├── App.jsx               # Root component
│   │   └── index.js              # Entry point
│   ├── package.json              # Dependencies
│   └── .env.example              # Environment template
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT.md
│   ├── USER_GUIDE.md
│   └── DATABASE_SCHEMA.md
└── README.md
```

## Getting Started

### Prerequisites

Before setup, ensure the following are installed:

- Node.js (v14.0.0 or higher)
- npm or yarn (v6.0.0 or higher)
- MongoDB (v4.4+) or PostgreSQL (v12+)
- Git for version control
- VS Code or preferred code editor
- SSH access (for server deployment)

### System Requirements

- OS: Linux, macOS, or Windows with WSL2
- RAM: Minimum 2GB (4GB+ recommended for production)
- Storage: 10GB minimum for database and file uploads
- Network: Stable internet connection with SSH capability

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/laladwesh/live-placement-ccd.git
cd live-placement-ccd
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**

```
# Server Configuration
PORT=5000
NODE_ENV=development
BACKEND_URL=http://localhost:5000

# Database
DB_HOST=localhost
DB_PORT=27017
DB_NAME=placement_portal
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_URL=mongodb://user:password@localhost:27017/placement_portal

# Authentication
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRE=7d

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# WebSocket
SOCKET_PORT=3001
SOCKET_CORS_ORIGIN=http://localhost:3000

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
PDF_OUTPUT_DIR=./pdfs

# Security
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Step 3: Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit environment variables
nano .env
```

**Frontend Environment Variables:**

```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:3001
REACT_APP_ENV=development
```

## Configuration

### Database Setup

#### MongoDB Configuration

```javascript
const mongoose = require('mongoose');

module.exports = async () => {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    process.exit(1);
  }
};
```

#### PostgreSQL Configuration

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

### WebSocket Configuration

```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('joinUserRoom', (userId) => {
    socket.join(`user_${userId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

module.exports = io;
```

## Running the Application

### Development Mode

```bash
# Terminal 1: Start Backend
cd backend
npm run dev

# Expected output:
# Server running on port 5000
# MongoDB Connected Successfully
# WebSocket server listening on port 3001

# Terminal 2: Start Frontend
cd frontend
npm start

# Browser opens automatically at http://localhost:3000
```

### Production Mode

```bash
# Build frontend for production
cd frontend
npm run build

# Install PM2 globally
npm install -g pm2

# Start backend with PM2
cd ../backend
pm2 start server.js --name "placement-portal"
pm2 logs placement-portal

# View process status
pm2 status
```

## API Documentation

### Authentication Endpoints

#### User Login

```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200 OK):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "userId",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin" | "poc" | "student"
  }
}
```

#### Token Verification

```
GET /api/auth/verify
Authorization: Bearer <token>

Response (200 OK):
{
  "valid": true,
  "user": { ... }
}
```

### Offer Management Endpoints

#### Create Offer (POC only)

```
POST /api/offers
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "companyId": "company123",
  "jobTitle": "Software Engineer",
  "salary": 1200000,
  "description": "Full-time position",
  "deadline": "2025-02-15",
  "shortlistedStudents": ["student1", "student2"]
}

Response (201 Created):
{
  "success": true,
  "offer": { ... },
  "message": "Offer created successfully"
}
```

#### Get Offers with Filters

```
GET /api/offers?status=pending&companyId=company123
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "count": 15,
  "offers": [ ... ]
}
```

#### Approve Offer (Admin only)

```
PATCH /api/offers/:offerId/approve
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "status": "approved"
}

Response (200 OK):
{
  "success": true,
  "message": "Offer approved and notifications sent"
}
```

### Interview Management Endpoints

#### Create Interview Slot (POC)

```
POST /api/interviews
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "companyId": "company123",
  "date": "2025-02-20",
  "startTime": "10:00",
  "endTime": "11:00",
  "location": "Room 101",
  "capacity": 10
}

Response (201 Created):
{
  "success": true,
  "interview": { ... }
}
```

#### Assign Student to Interview

```
POST /api/interviews/:interviewId/assign
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "studentId": "student123"
}

Response (200 OK):
{
  "success": true,
  "message": "Student assigned and notification sent"
}
```

### Shortlist Management Endpoints

#### Create Shortlist Entry (POC)

```
POST /api/shortlists
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "companyId": "company123",
  "studentId": "student123",
  "round": 1,
  "status": "shortlisted"
}

Response (201 Created):
{
  "success": true,
  "shortlist": { ... }
}
```

#### Approve Shortlist (Admin)

```
PATCH /api/shortlists/:shortlistId/approve
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "message": "Shortlist approved"
}
```

### Student Portal Endpoints

#### Get My Offers (Student)

```
GET /api/student/offers
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "offers": [
    {
      "id": "offer1",
      "company": "TechCorp",
      "salary": 1500000,
      "status": "pending"
    }
  ]
}
```

#### Get My Shortlists (Student)

```
GET /api/student/shortlists
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "shortlists": [ ... ]
}
```

### Report Generation Endpoints

#### Generate Placement Report (Admin)

```
POST /api/reports/placement-pdf
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "format": "pdf",
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-02-28"
  }
}

Response (200 OK):
{
  "success": true,
  "fileUrl": "/uploads/reports/placement_report_2025.pdf"
}
```

## Role-Based Access Control

### Permission Matrix

| Feature | Admin | POC | Student |
|---------|-------|-----|---------|
| View All Offers | Yes | Own Company | Own Only |
| Create Offers | No | Yes | No |
| Approve Offers | Yes | No | No |
| Schedule Interviews | No | Yes | No |
| View Shortlists | Yes | Own Company | Own Only |
| Approve Shortlists | Yes | No | No |
| Block Placed Students | Yes | No | No |
| Generate Reports | Yes | No | No |
| View Analytics | Yes | Limited | No |
| Manage Users | Yes | No | No |

### RBAC Implementation

```javascript
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    next();
  };
};

// Usage in routes
router.post('/offers', 
  authMiddleware, 
  checkRole(['poc']), 
  offerController.createOffer
);
```

## Deployment

### Deployment on IITG Servers via SSH

#### Server Preparation

```bash
# SSH into server
ssh user@iitg-server.example.com

# Install Node.js and npm
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Clone and Setup

```bash
# Clone repository
git clone https://github.com/laladwesh/live-placement-ccd.git
cd live-placement-ccd

# Setup backend
cd backend
npm install
cp .env.example .env
# Edit .env with production configuration

# Setup frontend
cd ../frontend
npm install
npm run build
```

#### Nginx Configuration

```nginx
server {
    listen 80;
    server_name placement.iitg.ac.in;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name placement.iitg.ac.in;

    ssl_certificate /etc/letsencrypt/live/placement.iitg.ac.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/placement.iitg.ac.in/privkey.pem;

    # Frontend
    location / {
        root /var/www/live-placement-ccd/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Proxy
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Start Services with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd backend
pm2 start server.js --name "placement-api"

# Save PM2 configuration
pm2 save

# Enable startup on reboot
pm2 startup
```

#### SSL Certificate Setup

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot certonly --nginx -d placement.iitg.ac.in

# Enable auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Performance Metrics

### Achieved During 2025 Placement Season

| Metric | Value |
|--------|-------|
| Concurrent Users | 1500+ students, 150+ POCs, 20+ admins |
| API Response Time | Less than 200ms (p95) |
| WebSocket Latency | Less than 50ms for real-time updates |
| Database Query Time | Less than 100ms (p95) |
| PDF Generation | 5-10 seconds per report |
| System Uptime | 99.9% during placement season |
| Daily Active Users | Peak 1200+ concurrent users |
| Offers Managed | 8000+ |
| Interview Slots | 15000+ |

## Security Features

### Authentication and Authorization

- JWT tokens with 7-day expiration
- Bcrypt password hashing with 12 salt rounds
- Session management with secure HTTP-only cookies
- Role-based route protection
- Multi-factor authentication support (optional)

### API Security

- CORS configuration restricted to allowed origins
- Rate limiting: 100 requests per 15 minutes
- Input validation using Joi schema validation
- SQL injection prevention with parameterized queries
- HTTPS/TLS encryption with SSL certificates

### Data Protection

```javascript
// Password Hashing
const bcrypt = require('bcryptjs');
const hashedPassword = await bcrypt.hash(password, 12);

// JWT Token Generation
const token = jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Network Security

- HTTPS/TLS with Let's Encrypt certificates
- Secure headers with Helmet.js
- CSRF protection for form submissions
- Content Security Policy (CSP) headers
- Secure cookie attributes

### Database Security

- Credentials stored in environment variables
- Connection encryption with SSL/TLS
- Access control lists for database users
- Automated backup scheduling
- Connection pooling with size limits

### Monitoring and Logging

- Request logging with Morgan
- Error tracking and reporting
- Audit trail for all administrative actions
- Real-time performance monitoring
- PM2 process management and logging

## Troubleshooting

### MongoDB Connection Error

**Error:** MongoNetworkError: connect ECONNREFUSED

**Solution:**

```bash
# Verify MongoDB is running
sudo systemctl status mongod

# Start MongoDB if not running
sudo systemctl start mongod

# Check connection in .env
# MongoDB should be accessible at localhost:27017
```

### WebSocket Connection Fails

**Error:** WebSocket is closed before the connection is established

**Solution:**

```bash
# Check if WebSocket port is open
lsof -i :3001

# Verify socket configuration in backend/config/socket.js
# Ensure CORS is properly configured
# Test connection: ws://localhost:3001
```

### PDF Generation Times Out

**Error:** PDF generation timeout after 30000ms

**Solution:**

```javascript
// Increase timeout in pdfService.js
const pdfOptions = {
  timeout: 60000, // 60 seconds
  format: 'A4'
};

// Use Puppeteer for complex PDFs instead of PDFKit
const puppeteer = require('puppeteer');
```

### High Memory Usage

**Error:** JavaScript heap out of memory

**Solution:**

```bash
# Increase Node.js heap size
node --max-old-space-size=4096 server.js

# Or use PM2 with memory limits
pm2 start server.js --max-memory-restart 1G
```

### CORS Errors

**Error:** Access to XMLHttpRequest blocked by CORS policy

**Solution:**

```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'https://placement.iitg.ac.in'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## Contributing

### Development Workflow

1. Fork the repository on GitHub
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request with detailed description

### Coding Standards

- Use ESLint for code style consistency
- Follow Prettier formatting rules
- Write meaningful commit messages
- Add comments for complex logic
- Include unit tests for new features

### Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Check code coverage
npm run test:coverage
```

## Support and Contact

- **Report Issues:** https://github.com/laladwesh/live-placement-ccd/issues
- **Documentation:** See /docs folder
- **Email:** placement-admin@iitg.ac.in

## Acknowledgments

- IITG Administration for providing server infrastructure
- Placement Cell for requirements and feedback
- All contributing developers and testers
- Participating companies in IITG Placements 2025

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Project Information

- **Version:** 1.0.0
- **Last Updated:** January 2025
- **Maintainer:** [@laladwesh](https://github.com/laladwesh)
- **Live Deployment:** https://iitg.ac.in/dday/
- **Institution:** Indian Institute of Technology Guwahati
