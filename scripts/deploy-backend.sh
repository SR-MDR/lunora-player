#!/bin/bash

# Lunora Player - Backend Lambda Deployment Script
# AWS SDK v3 Compatible - Optimized for tree-shaking and smaller bundles
# Prevents recurring deployment issues by automating the entire process
# Usage: Run from project root: ./scripts/deploy-backend.sh

set -e  # Exit on any error

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

# Change to backend directory from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "🚀 Starting Lunora Player Backend Lambda Deployment (AWS SDK v3)..."
print_status "Project root: $PROJECT_ROOT"
print_status "Backend directory: $BACKEND_DIR"

# Verify we're in the right place
if [ ! -f "$BACKEND_DIR/index.js" ]; then
    print_error "Backend index.js not found. Are you running from the project root?"
    exit 1
fi

# Change to backend directory
cd "$BACKEND_DIR"

# Configuration
FUNCTION_NAME="lunora-player-prod-dynamic-streaming-api"
REGION="us-west-2"
PROFILE="lunora-media"
SOURCE_HANDLER="index.js"
DEPLOYMENT_DIR="deployment-temp"
ZIP_FILE="lunora-lambda-deployment.zip"

# Verify AWS credentials
print_status "Verifying AWS credentials..."
if aws sts get-caller-identity --profile "$PROFILE" >/dev/null 2>&1; then
    print_success "AWS credentials verified"
else
    print_error "AWS credentials verification failed"
    exit 1
fi

# Step 1: Clean up any existing deployment artifacts
print_status "Cleaning up existing deployment artifacts..."
rm -rf "$DEPLOYMENT_DIR"
rm -f "$ZIP_FILE"
rm -rf lambda-complete-deployment
rm -rf lambda-deployment
rm -f *.zip
rm -f test-*.js  # Remove test files from migration
print_success "Cleanup completed"

# Step 2: Create fresh deployment directory
print_status "Creating fresh deployment directory..."
mkdir "$DEPLOYMENT_DIR"

# Step 3: Verify AWS SDK v3 migration
print_status "Verifying AWS SDK v3 migration..."
if grep -q "@aws-sdk/" package.json; then
    print_success "AWS SDK v3 dependencies detected"
else
    print_error "AWS SDK v3 dependencies not found. Migration may be incomplete."
    exit 1
fi

# Step 4: Systematic dependency analysis
print_status "Analyzing dependencies in $SOURCE_HANDLER..."

# Find all local require statements
LOCAL_DEPS=$(grep -o "require('\./[^']*')" "$SOURCE_HANDLER" | sed "s/require('\.\/\([^']*\)')/\1.js/g" || true)

print_status "Found local dependencies:"
for dep in $LOCAL_DEPS; do
    echo "  - $dep"
    if [ ! -f "$dep" ]; then
        print_error "Missing dependency file: $dep"
        exit 1
    fi
done

# Step 5: Copy main handler (already named index.js)
print_status "Copying main handler..."
cp "$SOURCE_HANDLER" "$DEPLOYMENT_DIR/"

# Step 6: Copy all local dependencies
print_status "Copying local dependencies..."
for dep in $LOCAL_DEPS; do
    echo "  Copying $dep..."
    cp "$dep" "$DEPLOYMENT_DIR/"
done

# Step 7: Check for transitive dependencies
print_status "Checking for transitive dependencies..."
for dep in $LOCAL_DEPS; do
    TRANSITIVE_DEPS=$(grep -o "require('\./[^']*')" "$dep" | sed "s/require('\.\/\([^']*\)')/\1.js/g" || true)
    for trans_dep in $TRANSITIVE_DEPS; do
        if [ ! -f "$DEPLOYMENT_DIR/$trans_dep" ]; then
            echo "  Copying transitive dependency: $trans_dep"
            cp "$trans_dep" "$DEPLOYMENT_DIR/"
        fi
    done
done

# Step 8: Copy package.json and install AWS SDK v3 dependencies
print_status "Installing AWS SDK v3 dependencies..."
cp package.json "$DEPLOYMENT_DIR/"
cd "$DEPLOYMENT_DIR"

# Install production dependencies with AWS SDK v3
npm install --production --no-optional

# Verify AWS SDK v3 installation
if [ -d "node_modules/@aws-sdk" ]; then
    print_success "AWS SDK v3 installed successfully"
    echo "  SDK v3 size: $(du -sh node_modules/@aws-sdk | cut -f1)"
else
    print_error "AWS SDK v3 installation failed"
    exit 1
fi

cd ..

# Step 9: Verify all files are present
print_status "Verifying deployment package contents..."
echo "Files in deployment package:"
ls -la "$DEPLOYMENT_DIR/"

# Check package size
PACKAGE_SIZE=$(du -sh "$DEPLOYMENT_DIR" | cut -f1)
print_status "Package size: $PACKAGE_SIZE"

# Step 10: Create deployment zip
print_status "Creating deployment zip..."
cd "$DEPLOYMENT_DIR"
zip -r "../$ZIP_FILE" . > /dev/null
cd ..

ZIP_SIZE=$(ls -lh "$ZIP_FILE" | awk '{print $5}')
print_success "Deployment zip created: $ZIP_SIZE"

# Step 11: Deploy to Lambda
print_status "Deploying to Lambda..."
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_FILE" \
    --region "$REGION" \
    --profile "$PROFILE" > /dev/null

if [ $? -eq 0 ]; then
    print_success "Lambda function updated successfully"
else
    print_error "Lambda deployment failed"
    exit 1
fi

# Step 12: Wait for deployment to complete
print_status "Waiting for deployment to complete..."
sleep 15

# Step 13: Test deployment with multiple endpoints
print_status "Testing AWS SDK v3 deployment..."

# Test health endpoint
HEALTH_RESPONSE=$(curl -s "https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/health" || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    print_success "Health check passed"
else
    print_error "Health check failed: $HEALTH_RESPONSE"
    exit 1
fi

# Test MediaConnect endpoint (key improvement area)
MEDIACONNECT_RESPONSE=$(curl -s "https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/mediaconnect/sources/health" || echo "FAILED")
if [[ "$MEDIACONNECT_RESPONSE" == *"sources"* ]] || [[ "$MEDIACONNECT_RESPONSE" == *"error"* ]]; then
    print_success "MediaConnect endpoint responding (AWS SDK v3)"
else
    print_warning "MediaConnect endpoint may need configuration"
fi

# Step 14: Clean up
print_status "Cleaning up temporary files..."
rm -rf "$DEPLOYMENT_DIR"
rm -f "$ZIP_FILE"

print_success "🎉 AWS SDK v3 deployment completed successfully!"
echo ""
print_status "📊 Backend URL: https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws"
print_status "🔧 Expected improvements: Better CloudWatch integration, smaller bundle size"
print_status "📈 MediaConnect source health detection should be more reliable"
