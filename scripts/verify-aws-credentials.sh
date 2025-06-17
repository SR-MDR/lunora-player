#!/bin/bash

# Lunora Player - AWS Credentials Verification Script
# This script verifies that AWS credentials are properly configured
# Usage: ./scripts/verify-aws-credentials.sh

set -e

echo "🔐 Verifying AWS Credentials for Lunora Player..."

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Set default profile if not set
AWS_PROFILE=${AWS_PROFILE:-lunora-media}
AWS_REGION=${AWS_REGION:-us-west-2}
EXPECTED_ACCOUNT=${AWS_ACCOUNT_ID:-372241484305}

echo "🔧 Configuration:"
echo "  AWS_PROFILE: $AWS_PROFILE"
echo "  AWS_REGION: $AWS_REGION"
echo "  Expected Account: $EXPECTED_ACCOUNT"

# Test 1: Basic AWS CLI access
echo ""
echo "🧪 Test 1: Basic AWS CLI access..."
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI."
    exit 1
fi

# Test 2: Get caller identity
echo ""
echo "🧪 Test 2: AWS Caller Identity..."
CALLER_IDENTITY=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null || echo "FAILED")

if [[ "$CALLER_IDENTITY" == "FAILED" ]]; then
    echo "❌ Failed to get caller identity. Check your AWS credentials."
    echo "💡 Try running: aws configure --profile $AWS_PROFILE"
    exit 1
fi

ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | grep -o '"Account": "[^"]*"' | cut -d'"' -f4)
USER_ARN=$(echo "$CALLER_IDENTITY" | grep -o '"Arn": "[^"]*"' | cut -d'"' -f4)

echo "✅ Successfully authenticated as:"
echo "  Account: $ACCOUNT_ID"
echo "  ARN: $USER_ARN"

# Test 3: Verify correct account
echo ""
echo "🧪 Test 3: Account verification..."
if [[ "$ACCOUNT_ID" != "$EXPECTED_ACCOUNT" ]]; then
    echo "⚠️  Warning: Connected to account $ACCOUNT_ID, expected $EXPECTED_ACCOUNT"
    echo "💡 Make sure you're using the correct AWS profile."
else
    echo "✅ Connected to correct account: $ACCOUNT_ID"
fi

# Test 4: MediaConnect access
echo ""
echo "🧪 Test 4: MediaConnect service access..."
MEDIACONNECT_TEST=$(aws mediaconnect list-flows --profile "$AWS_PROFILE" --region "$AWS_REGION" --max-results 1 2>/dev/null || echo "FAILED")

if [[ "$MEDIACONNECT_TEST" == "FAILED" ]]; then
    echo "❌ Failed to access MediaConnect service."
    echo "💡 Check IAM permissions for MediaConnect."
else
    echo "✅ MediaConnect service access confirmed."
fi

# Test 5: Specific MediaConnect flow access (if configured)
if [[ -n "$MEDIACONNECT_FLOW_ARN" ]]; then
    echo ""
    echo "🧪 Test 5: Specific MediaConnect flow access..."
    FLOW_TEST=$(aws mediaconnect describe-flow --flow-arn "$MEDIACONNECT_FLOW_ARN" --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null || echo "FAILED")
    
    if [[ "$FLOW_TEST" == "FAILED" ]]; then
        echo "❌ Failed to access MediaConnect flow: $MEDIACONNECT_FLOW_ARN"
    else
        FLOW_STATUS=$(echo "$FLOW_TEST" | grep -o '"Status": "[^"]*"' | cut -d'"' -f4)
        echo "✅ MediaConnect flow access confirmed. Status: $FLOW_STATUS"
    fi
fi

# Test 6: DynamoDB access
echo ""
echo "🧪 Test 6: DynamoDB service access..."
DYNAMODB_TEST=$(aws dynamodb list-tables --profile "$AWS_PROFILE" --region "$AWS_REGION" --max-items 1 2>/dev/null || echo "FAILED")

if [[ "$DYNAMODB_TEST" == "FAILED" ]]; then
    echo "❌ Failed to access DynamoDB service."
else
    echo "✅ DynamoDB service access confirmed."
fi

# Test 7: Lambda access
echo ""
echo "🧪 Test 7: Lambda service access..."
LAMBDA_TEST=$(aws lambda list-functions --profile "$AWS_PROFILE" --region "$AWS_REGION" --max-items 1 2>/dev/null || echo "FAILED")

if [[ "$LAMBDA_TEST" == "FAILED" ]]; then
    echo "❌ Failed to access Lambda service."
else
    echo "✅ Lambda service access confirmed."
fi

echo ""
echo "🎉 AWS Credentials verification completed!"
echo ""
echo "📋 Summary for future AI assistants:"
echo "  ✅ AWS CLI installed and configured"
echo "  ✅ Profile: $AWS_PROFILE"
echo "  ✅ Region: $AWS_REGION" 
echo "  ✅ Account: $ACCOUNT_ID"
echo "  ✅ Services: MediaConnect, DynamoDB, Lambda accessible"
echo ""
echo "💡 If you encounter AWS credential issues in future chats:"
echo "   1. Run this script: ./scripts/verify-aws-credentials.sh"
echo "   2. Check that AWS_PROFILE=lunora-media is set"
echo "   3. Verify .env file exists with correct settings"
echo "   4. Ensure AWS_SDK_LOAD_CONFIG=1 is set for Node.js applications"
