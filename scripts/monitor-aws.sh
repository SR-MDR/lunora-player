#!/bin/bash

# Lunora Player - AWS Resource Monitoring Script
# This script checks the status of AWS Media Services resources

set -e

# Configuration
REGION="us-west-2"
PROFILE="lunora-media"
MEDIAPACKAGE_CHANNEL="lunora-player-dev-channel"
S3_BUCKET="lunora-media-videos-dev-372241484305"

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

# Check S3 bucket status
check_s3_status() {
    print_header "S3 Bucket Status"
    
    if aws s3api head-bucket --bucket $S3_BUCKET --profile $PROFILE --region $REGION >/dev/null 2>&1; then
        print_success "S3 bucket exists: $S3_BUCKET"
        
        # Get bucket size and object count
        local size=$(aws s3api list-objects-v2 --bucket $S3_BUCKET --profile $PROFILE --region $REGION --query 'sum(Contents[].Size)' --output text 2>/dev/null || echo "0")
        local count=$(aws s3api list-objects-v2 --bucket $S3_BUCKET --profile $PROFILE --region $REGION --query 'length(Contents)' --output text 2>/dev/null || echo "0")
        
        if [ "$size" = "None" ] || [ "$size" = "" ]; then
            size="0"
        fi
        
        if [ "$count" = "None" ] || [ "$count" = "" ]; then
            count="0"
        fi
        
        local size_mb=$((size / 1024 / 1024))
        print_status "Storage used: ${size_mb} MB"
        print_status "Objects: $count"
        
        # Check bucket region
        local bucket_region=$(aws s3api get-bucket-location --bucket $S3_BUCKET --profile $PROFILE --query 'LocationConstraint' --output text 2>/dev/null || echo "us-east-1")
        if [ "$bucket_region" = "None" ]; then
            bucket_region="us-east-1"
        fi
        print_status "Region: $bucket_region"
        
    else
        print_error "S3 bucket not found: $S3_BUCKET"
        return 1
    fi
}

# Check MediaPackage status
check_mediapackage_status() {
    print_header "MediaPackage Status"
    
    # Check channel
    local channel_info=$(aws mediapackage describe-channel --id $MEDIAPACKAGE_CHANNEL --profile $PROFILE --region $REGION 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_success "MediaPackage channel exists: $MEDIAPACKAGE_CHANNEL"
        
        local created_at=$(echo "$channel_info" | jq -r '.CreatedAt' 2>/dev/null || echo "Unknown")
        local description=$(echo "$channel_info" | jq -r '.Description' 2>/dev/null || echo "No description")
        
        print_status "Created: $created_at"
        print_status "Description: $description"
        
        # Check origin endpoints
        local endpoints=$(aws mediapackage list-origin-endpoints --channel-id $MEDIAPACKAGE_CHANNEL --profile $PROFILE --region $REGION 2>/dev/null)
        local endpoint_count=$(echo "$endpoints" | jq '.OriginEndpoints | length' 2>/dev/null || echo "0")
        
        print_status "Origin endpoints: $endpoint_count"
        
        if [ "$endpoint_count" -gt 0 ]; then
            echo "$endpoints" | jq -r '.OriginEndpoints[] | "  - \(.Id): \(.Url)"' 2>/dev/null || echo "  Unable to parse endpoints"
        fi
        
    else
        print_error "MediaPackage channel not found: $MEDIAPACKAGE_CHANNEL"
        return 1
    fi
}

# Check MediaLive status
check_medialive_status() {
    print_header "MediaLive Status"
    
    local channels=$(aws medialive list-channels --profile $PROFILE --region $REGION 2>/dev/null)
    local channel_count=$(echo "$channels" | jq '.Channels | length' 2>/dev/null || echo "0")
    
    if [ "$channel_count" -eq 0 ]; then
        print_warning "No MediaLive channels found"
        print_status "Create a MediaLive channel to enable live streaming"
    else
        print_success "Found $channel_count MediaLive channel(s)"
        
        echo "$channels" | jq -r '.Channels[] | "  - \(.Name) (\(.Id)): \(.State)"' 2>/dev/null || echo "  Unable to parse channels"
    fi
}

# Check CloudFront status
check_cloudfront_status() {
    print_header "CloudFront Status"
    
    local distributions=$(aws cloudfront list-distributions --profile $PROFILE 2>/dev/null)
    local dist_count=$(echo "$distributions" | jq '.DistributionList.Items | length' 2>/dev/null || echo "0")
    
    if [ "$dist_count" -eq 0 ]; then
        print_warning "No CloudFront distributions found"
        print_status "Create a CloudFront distribution for global content delivery"
    else
        print_success "Found $dist_count CloudFront distribution(s)"
        
        echo "$distributions" | jq -r '.DistributionList.Items[] | "  - \(.Id): \(.DomainName) (\(.Status))"' 2>/dev/null || echo "  Unable to parse distributions"
    fi
}

# Get cost information (simplified)
check_costs() {
    print_header "Cost Information"
    
    print_status "Cost monitoring requires AWS Cost Explorer API access"
    print_status "Current month estimated costs:"
    
    # Note: This would require AWS Cost Explorer API in a real implementation
    print_status "  MediaPackage: Based on data processed"
    print_status "  S3: Based on storage and requests"
    print_status "  MediaLive: ~$2.50/hour when running"
    print_status "  CloudFront: Based on data transfer"
    
    print_warning "For detailed cost analysis, check AWS Cost Explorer in the console"
}

# Test endpoints
test_endpoints() {
    print_header "Endpoint Testing"
    
    # Test MediaPackage HLS endpoint
    local hls_endpoint="https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/456a13256d454682b4bd708236618057/index.m3u8"
    
    print_status "Testing MediaPackage HLS endpoint..."
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$hls_endpoint" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        print_success "HLS endpoint is active and serving content"
    elif [ "$response" = "404" ]; then
        print_warning "HLS endpoint exists but no content available (normal when not streaming)"
    else
        print_error "HLS endpoint test failed (HTTP $response)"
    fi
}

# Generate monitoring report
generate_report() {
    print_header "Monitoring Report Summary"
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    print_status "Report generated: $timestamp"
    print_status "Account: 372241484305 (Lunora-Media-Services)"
    print_status "Region: $REGION"
    
    echo ""
    print_status "Resource Status:"
    
    # Quick status check
    if aws s3api head-bucket --bucket $S3_BUCKET --profile $PROFILE --region $REGION >/dev/null 2>&1; then
        echo "  ✓ S3 Bucket: Active"
    else
        echo "  ✗ S3 Bucket: Not Found"
    fi
    
    if aws mediapackage describe-channel --id $MEDIAPACKAGE_CHANNEL --profile $PROFILE --region $REGION >/dev/null 2>&1; then
        echo "  ✓ MediaPackage: Active"
    else
        echo "  ✗ MediaPackage: Not Found"
    fi
    
    local ml_count=$(aws medialive list-channels --profile $PROFILE --region $REGION --query 'length(Channels)' --output text 2>/dev/null || echo "0")
    if [ "$ml_count" -gt 0 ]; then
        echo "  ✓ MediaLive: $ml_count channel(s)"
    else
        echo "  ⚠ MediaLive: No channels"
    fi
    
    local cf_count=$(aws cloudfront list-distributions --profile $PROFILE --query 'length(DistributionList.Items)' --output text 2>/dev/null || echo "0")
    if [ "$cf_count" -gt 0 ]; then
        echo "  ✓ CloudFront: $cf_count distribution(s)"
    else
        echo "  ⚠ CloudFront: No distributions"
    fi
}

# Main function
main() {
    echo "=========================================="
    echo "  Lunora Player - AWS Resource Monitor"
    echo "=========================================="
    echo ""
    
    case "${1:-status}" in
        "status")
            check_s3_status
            check_mediapackage_status
            check_medialive_status
            check_cloudfront_status
            ;;
        "costs")
            check_costs
            ;;
        "test")
            test_endpoints
            ;;
        "report")
            generate_report
            ;;
        "all")
            check_s3_status
            check_mediapackage_status
            check_medialive_status
            check_cloudfront_status
            check_costs
            test_endpoints
            generate_report
            ;;
        *)
            echo "Usage: $0 [status|costs|test|report|all]"
            echo ""
            echo "Commands:"
            echo "  status  - Check AWS resource status (default)"
            echo "  costs   - Show cost information"
            echo "  test    - Test endpoints"
            echo "  report  - Generate summary report"
            echo "  all     - Run all checks"
            exit 1
            ;;
    esac
    
    echo ""
    print_status "Monitoring complete. For real-time monitoring, open the dashboard:"
    print_status "npm run dashboard"
}

# Run main function
main "$@"
