#!/bin/bash

# Deploy Lambda Function for Multi-Destination Streaming API
# This script packages and deploys the Lambda function with proper CORS support

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
FUNCTION_NAME="lunora-player-prod-multi-destination-api"

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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    if ! command -v zip &> /dev/null; then
        print_error "zip command not found. Please install zip."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE &> /dev/null; then
        print_error "AWS credentials not configured for profile: $AWS_PROFILE"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Create deployment package
create_package() {
    print_status "Creating Lambda deployment package..."
    
    # Create temporary directory
    local temp_dir=$(mktemp -d)
    local package_dir="$temp_dir/lambda-package"
    mkdir -p "$package_dir"
    
    # Copy Lambda handler
    cp backend/lambda-handler.js "$package_dir/index.js"
    
    # Create package.json for dependencies
    cat > "$package_dir/package.json" << 'EOF'
{
  "name": "lunora-multi-destination-api",
  "version": "1.0.0",
  "description": "Multi-destination streaming API for Lunora Player",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1691.0"
  }
}
EOF
    
    # Install dependencies
    cd "$package_dir"
    npm install --production
    
    # Create deployment zip
    zip -r ../lambda-deployment.zip . -x "*.git*" "*.DS_Store*"
    
    # Move zip to project root
    local project_root="$OLDPWD"
    mv ../lambda-deployment.zip "$project_root/lambda-deployment.zip"
    cd "$project_root"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    print_success "Deployment package created: lambda-deployment.zip"
}

# Update Lambda function
update_function() {
    print_status "Updating Lambda function: $FUNCTION_NAME"
    
    # Update function code
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://lambda-deployment.zip \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
    
    print_success "Lambda function code updated"
    
    # Update function configuration
    print_status "Updating function configuration..."
    
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --runtime nodejs22.x \
        --timeout 30 \
        --memory-size 512 \
        --environment Variables="{
            NODE_ENV=$ENVIRONMENT,
            DESTINATIONS_TABLE=lunora-destinations,
            PRESETS_TABLE=lunora-presets,
            SESSIONS_TABLE=lunora-streaming-sessions,
            PARAMETER_STORE_PREFIX=/lunora-player/streaming,
            MEDIALIVE_CHANNEL_ID=3714710,
            MEDIALIVE_REGION=us-west-2
        }" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
    
    print_success "Lambda function configuration updated"
}

# Test function
test_function() {
    print_status "Testing Lambda function..."
    
    # Create test event
    cat > test-event.json << 'EOF'
{
  "httpMethod": "GET",
  "path": "/api/destinations",
  "headers": {
    "Content-Type": "application/json",
    "Origin": "https://d35au6zpsr51nc.cloudfront.net"
  },
  "body": null
}
EOF
    
    # Invoke function
    aws lambda invoke \
        --function-name "$FUNCTION_NAME" \
        --payload fileb://test-event.json \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        response.json
    
    # Check response
    if [ -f response.json ]; then
        print_status "Function response:"
        cat response.json | jq '.'
        rm -f response.json
    fi
    
    # Cleanup
    rm -f test-event.json
    
    print_success "Function test completed"
}

# Get function URL
get_function_url() {
    print_status "Getting function URL..."
    
    local function_url=$(aws lambda get-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'FunctionUrl' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$function_url" ]; then
        print_success "Function URL: $function_url"
    else
        print_warning "No function URL configured"
    fi
}

# Main function
main() {
    print_status "Starting Lambda function deployment..."
    
    check_prerequisites
    create_package
    update_function
    test_function
    get_function_url
    
    # Cleanup
    rm -f lambda-deployment.zip
    
    print_success "Lambda function deployment completed!"
    print_status "The API should now have proper CORS headers and work with the frontend."
}

# Run main function
main "$@"
