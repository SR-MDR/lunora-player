#!/bin/bash

# Create Fresh Lambda Function for Multi-Destination Streaming API
# This script creates a new Lambda function with proper CORS support

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
AWS_ACCOUNT_ID="372241484305"
FUNCTION_NAME="lunora-player-prod-multi-destination-api"
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/lunora-player-prod-lambda-role"

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
    
    # Check if deployment package exists
    if [ ! -f "lambda-deployment.zip" ]; then
        print_error "Lambda deployment package not found. Please run deploy-lambda-api.sh first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Create Lambda function
create_function() {
    print_status "Creating Lambda function: $FUNCTION_NAME"
    
    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime nodejs22.x \
        --role "$ROLE_ARN" \
        --handler index.handler \
        --zip-file fileb://lambda-deployment.zip \
        --timeout 30 \
        --memory-size 512 \
        --environment Variables="{
            NODE_ENV=$ENVIRONMENT,
            AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID,
            DESTINATIONS_TABLE=lunora-destinations,
            PRESETS_TABLE=lunora-presets,
            SESSIONS_TABLE=lunora-streaming-sessions,
            PARAMETER_STORE_PREFIX=/lunora-player/streaming,
            MEDIALIVE_CHANNEL_ID=3714710,
            MEDIALIVE_REGION=us-west-2
        }" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
    
    print_success "Lambda function created successfully"
}

# Create function URL
create_function_url() {
    print_status "Creating function URL..."
    
    local function_url=$(aws lambda create-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --cors '{
            "AllowCredentials": true,
            "AllowHeaders": ["Content-Type", "Authorization"],
            "AllowMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "AllowOrigins": ["https://d35au6zpsr51nc.cloudfront.net", "http://localhost:3000"],
            "MaxAge": 86400
        }' \
        --auth-type NONE \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'FunctionUrl' \
        --output text)
    
    print_success "Function URL created: $function_url"
    echo "Function URL: $function_url"
}

# Test function
test_function() {
    print_status "Testing Lambda function..."
    
    # Wait a moment for function to be ready
    sleep 5
    
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

# Main function
main() {
    print_status "Creating fresh Lambda function..."
    
    check_prerequisites
    create_function
    create_function_url
    test_function
    
    print_success "Lambda function deployment completed!"
    print_status "The API should now have proper CORS headers and work with the frontend."
    print_warning "Remember to update the frontend API URL if the function URL changed."
}

# Run main function
main "$@"
