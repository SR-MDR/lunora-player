#!/bin/bash
set -e

# Configuration
ENVIRONMENT="prod"
PROJECT_NAME="lunora-player"
REGION="us-west-2"
PROFILE="lunora-media"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_stage() {
    echo -e "${BLUE}🚀 $1${NC}"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Starting staged deployment for ${PROJECT_NAME}-${ENVIRONMENT}..."
echo "Region: $REGION"
echo "Profile: $PROFILE"
echo ""

# Stage 1: Create backups
print_stage "Stage 1: Creating backups..."
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p backups

# Backup DynamoDB table
print_status "Creating DynamoDB backup..."
aws dynamodb create-backup \
    --table-name lunora-destinations \
    --backup-name "lunora-destinations-backup-${BACKUP_TIMESTAMP}" \
    --region $REGION \
    --profile $PROFILE

# Backup Lambda function
print_status "Creating Lambda function backup..."
LAMBDA_DOWNLOAD_URL=$(aws lambda get-function \
    --function-name lunora-player-prod-multi-destination-api \
    --region $REGION \
    --profile $PROFILE \
    --query 'Code.Location' \
    --output text)

curl -s "$LAMBDA_DOWNLOAD_URL" -o "backups/lambda-backup-${BACKUP_TIMESTAMP}.zip"

print_status "Backups created successfully"
echo "- DynamoDB: lunora-destinations-backup-${BACKUP_TIMESTAMP}"
echo "- Lambda: backups/lambda-backup-${BACKUP_TIMESTAMP}.zip"
echo ""

# Stage 2: Deploy MediaConnect Flow
print_stage "Stage 2: Deploying MediaConnect Flow..."

aws cloudformation deploy \
    --template-file aws/cloudformation/srt-mediaconnect-flow-robust.yaml \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --profile $PROFILE \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        VideonSourceIP="0.0.0.0/0"

# Get MediaConnect outputs
print_status "Retrieving MediaConnect Flow outputs..."

FLOW_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaConnectFlowArn`].OutputValue' \
    --output text)

SRT_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`SRTIngestEndpoint`].OutputValue' \
    --output text)

PRIMARY_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`PrimaryOutputArn`].OutputValue' \
    --output text)

YOUTUBE_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`YouTubeOutputArn`].OutputValue' \
    --output text)

TWITCH_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`TwitchOutputArn`].OutputValue' \
    --output text)

LINKEDIN_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`LinkedInOutputArn`].OutputValue' \
    --output text)

CUSTOM_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`CustomOutputArn`].OutputValue' \
    --output text)

print_status "MediaConnect Flow deployed successfully"
echo "Flow ARN: $FLOW_ARN"
echo "SRT Endpoint: $SRT_ENDPOINT"
echo ""

# Stage 3: Deploy MediaLive Channels
print_stage "Stage 3: Deploying MediaLive Channels..."

aws cloudformation deploy \
    --template-file aws/cloudformation/multi-medialive-channels-complete.yaml \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --profile $PROFILE \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        PrimaryOutputArn=$PRIMARY_OUTPUT_ARN \
        YouTubeOutputArn=$YOUTUBE_OUTPUT_ARN \
        TwitchOutputArn=$TWITCH_OUTPUT_ARN \
        LinkedInOutputArn=$LINKEDIN_OUTPUT_ARN \
        CustomOutputArn=$CUSTOM_OUTPUT_ARN

# Get MediaLive Channel IDs
print_status "Retrieving MediaLive Channel IDs..."

PRIMARY_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`PrimaryChannelId`].OutputValue' \
    --output text)

YOUTUBE_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`YouTubeChannelId`].OutputValue' \
    --output text)

TWITCH_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`TwitchChannelId`].OutputValue' \
    --output text)

LINKEDIN_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`LinkedInChannelId`].OutputValue' \
    --output text)

CUSTOM_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`CustomChannelId`].OutputValue' \
    --output text)

print_status "MediaLive Channels deployed successfully"
echo "Primary Channel ID: $PRIMARY_CHANNEL_ID"
echo "YouTube Channel ID: $YOUTUBE_CHANNEL_ID"
echo "Twitch Channel ID: $TWITCH_CHANNEL_ID"
echo "LinkedIn Channel ID: $LINKEDIN_CHANNEL_ID"
echo "Custom Channel ID: $CUSTOM_CHANNEL_ID"
echo ""

# Save deployment info
cat > "backups/deployment-info-${BACKUP_TIMESTAMP}.json" << EOF
{
  "timestamp": "${BACKUP_TIMESTAMP}",
  "mediaconnect": {
    "flow_arn": "${FLOW_ARN}",
    "srt_endpoint": "${SRT_ENDPOINT}"
  },
  "medialive_channels": {
    "primary": "${PRIMARY_CHANNEL_ID}",
    "youtube": "${YOUTUBE_CHANNEL_ID}",
    "twitch": "${TWITCH_CHANNEL_ID}",
    "linkedin": "${LINKEDIN_CHANNEL_ID}",
    "custom": "${CUSTOM_CHANNEL_ID}"
  }
}
EOF

print_status "Deployment information saved to backups/deployment-info-${BACKUP_TIMESTAMP}.json"
echo ""

echo "🎉 Staged deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Update Lambda function with new environment variables"
echo "2. Run database migration"
echo "3. Test individual channel functionality"
echo "4. Configure Videon Edge Node with SRT endpoint: $SRT_ENDPOINT"
echo ""
echo "🔄 Rollback Information:"
echo "- DynamoDB Backup: lunora-destinations-backup-${BACKUP_TIMESTAMP}"
echo "- Lambda Backup: backups/lambda-backup-${BACKUP_TIMESTAMP}.zip"
echo "- Deployment Info: backups/deployment-info-${BACKUP_TIMESTAMP}.json"
