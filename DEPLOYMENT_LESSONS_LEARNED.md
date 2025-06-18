# Lunora Player Deployment Lessons Learned

## Node.js 22.x Migration & Production Deployment Attempts - June 7, 2025

**Summary**: This document captures key lessons learned during the Node.js 22.x migration and production deployment attempts. These insights will help avoid similar issues in future deployments.

---

## 🔴 CRITICAL LESSONS LEARNED

### Issue #1: Node.js Migration Deployment Loop
- **Problem**: Got stuck in deployment loop when migrating from Node.js 18.x to 22.x
- **Root Cause**: Complex path handling logic incompatible with Lambda Function URLs + missing permissions
- **Solution**: Complete Lambda function deletion/recreation + restored working code from dist/lambda-function.js
- **Key Lesson**: **Always keep working backups of deployed code**. The `dist/lambda-function.js` file saved the entire deployment.

### Issue #2: Lambda Function URL Permissions
- **Problem**: Function URL returning 403 Forbidden errors
- **Root Cause**: Missing `lambda:InvokeFunctionUrl` permission in resource-based policy
- **Solution**: Added proper resource-based policy for Function URL access
- **Key Lesson**: **Lambda Function URLs require explicit permissions** - they don't inherit from execution role

### Issue #3: Production vs Development Environment Confusion
- **Problem**: Working on localhost while production deployment was broken
- **Root Cause**: Lost track of which environment was being tested
- **Solution**: Clear separation of local vs production configurations
- **Key Lesson**: **Always verify which environment you're working in** - use environment-specific API URLs

### Issue #4: API URL Configuration Inconsistency
- **Problem**: Production S3 files had wrong/placeholder API URLs
- **Root Cause**: Production deployment not updated with correct Lambda URL after recreation
- **Solution**: Systematic update of all production files with correct URLs
- **Key Lesson**: **Production deployments must be updated as a complete unit** when infrastructure changes

---

## 🟡 DEPLOYMENT BEST PRACTICES LEARNED

### 1. Infrastructure Management
- **Complete cleanup approach**: Sometimes delete/recreate is more effective than incremental fixes
- **Preserve working versions**: Always backup working deployments before major changes
- **Function URL vs API Gateway**: Different event structures and permission models

### 2. Configuration Management
- **Environment-specific configs**: Separate local and production API URLs clearly
- **Systematic updates**: When infrastructure changes, update ALL dependent files
- **Validation**: Test configuration changes in isolation before full deployment

### 3. Debugging Approach
- **Start with health checks**: Always verify basic connectivity first
- **Check permissions**: AWS permissions are often the root cause of 403/500 errors
- **Incremental testing**: Test each component individually before integration

---

## 🛠️ TECHNICAL SOLUTIONS THAT WORKED

### Lambda Function Recreation Process
```bash
# 1. Delete problematic function completely
aws lambda delete-function --function-name FUNCTION_NAME

# 2. Recreate with correct runtime
aws lambda create-function --runtime nodejs22.x

# 3. Deploy working code from backup
aws lambda update-function-code --zip-file fileb://working-backup.zip

# 4. Add Function URL permissions
aws lambda add-permission --action lambda:InvokeFunctionUrl
```

### Production File Update Process
```bash
# 1. Update local files with correct API URLs
# 2. Create production build
# 3. Deploy to S3 buckets systematically
# 4. Verify each component individually
```

---

## 📋 PREVENTION CHECKLIST FOR FUTURE DEPLOYMENTS

### Before Starting Deployment
- [ ] Create complete backup of current working state
- [ ] Document current production URLs and configurations
- [ ] Test all changes in development environment first
- [ ] Verify AWS credentials and permissions

### During Deployment
- [ ] Deploy infrastructure changes first
- [ ] Update configuration files with new URLs
- [ ] Test each component individually
- [ ] Verify API connectivity before frontend deployment

### After Deployment
- [ ] Test complete end-to-end functionality
- [ ] Document new production URLs
- [ ] Update monitoring and alerting
- [ ] Create rollback plan for next deployment

---

## 🎯 SUCCESS METRICS

**What Worked Well:**
- ✅ Local multi-destination MVP is fully functional
- ✅ DynamoDB integration working perfectly
- ✅ Backend API with all endpoints operational
- ✅ Frontend streaming interface complete
- ✅ Node.js 22.x migration successful (after recreation)

**Final State:**
- ✅ Lambda Function: Running on Node.js 22.x
- ✅ API Endpoints: All functional with correct URLs
- ✅ Local Development: Complete working MVP
- ✅ AWS Compliance: Ready for September 2025 Node.js 18 deprecation

---

## 🚨 **CRITICAL: SYSTEMATIC DEPLOYMENT PROCESS TO PREVENT RECURRING ISSUES**

### **PROBLEM ANALYSIS (June 14, 2025)**
**Recurring Issues:**
1. ❌ Multiple conflicting `index.js` files in different directories
2. ❌ CORS issues reappearing after rollbacks
3. ❌ Missing dependencies in every deployment
4. ❌ Duplicate deployment directories causing confusion

### **ROOT CAUSES:**
1. **No single source of truth** for deployment files
2. **Manual deployment process** prone to human error
3. **CORS configured in multiple places** (Function URL + code)
4. **No systematic dependency analysis**

---

## 🔧 **SYSTEMATIC DEPLOYMENT DEPENDENCY CHECKLIST**

### **CRITICAL: Always Analyze ALL require() Statements Before Deployment**

**Problem**: Repeatedly missing local file dependencies in Lambda deployments
**Root Cause**: Not systematically checking all `require()` statements in main file
**Solution**: Use this checklist for EVERY deployment

#### **Pre-Deployment Dependency Analysis:**
```bash
# 1. Find ALL require statements in main handler file
grep -n "require(" lambda-handler.js

# 2. Identify local vs npm dependencies
# Local files: require('./filename') or require('../path')
# NPM packages: require('package-name')

# 3. For each local file dependency, recursively check ITS dependencies
grep -n "require(" dependency-file.js

# 4. Copy ALL local dependencies to deployment directory
cp dependency1.js deployment-dir/
cp dependency2.js deployment-dir/
# etc.

# 5. Verify all files present before zipping
ls -la deployment-dir/
```

#### **Deployment Package Contents Verification:**
- [ ] Main handler file (index.js)
- [ ] package.json with correct dependencies
- [ ] node_modules/ with all npm packages
- [ ] ALL local file dependencies identified via require() analysis
- [ ] ALL transitive local dependencies (dependencies of dependencies)

#### **Example from June 14, 2025 Fix:**
**Main file**: `lambda-handler.js` required:
- ✅ `aws-sdk` (npm - included)
- ❌ `./multi-channel-manager-robust` (local - MISSING)
- ❌ `./schema-migration` (local - MISSING)

**Transitive dependency**: `schema-migration.js` required:
- ❌ `./default-presets` (local - MISSING)

**Result**: 3 missing files caused 502 Bad Gateway errors

---

## 🔗 **API ENDPOINT CONSISTENCY ISSUES (June 13, 2025)**

### **PROBLEM**: Frontend calling incorrect API endpoints causing 404 errors
- Health endpoint was calling `/health` instead of `/api/health`
- Streaming status was calling `/api/destinations/status` instead of `/api/streaming/status`

### **ROOT CAUSE**: Inconsistent endpoint usage between frontend and backend
- Backend correctly implements `/api/health` and `/api/streaming/status`
- Frontend had hardcoded wrong endpoints

### **SOLUTION**:
- Fixed health endpoint: Use `${this.apiBaseUrl}/health` → `/api/health`
- Fixed streaming status: Use `${this.apiBaseUrl}/streaming/status` → `/api/streaming/status`
- Deploy frontend and invalidate CloudFront cache

### **PREVENTION**:
- Always verify API endpoints match between frontend and backend
- Use consistent `apiBaseUrl` variable instead of hardcoded URLs
- Test API calls in browser developer tools during development
- Document all API endpoints in a single source of truth

---

## 🎯 **SCRIPTS ORGANIZATION & DEPLOYMENT WORKFLOW (June 13, 2025)**

### **PROBLEM**: Scattered deployment scripts and unclear deployment process
- Backend deployment script in `backend/deploy.sh`
- Verification scripts in project root
- No clear naming convention or organization
- No complete deployment pipeline

### **SOLUTION**: Professional scripts organization
```
scripts/
├── deploy-all.sh                    # Complete deployment pipeline
├── deploy-backend.sh                # Backend Lambda deployment
├── deploy-frontend.sh               # Frontend S3/CloudFront deployment
├── verify-backend-deployment.sh     # Backend verification (100% file matching)
├── verify-frontend-deployment.sh    # Frontend verification (100% file matching)
└── README.md                        # Complete scripts documentation
```

### **BENEFITS**:
- ✅ **Clear naming convention**: `deploy-*` and `verify-*` prefixes
- ✅ **Complete pipeline**: Single command for full deployment
- ✅ **Professional organization**: All deployment tools in one place
- ✅ **Verification system**: 100% file matching for both frontend and backend
- ✅ **Comprehensive documentation**: Scripts README explains everything

### **USAGE**:
```bash
# Complete deployment (recommended)
./scripts/deploy-all.sh

# Individual components
./scripts/deploy-backend.sh
./scripts/deploy-frontend.sh

# Verification only
./scripts/verify-backend-deployment.sh
./scripts/verify-frontend-deployment.sh
```

### **PREVENTION**:
- Always use organized scripts from `scripts/` folder
- Use `deploy-all.sh` for complete deployments
- Run verification scripts to confirm 100% synchronization
- Reference `scripts/README.md` for detailed usage instructions

---

## 🚀 **MAJOR BREAKTHROUGH: HIGH-RESOLUTION CLOUDWATCH SOURCE HEALTH MONITORING (June 18, 2025)**

### **PROBLEM SOLVED**: MediaConnect Source Health Detection Performance

**Issue**: Source health detection was inconsistent and slow:
- ✅ First change detected quickly (3-5 seconds)
- ❌ Subsequent changes took 1+ minutes
- ❌ AWS Console showed changes in 3-5 seconds consistently
- ❌ Complex EventBridge/SSE implementation was unreliable

### **ROOT CAUSE DISCOVERED**: CloudWatch Metric Resolution

**The Issue**: Standard CloudWatch metrics use 60-second periods
```javascript
// PROBLEM: Standard resolution
const params = {
    Period: 60,  // Data points every 60 seconds
    Statistics: ['Maximum']
};
```

**Why First Change Was Fast**: Lucky timing hitting fresh 60-second window
**Why Subsequent Changes Were Slow**: Had to wait for next 60-second data point

### **BREAKTHROUGH SOLUTION**: High-Resolution CloudWatch Metrics

**The Fix**: Use 1-second periods for real-time data
```javascript
// SOLUTION: High-resolution metrics
const params = {
    Period: 1,   // Data points every 1 second!
    Statistics: ['Maximum']
};
```

### **IMPLEMENTATION DETAILS**

**Backend Changes**:
- ✅ Removed complex EventBridge integration (164+ lines)
- ✅ Removed Server-Sent Events (SSE) handling (48+ lines)
- ✅ Removed stale metadata and peer IP detection
- ✅ Implemented clean high-resolution CloudWatch detection
- ✅ Simplified to single source of truth

**Frontend Changes**:
- ✅ Removed complex polling modes (burst/fast/aggressive)
- ✅ Simplified to consistent 5-second polling
- ✅ Removed cache timestamp checking
- ✅ Removed complex failover controls (113+ lines)
- ✅ Clean source health display only

### **PERFORMANCE RESULTS**

**Before Optimization**:
- ❌ First change: 3-5 seconds (lucky timing)
- ❌ Subsequent changes: 1+ minutes (60s CloudWatch periods)
- ❌ Complex caching causing stale data issues
- ❌ EventBridge events not consistently received

**After Optimization**:
- ✅ **ALL changes: 3-5 seconds consistently**
- ✅ **Matches AWS Console performance exactly**
- ✅ **No stale data or caching issues**
- ✅ **Clean, maintainable codebase**

### **ARCHITECTURE COMPARISON**

**Before (Complex)**:
```
Frontend → EventBridge Cache → CloudWatch (60s) → Stale Metadata → Peer IP Persistence
```

**After (Simple)**:
```
Frontend (5s polling) → High-Resolution CloudWatch (1s periods) → Real-time source health
```

### **CODE REDUCTION**

**Backend Cleanup**:
- ❌ Removed EventBridge handler: 164+ lines
- ❌ Removed SSE connections: 48+ lines
- ❌ Removed complex caching: 50+ lines
- ❌ Removed stale detection methods: 100+ lines
- **Total**: ~350+ lines of complex code removed

**Frontend Cleanup**:
- ❌ Removed complex polling modes: 57+ lines
- ❌ Removed failover controls: 113+ lines
- ❌ Removed cache management: 26+ lines
- **Total**: ~200+ lines of complex code removed

### **KEY INSIGHTS LEARNED**

1. **AWS Console Performance Secret**: Uses high-resolution CloudWatch metrics
2. **Simplicity Wins**: Single source of truth beats complex caching
3. **Real-time = 1-second periods**: Not complex event systems
4. **Cost vs Performance**: $0.30/month for dramatically better UX

### **PREVENTION FOR FUTURE**

**When Building Real-time Monitoring**:
- ✅ Start with high-resolution CloudWatch metrics
- ✅ Use Period: 1 for real-time data
- ✅ Avoid complex caching unless absolutely necessary
- ✅ Test with actual AWS Console as performance benchmark
- ✅ Measure detection speed for both first AND subsequent changes

**Cost Considerations**:
- High-resolution metrics cost more than standard
- For 2 MediaConnect sources: ~$0.30/month additional
- ROI: Massive improvement in user experience and reliability

---

## 🎯 **REAL-TIME SOURCE BITRATE MONITORING IMPLEMENTATION (June 18, 2025)**

### **NEW FEATURE ACHIEVEMENT**: Dynamic Source Bandwidth Display

**Problem Solved**: Users needed real-time visibility into source streaming bitrates for monitoring and troubleshooting.

**Solution Implemented**: Professional bitrate display integrated with existing source health monitoring.

### **TECHNICAL IMPLEMENTATION**

**Backend Enhancement**:
- ✅ Added `getSourceBitrate()` method using AWS CloudWatch `SourceBitRate` metric
- ✅ Integrated bitrate collection into existing `getSimpleSourceHealth()` method
- ✅ Added `bitrate_mbps` field to source health API responses
- ✅ Used 5-minute average with 1-minute periods for stable readings
- ✅ Converted bits/second to Mbps for user-friendly display

**Frontend Enhancement**:
- ✅ Added bitrate display elements to both primary and secondary source HTML
- ✅ Updated `updateSimpleSourceDisplay()` to show bitrate below IP address
- ✅ Added professional CSS styling with blue color and monospace font
- ✅ Implemented color coding: blue for active bitrate, gray for zero bitrate
- ✅ Added "Source Bandwidth:" label with 2 decimal precision formatting

### **VISUAL IMPROVEMENTS**

**Before**: Only IP address and connection status
**After**: Professional layout with bandwidth information
```
Line 1: 54.71.132.165:9999
Line 2: Source Bandwidth: 2.51 Mbps
Status: 🟢 Connected (right-aligned)
```

**Layout Fixes Applied**:
- ✅ Fixed text alignment inconsistency between primary and secondary source boxes
- ✅ Changed from horizontal to vertical flex layout for proper stacking
- ✅ Ensured both boxes use consistent left alignment for IP and bandwidth
- ✅ Maintained right alignment for status indicators

### **INTEGRATION SUCCESS**

**API Response Enhancement**:
```json
{
  "sources": [
    {
      "name": "lunora-player-videon-srt-source",
      "status": "connected",
      "bitrate_mbps": 2.51,
      "ingest_ip": "54.71.132.165",
      "ingest_port": 9999
    }
  ]
}
```

**Real-time Performance**:
- ✅ Updates every 5 seconds alongside source health monitoring
- ✅ Uses existing high-resolution CloudWatch infrastructure
- ✅ No additional polling overhead or complexity
- ✅ Seamless integration with existing monitoring system

### **CODE QUALITY IMPROVEMENTS**

**Project Cleanup**:
- ✅ Removed temporary development files: `AWS-Error-2.js`, `temp_AWS_error.html`, `realtime_mediaconnect_monitoring.py`
- ✅ Updated `.gitignore` with patterns to prevent similar temporary files
- ✅ Cleaned up backend by removing unused EventBridge and SSE complexity
- ✅ Reduced codebase by 267 lines while adding new functionality

**Architecture Simplification**:
- ✅ Maintained single source of truth approach
- ✅ Leveraged existing high-resolution CloudWatch implementation
- ✅ Added functionality without increasing complexity
- ✅ Professional styling matching AWS Console appearance

### **USER EXPERIENCE IMPACT**

**Benefits Delivered**:
- ✅ **Real-time visibility**: Users can see actual streaming bitrates
- ✅ **Professional appearance**: Clean, labeled format for better readability
- ✅ **Troubleshooting aid**: Immediate feedback when bitrates change
- ✅ **Consistent design**: Both source boxes display identically
- ✅ **Performance monitoring**: Easy identification of bandwidth issues

**Cost Impact**: Minimal additional CloudWatch API calls (~$0.05/month)
**Development Time**: Efficient implementation leveraging existing infrastructure

### **LESSONS LEARNED FOR FUTURE FEATURES**

**Best Practices Demonstrated**:
- ✅ **Leverage existing infrastructure**: Built on high-resolution CloudWatch foundation
- ✅ **Maintain consistency**: Ensured both source boxes behave identically
- ✅ **Professional styling**: Matched AWS Console appearance standards
- ✅ **Clean integration**: Added functionality without architectural changes
- ✅ **User-focused design**: Clear labeling and appropriate precision

**Development Approach**:
- ✅ **Incremental enhancement**: Built on proven source health monitoring
- ✅ **Systematic testing**: Verified both backend API and frontend display
- ✅ **Code cleanup**: Removed technical debt while adding features
- ✅ **Documentation**: Updated all relevant documentation files

---

*This document should be referenced before any future production deployments to avoid repeating these issues.*
