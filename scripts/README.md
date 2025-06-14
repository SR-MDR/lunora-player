# Lunora Player - Deployment Scripts

This folder contains all deployment and verification scripts for the Lunora Player streaming system.

## 📋 Available Scripts

### 🚀 Deployment Scripts

#### `deploy-all.sh`
**Complete deployment pipeline** - Deploys both backend and frontend, then verifies both deployments.
```bash
./scripts/deploy-all.sh
```
**What it does:**
1. Deploys backend Lambda function
2. Deploys frontend to S3/CloudFront
3. Verifies backend deployment
4. Verifies frontend deployment
5. Provides complete status summary

#### `deploy-backend.sh`
**Backend Lambda deployment** - Packages and deploys the backend Lambda function.
```bash
./scripts/deploy-backend.sh
```
**What it does:**
- Analyzes dependencies systematically
- Creates clean deployment package
- Deploys to AWS Lambda
- Tests health endpoint
- Cleans up temporary files

#### `deploy-frontend.sh`
**Frontend deployment** - Deploys frontend files to S3 and invalidates CloudFront cache.
```bash
./scripts/deploy-frontend.sh
```
**What it does:**
- Syncs frontend files to S3 bucket
- Excludes backend, node_modules, and other non-frontend files
- Invalidates CloudFront cache
- Tests frontend accessibility

### 🔍 Verification Scripts

#### `verify-backend-deployment.sh`
**Backend verification** - Downloads deployed Lambda code and compares with local files.
```bash
./scripts/verify-backend-deployment.sh
```
**What it verifies:**
- All backend files match deployed Lambda exactly
- Lambda configuration (runtime, handler, memory, timeout)
- No missing or extra files in deployment

#### `verify-frontend-deployment.sh`
**Frontend verification** - Compares all local frontend files with deployed CloudFront versions.
```bash
./scripts/verify-frontend-deployment.sh
```
**What it verifies:**
- All 35+ frontend files match CloudFront deployment exactly
- No missing files in deployment
- Complete synchronization between local and deployed

## 🎯 Recommended Usage

### For Complete Deployment
```bash
# Deploy everything and verify
./scripts/deploy-all.sh
```

### For Individual Components
```bash
# Backend only
./scripts/deploy-backend.sh
./scripts/verify-backend-deployment.sh

# Frontend only
./scripts/deploy-frontend.sh
./scripts/verify-frontend-deployment.sh
```

### For Verification Only
```bash
# Verify current deployments without deploying
./scripts/verify-backend-deployment.sh
./scripts/verify-frontend-deployment.sh
```

## 📁 File Structure

```
scripts/
├── README.md                           # This documentation
├── deploy-all.sh                       # Complete deployment pipeline
├── deploy-backend.sh                   # Backend Lambda deployment
├── deploy-frontend.sh                  # Frontend S3/CloudFront deployment
├── verify-backend-deployment.sh        # Backend verification
└── verify-frontend-deployment.sh       # Frontend verification
```

## ✅ Prerequisites

- AWS CLI configured with `lunora-media` profile
- Appropriate AWS permissions for Lambda, S3, and CloudFront
- Run all scripts from the project root directory

## 🔧 Configuration

All scripts are pre-configured with:
- **AWS Region**: us-west-2
- **AWS Profile**: lunora-media
- **S3 Bucket**: lunora-player-streaming-prod-372241484305
- **CloudFront Distribution**: E2JYM0YX968BFX
- **Lambda Function**: lunora-player-prod-dynamic-streaming-api

## 📊 Exit Codes

- **0**: Success
- **1**: Failure (check output for details)

All scripts provide colored output and detailed status information for easy troubleshooting.
