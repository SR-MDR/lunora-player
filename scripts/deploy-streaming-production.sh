#!/bin/bash

# Lunora Player - Multi-Destination Streaming Production Deployment
# This script properly deploys the streaming interface with correct directory structure

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
AWS_ACCOUNT_ID="372241484305"
S3_BUCKET="lunora-player-streaming-prod-372241484305"
CLOUDFRONT_DISTRIBUTION_ID="E2JYM0YX968BFX"

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

print_header() {
    echo ""
    echo "=========================================="
    echo "  $1"
    echo "=========================================="
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    print_success "AWS CLI found"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE &> /dev/null; then
        print_error "AWS credentials not configured for profile: $AWS_PROFILE"
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
    if [ "$account_id" != "$AWS_ACCOUNT_ID" ]; then
        print_error "Wrong AWS account. Expected: $AWS_ACCOUNT_ID, Got: $account_id"
        exit 1
    fi
    print_success "AWS credentials verified for account: $AWS_ACCOUNT_ID"
    
    # Check current branch
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "feature/multi-destination-production" ]; then
        print_warning "Current branch: $current_branch (expected: feature/multi-destination-production)"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    print_success "Branch verified: $current_branch"
}

# Build streaming application with proper directory structure
build_streaming_app() {
    print_header "Building Multi-Destination Streaming Application"
    
    # Clean and create build directory
    local build_dir="dist/streaming-production"
    if [ -d "$build_dir" ]; then
        rm -rf "$build_dir"
        print_success "Cleaned existing build directory"
    fi
    
    mkdir -p "$build_dir"
    print_success "Created build directory: $build_dir"
    
    # Copy main HTML files
    print_status "Copying HTML files..."
    cp streaming.html "$build_dir/"
    cp hls-player.html "$build_dir/"
    print_success "HTML files copied"
    
    # Copy directory structure
    print_status "Copying CSS files..."
    mkdir -p "$build_dir/css"
    cp css/streaming.css "$build_dir/css/"
    cp css/multi-destination.css "$build_dir/css/"
    print_success "CSS files copied"
    
    print_status "Copying JavaScript files..."
    mkdir -p "$build_dir/js"
    cp js/streaming-control.js "$build_dir/js/"
    cp js/multi-destination.js "$build_dir/js/"
    print_success "JavaScript files copied"
    
    print_status "Copying configuration files..."
    mkdir -p "$build_dir/config"
    cp config/streaming-presets.js "$build_dir/config/"
    
    # Create production AWS config
    cat > "$build_dir/config/aws-config.js" << 'EOF'
// Production AWS Configuration for Multi-Destination Streaming
const AWSConfig = {
    region: 'us-west-2',
    apiEndpoint: 'https://smwahluvvvo2lkg3bvxgkzpgqm0ovmqh.lambda-url.us-west-2.on.aws',
    environment: 'production'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AWSConfig;
}
EOF
    print_success "Configuration files copied"
    
    # Update HTML files for production
    print_status "Updating files for production..."
    
    # Add production meta tags to streaming.html
    sed -i.bak 's|<head>|<head>\
    <meta name="environment" content="production">\
    <meta name="build-time" content="'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'">\
    <meta name="version" content="1.0.0">|' "$build_dir/streaming.html"
    
    # Add production meta tags to hls-player.html
    sed -i.bak 's|<head>|<head>\
    <meta name="environment" content="production">\
    <meta name="build-time" content="'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'">\
    <meta name="version" content="1.0.0">|' "$build_dir/hls-player.html"
    
    # Clean up backup files
    rm -f "$build_dir"/*.bak
    
    print_success "Production build completed: $build_dir"
}

# Deploy to S3
deploy_to_s3() {
    print_header "Deploying to S3"
    
    local build_dir="dist/streaming-production"
    
    print_status "Syncing files to S3 bucket: $S3_BUCKET"
    aws s3 sync "$build_dir/" "s3://$S3_BUCKET/" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --delete \
        --exact-timestamps
    
    print_success "Files deployed to S3"
}

# Invalidate CloudFront cache
invalidate_cloudfront() {
    print_header "Invalidating CloudFront Cache"
    
    print_status "Creating invalidation for distribution: $CLOUDFRONT_DISTRIBUTION_ID"
    local invalidation_id=$(aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
        --paths "/*" \
        --profile $AWS_PROFILE \
        --query 'Invalidation.Id' \
        --output text)
    
    print_success "Invalidation created: $invalidation_id"
    
    print_status "Waiting for invalidation to complete..."
    aws cloudfront wait invalidation-completed \
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
        --id $invalidation_id \
        --profile $AWS_PROFILE
    
    print_success "CloudFront cache invalidated"
}

# Verify deployment
verify_deployment() {
    print_header "Verifying Deployment"
    
    print_status "Checking if files are accessible..."
    
    local base_url="https://d35au6zpsr51nc.cloudfront.net"
    local files=("streaming.html" "hls-player.html" "js/multi-destination.js" "css/multi-destination.css")
    
    for file in "${files[@]}"; do
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/$file")
        if [ "$status_code" = "200" ]; then
            print_success "✓ $file (HTTP $status_code)"
        else
            print_error "✗ $file (HTTP $status_code)"
        fi
    done
    
    print_success "Deployment verification completed"
    echo ""
    print_success "🎉 Multi-Destination Streaming deployed successfully!"
    echo ""
    echo "Production URLs:"
    echo "  Streaming Interface: https://d35au6zpsr51nc.cloudfront.net/streaming.html"
    echo "  HLS Player: https://d35au6zpsr51nc.cloudfront.net/hls-player.html"
}

# Main deployment function
main() {
    print_header "Lunora Player - Multi-Destination Streaming Production Deployment"
    
    check_prerequisites
    build_streaming_app
    deploy_to_s3
    invalidate_cloudfront
    verify_deployment
    
    print_header "Deployment Complete"
    print_success "All operations completed successfully!"
}

# Run deployment
main "$@"
