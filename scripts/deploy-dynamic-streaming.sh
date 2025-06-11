#!/bin/bash

# Deploy Dynamic Streaming Foundation
# This script deploys the enhanced dynamic streaming infrastructure

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-dynamic-streaming"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to create backup
create_backup() {
    local backup_dir="backups/dynamic-streaming-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    print_status "Creating backup in $backup_dir"
    
    # Backup current Lambda function if it exists
    if aws lambda get-function --function-name "${PROJECT_NAME}-${ENVIRONMENT}-multi-destination-api" --region "$AWS_REGION" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        print_status "Backing up current Lambda function..."
        aws lambda get-function --function-name "${PROJECT_NAME}-${ENVIRONMENT}-multi-destination-api" \
            --region "$AWS_REGION" --profile "$AWS_PROFILE" > "$backup_dir/current-lambda-function.json"
        
        # Download current function code
        local code_url=$(aws lambda get-function --function-name "${PROJECT_NAME}-${ENVIRONMENT}-multi-destination-api" \
            --region "$AWS_REGION" --profile "$AWS_PROFILE" --query 'Code.Location' --output text)
        curl -s "$code_url" -o "$backup_dir/current-lambda-code.zip"
        
        print_success "Lambda function backed up"
    fi
    
    # Backup DynamoDB table data
    print_status "Backing up DynamoDB table data..."
    aws dynamodb scan --table-name "lunora-destinations" --region "$AWS_REGION" --profile "$AWS_PROFILE" \
        > "$backup_dir/destinations-table-backup.json" 2>/dev/null || true
    
    # Save current configuration
    cat > "$backup_dir/deployment-config.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "project_name": "$PROJECT_NAME",
  "environment": "$ENVIRONMENT",
  "aws_region": "$AWS_REGION",
  "stack_name": "$STACK_NAME",
  "backup_reason": "Pre-dynamic-streaming-deployment"
}
EOF
    
    print_success "Backup created in $backup_dir"
    echo "$backup_dir" > .last-backup-path
}

# Function to validate prerequisites
validate_prerequisites() {
    print_status "Validating prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check AWS profile
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        print_error "AWS profile '$AWS_PROFILE' is not configured or invalid"
        exit 1
    fi
    
    # Check MediaConnect flow exists
    local flow_arn="arn:aws:mediaconnect:us-west-2:372241484305:flow:1-DgdVCAEFAAsHBgVS-e049c6465752:lunora-player-prod-srt-router"
    if ! aws mediaconnect describe-flow --flow-arn "$flow_arn" --region "$AWS_REGION" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        print_error "MediaConnect flow not found: $flow_arn"
        exit 1
    fi
    
    # Check required files exist
    local required_files=(
        "aws/cloudformation/dynamic-streaming-foundation.yaml"
        "backend/enhanced-lambda-handler.js"
        "backend/dynamic-destination-manager.js"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done
    
    print_success "Prerequisites validated"
}

# Function to package Lambda function
package_lambda() {
    print_status "Packaging Lambda function..."
    
    local temp_dir=$(mktemp -d)
    local package_dir="$temp_dir/lambda-package"
    mkdir -p "$package_dir"
    
    # Copy Lambda function files
    cp backend/enhanced-lambda-handler.js "$package_dir/"
    cp backend/dynamic-destination-manager.js "$package_dir/"
    
    # Copy package.json and install dependencies
    cat > "$package_dir/package.json" << EOF
{
  "name": "lunora-dynamic-streaming",
  "version": "1.0.0",
  "description": "Dynamic streaming Lambda function",
  "main": "enhanced-lambda-handler.js",
  "dependencies": {
    "aws-sdk": "^2.1692.0"
  }
}
EOF
    
    # Install dependencies
    cd "$package_dir"
    npm install --production
    
    # Create deployment package
    zip -r "../lambda-deployment.zip" . >/dev/null
    
    # Move package to project directory
    mv "../lambda-deployment.zip" "$OLDPWD/lambda-deployment.zip"
    cd "$OLDPWD"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    print_success "Lambda function packaged: lambda-deployment.zip"
}

# Function to deploy CloudFormation stack
deploy_stack() {
    print_status "Deploying CloudFormation stack: $STACK_NAME"
    
    # Validate template
    aws cloudformation validate-template \
        --template-body file://aws/cloudformation/dynamic-streaming-foundation.yaml \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
    
    print_success "CloudFormation template validated"
    
    # Deploy stack
    aws cloudformation deploy \
        --template-file aws/cloudformation/dynamic-streaming-foundation.yaml \
        --stack-name "$STACK_NAME" \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            ProjectName="$PROJECT_NAME" \
            Environment="$ENVIRONMENT" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --no-fail-on-empty-changeset
    
    print_success "CloudFormation stack deployed"
}

# Function to update Lambda function code
update_lambda_code() {
    print_status "Updating Lambda function code..."
    
    local function_name="${PROJECT_NAME}-${ENVIRONMENT}-dynamic-streaming-api"
    
    # Update function code
    aws lambda update-function-code \
        --function-name "$function_name" \
        --zip-file fileb://lambda-deployment.zip \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" >/dev/null
    
    # Wait for update to complete
    print_status "Waiting for Lambda function update to complete..."
    aws lambda wait function-updated \
        --function-name "$function_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
    
    print_success "Lambda function code updated"
}

# Function to test deployment
test_deployment() {
    print_status "Testing deployment..."
    
    # Get API URL from CloudFormation outputs
    local api_url=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs[?OutputKey==`DynamicStreamingApiUrl`].OutputValue' \
        --output text)
    
    if [[ -z "$api_url" ]]; then
        print_error "Failed to get API URL from CloudFormation outputs"
        return 1
    fi
    
    print_status "Testing API endpoint: $api_url"
    
    # Test health check
    local response=$(curl -s -w "%{http_code}" -o /tmp/api-test.json "${api_url}api/destinations" || echo "000")
    
    if [[ "$response" == "200" ]]; then
        print_success "API endpoint is responding correctly"
        print_status "API URL: $api_url"
    else
        print_error "API endpoint test failed (HTTP $response)"
        if [[ -f /tmp/api-test.json ]]; then
            print_error "Response: $(cat /tmp/api-test.json)"
        fi
        return 1
    fi
}

# Function to display deployment summary
display_summary() {
    print_success "Dynamic Streaming Foundation Deployment Complete!"
    echo
    print_status "Deployment Summary:"
    echo "=================="
    
    # Get stack outputs
    local outputs=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs')
    
    echo "$outputs" | jq -r '.[] | "  \(.OutputKey): \(.OutputValue)"'
    
    echo
    print_status "Next Steps:"
    echo "1. Update frontend configuration with new API URL"
    echo "2. Test destination creation and management"
    echo "3. Monitor CloudWatch logs for any issues"
    echo "4. Verify MediaConnect flow integration"
    
    # Save deployment info
    local backup_path=$(cat .last-backup-path 2>/dev/null || echo "backups/latest")
    cat > "$backup_path/deployment-success.json" << EOF
{
  "deployment_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stack_name": "$STACK_NAME",
  "api_outputs": $outputs,
  "status": "success"
}
EOF
}

# Main deployment function
main() {
    echo
    print_status "Starting Dynamic Streaming Foundation Deployment"
    echo "================================================"
    echo
    
    # Create backup
    create_backup
    
    # Validate prerequisites
    validate_prerequisites
    
    # Package Lambda function
    package_lambda
    
    # Deploy CloudFormation stack
    deploy_stack
    
    # Update Lambda function code
    update_lambda_code
    
    # Test deployment
    test_deployment
    
    # Display summary
    display_summary
    
    # Cleanup
    rm -f lambda-deployment.zip
    
    print_success "Deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "validate")
        validate_prerequisites
        aws cloudformation validate-template \
            --template-body file://aws/cloudformation/dynamic-streaming-foundation.yaml \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE"
        print_success "Validation completed"
        ;;
    "package")
        package_lambda
        print_success "Packaging completed"
        ;;
    "deploy")
        main
        ;;
    "test")
        test_deployment
        ;;
    *)
        echo "Usage: $0 [validate|package|deploy|test]"
        echo
        echo "Commands:"
        echo "  validate - Validate prerequisites and CloudFormation template"
        echo "  package  - Package Lambda function only"
        echo "  deploy   - Full deployment (default)"
        echo "  test     - Test deployed API endpoint"
        exit 1
        ;;
esac
