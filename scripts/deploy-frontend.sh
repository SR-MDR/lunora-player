#!/bin/bash

# Lunora Player - Frontend Deployment Script
# Deploys frontend files to S3 and invalidates CloudFront cache
# Usage: Run from project root: ./scripts/deploy-frontend.sh

set -e

# Configuration
S3_BUCKET="lunora-player-streaming-prod-372241484305"
CLOUDFRONT_DISTRIBUTION_ID="E2JYM0YX968BFX"
REGION="us-west-2"
PROFILE="lunora-media"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "🚀 Starting Lunora Player Frontend Deployment..."
echo "📁 Project root: $PROJECT_ROOT"
echo "📁 S3 bucket: $S3_BUCKET"
echo "📁 CloudFront distribution: $CLOUDFRONT_DISTRIBUTION_ID"

cd "$PROJECT_ROOT"

# Verify AWS credentials
print_status "Verifying AWS credentials..."
if aws sts get-caller-identity --profile "$PROFILE" >/dev/null 2>&1; then
    print_success "AWS credentials verified"
else
    print_error "AWS credentials verification failed"
    exit 1
fi

# List files to be deployed
print_status "Files to be deployed:"
find . -type f \( ! -path "./backend/*" ! -path "./node_modules/*" ! -path "./.git/*" ! -name "*.md" ! -name "*.zip" ! -path "./scripts/*" \) | sort | sed 's/^/  /'

# Deploy to S3
print_status "Deploying frontend files to S3..."
aws s3 sync . "s3://$S3_BUCKET/" \
    --exclude "backend/*" \
    --exclude "node_modules/*" \
    --exclude ".git/*" \
    --exclude "*.md" \
    --exclude "*.zip" \
    --exclude "scripts/*" \
    --exclude ".DS_Store" \
    --exclude ".env*" \
    --delete \
    --profile "$PROFILE" \
    --region "$REGION"

if [ $? -eq 0 ]; then
    print_success "Frontend files deployed to S3 successfully"
else
    print_error "S3 deployment failed"
    exit 1
fi

# Invalidate CloudFront cache
print_status "Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Invalidation.Id' \
    --output text)

if [ $? -eq 0 ]; then
    print_success "CloudFront invalidation created: $INVALIDATION_ID"
    print_status "Cache invalidation may take 5-15 minutes to complete"
else
    print_error "CloudFront invalidation failed"
    exit 1
fi

# Test deployment
print_status "Testing deployment..."
sleep 5
HEALTH_RESPONSE=$(curl -s "https://d35au6zpsr51nc.cloudfront.net/streaming.html" | head -1 || echo "FAILED")

if [[ "$HEALTH_RESPONSE" == *"<!DOCTYPE html>"* ]]; then
    print_success "Frontend deployment successful! Site is accessible."
else
    print_warning "Frontend deployed but may still be propagating through CloudFront"
fi

print_success "🎉 Frontend deployment completed!"
echo ""
print_status "Frontend URL: https://d35au6zpsr51nc.cloudfront.net/"
print_status "Streaming Dashboard: https://d35au6zpsr51nc.cloudfront.net/streaming.html"
print_status "Admin Dashboard: https://d35au6zpsr51nc.cloudfront.net/dashboard.html"
print_status "Video Player: https://d35au6zpsr51nc.cloudfront.net/index.html"
