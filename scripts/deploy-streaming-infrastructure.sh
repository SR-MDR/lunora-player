#!/bin/bash

# Lunora Player - Deploy Streaming Infrastructure
# Creates MediaLive + MediaPackage infrastructure for multi-source streaming

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"

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

# Function to check if stack exists
stack_exists() {
    local stack_name=$1
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --output text \
        --query 'Stacks[0].StackStatus' 2>/dev/null || echo "DOES_NOT_EXIST"
}

# Function to wait for stack operation
wait_for_stack() {
    local stack_name=$1
    local operation=$2
    
    print_status "Waiting for stack $operation to complete: $stack_name"
    
    aws cloudformation wait "stack-${operation}-complete" \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
    
    if [ $? -eq 0 ]; then
        print_success "Stack $operation completed: $stack_name"
    else
        print_error "Stack $operation failed: $stack_name"
        exit 1
    fi
}

# Function to deploy infrastructure stack
deploy_infrastructure() {
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-infrastructure"
    local template_file="aws/cloudformation/streaming-infrastructure.yaml"
    
    print_status "Deploying infrastructure stack: $stack_name"
    
    local stack_status=$(stack_exists "$stack_name")
    
    if [ "$stack_status" = "DOES_NOT_EXIST" ]; then
        print_status "Creating new infrastructure stack..."
        aws cloudformation create-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters \
                ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
                ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
                ParameterKey=InputType,ParameterValue="RTMP_PUSH" \
                ParameterKey=EnableRedundancy,ParameterValue="false" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE"
        
        wait_for_stack "$stack_name" "create"
    else
        print_status "Updating existing infrastructure stack..."
        aws cloudformation update-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters \
                ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
                ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
                ParameterKey=InputType,ParameterValue="RTMP_PUSH" \
                ParameterKey=EnableRedundancy,ParameterValue="false" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE" 2>/dev/null || {
            print_warning "No changes to infrastructure stack"
        }
        
        if [ $? -eq 0 ]; then
            wait_for_stack "$stack_name" "update"
        fi
    fi
}

# Function to get stack outputs
get_stack_output() {
    local stack_name=$1
    local output_key=$2
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text
}

# Function to deploy MediaLive channel
deploy_medialive_channel() {
    local infra_stack="${PROJECT_NAME}-${ENVIRONMENT}-infrastructure"
    local channel_stack="${PROJECT_NAME}-${ENVIRONMENT}-medialive"
    local template_file="aws/cloudformation/medialive-channel.yaml"
    
    print_status "Getting infrastructure outputs..."
    
    local channel_id=$(get_stack_output "$infra_stack" "MediaPackageChannelId")
    local role_arn=$(get_stack_output "$infra_stack" "MediaLiveRoleArn")
    local sg_id=$(get_stack_output "$infra_stack" "SecurityGroupId")
    local subnet_ids=$(get_stack_output "$infra_stack" "SubnetIds")

    if [ -z "$channel_id" ] || [ -z "$role_arn" ] || [ -z "$sg_id" ] || [ -z "$subnet_ids" ]; then
        print_error "Failed to get required infrastructure outputs"
        print_error "channel_id: $channel_id"
        print_error "role_arn: $role_arn"
        print_error "sg_id: $sg_id"
        print_error "subnet_ids: $subnet_ids"
        exit 1
    fi
    
    print_status "Deploying MediaLive channel stack: $channel_stack"
    
    local stack_status=$(stack_exists "$channel_stack")
    
    if [ "$stack_status" = "DOES_NOT_EXIST" ]; then
        print_status "Creating new MediaLive channel stack..."
        aws cloudformation create-stack \
            --stack-name "$channel_stack" \
            --template-body "file://$template_file" \
            --parameters \
                ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
                ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
                ParameterKey=InputType,ParameterValue="RTMP_PUSH" \
                ParameterKey=EnableRedundancy,ParameterValue="false" \
                ParameterKey=MediaPackageChannelId,ParameterValue="$channel_id" \
                ParameterKey=MediaLiveRoleArn,ParameterValue="$role_arn" \
                ParameterKey=SecurityGroupId,ParameterValue="$sg_id" \
                ParameterKey=SubnetIds,ParameterValue="$subnet_ids" \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE"
        
        wait_for_stack "$channel_stack" "create"
    else
        print_status "Updating existing MediaLive channel stack..."
        aws cloudformation update-stack \
            --stack-name "$channel_stack" \
            --template-body "file://$template_file" \
            --parameters \
                ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
                ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
                ParameterKey=InputType,ParameterValue="RTMP_PUSH" \
                ParameterKey=EnableRedundancy,ParameterValue="false" \
                ParameterKey=MediaPackageChannelId,ParameterValue="$channel_id" \
                ParameterKey=MediaLiveRoleArn,ParameterValue="$role_arn" \
                ParameterKey=SecurityGroupId,ParameterValue="$sg_id" \
                ParameterKey=SubnetIds,ParameterValue="$subnet_ids" \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE" 2>/dev/null || {
            print_warning "No changes to MediaLive channel stack"
        }
        
        if [ $? -eq 0 ]; then
            wait_for_stack "$channel_stack" "update"
        fi
    fi
}

# Function to display connection information
show_connection_info() {
    local infra_stack="${PROJECT_NAME}-${ENVIRONMENT}-infrastructure"
    local channel_stack="${PROJECT_NAME}-${ENVIRONMENT}-medialive"
    
    print_success "Streaming infrastructure deployed successfully!"
    echo
    print_status "Connection Information:"
    echo
    
    # MediaPackage HLS endpoint
    local hls_url=$(get_stack_output "$infra_stack" "MediaPackageHLSEndpoint")
    echo -e "${GREEN}HLS Player URL:${NC} $hls_url"
    echo
    
    # MediaLive RTMP endpoint
    local rtmp_endpoint=$(get_stack_output "$channel_stack" "PrimaryInputEndpoint")
    if [ -n "$rtmp_endpoint" ]; then
        echo -e "${GREEN}OBS RTMP Settings:${NC}"
        echo "  Server: ${rtmp_endpoint%/*}"
        echo "  Stream Key: ${rtmp_endpoint##*/}"
    fi
    echo
    
    # MediaLive channel ID
    local channel_id=$(get_stack_output "$channel_stack" "MediaLiveChannelId")
    echo -e "${GREEN}MediaLive Channel ID:${NC} $channel_id"
    echo
    
    print_warning "Remember to start the MediaLive channel before streaming!"
    echo "Use: aws medialive start-channel --channel-id $channel_id --region $AWS_REGION --profile $AWS_PROFILE"
}

# Main execution
main() {
    print_status "Starting Lunora Player streaming infrastructure deployment"
    print_status "Project: $PROJECT_NAME, Environment: $ENVIRONMENT, Region: $AWS_REGION"
    echo
    
    # Check AWS CLI and profile
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
        print_error "AWS CLI not configured or profile '$AWS_PROFILE' not found"
        exit 1
    fi
    
    # Deploy infrastructure
    deploy_infrastructure
    
    # Deploy MediaLive channel
    deploy_medialive_channel
    
    # Show connection information
    show_connection_info
    
    print_success "Deployment completed successfully!"
}

# Run main function
main "$@"
