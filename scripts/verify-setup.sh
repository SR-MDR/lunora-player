#!/bin/bash

# Lunora Player - Setup Verification Script
# This script verifies your AWS configuration and prerequisites

set -e

# Configuration
TARGET_ACCOUNT_ID="372241484305"
TARGET_REGION="us-west-2"
REQUIRED_SERVICES=("medialive" "mediapackage" "s3" "cloudfront")

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

print_header() {
    echo ""
    echo "=========================================="
    echo "  $1"
    echo "=========================================="
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js installation
check_nodejs() {
    print_header "Checking Node.js Installation"
    
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js is installed: $node_version"
        
        if command_exists npm; then
            local npm_version=$(npm --version)
            print_success "npm is installed: $npm_version"
        else
            print_error "npm is not installed"
            return 1
        fi
    else
        print_error "Node.js is not installed"
        print_status "Please install Node.js from https://nodejs.org/"
        return 1
    fi
}

# Check AWS CLI installation and configuration
check_aws_cli() {
    print_header "Checking AWS CLI Configuration"
    
    if ! command_exists aws; then
        print_error "AWS CLI is not installed"
        print_status "Please install AWS CLI from https://aws.amazon.com/cli/"
        return 1
    fi
    
    local aws_version=$(aws --version 2>&1 | cut -d' ' -f1)
    print_success "AWS CLI is installed: $aws_version"
    
    # Check if lunora-media profile exists
    if aws configure list-profiles | grep -q "lunora-media"; then
        print_success "AWS profile 'lunora-media' exists"
        
        # Test the profile
        if aws sts get-caller-identity --profile lunora-media >/dev/null 2>&1; then
            local account_id=$(aws sts get-caller-identity --profile lunora-media --query Account --output text)
            local region=$(aws configure get region --profile lunora-media)
            
            print_success "Profile 'lunora-media' is working"
            print_status "Account ID: $account_id"
            print_status "Region: $region"
            
            # Verify account ID
            if [ "$account_id" = "$TARGET_ACCOUNT_ID" ]; then
                print_success "Correct account ID: $TARGET_ACCOUNT_ID (Lunora-Media-Services)"
            else
                print_warning "Account ID mismatch. Expected: $TARGET_ACCOUNT_ID, Got: $account_id"
            fi
            
            # Verify region
            if [ "$region" = "$TARGET_REGION" ]; then
                print_success "Correct region: $TARGET_REGION"
            else
                print_warning "Region mismatch. Expected: $TARGET_REGION, Got: $region"
            fi
        else
            print_error "Profile 'lunora-media' authentication failed"
            print_status "Please run: aws configure --profile lunora-media"
            return 1
        fi
    else
        print_warning "AWS profile 'lunora-media' not found"
        print_status "Please run: aws configure --profile lunora-media"
        print_status "Use account 372241484305 and region us-west-2"
        return 1
    fi
}

# Check AWS service access
check_aws_services() {
    print_header "Checking AWS Service Access"
    
    for service in "${REQUIRED_SERVICES[@]}"; do
        case $service in
            "medialive")
                if aws medialive list-channels --region $TARGET_REGION --profile lunora-media >/dev/null 2>&1; then
                    print_success "MediaLive access: OK"
                else
                    print_error "MediaLive access: FAILED"
                fi
                ;;
            "mediapackage")
                if aws mediapackage list-channels --region $TARGET_REGION --profile lunora-media >/dev/null 2>&1; then
                    print_success "MediaPackage access: OK"
                else
                    print_error "MediaPackage access: FAILED"
                fi
                ;;
            "s3")
                if aws s3 ls --profile lunora-media >/dev/null 2>&1; then
                    print_success "S3 access: OK"
                else
                    print_error "S3 access: FAILED"
                fi
                ;;
            "cloudfront")
                if aws cloudfront list-distributions --profile lunora-media >/dev/null 2>&1; then
                    print_success "CloudFront access: OK"
                else
                    print_error "CloudFront access: FAILED"
                fi
                ;;
        esac
    done
}

# Check project dependencies
check_dependencies() {
    print_header "Checking Project Dependencies"
    
    if [ -f "package.json" ]; then
        print_success "package.json found"
        
        if [ -d "node_modules" ]; then
            print_success "node_modules directory exists"
        else
            print_warning "node_modules not found"
            print_status "Run: npm install"
        fi
    else
        print_error "package.json not found"
        print_status "Make sure you're in the project root directory"
        return 1
    fi
}

# Check CloudFormation template
check_template() {
    print_header "Checking CloudFormation Template"
    
    local template_file="aws/cloudformation/media-services.yaml"
    
    if [ -f "$template_file" ]; then
        print_success "CloudFormation template found"
        
        # Validate template
        if aws cloudformation validate-template --template-body file://$template_file --region $TARGET_REGION --profile lunora-media >/dev/null 2>&1; then
            print_success "CloudFormation template is valid"
        else
            print_error "CloudFormation template validation failed"
            return 1
        fi
    else
        print_error "CloudFormation template not found: $template_file"
        return 1
    fi
}

# Check if development server can start
check_dev_server() {
    print_header "Checking Development Server"
    
    if command_exists npx; then
        print_success "npx is available"
        
        # Check if port 8080 is available
        if ! lsof -i :8080 >/dev/null 2>&1; then
            print_success "Port 8080 is available"
        else
            print_warning "Port 8080 is in use"
            print_status "You may need to stop the current server or use a different port"
        fi
    else
        print_error "npx is not available"
        return 1
    fi
}

# Main verification function
main() {
    echo "=========================================="
    echo "  Lunora Player - Setup Verification"
    echo "=========================================="
    echo ""
    print_status "Verifying prerequisites for Lunora Player deployment..."
    echo ""
    
    local errors=0
    
    # Run all checks
    check_nodejs || ((errors++))
    check_aws_cli || ((errors++))
    check_aws_services || ((errors++))
    check_dependencies || ((errors++))
    check_template || ((errors++))
    check_dev_server || ((errors++))
    
    # Summary
    print_header "Verification Summary"
    
    if [ $errors -eq 0 ]; then
        print_success "All checks passed! You're ready to deploy."
        echo ""
        print_status "Next steps:"
        echo "1. Start development server: npm run dev"
        echo "2. Deploy AWS infrastructure: ./scripts/deploy-aws.sh deploy"
        echo "3. Configure your Videon Edge nodes"
        echo "4. Test end-to-end streaming"
    else
        print_error "Found $errors issue(s) that need to be resolved."
        echo ""
        print_status "Please fix the issues above and run this script again."
    fi
    
    echo ""
    print_status "For detailed setup instructions, see:"
    echo "- README.md"
    echo "- docs/aws-account-setup.md"
    echo "- docs/aws-setup.md"
}

# Run main function
main "$@"
