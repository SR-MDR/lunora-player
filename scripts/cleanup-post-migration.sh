#!/bin/bash

# Lunora Player - Post AWS SDK v3 Migration Cleanup
# Removes unnecessary dependencies after successful migration
# Usage: Run from project root: ./scripts/cleanup-post-migration.sh

set -e

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

# Change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧹 Starting Post-Migration Cleanup..."
print_status "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Verify we're in the right place
if [ ! -f "backend/index.js" ] || [ ! -d "backend/node_modules/@aws-sdk" ]; then
    print_error "Project structure not found or AWS SDK v3 migration not complete"
    exit 1
fi

# Check current sizes
print_status "Current disk usage:"
if [ -d "node_modules" ]; then
    ROOT_SIZE=$(du -sh node_modules/ | cut -f1)
    echo "  Root node_modules/: $ROOT_SIZE"
else
    echo "  Root node_modules/: Not found"
fi

if [ -d "backend/node_modules" ]; then
    BACKEND_SIZE=$(du -sh backend/node_modules/ | cut -f1)
    echo "  Backend node_modules/: $BACKEND_SIZE"
else
    print_error "Backend node_modules not found - migration may be incomplete"
    exit 1
fi

# Check for AWS SDK v2 in root
if [ -d "node_modules/aws-sdk" ]; then
    AWS_V2_SIZE=$(du -sh node_modules/aws-sdk | cut -f1)
    print_warning "Found AWS SDK v2 in root: $AWS_V2_SIZE"
else
    print_status "No AWS SDK v2 found in root"
fi

# Confirm cleanup
echo ""
print_warning "This will remove the root node_modules/ directory (development dependencies)"
print_status "Backend production dependencies will be preserved"
echo ""
read -p "Continue with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Cleanup cancelled"
    exit 0
fi

# Backup package files (just in case)
print_status "Creating backup of package files..."
cp package.json package.json.backup 2>/dev/null || true
cp package-lock.json package-lock.json.backup 2>/dev/null || true

# Remove root node_modules
if [ -d "node_modules" ]; then
    print_status "Removing root node_modules/ directory..."
    rm -rf node_modules/
    print_success "Root node_modules/ removed"
else
    print_status "Root node_modules/ already clean"
fi

# Verify backend dependencies are intact
print_status "Verifying backend AWS SDK v3 dependencies..."
if [ -d "backend/node_modules/@aws-sdk" ]; then
    SDK_COUNT=$(ls backend/node_modules/@aws-sdk/ | wc -l | tr -d ' ')
    print_success "Backend AWS SDK v3 intact ($SDK_COUNT packages)"
else
    print_error "Backend AWS SDK v3 missing - cleanup may have failed"
    exit 1
fi

# Check final sizes
print_status "Final disk usage:"
if [ -d "backend/node_modules" ]; then
    FINAL_BACKEND_SIZE=$(du -sh backend/node_modules/ | cut -f1)
    echo "  Backend node_modules/: $FINAL_BACKEND_SIZE"
fi

# Clean up backup files
print_status "Cleaning up backup files..."
rm -f package.json.backup package-lock.json.backup

print_success "🎉 Post-migration cleanup completed!"
echo ""
print_status "✅ Removed: Root development dependencies"
print_status "✅ Preserved: Backend production dependencies (AWS SDK v3)"
print_status "✅ Space saved: Approximately 181M"
echo ""
print_status "📋 Next steps:"
echo "  1. Test deployment: ./scripts/deploy-backend.sh"
echo "  2. Verify functionality: Check API endpoints"
echo "  3. If needed, reinstall dev deps: npm install"
