#!/bin/bash
set -e

echo "🔍 Starting pre-deployment validation for SRT → MediaConnect → Multi-MediaLive..."

# Configuration
ENVIRONMENT="prod"
PROJECT_NAME="lunora-player"
REGION="us-west-2"
PROFILE="lunora-media"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Validate AWS credentials and permissions
echo "🔐 Validating AWS credentials..."
if aws sts get-caller-identity --profile $PROFILE > /dev/null 2>&1; then
    ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query 'Account' --output text)
    print_status "AWS credentials valid for account: $ACCOUNT_ID"
else
    print_error "AWS credentials validation failed"
    exit 1
fi

# 2. Validate CloudFormation templates
echo "📋 Validating CloudFormation templates..."

# Validate Dynamic Streaming Foundation template
if aws cloudformation validate-template \
    --template-body file://aws/cloudformation/dynamic-streaming-foundation.yaml \
    --profile $PROFILE > /dev/null 2>&1; then
    print_status "Dynamic Streaming Foundation template is valid"
else
    print_error "Dynamic Streaming Foundation template validation failed"
    exit 1
fi

# 3. Check existing MediaConnect flow
echo "🌐 Checking existing MediaConnect flow..."
EXISTING_FLOW=$(aws mediaconnect list-flows \
    --region $REGION \
    --profile $PROFILE \
    --query 'Flows[?Name==`lunora-player-prod-srt-router`].FlowArn' \
    --output text 2>/dev/null || echo "")

if [ ! -z "$EXISTING_FLOW" ]; then
    print_status "MediaConnect flow found: $EXISTING_FLOW"
    echo "This flow will be used for dynamic streaming."
else
    print_error "Required MediaConnect flow not found"
    exit 1
fi

# 4. Validate current MediaLive channel
echo "📺 Validating current MediaLive channel..."
CURRENT_CHANNEL_STATE=$(aws medialive describe-channel \
    --channel-id 3714710 \
    --region $REGION \
    --profile $PROFILE \
    --query 'State' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$CURRENT_CHANNEL_STATE" != "NOT_FOUND" ]; then
    print_status "Current MediaLive channel (3714710) state: $CURRENT_CHANNEL_STATE"
else
    print_error "Current MediaLive channel (3714710) not found"
    exit 1
fi

# 5. Check DynamoDB tables
echo "🗄️  Validating DynamoDB tables..."

# Check destinations table
DESTINATIONS_TABLE_STATUS=$(aws dynamodb describe-table \
    --table-name lunora-destinations \
    --region $REGION \
    --profile $PROFILE \
    --query 'Table.TableStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$DESTINATIONS_TABLE_STATUS" = "ACTIVE" ]; then
    print_status "Destinations table is active"
else
    print_error "Destinations table not found or not active: $DESTINATIONS_TABLE_STATUS"
    exit 1
fi

# Check presets table
PRESETS_TABLE_STATUS=$(aws dynamodb describe-table \
    --table-name lunora-presets \
    --region $REGION \
    --profile $PROFILE \
    --query 'Table.TableStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$PRESETS_TABLE_STATUS" = "ACTIVE" ]; then
    print_status "Presets table is active"
else
    print_warning "Presets table not found: $PRESETS_TABLE_STATUS"
    echo "Will be created during deployment if needed"
fi

# 6. Validate Lambda function
echo "⚡ Validating Lambda function..."
LAMBDA_STATE=$(aws lambda get-function \
    --function-name lunora-player-prod-dynamic-streaming-api \
    --region $REGION \
    --profile $PROFILE \
    --query 'Configuration.State' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$LAMBDA_STATE" = "Active" ]; then
    print_status "Lambda function is active"
else
    print_warning "Lambda function not found or not active: $LAMBDA_STATE"
    echo "Will be created during deployment"
fi

# 7. Check available capacity and limits
echo "📊 Checking AWS service limits..."

# Check MediaLive channel limit
MEDIALIVE_CHANNELS=$(aws medialive list-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'length(Channels)' \
    --output text 2>/dev/null || echo "0")

print_status "Current MediaLive channels: $MEDIALIVE_CHANNELS"

if [ "$MEDIALIVE_CHANNELS" -gt 15 ]; then
    print_warning "High number of MediaLive channels. Check service limits."
fi

# 8. Validate required environment variables
echo "🔧 Validating environment configuration..."

# Check if we have the required channel IDs in environment or will create them
if [ -z "$PRIMARY_CHANNEL_ID" ] && [ -z "$YOUTUBE_CHANNEL_ID" ]; then
    print_status "New channel IDs will be created during deployment"
else
    print_status "Some channel IDs already configured"
fi

# 9. Check network connectivity
echo "🌍 Testing network connectivity..."
if curl -s --max-time 10 https://medialive.us-west-2.amazonaws.com > /dev/null; then
    print_status "MediaLive service connectivity OK"
else
    print_warning "MediaLive service connectivity issues"
fi

if curl -s --max-time 10 https://mediaconnect.us-west-2.amazonaws.com > /dev/null; then
    print_status "MediaConnect service connectivity OK"
else
    print_warning "MediaConnect service connectivity issues"
fi

# 10. Validate disk space for backups
echo "💾 Checking disk space for backups..."
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "${AVAILABLE_SPACE%.*}" -gt 1 ]; then
    print_status "Sufficient disk space available: ${AVAILABLE_SPACE}G"
else
    print_warning "Low disk space: ${AVAILABLE_SPACE}G"
fi

echo ""
echo "🎉 Pre-deployment validation completed successfully!"
echo ""
echo "📋 Summary:"
echo "- AWS Account: $ACCOUNT_ID"
echo "- Region: $REGION"
echo "- Current MediaLive Channel: 3714710 ($CURRENT_CHANNEL_STATE)"
echo "- DynamoDB Tables: destinations ($DESTINATIONS_TABLE_STATUS), presets ($PRESETS_TABLE_STATUS)"
echo "- Lambda Function: $LAMBDA_STATE"
echo "- MediaLive Channels: $MEDIALIVE_CHANNELS"
echo ""
echo "✅ Ready to proceed with deployment!"
echo "Next step: Run ./scripts/staged-deployment.sh"
