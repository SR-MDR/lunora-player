#!/bin/bash

# Lunora Player - Complete Deployment Script
# Deploys both backend Lambda and frontend, then verifies both deployments
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

print_header "Lunora Player - Complete Deployment"
echo "📁 Project root: $PROJECT_ROOT"
echo "🕐 Started at: $(date)"

cd "$PROJECT_ROOT"

# Step 1: Deploy Backend
print_header "Step 1: Backend Lambda Deployment"
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
print_header "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
print_success "✅ Backend Lambda: Deployed and verified"
print_success "✅ Frontend: Deployed and verified"
echo ""
print_status "🔗 Application URLs:"
echo "   Frontend: https://d35au6zpsr51nc.cloudfront.net/"
echo "   Streaming: https://d35au6zpsr51nc.cloudfront.net/streaming.html"
echo "   Dashboard: https://d35au6zpsr51nc.cloudfront.net/dashboard.html"
echo "   Backend API: https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/"
echo ""
print_status "🕐 Completed at: $(date)"
print_status "⏱️  Total deployment time: $SECONDS seconds"
