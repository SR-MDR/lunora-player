#!/bin/bash

# Lunora Player - Production Deployment with SRT Ingest
# This script deploys the complete Lunora Player system with SRT ingest capability

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
ACCOUNT_ID="372241484305"

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
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    print_success "AWS CLI found"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js."
        exit 1
    fi
    print_success "Node.js found"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE >/dev/null 2>&1; then
        print_error "AWS credentials not configured for profile: $AWS_PROFILE"
        print_status "Please run: aws configure --profile $AWS_PROFILE"
        exit 1
    fi
    
    # Verify account ID
    local current_account=$(aws sts get-caller-identity --profile $AWS_PROFILE --query 'Account' --output text)
    if [ "$current_account" != "$ACCOUNT_ID" ]; then
        print_error "Wrong AWS account. Expected: $ACCOUNT_ID, Got: $current_account"
        exit 1
    fi
    print_success "AWS credentials verified for account: $ACCOUNT_ID"
    
    # Check if domain and certificate are provided
    if [ -z "$DOMAIN_NAME" ]; then
        print_warning "DOMAIN_NAME not set. Using CloudFront default domains."
        DOMAIN_NAME="cloudfront.net"
        USE_CUSTOM_DOMAIN=false
    else
        USE_CUSTOM_DOMAIN=true
    fi

    if [ -z "$CERTIFICATE_ARN" ] && [ "$USE_CUSTOM_DOMAIN" = "true" ]; then
        print_warning "CERTIFICATE_ARN not set. Using CloudFront default SSL."
        USE_CUSTOM_DOMAIN=false
    fi
    
    print_success "Domain: $DOMAIN_NAME"
    print_success "Certificate: $CERTIFICATE_ARN"
}

# Deploy MediaLive with SRT input
deploy_medialive_srt() {
    print_header "Deploying MediaLive with SRT Input"
    
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-medialive-srt"
    
    print_status "Creating MediaLive stack with SRT input..."
    
    # Create the MediaLive stack with SRT input
    aws cloudformation deploy \
        --template-file aws/cloudformation/medialive-srt.yaml \
        --stack-name $stack_name \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            ProjectName=$PROJECT_NAME \
            Environment=$ENVIRONMENT \
            MediaPackageChannelId=lunora-player-dev-channel
    
    if [ $? -eq 0 ]; then
        print_success "MediaLive SRT stack deployed successfully"
    else
        print_error "MediaLive SRT stack deployment failed"
        exit 1
    fi
    
    # Get MediaLive input details
    print_status "Retrieving MediaLive SRT input details..."
    local srt_input_url=$(aws cloudformation describe-stacks \
        --stack-name $stack_name \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'Stacks[0].Outputs[?OutputKey==`SRTInputURL`].OutputValue' \
        --output text)
    
    local channel_id=$(aws cloudformation describe-stacks \
        --stack-name $stack_name \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaLiveChannelId`].OutputValue' \
        --output text)
    
    print_success "SRT Input URL: $srt_input_url"
    print_success "MediaLive Channel ID: $channel_id"
    
    # Store these values for later use
    export SRT_INPUT_URL="$srt_input_url"
    export MEDIALIVE_CHANNEL_ID="$channel_id"
}

# Build frontend applications
build_frontend() {
    print_header "Building Frontend Applications"
    
    print_status "Installing dependencies..."
    npm install
    
    print_status "Building player application..."
    mkdir -p dist/player
    cp index.html dist/player/
    cp -r css dist/player/
    cp -r js dist/player/
    cp -r config dist/player/
    
    # Update config for production
    sed -i.bak "s|http://localhost:3000/api|https://api.${DOMAIN_NAME}|g" dist/player/config/aws-config.js
    sed -i.bak "s|http://localhost:3000/api|https://api.${DOMAIN_NAME}|g" dist/player/js/dashboard.js
    
    print_status "Building dashboard application..."
    mkdir -p dist/dashboard
    cp dashboard.html dist/dashboard/
    cp -r css dist/dashboard/
    cp -r js dist/dashboard/
    cp -r config dist/dashboard/
    
    print_status "Building Videon test application..."
    mkdir -p dist/videon
    cp videon-test.html dist/videon/
    
    # Update API endpoints for production
    sed -i.bak "s|http://localhost:3000/api|https://api.${DOMAIN_NAME}|g" dist/videon/videon-test.html
    
    print_success "Frontend applications built successfully"
}

# Deploy infrastructure
deploy_infrastructure() {
    print_header "Deploying Production Infrastructure"
    
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-infrastructure"
    
    print_status "Deploying CloudFormation stack: $stack_name"
    
    local params="ProjectName=$PROJECT_NAME Environment=$ENVIRONMENT"

    if [ "$USE_CUSTOM_DOMAIN" = "true" ]; then
        params="$params DomainName=$DOMAIN_NAME CertificateArn=$CERTIFICATE_ARN"
    else
        params="$params DomainName=example.com"
    fi

    aws cloudformation deploy \
        --template-file aws/cloudformation/production-stack.yaml \
        --stack-name $stack_name \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides $params
    
    if [ $? -eq 0 ]; then
        print_success "Infrastructure deployed successfully"
    else
        print_error "Infrastructure deployment failed"
        exit 1
    fi
    
    # Get stack outputs
    print_status "Retrieving stack outputs..."
    aws cloudformation describe-stacks \
        --stack-name $stack_name \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'Stacks[0].Outputs' \
        --output table
}

# Deploy media services
deploy_media_services() {
    print_header "Deploying Media Services"
    
    print_status "Deploying MediaPackage and related services..."
    
    # Deploy the existing media services stack for production
    aws cloudformation deploy \
        --template-file aws/cloudformation/media-services-simple.yaml \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-media-services" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            ProjectName=$PROJECT_NAME \
            Environment=$ENVIRONMENT
    
    print_success "Media services deployed successfully"
}

# Main deployment function
main() {
    print_header "Lunora Player - Production Deployment with SRT Ingest"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN_NAME="$2"
                shift 2
                ;;
            --certificate)
                CERTIFICATE_ARN="$2"
                shift 2
                ;;
            --profile)
                AWS_PROFILE="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --domain DOMAIN        Domain name (e.g., yourdomain.com)"
                echo "  --certificate ARN      SSL certificate ARN"
                echo "  --profile PROFILE      AWS profile (default: lunora-media)"
                echo "  --region REGION        AWS region (default: us-west-2)"
                echo "  --help                 Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_status "Configuration:"
    print_status "  Project: $PROJECT_NAME"
    print_status "  Environment: $ENVIRONMENT"
    print_status "  Region: $AWS_REGION"
    print_status "  Profile: $AWS_PROFILE"
    print_status "  Account: $ACCOUNT_ID"
    print_status "  Domain: ${DOMAIN_NAME:-'Not set'}"
    print_status "  Certificate: ${CERTIFICATE_ARN:-'Not set'}"
    
    # Run deployment steps
    check_prerequisites
    deploy_media_services
    deploy_medialive_srt
    build_frontend
    deploy_infrastructure
    
    print_header "Deployment Complete"
    print_success "Lunora Player with SRT ingest has been deployed to production!"
}

# Run main function with all arguments
main "$@"
