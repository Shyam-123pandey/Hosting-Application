# Quick Start Guide

## System Requirements
- Node.js 18+
- Docker (for Build Server)
- PostgreSQL database
- AWS credentials (ECS, S3)
- Kafka cluster
- ClickHouse instance

## Installation Steps

### 1. API Server Setup

```bash
cd api-server

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Setup environment variables
# Create .env file with:
# DATABASE_URL="postgresql://user:password@host:5432/db"
# AWS_ACCESS_KEY_ID="your-key"
# AWS_SECRET_ACCESS_KEY="your-secret"

# Start in development
npm run dev
# Server runs on http://localhost:9000
```

### 2. Frontend Setup

```bash
cd frontend-nextjs

# Install dependencies
npm install

# Start development server
npm run dev
# Frontend runs on http://localhost:3000

# Build for production
npm run build
npm start
```

### 3. Reverse Proxy Setup

```bash
cd reverseProxy

# Install dependencies
npm install

# Start proxy
npm start
# Proxy runs on http://localhost:8000
```

### 4. Build Server (Docker)

```bash
cd BuildServer

# Build Docker image
docker build -t hosting-build-server .

# Push to ECR (if using AWS)
# Or configure ECS task definition to use this image
```

---

## First Time Setup

1. **Start API Server** (Terminal 1)
   ```bash
   cd api-server && npm run dev
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd frontend-nextjs && npm run dev
   ```

3. **Open Browser**
   - Go to http://localhost:3000

4. **Create Project**
   - Click "New Project"
   - Enter: Project Name (e.g., "My App")
   - Enter: GitHub URL (e.g., "https://github.com/user/my-app")
   - Click "Create Project"

5. **Deploy Project**
   - Find project in dashboard
   - Click "Deploy" button
   - Watch logs in real-time!

---

## Environment Variables

### API Server (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/hosting_db
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1

# Optional: Override services
CLICKHOUSE_HOST=https://host:11319
KAFKA_BROKERS=kafka-host:11331
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:9000
```

---

## Database Setup

### Prisma Migration
```bash
cd api-server

# Run migrations
npm run prisma:migrate

# This will:
# 1. Create tables (Project, Deployement)
# 2. Create enums (DeployementStatus)
# 3. Setup relationships
```

### Tables Created
- `Project` - Stores project info
- `Deployement` - Stores deployment records
- `_prisma_migrations` - Migration tracking

---

## Troubleshooting

### Frontend won't connect to API
```
Error: Failed to fetch
Solution:
1. Verify API server running: http://localhost:9000
2. Try: curl http://localhost:9000/projects
3. Check browser console for CORS errors
```

### Socket.io not connecting
```
Error: WebSocket connection failed
Solution:
1. Confirm API on port 9000 (not 9002)
2. Check Network tab in DevTools
3. Fallback polling will work instead
```

### No logs appearing
```
Error: Logs not showing during deployment
Solution:
1. Check Kafka consumer group: api-server-logs-consumer
2. Verify ClickHouse table: log_events exists
3. Check build container logs in CloudWatch
```

### Build fails immediately
```
Error: Container exits with error
Solution:
1. Check git repository is public
2. Verify project has npm scripts (build)
3. Check environment variables passed to container
4. Review CloudWatch logs for error details
```

---

## Common Commands

### Restart Services
```bash
# Kill all node processes
killall node

# Restart API
cd api-server && npm run dev

# Restart Frontend
cd frontend-nextjs && npm run dev

# Restart Proxy
cd reverseProxy && npm start
```

### Database Operations
```bash
# Reset database (WARNING: Deletes all data)
cd api-server
npm run prisma:migrate reset --force

# View database changes
npm run prisma:generate

# Open Prisma Studio (GUI)
npx prisma studio
```

### View Logs
```bash
# API Server: Check console output
# Frontend: Browser DevTools Console
# Build: CloudWatch Logs (AWS)
# ClickHouse: Query directly with DBeaver
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Frontend (Next.js)                     │
│         http://localhost:3000                   │
└────────────────┬────────────────────────────────┘
                 │ HTTP/Socket.io
                 ↓
┌─────────────────────────────────────────────────┐
│      API Server (Express)                       │
│      http://localhost:9000                      │
│                                                 │
│  • /projects - List                             │
│  • /project - Create                            │
│  • /deploy - Start deployment                   │
│  • /logs/:id - Get logs                         │
│  • WebSocket - Real-time                        │
└────────────┬─────────────────────┬──────────────┘
             │                     │
             ↓                     ↓
      ┌──────────────┐     ┌──────────────┐
      │ PostgreSQL   │     │ Kafka        │
      │ (Projects)   │     │ (Build Logs) │
      └──────────────┘     └──────┬───────┘
                                  │
                                  ↓
                           ┌──────────────┐
                           │ ClickHouse   │
                           │ (Log Storage)│
                           └──────────────┘

┌─────────────────────────────────────────────────┐
│    Build Server (Docker in ECS)                 │
│                                                 │
│  • Clone repo                                   │
│  • npm install + npm run build                  │
│  • Publish logs to Kafka                        │
│  • Upload to S3                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│    Reverse Proxy (Express)                      │
│    http://localhost:8000                        │
│                                                 │
│    Routes subdomains → S3 builds               │
└─────────────────────────────────────────────────┘
```

---

## Development Workflow

### Making Changes

**Backend Change**
```bash
cd api-server
# Edit index.js
npm run dev (auto-restarts)
```

**Frontend Change**
```bash
cd frontend-nextjs
# Edit app/page.tsx
# Save (auto-reloads)
```

**Add New API Endpoint**
```bash
# 1. Edit api-server/index.js
# 2. Add app.get() or app.post()
# 3. Restart npm run dev
# 4. Call from frontend via useApi()
```

**Add New Component**
```bash
# 1. Create file in components/
# 2. Import in app/page.tsx
# 3. Use in JSX
```

---

## Monitoring

### Check API Health
```bash
curl http://localhost:9000/projects
```

### Check Frontend
```bash
curl http://localhost:3000
```

### Monitor Logs
```bash
# Terminal with API running logs real-time
# Check: ClickHouse for historical logs

# View in AWS CloudWatch:
# Search: "logs" in AWS Console
```

### Database Stats
```bash
npx prisma studio
# View all project and deployment records
```

---

## Production Deployment

### Prerequisites
1. Deploy PostgreSQL database (RDS)
2. Setup AWS ECS cluster
3. Configure AWS S3 bucket
4. Setup Kafka cluster
5. Setup ClickHouse instance
6. Get AWS credentials

### Frontend Deployment
```bash
# Build for production
npm run build

# Deploy to Vercel, Netlify, or AWS
# Update API_BASE_URL to production
```

### API Deployment
```bash
# Build Docker image
docker build -t hosting-api:latest .

# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag hosting-api:latest <account>.dkr.ecr.us-east-1.amazonaws.com/hosting-api:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/hosting-api:latest

# Deploy ECS task definition with new image
```

### Reverse Proxy Deployment
```bash
# Similar process to API
# Or use EC2 instance with nginx
```

---

## Support

- **Architecture Details**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Frontend Docs**: See [frontend-nextjs/README.md](./frontend-nextjs/README.md)
- **Implementation Notes**: See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

---

## Getting Help

1. **Check the docs** first (ARCHITECTURE.md)
2. **Check console logs** (API and Browser DevTools)
3. **Check CloudWatch** for build errors
4. **Restart services** if stuck
5. **Reset database** if corrupted (use carefully!)

---

Happy deploying! 🚀
