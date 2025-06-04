#!/bin/bash

# Lunora Player - Videon Edge Node Connectivity Test Script
# This script tests the connectivity between Videon Edge nodes and the Lunora Player backend

set -e

# Configuration
BACKEND_URL="http://localhost:3000"
VIDEON_TEST_ENDPOINT="${BACKEND_URL}/api/videon/test"
STREAM_STATUS_ENDPOINT="${BACKEND_URL}/api/videon/stream-status"

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

# Test basic connectivity
test_basic_connectivity() {
    print_header "Basic Connectivity Test"
    
    print_status "Testing GET request to Videon test endpoint..."
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$VIDEON_TEST_ENDPOINT" 2>/dev/null)
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" = "200" ]; then
        print_success "GET test successful (HTTP $status)"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        print_error "GET test failed (HTTP $status)"
        echo "$body"
        return 1
    fi
}

# Test POST with sample data
test_post_connectivity() {
    print_header "POST Data Test"
    
    print_status "Testing POST request with sample Videon data..."
    
    local test_data='{
        "device": {
            "model": "Videon Edge",
            "firmware": "1.2.3",
            "serial": "VE123456789"
        },
        "stream": {
            "protocol": "SRT",
            "bitrate": 5000000,
            "resolution": "1920x1080",
            "fps": 30
        },
        "network": {
            "interface": "eth0",
            "ip": "192.168.1.100"
        },
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }'
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -H "Content-Type: application/json" \
        -H "User-Agent: Videon-Edge/1.2.3" \
        -d "$test_data" \
        "$VIDEON_TEST_ENDPOINT" 2>/dev/null)
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" = "200" ]; then
        print_success "POST test successful (HTTP $status)"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        print_error "POST test failed (HTTP $status)"
        echo "$body"
        return 1
    fi
}

# Test stream status endpoint
test_stream_status() {
    print_header "Stream Status Check"
    
    print_status "Checking AWS Media Services status..."
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$STREAM_STATUS_ENDPOINT" 2>/dev/null)
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" = "200" ]; then
        print_success "Stream status check successful (HTTP $status)"
        echo "$body" | jq . 2>/dev/null || echo "$body"
        
        # Parse and display key information
        local active_channels=$(echo "$body" | jq -r '.streaming.mediaLive.activeChannels' 2>/dev/null || echo "0")
        local total_channels=$(echo "$body" | jq -r '.streaming.mediaLive.totalChannels' 2>/dev/null || echo "0")
        local mp_endpoints=$(echo "$body" | jq -r '.streaming.mediaPackage.endpoints | length' 2>/dev/null || echo "0")
        
        echo ""
        print_status "Summary:"
        echo "  MediaLive Channels: $active_channels active / $total_channels total"
        echo "  MediaPackage Endpoints: $mp_endpoints"
        
        if [ "$active_channels" = "0" ]; then
            print_warning "No active MediaLive channels - create and start a channel to receive SRT streams"
        else
            print_success "MediaLive channels are ready to receive streams"
        fi
        
    else
        print_error "Stream status check failed (HTTP $status)"
        echo "$body"
        return 1
    fi
}

# Test backend health
test_backend_health() {
    print_header "Backend Health Check"
    
    print_status "Testing backend API health..."
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "${BACKEND_URL}/api/health" 2>/dev/null)
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" = "200" ]; then
        print_success "Backend health check passed (HTTP $status)"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        print_error "Backend health check failed (HTTP $status)"
        echo "$body"
        return 1
    fi
}

# Performance test
test_performance() {
    print_header "Performance Test"
    
    print_status "Running performance test (10 requests)..."
    
    local total_time=0
    local successful_requests=0
    
    for i in {1..10}; do
        local start_time=$(date +%s%N)
        local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$VIDEON_TEST_ENDPOINT" 2>/dev/null)
        local end_time=$(date +%s%N)
        local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
        
        local request_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        total_time=$((total_time + request_time))
        
        if [ "$status" = "200" ]; then
            successful_requests=$((successful_requests + 1))
            echo "  Request $i: ${request_time}ms (✓)"
        else
            echo "  Request $i: ${request_time}ms (✗ HTTP $status)"
        fi
    done
    
    local avg_time=$((total_time / 10))
    local success_rate=$((successful_requests * 100 / 10))
    
    echo ""
    print_status "Performance Results:"
    echo "  Successful requests: $successful_requests/10 ($success_rate%)"
    echo "  Average response time: ${avg_time}ms"
    
    if [ "$success_rate" -eq 100 ] && [ "$avg_time" -lt 1000 ]; then
        print_success "Performance test passed"
    elif [ "$success_rate" -eq 100 ]; then
        print_warning "All requests successful but response time is high (${avg_time}ms)"
    else
        print_error "Performance test failed - $((10 - successful_requests)) requests failed"
    fi
}

# Generate Videon configuration
generate_videon_config() {
    print_header "Videon Edge Node Configuration"
    
    print_status "Generating configuration for Videon Edge node..."
    
    # Get MediaLive input information (if available)
    local ml_response=$(curl -s "${BACKEND_URL}/api/medialive/status" 2>/dev/null)
    
    echo ""
    echo "# Videon Edge Node Configuration for Lunora Player"
    echo "# Generated on: $(date)"
    echo ""
    echo "## Backend API Endpoints:"
    echo "Health Check:     ${BACKEND_URL}/api/health"
    echo "Connectivity Test: ${VIDEON_TEST_ENDPOINT}"
    echo "Stream Status:    ${STREAM_STATUS_ENDPOINT}"
    echo "Dashboard:        http://localhost:8081/dashboard.html"
    echo ""
    echo "## SRT Output Configuration:"
    echo "# Configure your Videon Edge node with these settings:"
    echo "Protocol:         SRT Caller"
    echo "Host:             [MediaLive Input Endpoint - create MediaLive channel first]"
    echo "Port:             9998"
    echo "Latency:          200ms"
    echo "Mode:             Caller"
    echo ""
    echo "## HTTP Monitoring (Optional):"
    echo "# Configure periodic HTTP requests to monitor connectivity:"
    echo "Test URL:         ${VIDEON_TEST_ENDPOINT}"
    echo "Method:           GET or POST"
    echo "Interval:         60 seconds"
    echo "Timeout:          10 seconds"
    echo ""
    echo "## Next Steps:"
    echo "1. Create a MediaLive channel using the dashboard"
    echo "2. Configure Videon Edge node SRT output to MediaLive input"
    echo "3. Start streaming and monitor via dashboard"
}

# Main function
main() {
    echo "=========================================="
    echo "  Lunora Player - Videon Connectivity Test"
    echo "=========================================="
    echo ""
    
    case "${1:-all}" in
        "health")
            test_backend_health
            ;;
        "basic")
            test_basic_connectivity
            ;;
        "post")
            test_post_connectivity
            ;;
        "status")
            test_stream_status
            ;;
        "performance")
            test_performance
            ;;
        "config")
            generate_videon_config
            ;;
        "all")
            test_backend_health
            test_basic_connectivity
            test_post_connectivity
            test_stream_status
            test_performance
            generate_videon_config
            ;;
        *)
            echo "Usage: $0 [health|basic|post|status|performance|config|all]"
            echo ""
            echo "Commands:"
            echo "  health      - Test backend API health"
            echo "  basic       - Test basic GET connectivity"
            echo "  post        - Test POST with sample data"
            echo "  status      - Check stream status"
            echo "  performance - Run performance test"
            echo "  config      - Generate Videon configuration"
            echo "  all         - Run all tests (default)"
            exit 1
            ;;
    esac
    
    echo ""
    print_status "Test completed. Check results above."
}

# Run main function
main "$@"
