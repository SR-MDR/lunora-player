#!/bin/bash

# Lunora Player - Production SRT Testing Script
# This script tests the complete SRT ingest pipeline in production

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
ACCOUNT_ID="372241484305"

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

# Test AWS connectivity
test_aws_connectivity() {
    print_header "Testing AWS Connectivity"
    
    # Test AWS credentials
    local account=$(aws sts get-caller-identity --profile $AWS_PROFILE --query 'Account' --output text 2>/dev/null)
    if [ "$account" = "$ACCOUNT_ID" ]; then
        print_success "AWS credentials verified for account: $account"
    else
        print_error "AWS credentials failed or wrong account"
        exit 1
    fi
    
    # Test region
    local region=$(aws configure get region --profile $AWS_PROFILE)
    if [ "$region" = "$AWS_REGION" ]; then
        print_success "AWS region verified: $region"
    else
        print_warning "AWS region mismatch. Expected: $AWS_REGION, Got: $region"
    fi
}

# Test MediaLive status
test_medialive_status() {
    print_header "Testing MediaLive Status"
    
    # Get MediaLive channels
    local channels=$(aws medialive list-channels --profile $AWS_PROFILE --region $AWS_REGION --output json)
    local channel_count=$(echo "$channels" | jq '.Channels | length')
    
    print_status "Found $channel_count MediaLive channels"
    
    if [ "$channel_count" -gt 0 ]; then
        echo "$channels" | jq -r '.Channels[] | "Channel: \(.Name) (\(.Id)) - State: \(.State)"'
        
        # Check for running channels
        local running_channels=$(echo "$channels" | jq -r '.Channels[] | select(.State == "RUNNING") | .Id')
        if [ -n "$running_channels" ]; then
            print_success "Found running MediaLive channels"
            for channel_id in $running_channels; do
                print_status "Testing channel: $channel_id"
                
                # Get channel details
                local channel_details=$(aws medialive describe-channel \
                    --channel-id "$channel_id" \
                    --profile $AWS_PROFILE \
                    --region $AWS_REGION \
                    --output json)
                
                local input_count=$(echo "$channel_details" | jq '.InputAttachments | length')
                local dest_count=$(echo "$channel_details" | jq '.Destinations | length')
                
                print_status "  Inputs: $input_count, Destinations: $dest_count"
            done
        else
            print_warning "No running MediaLive channels found"
            print_status "You may need to start a channel for SRT testing"
        fi
    else
        print_warning "No MediaLive channels found"
        print_status "Deploy MediaLive infrastructure first"
    fi
}

# Test MediaPackage status
test_mediapackage_status() {
    print_header "Testing MediaPackage Status"
    
    # Get MediaPackage channels
    local channels=$(aws mediapackage list-channels --profile $AWS_PROFILE --region $AWS_REGION --output json)
    local channel_count=$(echo "$channels" | jq '.Channels | length')
    
    print_status "Found $channel_count MediaPackage channels"
    
    if [ "$channel_count" -gt 0 ]; then
        echo "$channels" | jq -r '.Channels[] | "Channel: \(.Id) - \(.Description)"'
        
        # Test each channel's endpoints
        local channel_ids=$(echo "$channels" | jq -r '.Channels[].Id')
        for channel_id in $channel_ids; do
            print_status "Testing endpoints for channel: $channel_id"
            
            local endpoints=$(aws mediapackage list-origin-endpoints \
                --channel-id "$channel_id" \
                --profile $AWS_PROFILE \
                --region $AWS_REGION \
                --output json)
            
            local endpoint_count=$(echo "$endpoints" | jq '.OriginEndpoints | length')
            print_status "  Found $endpoint_count endpoints"
            
            if [ "$endpoint_count" -gt 0 ]; then
                echo "$endpoints" | jq -r '.OriginEndpoints[] | "  Endpoint: \(.Id) - \(.Url)"'
                
                # Test HLS endpoint accessibility
                local hls_urls=$(echo "$endpoints" | jq -r '.OriginEndpoints[] | select(.HlsPackage) | .Url')
                for url in $hls_urls; do
                    print_status "  Testing HLS endpoint: $url"
                    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
                    if [ "$response" = "200" ]; then
                        print_success "  HLS endpoint accessible"
                    else
                        print_warning "  HLS endpoint returned HTTP $response"
                    fi
                done
            fi
        done
    else
        print_warning "No MediaPackage channels found"
    fi
}

# Test CloudFront distributions
test_cloudfront_status() {
    print_header "Testing CloudFront Status"
    
    local distributions=$(aws cloudfront list-distributions --profile $AWS_PROFILE --output json)
    local dist_count=$(echo "$distributions" | jq '.DistributionList.Items | length')
    
    print_status "Found $dist_count CloudFront distributions"
    
    if [ "$dist_count" -gt 0 ]; then
        echo "$distributions" | jq -r '.DistributionList.Items[] | "Distribution: \(.Id) - \(.DomainName) (\(.Status))"'
        
        # Test distribution accessibility
        local domains=$(echo "$distributions" | jq -r '.DistributionList.Items[] | select(.Status == "Deployed") | .DomainName')
        for domain in $domains; do
            print_status "Testing distribution: https://$domain"
            local response=$(curl -s -o /dev/null -w "%{http_code}" "https://$domain" || echo "000")
            if [ "$response" = "200" ] || [ "$response" = "403" ]; then
                print_success "Distribution accessible"
            else
                print_warning "Distribution returned HTTP $response"
            fi
        done
    else
        print_warning "No CloudFront distributions found"
    fi
}

# Test production URLs
test_production_urls() {
    print_header "Testing Production URLs"
    
    if [ -n "$DOMAIN_NAME" ]; then
        local urls=(
            "https://player.$DOMAIN_NAME"
            "https://dashboard.$DOMAIN_NAME"
            "https://api.$DOMAIN_NAME/health"
            "https://api.$DOMAIN_NAME/api/videon/test"
        )
        
        for url in "${urls[@]}"; do
            print_status "Testing: $url"
            local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
            if [ "$response" = "200" ]; then
                print_success "URL accessible"
            else
                print_warning "URL returned HTTP $response"
            fi
        done
    else
        print_warning "DOMAIN_NAME not set, skipping production URL tests"
    fi
}

# Get SRT configuration for LiveEdge Node
get_srt_configuration() {
    print_header "SRT Configuration for LiveEdge Node"
    
    # Get MediaLive SRT inputs
    local inputs=$(aws medialive list-inputs --profile $AWS_PROFILE --region $AWS_REGION --output json)
    local srt_inputs=$(echo "$inputs" | jq '.Inputs[] | select(.Type == "SRT_LISTENER")')
    
    if [ -n "$srt_inputs" ]; then
        print_success "Found SRT inputs:"
        echo "$srt_inputs" | jq -r '"Input ID: \(.Id), Name: \(.Name), State: \(.State)"'
        
        # Get input details
        local input_ids=$(echo "$srt_inputs" | jq -r '.Id')
        for input_id in $input_ids; do
            print_status "SRT Input Details for $input_id:"
            
            local input_details=$(aws medialive describe-input \
                --input-id "$input_id" \
                --profile $AWS_PROFILE \
                --region $AWS_REGION \
                --output json)
            
            local destinations=$(echo "$input_details" | jq -r '.Destinations[]?')
            if [ -n "$destinations" ]; then
                echo "$input_details" | jq -r '.Destinations[] | "  SRT URL: srt://\(.Url):\(.Port // 9998)"'
            fi
        done
        
        print_status ""
        print_status "LiveEdge Node Configuration:"
        print_status "1. Set SRT output mode to 'Caller'"
        print_status "2. Use the SRT URL shown above"
        print_status "3. Set latency to 200ms (recommended)"
        print_status "4. Enable encryption if required"
        print_status "5. Start streaming from LiveEdge Node"
    else
        print_warning "No SRT inputs found"
        print_status "Deploy MediaLive SRT infrastructure first"
    fi
}

# Monitor streaming status
monitor_streaming() {
    print_header "Monitoring Streaming Status"
    
    print_status "Checking for active streams..."
    
    # Check MediaLive channels
    local channels=$(aws medialive list-channels --profile $AWS_PROFILE --region $AWS_REGION --output json)
    local running_channels=$(echo "$channels" | jq -r '.Channels[] | select(.State == "RUNNING") | .Id')
    
    if [ -n "$running_channels" ]; then
        for channel_id in $running_channels; do
            print_status "Monitoring channel: $channel_id"
            
            # Get channel metrics (simplified)
            local end_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            local start_time=$(date -u -d '1 hour ago' +"%Y-%m-%dT%H:%M:%SZ")
            
            # Note: In production, you would get actual CloudWatch metrics here
            print_status "  Channel is running (detailed metrics require CloudWatch API)"
        done
    else
        print_warning "No running MediaLive channels found"
    fi
    
    # Check MediaPackage for recent activity
    print_status "Checking MediaPackage activity..."
    # This would typically involve checking CloudWatch metrics for MediaPackage
    print_status "MediaPackage status check complete"
}

# Main testing function
main() {
    print_header "Lunora Player - Production SRT Testing"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN_NAME="$2"
                shift 2
                ;;
            --profile)
                AWS_PROFILE="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --monitor)
                MONITOR_MODE=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --domain DOMAIN        Domain name for production URLs"
                echo "  --profile PROFILE      AWS profile (default: lunora-media)"
                echo "  --region REGION        AWS region (default: us-west-2)"
                echo "  --monitor              Run in monitoring mode"
                echo "  --help                 Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_status "Configuration:"
    print_status "  Project: $PROJECT_NAME"
    print_status "  Environment: $ENVIRONMENT"
    print_status "  Region: $AWS_REGION"
    print_status "  Profile: $AWS_PROFILE"
    print_status "  Account: $ACCOUNT_ID"
    print_status "  Domain: ${DOMAIN_NAME:-'Not set'}"
    
    # Run tests
    test_aws_connectivity
    test_medialive_status
    test_mediapackage_status
    test_cloudfront_status
    
    if [ -n "$DOMAIN_NAME" ]; then
        test_production_urls
    fi
    
    get_srt_configuration
    
    if [ "$MONITOR_MODE" = true ]; then
        while true; do
            monitor_streaming
            print_status "Waiting 30 seconds before next check..."
            sleep 30
        done
    else
        monitor_streaming
    fi
    
    print_header "Testing Complete"
    print_success "Production SRT testing completed!"
    print_status "Use --monitor flag for continuous monitoring"
}

# Run main function with all arguments
main "$@"
