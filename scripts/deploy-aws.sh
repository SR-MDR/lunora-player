#!/bin/bash

# Lunora Player - AWS Infrastructure Deployment Script
# This script deploys the AWS Media Services infrastructure using CloudFormation

set -e  # Exit on any error

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="${ENVIRONMENT:-dev}"
REGION="${AWS_REGION:-us-west-2}"
TARGET_ACCOUNT_ID="372241484305"  # Lunora-Media-Services account
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-media-services"
TEMPLATE_FILE="aws/cloudformation/media-services.yaml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check if AWS CLI is installed and configured
check_aws_cli() {
    print_status "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured or credentials are invalid."
        print_status "Please run 'aws configure' to set up your credentials."
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local current_region=$(aws configure get region)

    print_success "AWS CLI is configured"
    print_status "Account ID: $account_id"
    print_status "Current Region: $current_region"
    print_status "Target Account: $TARGET_ACCOUNT_ID (Lunora-Media-Services)"

    if [ "$account_id" != "$TARGET_ACCOUNT_ID" ]; then
        print_warning "Current account ($account_id) differs from target account ($TARGET_ACCOUNT_ID)"
        print_status "Please switch to the Lunora-Media-Services account or use cross-account role"
        print_status "You can use: aws sts assume-role or aws configure --profile lunora-media"
    fi

    if [ "$current_region" != "$REGION" ]; then
        print_warning "Current region ($current_region) differs from target region ($REGION)"
        print_status "Using target region: $REGION"
    fi
}

# Function to validate CloudFormation template
validate_template() {
    print_status "Validating CloudFormation template..."
    
    if [ ! -f "$TEMPLATE_FILE" ]; then
        print_error "Template file not found: $TEMPLATE_FILE"
        exit 1
    fi
    
    aws cloudformation validate-template \
        --template-body file://$TEMPLATE_FILE \
        --region $REGION > /dev/null
    
    print_success "Template validation passed"
}

# Function to check if stack exists
stack_exists() {
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION &> /dev/null
}

# Function to deploy or update stack
deploy_stack() {
    local action
    local video_bucket_name="lunora-media-videos"
    
    if stack_exists; then
        action="update"
        print_status "Updating existing stack: $STACK_NAME"
    else
        action="create"
        print_status "Creating new stack: $STACK_NAME"
    fi
    
    print_status "Deploying CloudFormation stack..."
    
    aws cloudformation deploy \
        --template-file $TEMPLATE_FILE \
        --stack-name $STACK_NAME \
        --region $REGION \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            ProjectName=$PROJECT_NAME \
            Environment=$ENVIRONMENT \
            VideoBucketName=$video_bucket_name \
        --tags \
            Project=$PROJECT_NAME \
            Environment=$ENVIRONMENT \
            ManagedBy=CloudFormation
    
    if [ $? -eq 0 ]; then
        print_success "Stack deployment completed successfully"
    else
        print_error "Stack deployment failed"
        exit 1
    fi
}

# Function to get stack outputs
get_stack_outputs() {
    print_status "Retrieving stack outputs..."
    
    local outputs=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs' \
        --output table)
    
    echo "$outputs"
    
    # Extract specific outputs for configuration
    local hls_endpoint=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaPackageHLSEndpointUrl`].OutputValue' \
        --output text)
    
    local cloudfront_domain=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
        --output text)
    
    local video_bucket=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`VideoBucketName`].OutputValue' \
        --output text)
    
    # Update configuration file
    update_config_file "$hls_endpoint" "$cloudfront_domain" "$video_bucket"
}

# Function to update player configuration
update_config_file() {
    local hls_endpoint="$1"
    local cloudfront_domain="$2"
    local video_bucket="$3"
    
    print_status "Updating player configuration..."
    
    # Create AWS config file
    cat > config/aws-config.js << EOF
// AWS Configuration - Auto-generated by deployment script
const AWSConfig = {
    region: '$REGION',
    mediaPackage: {
        hlsEndpoint: '$hls_endpoint'
    },
    cloudFront: {
        domain: '$cloudfront_domain'
    },
    s3: {
        bucket: '$video_bucket'
    },
    stackName: '$STACK_NAME',
    environment: '$ENVIRONMENT'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AWSConfig;
}
EOF
    
    print_success "Configuration file updated: config/aws-config.js"
    
    # Update the main player config with actual values
    if [ -f "config/player-config.js" ]; then
        print_status "Updating main player configuration..."
        
        # Use sed to replace placeholder values (macOS compatible)
        sed -i '' "s|your-mediapackage-endpoint.mediapackage.us-west-2.amazonaws.com/out/v1/your-channel-id/index.m3u8|${hls_endpoint}|g" config/player-config.js
        sed -i '' "s|your-cloudfront-domain.cloudfront.net|${cloudfront_domain}|g" config/player-config.js
        sed -i '' "s|your-video-bucket|${video_bucket}|g" config/player-config.js
        
        print_success "Player configuration updated"
    fi
}

# Function to start MediaLive channel
start_medialive_channel() {
    print_status "Starting MediaLive channel..."
    
    local channel_id=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaLiveChannelId`].OutputValue' \
        --output text)
    
    if [ -n "$channel_id" ]; then
        aws medialive start-channel \
            --channel-id $channel_id \
            --region $REGION > /dev/null
        
        print_success "MediaLive channel started: $channel_id"
        print_warning "Note: Starting the channel will incur AWS charges"
    else
        print_error "Could not find MediaLive channel ID"
    fi
}

# Function to display next steps
show_next_steps() {
    print_success "Deployment completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "1. Configure your Videon Edge node to send SRT stream to the MediaLive input"
    echo "2. Start the MediaLive channel (this will incur charges):"
    echo "   ./scripts/deploy-aws.sh start-channel"
    echo "3. Test the player with the test stream first"
    echo "4. Open index.html in your browser to test the player"
    echo ""
    print_status "Configuration files updated:"
    echo "- config/aws-config.js"
    echo "- config/player-config.js"
}

# Main execution
main() {
    echo "=========================================="
    echo "  Lunora Player - AWS Deployment Script"
    echo "=========================================="
    echo ""
    
    case "${1:-deploy}" in
        "deploy")
            check_aws_cli
            validate_template
            deploy_stack
            get_stack_outputs
            show_next_steps
            ;;
        "start-channel")
            check_aws_cli
            start_medialive_channel
            ;;
        "outputs")
            check_aws_cli
            get_stack_outputs
            ;;
        "validate")
            check_aws_cli
            validate_template
            print_success "Template is valid"
            ;;
        *)
            echo "Usage: $0 [deploy|start-channel|outputs|validate]"
            echo ""
            echo "Commands:"
            echo "  deploy        - Deploy the AWS infrastructure (default)"
            echo "  start-channel - Start the MediaLive channel"
            echo "  outputs       - Show stack outputs"
            echo "  validate      - Validate CloudFormation template"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
