# ✅ REVERSE PROXY FIX - VERIFICATION CHECKLIST

**Task**: Verify all 5 bugs are fixed and reverse proxy works correctly  
**Time**: ~5 minutes  

---

## 📋 Pre-Requisites

- [ ] Build Server is running (has built artifacts)
- [ ] API Server is running (port 9000)
- [ ] Frontend is running (port 3000)
- [ ] Reverse Proxy folder has `npm install` done

---

## 🔧 Installation Check

```bash
cd reverseProxy

# Check 1: package.json has AWS SDK
grep "aws-sdk" package.json
# Expected: "@aws-sdk/client-s3": "^3.400.0"
✅ PASS: AWS SDK dependency present

# Check 2: node_modules has dependencies
ls node_modules/@aws-sdk/client-s3
# Expected: Directory exists
✅ PASS: Dependencies installed

# Check 3: index.js has no syntax errors
node -c index.js
# Expected: No output (no errors)
✅ PASS: No syntax errors
```

---

## 🚀 Start Reverse Proxy

```bash
cd reverseProxy
npm start
```

**Expected Console Output**:
```
✅ Reverse Proxy Running on port 8000
📍 S3 Bucket: newhosting-application
🌍 Region: ap-south-1
📁 Base Path: https://newhosting-application.s3.ap-south-1.amazonaws.com/__outputs
```

**Verification**:
- [ ] Port 8000 is listening
- [ ] No startup errors
- [ ] S3 bucket name correct
- [ ] Region set to ap-south-1

---

## 📝 Code Verification (index.js)

### Check 1: S3 Configuration ✅
```javascript
// Line 8-10: Should have S3 constants
const S3_BUCKET = 'newhosting-application'
const S3_REGION = 'ap-south-1'
const S3_BASE_PATH = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/__outputs`

✅ PASS: S3 constants configured
```

### Check 2: S3Client Created ✅
```javascript
// Line 13-20: Should create S3 client
const s3Client = new S3Client({ 
  region: S3_REGION,
  credentials: { ... }
})

✅ PASS: S3 client initialized
```

### Check 3: URL Construction (NO Double Slash) ✅
```javascript
// Line 30-37: Should build correct S3 path
let s3Path = `${S3_BASE_PATH}/${subdomain}${req.url}`
// Should NOT have double slash: /${subdomain}
// Check: console.log(s3Path) should show single slash

✅ PASS: No double slash in URL
```

### Check 4: Root Path Handling ✅
```javascript
// Line 34-36: Should redirect / to /index.html
if (req.url === '/' || req.url === '') {
  s3Path = `${S3_BASE_PATH}/${subdomain}/index.html`
}

✅ PASS: Root path redirected
```

### Check 5: Logging Present ✅
```javascript
// Line 39-40, 57, 67: Should have detailed logging
console.log(`[Proxy] ${hostname} → ${subdomain}`)
console.log(`[S3 URL] ${s3Path}`)

✅ PASS: Logging implemented
```

---

## 🧪 Deploy Test Project

### Step 1: Create Project
```
1. Open http://localhost:3000
2. Click "New Project" button
3. Name: "test-project"
4. Git URL: Choose a public repo with build
5. Click "Create Project"

✅ Project created
```

### Step 2: Deploy Project
```
1. Find project in list
2. Click "Deploy" button
3. Watch frontend for logs
4. Wait for status: READY
5. Note the subdomain (e.g., "test-project" or "happy-penguin")

✅ Deployment complete
```

### Step 3: Check S3 Upload
```bash
# Verify files uploaded to S3
aws s3 ls s3://newhosting-application/__outputs/ --recursive | head -20

# Expected output:
# 2026-02-13 10:30:00    1234  __outputs/{subdomain}/index.html
# 2026-02-13 10:30:01    5678  __outputs/{subdomain}/style.css
# 2026-02-13 10:30:02    9012  __outputs/{subdomain}/app.js

✅ Files uploaded to S3
```

---

## 🌐 Test Reverse Proxy

### Step 1: Check Reverse Proxy Logs
```
Watch reverse proxy console, should show:

[Proxy] {subdomain}.localhost → {subdomain}
[S3 URL] https://newhosting-application.s3.ap-south-1.amazonaws.com/__outputs/{subdomain}/
[ProxyReq] GET /
[ProxyRes] Status: 200

✅ Correct logs appearing
```

### Step 2: Test Root Path
```bash
# Open browser or curl
curl -v http://test-project.localhost:8000/

# Check response:
# Expected headers: HTTP/1.1 200 OK
# Expected body: HTML content (not XML error)

✅ Root path works, returns 200
```

### Step 3: Test CSS Loading
```bash
curl -v http://test-project.localhost:8000/style.css

# Expected: Status 200
# Check logs show: [S3 URL] .../style.css

✅ CSS loads correctly
```

### Step 4: Test JavaScript
```bash
curl -v http://test-project.localhost:8000/app.js

# Expected: Status 200
# Check logs show: [S3 URL] .../app.js

✅ JavaScript loads correctly
```

### Step 5: Open in Browser
```
1. Click "Open" button from frontend (when status = READY)
OR
2. Type: http://{subdomain}.localhost:8000/

Expected: Your deployed website loads ✅
         No XML error
         Styles applied
         Resources loaded
```

---

## 📊 Success Criteria

### Browser View
- [ ] Website loads without errors
- [ ] No "This XML file does not appear to have any style information" error
- [ ] HTML renders
- [ ] CSS styling applied
- [ ] JavaScript functional
- [ ] Images display
- [ ] All resources have green checkmarks in DevTools

### Reverse Proxy Console
- [ ] [Proxy] line shows subdomain extraction
- [ ] [S3 URL] shows no double slashes
- [ ] [ProxyReq] shows correct method and path
- [ ] [ProxyRes] shows Status: 200

### S3 Backend
- [ ] Files exist in __outputs/{subdomain}/
- [ ] index.html is present
- [ ] Static assets (CSS, JS, images) are present
- [ ] Files have public-read permissions (or AWS credentials working)

---

## ❌ If Tests Fail

### Problem: Status 403 (Access Denied)
```
[S3 Error] Access Denied (403)
Possible causes:
1. S3 bucket is not public
2. Object does not have public read permissions  
3. AWS credentials are invalid

Fix:
- Check AWS credentials in reverseProxy/index.js are correct
- Verify S3 bucket allows public access
- Check object ACL in S3 console
```

### Problem: Status 404 (Not Found)
```
[S3 Error] Not Found (404)
Expected path: __outputs/{subdomain}/index.html

Fix:
- Verify project was deployed (check S3 console)
- Verify index.html exists in bucket
- Verify subdomain matches between frontend and S3
```

### Problem: Double Slash in Logs
```
[S3 URL] https://.../__outputs//{subdomain}/
                           ↑↑ Double slash

Fix:
- Check reverseProxy/index.js line 30
- Should be: `${S3_BASE_PATH}/${subdomain}${req.url}`
- NOT: `${BASE_PATH}/${subdomain}` (which would add extra /)
```

### Problem: No Logs from Reverse Proxy
```
No [Proxy], [S3 URL], [ProxyReq], [ProxyRes] messages

Fix:
- Check proxy is running: npm start
- Check console output is visible
- Verify no console.log lines were removed
```

---

## 📈 Full Test Scenario (5 min)

```
1. Start reverse proxy
   npm start
   Expected: ✅ Ready on port 8000

2. Deploy test project
   Frontend → Deploy button
   Expected: ✅ Status = READY

3. Check logs
   Reverse proxy console → [ProxyRes] Status: 200
   Expected: ✅ Correct logs shown

4. Open website
   Click "Open" button from frontend
   Expected: ✅ Website loads, no errors

5. Verify static assets
   Browser DevTools → Network tab
   Expected: ✅ All resources Status 200

6. Check console for errors
   Browser DevTools → Console tab
   Expected: ✅ No red errors
```

---

## 🎯 Final Checklist

| Item | Status |
|------|--------|
| reverseProxy/index.js has S3 configuration | ✅/❌ |
| reverseProxy/index.js has S3Client | ✅/❌ |
| reverseProxy/index.js has NO double slash | ✅/❌ |
| reverseProxy/index.js has logging | ✅/❌ |
| reverseProxy/package.json has AWS SDK | ✅/❌ |
| npm install completed | ✅/❌ |
| Reverse proxy starts (npm start) | ✅/❌ |
| S3 bucket has deployed files | ✅/❌ |
| Reverse proxy shows [ProxyRes] 200 | ✅/❌ |
| Website loads at subdomain.localhost:8000 | ✅/❌ |
| No XML error shown | ✅/❌ |
| Static assets load (200 status) | ✅/❌ |
| Styling applied correctly | ✅/❌ |

**All Checks Passing**: ✅ REVERSE PROXY FIXED!

---

## 📞 Quick Reference

**Start Proxy**: `cd reverseProxy && npm start`  
**Test URL**: `http://{subdomain}.localhost:8000`  
**Check Logs**: Watch reverse proxy console for [Proxy], [S3 URL], [ProxyRes]  
**View Files**: `aws s3 ls s3://newhosting-application/__outputs/{subdomain}/`  
**Debug Error**: Check reverse proxy console for detailed [S3 Error] message  

---

**All Tests Pass = Reverse Proxy Fixed!** ✅ 🚀
