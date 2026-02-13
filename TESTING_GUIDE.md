# Testing Guide

## Pre-Testing Checklist

Before running tests, ensure:
- ✅ Node.js 18+ installed
- ✅ PostgreSQL running
- ✅ Kafka running (or mocked)
- ✅ ClickHouse running (or mocked)
- ✅ AWS credentials configured
- ✅ All npm dependencies installed

---

## Unit Testing

### API Server

#### Test: Create Project
```bash
# 1. Start API server
cd api-server && npm run dev

# 2. In new terminal, test endpoint
curl -X POST http://localhost:9000/project \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test App",
    "gitURL": "https://github.com/user/repo"
  }'

# Expected Response:
{
  "status": "success",
  "data": {
    "project": {
      "id": "uuid-1234",
      "name": "Test App",
      "git_url": "https://github.com/user/repo",
      "subdomain": "happy-penguin",
      "createdAt": "2026-02-13T12:00:00Z"
    }
  }
}
```

#### Test: Get Projects
```bash
curl http://localhost:9000/projects

# Expected: Array of projects
```

#### Test: Deploy
```bash
curl -X POST http://localhost:9000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "uuid-1234"
  }'

# Expected Response:
{
  "status": "queued",
  "data": {
    "deploymentId": "deployment-uuid"
  }
}
```

---

## Integration Testing

### Frontend + Backend

#### Test 1: Create and Deploy
```
1. Open http://localhost:3000
2. Click "New Project"
3. Enter: Name = "Test Project"
4. Enter: URL = "https://github.com/your/repo"
5. Click "Create Project"
6. Project appears in list
7. Click "Deploy"
8. Deployment starts
9. Logs appear in panel
```

**Pass Criteria**:
- ✅ Project created successfully
- ✅ Project appears in dashboard
- ✅ Deployment triggered
- ✅ Logs displayed in real-time

#### Test 2: Real-time Logs via Socket.io
```
1. Deploy a project
2. Open DevTools → Network → WS
3. Should see: /socket.io connection
4. Logs should stream in real-time
5. No polling delay visible
```

**Pass Criteria**:
- ✅ WebSocket connection established
- ✅ Messages received via Socket.io
- ✅ Logs update instantly

#### Test 3: Polling Fallback
```
1. Deploy a project
2. Open DevTools → Network → XHR
3. Block WebSocket (DevTools → Network Conditions → Offline)
4. Refresh page
5. Wait 2 seconds
6. Should see: GET /logs/deployment-id
7. Logs should still update (slower)
```

**Pass Criteria**:
- ✅ Polling starts when Socket.io fails
- ✅ Logs load every 2 seconds
- ✅ No Socket.io messages in Network

#### Test 4: Deployment History
```
1. Create 2 projects
2. Deploy project 1
3. Wait for completion
4. Deploy project 1 again
5. Click on project to expand
6. Should show 2 deployments in history
7. Click on old deployment
8. Should show completed logs
```

**Pass Criteria**:
- ✅ Multiple deployments tracked
- ✅ History expandable
- ✅ Can view past logs

---

## API Endpoint Testing

### Using Postman or curl

#### Collections to Test

**1. Project Endpoints**
```bash
# Create
POST /project
Body: { "name": "Test", "gitURL": "https://github.com/user/repo" }

# List
GET /projects

# Get One
GET /projects/{projectId}
```

**2. Deployment Endpoints**
```bash
# Create
POST /deploy
Body: { "projectId": "{projectId}" }

# Get
GET /deployments/{deploymentId}
```

**3. Log Endpoints**
```bash
# Get
GET /logs/{deploymentId}
```

---

## Frontend Testing

### Component Tests

#### ProjectCard Component
```tsx
// Verify renders correctly
- Should show project name
- Should show git URL
- Should show subdomain
- Should show deploy button
- Should expand/collapse
- Should show deployment history when expanded
- Should show status badge for latest
```

#### DeploymentStatusBadge Component
```tsx
// Test all statuses
READY → green background, checkmark icon
IN_PROGRESS → blue background, spinner
QUEUED → yellow background, clock
FAIL → red background, alert icon
```

### User Interaction Tests

#### Create Project Flow
```
1. Click "New Project" button
2. Form appears
3. Enter text in Name field
4. Enter text in URL field
5. Click "Create Project"
6. Form disappears
7. Project appears in list
8. Click "Cancel" to close form without creating
```

#### Deploy Flow
```
1. Click "Deploy" button on project
2. Button shows loading spinner
3. Logs panel appears at bottom
4. Logs start appearing
5. Can click "Close" to dismiss logs
6. Deployment status updates
```

#### Responsive Design
```
1. Open Chrome DevTools (F12)
2. Toggle device toolbar
3. Test on:
   - iPhone SE (375w)
   - iPad (768w)
   - Desktop (1920w)
4. All layouts should be readable
5. No horizontal scroll
```

---

## Performance Testing

### Load Time
```bash
# Frontend build time should be < 5 seconds
npm run build

# Bundle size should be < 500KB gzipped
npm run build
# Check .next folder size
```

### Runtime Performance
```bash
# Open DevTools
# Check:
1. Time to Interactive < 3 seconds
2. First Contentful Paint < 2 seconds
3. Cumulative Layout Shift < 0.1
4. No console errors
```

### Socket.io Performance
```bash
# During deployment:
1. Open DevTools → Performance
2. Record 30 seconds of deployment
3. Check:
   - CPU usage < 20%
   - Memory stable
   - No memory leaks
4. Messages arriving < 100ms after sent
```

---

## Error Scenario Testing

### Network Errors

#### Test: API Server Down
```
1. Kill API server (Ctrl+C)
2. Try to create project
3. Should show: "Failed to create project"
4. Alert message appears
5. Restart API server
6. Should recover after refresh
```

#### Test: Socket.io Fails
```
1. Block port 9002 with firewall
2. Deploy a project
3. Should see polling starts
4. Logs should update every 2 seconds
5. Unblock port
6. Socket.io should reconnect
```

#### Test: Database Down
```
1. Stop PostgreSQL
2. Try to get projects
3. Should show: "Internal Server Error"
4. Restart database
5. Should recover
```

### Build Failures

#### Test: Invalid Git URL
```
1. Create project with invalid URL
2. Deploy
3. Build container exits
4. Status changes to FAIL
5. Logs show error message
```

#### Test: Build Script Missing
```
1. Create project from repo without npm scripts
2. Deploy
3. Build fails during npm run build
4. Status changes to FAIL
5. Logs show: "npm: build: command not found"
```

---

## End-to-End Testing

### Complete Deployment Flow
```
1. Start all services
2. Open frontend
3. Create new project
4. Deploy project
5. Monitor logs
6. Wait for completion
7. Check status is READY
8. Verify logs are stored
9. Deploy again
10. Check history shows 2 deployments
```

### Reliability Test (5 deployments)
```
1. Create 1 project
2. Deploy 5 times in sequence
3. Check:
   - All 5 deployments listed
   - All logs captured
   - No data loss
   - No duplicate IDs
   - All status changes properly
```

---

## Browser Testing

### Test Matrix

| Browser | Desktop | Mobile | Status |
|---------|---------|--------|--------|
| Chrome | ✅ | ✅ | Latest |
| Firefox | ✅ | ✅ | Latest |
| Safari | ✅ | ✅ | Latest |
| Edge | ✅ | ✅ | Latest |

### Features to Test per Browser
- Socket.io connection
- HTTP polling
- UI rendering
- Button clicks
- Form input
- Scrolling
- Responsive layout

---

## Accessibility Testing

### Keyboard Navigation
```
1. Use Tab to navigate all buttons
2. Use Enter to click buttons
3. Use Tab + Shift to go backwards
4. All interactive elements should be reachable
```

### Screen Reader
```
Using NVDA or JAWS:
1. Launch screen reader
2. Navigate page
3. Verify:
   - Page title read correctly
   - Button labels clear
   - Form inputs labeled
   - Status messages announced
```

### Color Contrast
```
Using WebAIM contrast checker:
1. Check all text has sufficient contrast
2. Don't rely only on color for status
3. Icons have proper contrast
```

---

## Security Testing

### Input Validation
```
1. Try XSS payload in project name:
   <script>alert('xss')</script>
   → Should be stored as text, not executed

2. Try SQL injection in URL field
   → Should fail validation

3. Try large payloads
   → Should be rejected by server
```

### CORS Testing
```
1. From different origin, try API call
2. Should be allowed (configured in API)
3. Verify headers allow frontend origin
```

---

## Final Verification Checklist

- ✅ All endpoints respond correctly
- ✅ Frontend loads without errors
- ✅ Socket.io connects
- ✅ Can create projects
- ✅ Can deploy projects
- ✅ Logs display in real-time
- ✅ Polling works as fallback
- ✅ Status updates correctly
- ✅ UI is responsive
- ✅ No console errors
- ✅ Performance is acceptable
- ✅ Edge cases handled
- ✅ Cross-browser compatible

---

## Test Results Template

```
Date: 2026-02-13
Tester: [Name]

API Server Tests: PASS / FAIL
Frontend Tests: PASS / FAIL
Integration Tests: PASS / FAIL
Performance Tests: PASS / FAIL
Security Tests: PASS / FAIL

Issues Found:
[ List any issues ]

Recommendations:
[ List improvements ]

Sign-off: [ Name ]
```

---

## Continuous Testing

### Automated Tests (Future)
```bash
# Frontend unit tests
npm run test

# API integration tests
npm run test:api

# E2E tests
npm run test:e2e
```

### Manual Regression Tests
```
Weekly:
- Create and deploy a project
- Verify all features work
- Check logs are captured
- Test on multiple browsers
```

---

## Support

For test failures, check:
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
2. [QUICK_START.md](./QUICK_START.md) - Setup guide
3. [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Changes made

Happy testing! 🧪
