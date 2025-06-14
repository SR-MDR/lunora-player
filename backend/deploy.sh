#!/bin/bash

# Lunora Player - Systematic Lambda Deployment Script
# Prevents recurring deployment issues by automating the entire process

set -e  # Exit on any error

echo "🚀 Starting Lunora Player Lambda Deployment..."

# Configuration
FUNCTION_NAME="lunora-player-prod-dynamic-streaming-api"
REGION="us-west-2"
PROFILE="lunora-media"
SOURCE_HANDLER="index.js"
DEPLOYMENT_DIR="deployment-temp"
ZIP_FILE="lunora-lambda-deployment.zip"

# Step 1: Clean up any existing deployment artifacts
echo "🧹 Cleaning up existing deployment artifacts..."
rm -rf "$DEPLOYMENT_DIR"
rm -f "$ZIP_FILE"
rm -rf lambda-complete-deployment
rm -rf lambda-deployment
rm -f *.zip

# Step 2: Create fresh deployment directory
echo "📁 Creating fresh deployment directory..."
mkdir "$DEPLOYMENT_DIR"

# Step 3: Systematic dependency analysis
echo "🔍 Analyzing dependencies in $SOURCE_HANDLER..."

# Find all local require statements
LOCAL_DEPS=$(grep -o "require('\./[^']*')" "$SOURCE_HANDLER" | sed "s/require('\.\/\([^']*\)')/\1.js/g" || true)

echo "📋 Found local dependencies:"
for dep in $LOCAL_DEPS; do
    echo "  - $dep"
    if [ ! -f "$dep" ]; then
        echo "❌ ERROR: Missing dependency file: $dep"
        exit 1
    fi
done

# Step 4: Copy main handler (already named index.js)
echo "📄 Copying main handler..."
cp "$SOURCE_HANDLER" "$DEPLOYMENT_DIR/"

# Step 5: Copy all local dependencies
echo "📦 Copying local dependencies..."
for dep in $LOCAL_DEPS; do
    echo "  Copying $dep..."
    cp "$dep" "$DEPLOYMENT_DIR/"
done

# Step 6: Check for transitive dependencies
echo "🔄 Checking for transitive dependencies..."
for dep in $LOCAL_DEPS; do
    TRANSITIVE_DEPS=$(grep -o "require('\./[^']*')" "$dep" | sed "s/require('\.\/\([^']*\)')/\1.js/g" || true)
    for trans_dep in $TRANSITIVE_DEPS; do
        if [ ! -f "$DEPLOYMENT_DIR/$trans_dep" ]; then
            echo "  Copying transitive dependency: $trans_dep"
            cp "$trans_dep" "$DEPLOYMENT_DIR/"
        fi
    done
done

# Step 7: Copy package.json and install dependencies
echo "📦 Installing npm dependencies..."
cp package.json "$DEPLOYMENT_DIR/"
cd "$DEPLOYMENT_DIR"
npm install --production
cd ..

# Step 8: Verify all files are present
echo "✅ Verifying deployment package contents..."
echo "Files in deployment package:"
ls -la "$DEPLOYMENT_DIR/"

# Step 9: Create deployment zip
echo "🗜️ Creating deployment zip..."
cd "$DEPLOYMENT_DIR"
zip -r "../$ZIP_FILE" .
cd ..

# Step 10: Deploy to Lambda
echo "🚀 Deploying to Lambda..."
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_FILE" \
    --region "$REGION" \
    --profile "$PROFILE"

# Step 11: Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Step 12: Test deployment
echo "🧪 Testing deployment..."
HEALTH_RESPONSE=$(curl -s "https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/health" || echo "FAILED")

if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    echo "✅ Deployment successful! Health check passed."
else
    echo "❌ Deployment failed! Health check failed."
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

# Step 13: Clean up
echo "🧹 Cleaning up temporary files..."
rm -rf "$DEPLOYMENT_DIR"
rm -f "$ZIP_FILE"

echo "🎉 Deployment completed successfully!"
echo "📊 Backend URL: https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws"
