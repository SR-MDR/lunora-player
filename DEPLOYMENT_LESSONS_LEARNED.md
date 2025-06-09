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

## MediaConnect Integration Implementation - December 2024

**Summary**: Lessons learned during the implementation of MediaConnect granular control for multi-destination streaming.

### 🟢 SUCCESSFUL IMPLEMENTATION APPROACH

#### Issue #1: Complex Backend Integration Without Breaking Existing Code
- **Challenge**: Add MediaConnect functionality to existing working Lambda function without disrupting current operations
- **Approach**: Systematic addition of new functions rather than replacement
- **Solution**: Added MediaConnect SDK client alongside existing AWS services, implemented new functions incrementally
- **Key Lesson**: **Incremental enhancement is safer than wholesale replacement** - preserve working functionality while adding new features

#### Issue #2: Database Schema Evolution
- **Challenge**: Add new sources table and enhance destinations table without data loss
- **Approach**: Created new table separately, enhanced existing table through application logic
- **Solution**: Used DynamoDB's flexible schema to add new fields without migration
- **Key Lesson**: **NoSQL databases allow graceful schema evolution** - new fields can be added without affecting existing data

#### Issue #3: MediaConnect vs MediaLive Integration Complexity
- **Challenge**: Understanding the difference between MediaLive schedule actions and MediaConnect flow outputs
- **Approach**: Researched AWS documentation and implemented MediaConnect-first approach
- **Solution**: Replaced MediaLive schedule actions with MediaConnect output management for true granular control
- **Key Lesson**: **MediaConnect provides true granular control** - MediaLive schedule actions are limited and require channel restarts

### 🟡 TECHNICAL IMPLEMENTATION INSIGHTS

#### 1. AWS SDK Integration Patterns
- **MediaConnect Client**: Added `new AWS.MediaConnect()` alongside existing clients
- **Environment Variables**: Used existing pattern for configuration management
- **Error Handling**: Implemented consistent error handling across all new functions
- **Key Lesson**: **Follow established patterns** - consistency reduces bugs and improves maintainability

#### 2. API Endpoint Design
- **RESTful Patterns**: Used consistent REST patterns for source management
- **Path Parameters**: Leveraged existing path parameter extraction logic
- **Response Format**: Maintained consistent response structure across all endpoints
- **Key Lesson**: **API consistency improves developer experience** - follow established conventions

#### 3. Status Synchronization Strategy
- **Multi-Service Sync**: Implemented synchronization between MediaConnect, MediaLive, and DynamoDB
- **Real-time Updates**: Used existing synchronization patterns for new MediaConnect status
- **Error Recovery**: Added robust error handling for synchronization failures
- **Key Lesson**: **Status synchronization is critical** - multiple AWS services require careful state management

### 🔧 IMPLEMENTATION BEST PRACTICES DISCOVERED

#### 1. MediaConnect Flow Management
```javascript
// Successful pattern for MediaConnect integration
const addMediaConnectOutput = async (destination) => {
    // 1. Validate MediaConnect flow ARN
    // 2. Get stream key from Parameter Store
    // 3. Construct full RTMP URL
    // 4. Add output to flow
    // 5. Update database with output ARN
};
```

#### 2. Granular Destination Control
```javascript
// Pattern for individual destination management
const startMediaConnectDestination = async (destinationId, destination) => {
    // 1. Ensure MediaLive channel is running
    // 2. Add MediaConnect output for this destination only
    // 3. Update database status
    // 4. Return success without affecting other destinations
};
```

#### 3. Source Management Implementation
```javascript
// Pattern for source lifecycle management
const createSource = async (body) => {
    // 1. Validate required fields
    // 2. Generate unique source ID
    // 3. Set default values for optional fields
    // 4. Store in sources table
    // 5. Return sanitized response
};
```

### 🚨 POTENTIAL PITFALLS AVOIDED

#### 1. MediaConnect Cost Management
- **Issue**: MediaConnect has fixed monthly cost (~$391) regardless of usage
- **Solution**: Documented cost model clearly and justified break-even point
- **Key Lesson**: **Understand AWS pricing models** - MediaConnect is cost-effective for 4+ destinations

#### 2. Backward Compatibility
- **Issue**: Risk of breaking existing destination management
- **Solution**: Enhanced existing functions rather than replacing them
- **Key Lesson**: **Preserve existing functionality** - users depend on current behavior

#### 3. Environment Variable Management
- **Issue**: MediaConnect Flow ARN needed to be configured properly
- **Solution**: Used existing environment variable patterns and documented in lambda-env-vars.json
- **Key Lesson**: **Follow established configuration patterns** - consistency prevents deployment issues

### 📋 MEDIACONNECT DEPLOYMENT CHECKLIST

#### Before Implementation
- [ ] Verify MediaConnect infrastructure is deployed
- [ ] Confirm MediaConnect Flow ARN is available
- [ ] Test MediaConnect permissions in Lambda execution role
- [ ] Backup existing working Lambda function

#### During Implementation
- [ ] Add MediaConnect SDK client to existing AWS services
- [ ] Implement MediaConnect integration functions incrementally
- [ ] Test each function individually before integration
- [ ] Maintain existing API endpoint functionality

#### After Implementation
- [ ] Test source management endpoints
- [ ] Verify granular destination control works
- [ ] Confirm existing destinations still function
- [ ] Monitor MediaConnect costs and usage

### 🎯 MEDIACONNECT SUCCESS METRICS

**Implementation Achievements:**
- ✅ MediaConnect SDK integration completed
- ✅ Source management API fully functional
- ✅ Granular destination control implemented
- ✅ Real-time RTMP output management working
- ✅ Backward compatibility maintained
- ✅ Status synchronization enhanced
- ✅ Error handling comprehensive

**Technical Benefits Realized:**
- ✅ Individual destination start/stop without affecting others
- ✅ No MediaLive channel restarts required
- ✅ Unlimited RTMP destinations with fixed cost
- ✅ Real-time configuration changes
- ✅ Enhanced monitoring and status tracking

---

*This document should be referenced before any future production deployments to avoid repeating these issues.*
