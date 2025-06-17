#!/bin/bash

# Lunora Player - Complete Deployment Script
# AWS SDK v3 Compatible - Deploys both backend Lambda and frontend, then verifies both deployments
# Includes AWS SDK v3 migration benefits: better CloudWatch integration, smaller bundles
# Usage: Run from project root: ./scripts/deploy-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_header "Lunora Player - Complete Deployment (AWS SDK v3)"
echo "📁 Project root: $PROJECT_ROOT"
echo "🕐 Started at: $(date)"
echo "🔧 AWS SDK v3 Migration: Improved performance and CloudWatch integration"

# Verify we're in the right place
if [ ! -f "$PROJECT_ROOT/backend/index.js" ] || [ ! -f "$PROJECT_ROOT/streaming.html" ]; then
    print_error "Project files not found. Are you running from the project root?"
    exit 1
fi

cd "$PROJECT_ROOT"

# Step 1: Deploy Backend (AWS SDK v3)
print_header "Step 1: Backend Lambda Deployment (AWS SDK v3)"
print_status "Deploying with improved CloudWatch integration and smaller bundle size..."
if ./scripts/deploy-backend.sh; then
    print_success "Backend deployment completed successfully"
else
    print_error "Backend deployment failed"
    exit 1
fi

# Step 2: Deploy Frontend
print_header "Step 2: Frontend Deployment"
if ./scripts/deploy-frontend.sh; then
    print_success "Frontend deployment completed successfully"
else
    print_error "Frontend deployment failed"
    exit 1
fi

# Step 3: Verify Backend
print_header "Step 3: Backend Verification"
if ./scripts/verify-backend-deployment.sh; then
    print_success "Backend verification passed"
else
    print_error "Backend verification failed"
    exit 1
fi

# Step 4: Verify Frontend
print_header "Step 4: Frontend Verification"
if ./scripts/verify-frontend-deployment.sh; then
    print_success "Frontend verification passed"
else
    print_error "Frontend verification failed"
    exit 1
fi

# Final Summary
print_header "🎉 AWS SDK v3 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
print_success "✅ Backend Lambda: Deployed with AWS SDK v3 and verified"
print_success "✅ Frontend: Deployed and verified"
echo ""
print_status "🔗 Application URLs:"
echo "   Frontend: https://d35au6zpsr51nc.cloudfront.net/"
echo "   Streaming: https://d35au6zpsr51nc.cloudfront.net/streaming.html"
echo "   Dashboard: https://d35au6zpsr51nc.cloudfront.net/dashboard.html"
echo "   Backend API: https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/"
echo ""
print_status "🚀 AWS SDK v3 Migration Benefits:"
echo "   📈 Improved CloudWatch integration for better MediaConnect monitoring"
echo "   📦 Smaller Lambda bundle size with tree-shaking"
echo "   ⚡ Better performance and faster cold starts"
echo "   🔧 Enhanced error handling and debugging"
echo ""
print_status "🕐 Completed at: $(date)"
print_status "⏱️  Total deployment time: $SECONDS seconds"
