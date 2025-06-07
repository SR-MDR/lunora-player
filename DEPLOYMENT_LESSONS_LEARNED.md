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

*This document should be referenced before any future production deployments to avoid repeating these issues.*
