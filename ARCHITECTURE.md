# Hosting Platform - Complete Architecture Documentation

## Overview

This is a modern **Git-based Hosting Platform** that allows users to deploy their applications directly from GitHub. The platform consists of:

- **Frontend**: Next.js React application with beautiful dark-mode UI
- **API Server**: Express.js backend with real-time capabilities
- **Build Server**: Docker-based build container
- **Reverse Proxy**: Routes subdomains to S3-hosted builds
- **Infrastructure**: AWS ECS, S3, PostgreSQL, Kafka, ClickHouse

---

## Architecture

### Data Flow

```
1. User creates project (GitHub URL)
   ↓
2. Frontend submits to -> API Server POST /project
   ↓
3. Project stored in PostgreSQL via Prisma
   ↓
4. User triggers deployment -> POST /deploy
   ↓
5. API Server creates deployment record & launches ECS task
   ↓
6. Build Server clones repo, runs build, publishes logs to Kafka
   ↓
7. API Server consumes Kafka logs, stores in ClickHouse
   ↓
8. Frontend polls GET /logs/:id (every 2 seconds)
   ↓
9. Socket.io broadcasts logs to connected clients in real-time
   ↓
10. Build artifacts uploaded to S3
    ↓
11. Reverse proxy routes subdomain to S3 hosted files
```

### Key Components

#### 1. **API Server** (`api-server/index.js`)
- **Port**: 9000
- **Transport**: Express.js + Socket.io
- **Database**: PostgreSQL (via Prisma ORM)
- **Key Endpoints**:
  - `POST /project` - Create new project
  - `POST /deploy` - Trigger deployment
  - `GET /projects` - List all projects
  - `GET /projects/:id` - Get project details with deployments
  - `GET /deployments/:id` - Get deployment status
  - `GET /logs/:id` - Get deployment logs from ClickHouse

**Socket.io Events**:
- `connection` - Client connects
- `subscribe` - Client subscribes to deployment logs
- `message` - Server broadcasts logs and status updates

#### 2. **Frontend** (`frontend-nextjs/`)
- **Technology**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS with dark mode
- **Components**: Radix UI primitives
- **Icons**: Lucide React

**Key Features**:
- Project dashboard with list view
- Create new projects from GitHub URLs
- Deploy projects with one click
- Real-time deployment logs with Socket.io
- Polling fallback for logs (every 2 seconds)
- Deployment status tracking with visual indicators
- Expandable project cards showing deployment history

#### 3. **Build Server** (`BuildServer/`)
- **Container**: Docker container running in ECS Fargate
- **Environment Variables**:
  - `PROJECT_ID` - Project identifier
  - `DEPLOYMENT_ID` - Deployment identifier
  - `GIT_REPOSITORY_URL` - GitHub repository URL

**Build Process**:
1. Clones Git repository
2. Installs dependencies (`npm install`)
3. Builds project (`npm run build`)
4. Publishes logs to Kafka topic `container-logs`
5. Uploads artifacts to S3 bucket `newhosting-application/__outputs/{PROJECT_ID}/`

#### 4. **Reverse Proxy** (`reverseProxy/`)
- **Port**: 8000
- **Function**: Routes subdomains to S3 hosted builds
- **Feature**: Serves `index.html` for root path (SPA support)

---

## Database Schema

### Prisma Models

#### Project
```prisma
model Project {
  id            String        @id
  name          String
  git_url       String
  subdomain     String        @unique
  custom_domain String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime
  Deployement   Deployement[]
}
```

#### Deployment
```prisma
model Deployement {
  id         String            @id
  project_id String
  status     DeployementStatus @default(NOT_STARTED)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @default(now())
  Project    Project           @relation(fields: [project_id], references: [id])
}

enum DeployementStatus {
  NOT_STARTED
  QUEUED
  IN_PROGRESS
  READY
  FAIL
}
```

---

## Socket.io Message Format

### Server → Client Messages
```json
{
  "type": "log" | "status" | "subscribe",
  "log": "Build started...",
  "status": "IN_PROGRESS",
  "deploymentId": "deployment-uuid",
  "timestamp": "2026-02-13T12:30:00Z"
}
```

### Client → Server Events
```javascript
socket.emit("subscribe", "deployment-id")
```

---

## Frontend Components

### Main Page (`app/page.tsx`)
- Project list with deployment status
- Create project form
- Deploy project button
- Real-time logs viewer
- Deployment history panel

### Custom Hooks (`lib/hooks.ts`)
```typescript
useApi() // Returns all API methods:
- fetchProjects()
- fetchProject(id)
- fetchDeployment(id)
- fetchLogs(id)
- createProject(name, url)
- deployProject(id)
```

### UI Components (`components/ProjectCard.tsx`)
- `DeploymentStatusBadge` - Status indicator with icon
- `ProjectCard` - Reusable project display component

---

## Log Display Strategy

### Real-time (via Socket.io)
- **Advantage**: Instant updates, lower latency
- **Used for**: Live deployment watching
- **Fallback**: Works with polling if Socket.io fails

### Polling (via HTTP)
- **Interval**: Every 2 seconds
- **Duration**: 10 minutes per deployment
- **Advantage**: No WebSocket required, works everywhere
- **Endpoint**: `GET /logs/{deploymentId}`

**Frontend Logic**:
1. When deployment starts, subscribe to Socket.io
2. Begin polling logs every 2 seconds
3. Display logs as they arrive (Socket.io priority)
4. Auto-stop polling after 10 minutes

---

## Why Not Just Socket.io?

**Original Problem**: Socket.io was on port 9002, Express on 9000 - separate servers
- CORS errors
- Connection issues across ports
- No HTTP fallback

**Solution Implemented**:
1. **Integrated Socket.io** into Express on port 9000
2. **Proper HTTP Server**: Created `http.Server` wrapping Express
3. **Polling Fallback**: Added HTTP polling endpoint for reliability
4. **Hybrid Approach**: Socket.io + polling = robust log delivery

---

## Running the Application

### 1. Start API Server
```bash
cd api-server
npm install
npm run dev
# Server runs on http://localhost:9000
# Socket.io on same server (HTTP upgrade)
```

### 2. Start Frontend
```bash
cd frontend-nextjs
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### 3. Start Reverse Proxy
```bash
cd reverseProxy
npm install
npm start
# Proxy runs on http://localhost:8000
```

---

## Environment Configuration

### Required Environment Variables

#### API Server
```bash
DATABASE_URL="postgresql://user:password@host:5432/database"
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
```

#### ClickHouse Connection
Already configured in API server for log storage

#### Kafka Configuration
Already configured in API server for log streaming

---

## Frontend Features Explained

### 1. Project Dashboard
- Lists all projects
- Shows latest deployment status
- Color-coded status indicators:
  - 🟢 READY (green)
  - 🔵 IN_PROGRESS (blue, spinning)
  - 🟡 QUEUED (yellow)
  - 🔴 FAIL (red)

### 2. Create Project
- Modal form with Name and GitHub URL
- Validation on frontend
- Creates project and returns to list

### 3. Deploy Project
- One-click deployment
- Instantly shows logs panel
- Combines Socket.io + polling
- Auto-scrolls to latest log

### 4. Logs Viewer
- Fixed bottom panel (fixed position)
- Terminal-like appearance with Fira Code font
- Green text on dark background
- Timestamps for each log entry
- Auto-scroll to latest entry
- Dismissible with close button

### 5. Responsive Design
- Mobile-friendly layout
- Tailwind CSS for styling
- Dark mode by default
- Gradient backgrounds

---

## API Response Examples

### Create Project
```bash
POST /project
Body: { "name": "My App", "gitURL": "https://github.com/user/repo" }

Response:
{
  "status": "success",
  "data": {
    "project": {
      "id": "uuid",
      "name": "My App",
      "git_url": "https://github.com/user/repo",
      "subdomain": "happy-penguin",
      "createdAt": "2026-02-13T12:00:00Z",
      "updatedAt": "2026-02-13T12:00:00Z"
    }
  }
}
```

### Get Projects
```bash
GET /projects

Response:
{
  "status": "success",
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "My App",
        "git_url": "https://github.com/user/repo",
        "subdomain": "happy-penguin",
        "Deployement": [
          {
            "id": "deployment-uuid",
            "project_id": "uuid",
            "status": "READY",
            "createdAt": "2026-02-13T12:00:00Z"
          }
        ]
      }
    ]
  }
}
```

### Get Logs
```bash
GET /logs/deployment-uuid

Response:
{
  "logs": [
    { "log": "Build started" },
    { "log": "npm install running..." },
    { "log": "Build complete" }
  ]
}
```

---

## Troubleshooting

### Socket.io Not Connecting
1. Check API server is running on port 9000
2. Verify CORS is enabled in Socket.io config
3. Check browser console for errors
4. Polling will automatically fallback

### No Logs Appearing
1. Check Kafka is receiving logs from build container
2. Verify ClickHouse table exists: `log_events`
3. Check API server container logs
4. Try refreshing logs with polling interval

### Deployment Status Not Updating
1. Verify ECS task is running
2. Check environment variables passed to build container
3. Check Kafka consumer is consuming messages
4. Verify database write permissions

### Build Container Fails
1. Check Git URL is valid and public
2. Verify build script (npm run build) exists
3. Check Docker container has required dependencies
4. View logs in ClickHouse directly

---

## Future Enhancements

1. **Custom Domains**: Add support for custom domains instead of subdomains
2. **Build Caching**: Cache dependencies to speed up builds
3. **Rollback**: Ability to revert to previous deployments
4. **Environment Variables**: Per-project environment config
5. **Webhooks**: Auto-deploy on GitHub push
6. **Team Management**: Multi-user projects
7. **Usage Analytics**: Track deployment frequency, build times
8. **Performance Metrics**: Lighthouse scores, resource usage
9. **Custom Build Scripts**: Override default npm build
10. **Preview Deployments**: Deploy PR previews automatically

---

## Technology Stack Summary

| Component | Technology | Port |
|-----------|-----------|------|
| Frontend | Next.js 14, React 18, TypeScript | 3000 |
| API Server | Express.js, Socket.io | 9000 |
| Build Server | Docker, ECS Fargate | - |
| Reverse Proxy | Express.js | 8000 |
| Database | PostgreSQL | 5432 |
| Cache/Logs | Kafka | 11331 |
| Analytics | ClickHouse | 11319 |
| Storage | AWS S3 | - |
| Container | Docker | - |

---

## File Structure

```
frontend-nextjs/
├── app/
│   ├── page.tsx              # Main dashboard page
│   ├── layout.tsx            # Root layout with metadata
│   └── globals.css           # Global styles
├── components/
│   ├── ProjectCard.tsx       # Reusable project component
│   └── ui/
│       ├── button.tsx        # Button component
│       └── input.tsx         # Input component
├── lib/
│   ├── hooks.ts             # API hooks
│   └── utils.ts             # Utility functions
└── package.json

api-server/
├── index.js                  # Main server file
├── package.json
├── prisma/
│   └── schema.prisma        # DB schema
└── lib/
    └── prisma.js            # Prisma client
```

---

## Contact & Support

For issues or questions about the architecture, refer to the backend API documentation in the code comments.

**Last Updated**: February 2026
