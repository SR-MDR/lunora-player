#!/bin/bash

# Comprehensive Backend Lambda Deployment Verification Script
# Compares deployed Lambda function code with local backend files

set -e

FUNCTION_NAME="lunora-player-prod-dynamic-streaming-api"
REGION="us-west-2"
PROFILE="lunora-media"
TEMP_DIR="/tmp/backend-verification"
ERRORS=0
TOTAL_FILES=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Starting comprehensive backend Lambda deployment verification...${NC}"
echo "=================================================="

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo -e "${BLUE}📥 Downloading deployed Lambda function code...${NC}"

# Get Lambda function details and download code
LAMBDA_INFO=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --profile "$PROFILE")
CODE_LOCATION=$(echo "$LAMBDA_INFO" | jq -r '.Code.Location')

if [ "$CODE_LOCATION" = "null" ] || [ -z "$CODE_LOCATION" ]; then
    echo -e "${RED}❌ Failed to get Lambda code location${NC}"
    exit 1
fi

# Download and extract Lambda code
echo "Downloading from: $CODE_LOCATION"
if ! curl -s "$CODE_LOCATION" -o deployed-lambda.zip; then
    echo -e "${RED}❌ Failed to download Lambda code${NC}"
    exit 1
fi

if ! unzip -q deployed-lambda.zip; then
    echo -e "${RED}❌ Failed to extract Lambda code${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Lambda code downloaded and extracted${NC}"
echo ""

# Get list of backend files to compare
BACKEND_DIR="/Users/steverichards/dev/business/lunora-player/backend"
BACKEND_FILES=$(find "$BACKEND_DIR" -name "*.js" -o -name "package.json" -o -name "package-lock.json" | grep -v node_modules | sort)

echo -e "${BLUE}Backend files to verify:${NC}"
for file in $BACKEND_FILES; do
    basename_file=$(basename "$file")
    echo "  $basename_file"
done
echo ""

# Compare each file
for file in $BACKEND_FILES; do
    basename_file=$(basename "$file")
    TOTAL_FILES=$((TOTAL_FILES + 1))
    echo -n "Checking $basename_file... "
    
    if [ -f "$basename_file" ]; then
        # Compare files
        if diff -q "$file" "$basename_file" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ MATCH${NC}"
        else
            echo -e "${RED}❌ DIFFERENT${NC}"
            echo -e "${YELLOW}  Differences found in $basename_file:${NC}"
            diff -u "$file" "$basename_file" | head -20
            echo ""
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "${RED}❌ NOT FOUND${NC}"
        echo -e "${YELLOW}  File $basename_file not found in deployed Lambda${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check for extra files in deployed Lambda
echo ""
echo -e "${BLUE}Checking for extra files in deployed Lambda...${NC}"
DEPLOYED_JS_FILES=$(find . -name "*.js" -not -path "./node_modules/*" | sort)
for deployed_file in $DEPLOYED_JS_FILES; do
    basename_deployed=$(basename "$deployed_file")
    if ! find "$BACKEND_DIR" -name "$basename_deployed" | grep -q .; then
        echo -e "${YELLOW}⚠️  Extra file in Lambda: $basename_deployed${NC}"
    fi
done

# Check Lambda configuration
echo ""
echo -e "${BLUE}Lambda Configuration:${NC}"
echo "$LAMBDA_INFO" | jq -r '.Configuration | {
    Runtime: .Runtime,
    Handler: .Handler,
    CodeSize: .CodeSize,
    LastModified: .LastModified,
    MemorySize: .MemorySize,
    Timeout: .Timeout
}'

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo ""
echo "=================================================="
echo -e "${BLUE}Backend Verification Summary:${NC}"
echo "  Total files checked: $TOTAL_FILES"
echo "  Files matching: $((TOTAL_FILES - ERRORS))"
echo "  Files with issues: $ERRORS"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: All backend files match perfectly!${NC}"
    echo -e "${GREEN}Lambda deployment is 100% synchronized with local backend files.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  WARNING: $ERRORS file(s) have differences or are missing.${NC}"
    echo -e "${YELLOW}Please review the differences above and redeploy if necessary.${NC}"
    exit 1
fi
