# Hosting Platform Frontend

A modern, beautiful Next.js application for managing and deploying projects from GitHub.

## Quick Start

### Prerequisites
- Node.js 18+
- API server running on `http://localhost:9000`

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Production Build
```bash
npm run build
npm start
```

## Features

- ✨ Beautiful dark UI with gradient backgrounds
- 🚀 One-click deployment from GitHub
- 📊 Real-time deployment logs with Socket.io
- 🎯 Project dashboard and management
- 📱 Responsive design for all devices
- 🔄 Deployment history tracking
- 🎨 Visual status indicators (READY, IN_PROGRESS, QUEUED, FAIL)

## Project Structure

```
app/
├── page.tsx           # Main dashboard page
├── layout.tsx         # Root layout
└── globals.css        # Tailwind styles

components/
├── ProjectCard.tsx    # Project component
└── ui/                # Radix UI components
    ├── button.tsx
    └── input.tsx

lib/
├── hooks.ts          # useApi() hook
└── utils.ts          # Utilities
```

## Key Technologies

- **Frontend Framework**: Next.js 14
- **Runtime**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Real-time**: Socket.io
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Custom Hooks

### useApi()
Main hook for API interactions:

```typescript
const {
  error,
  loading,
  fetchProjects,
  fetchLogs,
  createProject,
  deployProject
} = useApi();
```

## API Integration

### Endpoints Used

- `POST /project` - Create new project
- `GET /projects` - List all projects
- `POST /deploy` - Start deployment
- `GET /logs/:id` - Get deployment logs

## Socket.io + Polling Strategy

**Socket.io**: Real-time log streaming (primary)
**Polling**: HTTP fallback every 2 seconds
**Combination**: Ensures logs are never missed

## License

MIT - See [ARCHITECTURE.md](../ARCHITECTURE.md) for full system documentation
