#!/bin/bash

# Comprehensive Frontend Deployment Verification Script
# Compares every file in local directory with deployed S3/CloudFront version

set -e

CLOUDFRONT_URL="https://d35au6zpsr51nc.cloudfront.net"
TEMP_DIR="/tmp/deployment-verification"
ERRORS=0
TOTAL_FILES=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Starting comprehensive frontend deployment verification...${NC}"
echo "=================================================="

# Create temp directory
mkdir -p "$TEMP_DIR"

# Get list of files to compare (excluding backend, node_modules, .git, docs)
FILES=$(find . -type f \( ! -path "./backend/*" ! -path "./node_modules/*" ! -path "./.git/*" ! -name "*.md" ! -name "*.zip" ! -name "verify-deployment.sh" \) | sed 's|^\./||' | sort)

echo -e "${BLUE}Files to verify:${NC}"
echo "$FILES" | sed 's/^/  /'
echo ""

# Compare each file
for file in $FILES; do
    TOTAL_FILES=$((TOTAL_FILES + 1))
    echo -n "Checking $file... "
    
    # Download deployed version
    if curl -s -f "$CLOUDFRONT_URL/$file" > "$TEMP_DIR/deployed_$(basename "$file")" 2>/dev/null; then
        # Compare files
        if diff -q "$file" "$TEMP_DIR/deployed_$(basename "$file")" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ MATCH${NC}"
        else
            echo -e "${RED}❌ DIFFERENT${NC}"
            echo -e "${YELLOW}  Differences found in $file:${NC}"
            diff -u "$file" "$TEMP_DIR/deployed_$(basename "$file")" | head -20
            echo ""
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "${RED}❌ NOT FOUND${NC}"
        echo -e "${YELLOW}  File $file not found on CloudFront${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "=================================================="
echo -e "${BLUE}Verification Summary:${NC}"
echo "  Total files checked: $TOTAL_FILES"
echo "  Files matching: $((TOTAL_FILES - ERRORS))"
echo "  Files with issues: $ERRORS"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: All files match perfectly!${NC}"
    echo -e "${GREEN}Frontend deployment is 100% synchronized with local files.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  WARNING: $ERRORS file(s) have differences or are missing.${NC}"
    echo -e "${YELLOW}Please review the differences above and redeploy if necessary.${NC}"
    exit 1
fi
