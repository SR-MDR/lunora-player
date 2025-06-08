#!/bin/bash

# Lunora Player - Manage Streaming Services
# Start, stop, and monitor MediaLive channels and streaming pipeline

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get stack output
get_stack_output() {
    local stack_name=$1
    local output_key=$2
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Function to get MediaLive channel ID
get_channel_id() {
    # Check for existing channels first
    local rtmp_channel=$(aws medialive list-channels \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Channels[?Name==`lunora-prod-channel`].Id' \
        --output text 2>/dev/null)

    if [ -n "$rtmp_channel" ]; then
        echo "$rtmp_channel"
        return
    fi

    # Fallback to CloudFormation output
    local channel_stack="${PROJECT_NAME}-${ENVIRONMENT}-medialive"
    get_stack_output "$channel_stack" "MediaLiveChannelId"
}

# Function to get SRT channel ID
get_srt_channel_id() {
    aws medialive list-channels \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Channels[?Name==`lunora-prod-srt-channel`].Id' \
        --output text 2>/dev/null
}

# Function to get channel state
get_channel_state() {
    local channel_id=$1
    
    aws medialive describe-channel \
        --channel-id "$channel_id" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'State' \
        --output text 2>/dev/null || echo "NOT_FOUND"
}

# Function to start MediaLive channel
start_channel() {
    local channel_id=$(get_channel_id)
    
    if [ -z "$channel_id" ]; then
        print_error "MediaLive channel not found. Deploy infrastructure first."
        exit 1
    fi
    
    local state=$(get_channel_state "$channel_id")
    
    case "$state" in
        "RUNNING")
            print_warning "Channel is already running"
            ;;
        "IDLE")
            print_status "Starting MediaLive channel: $channel_id"
            aws medialive start-channel \
                --channel-id "$channel_id" \
                --region "$AWS_REGION" \
                --profile "$AWS_PROFILE"
            print_success "Channel start command sent. It may take a few minutes to fully start."
            ;;
        "STARTING")
            print_warning "Channel is already starting"
            ;;
        *)
            print_error "Channel is in state: $state. Cannot start."
            exit 1
            ;;
    esac
}

# Function to stop MediaLive channel
stop_channel() {
    local channel_id=$(get_channel_id)
    
    if [ -z "$channel_id" ]; then
        print_error "MediaLive channel not found."
        exit 1
    fi
    
    local state=$(get_channel_state "$channel_id")
    
    case "$state" in
        "IDLE")
            print_warning "Channel is already stopped"
            ;;
        "RUNNING")
            print_status "Stopping MediaLive channel: $channel_id"
            aws medialive stop-channel \
                --channel-id "$channel_id" \
                --region "$AWS_REGION" \
                --profile "$AWS_PROFILE"
            print_success "Channel stop command sent. It may take a few minutes to fully stop."
            ;;
        "STOPPING")
            print_warning "Channel is already stopping"
            ;;
        *)
            print_error "Channel is in state: $state. Cannot stop."
            exit 1
            ;;
    esac
}

# Function to show status
show_status() {
    local infra_stack="${PROJECT_NAME}-${ENVIRONMENT}-infrastructure"
    local channel_stack="${PROJECT_NAME}-${ENVIRONMENT}-medialive"
    local channel_id=$(get_channel_id)
    
    echo
    print_status "Lunora Player Streaming Status"
    echo "================================"
    echo
    
    # Infrastructure status
    if aws cloudformation describe-stacks --stack-name "$infra_stack" --region "$AWS_REGION" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Infrastructure Stack: DEPLOYED"
        
        # MediaPackage info
        local hls_url=$(get_stack_output "$infra_stack" "MediaPackageHLSEndpoint")
        echo -e "${GREEN}✓${NC} MediaPackage HLS Endpoint: $hls_url"
    else
        echo -e "${RED}✗${NC} Infrastructure Stack: NOT DEPLOYED"
    fi
    
    # MediaLive status
    if [ -n "$channel_id" ]; then
        local state=$(get_channel_state "$channel_id")
        case "$state" in
            "RUNNING")
                echo -e "${GREEN}✓${NC} MediaLive Channel: RUNNING ($channel_id)"
                ;;
            "IDLE")
                echo -e "${YELLOW}⚠${NC} MediaLive Channel: STOPPED ($channel_id)"
                ;;
            "STARTING")
                echo -e "${BLUE}⏳${NC} MediaLive Channel: STARTING ($channel_id)"
                ;;
            "STOPPING")
                echo -e "${BLUE}⏳${NC} MediaLive Channel: STOPPING ($channel_id)"
                ;;
            *)
                echo -e "${RED}✗${NC} MediaLive Channel: $state ($channel_id)"
                ;;
        esac
        
        # RTMP endpoint info
        local rtmp_endpoint=$(get_stack_output "$channel_stack" "PrimaryInputEndpoint")
        if [ -n "$rtmp_endpoint" ]; then
            echo -e "${GREEN}✓${NC} RTMP Endpoint: $rtmp_endpoint"
        fi
    else
        echo -e "${RED}✗${NC} MediaLive Channel: NOT DEPLOYED"
    fi
    
    echo
}

# Function to show connection info for OBS
show_obs_config() {
    local channel_stack="${PROJECT_NAME}-${ENVIRONMENT}-medialive"
    local rtmp_endpoint=$(get_stack_output "$channel_stack" "PrimaryInputEndpoint")
    
    if [ -z "$rtmp_endpoint" ]; then
        print_error "RTMP endpoint not found. Deploy infrastructure first."
        exit 1
    fi
    
    echo
    print_status "OBS Studio Configuration"
    echo "========================"
    echo
    echo -e "${GREEN}Stream Type:${NC} Custom Streaming Server"
    echo -e "${GREEN}Server:${NC} ${rtmp_endpoint%/*}"
    echo -e "${GREEN}Stream Key:${NC} ${rtmp_endpoint##*/}"
    echo
    print_status "Steps to configure OBS:"
    echo "1. Open OBS Studio"
    echo "2. Go to Settings > Stream"
    echo "3. Select 'Custom Streaming Server'"
    echo "4. Enter the Server and Stream Key above"
    echo "5. Click OK and start streaming"
    echo
}

# Function to test HLS playback
test_hls_playback() {
    local infra_stack="${PROJECT_NAME}-${ENVIRONMENT}-infrastructure"
    local hls_url=$(get_stack_output "$infra_stack" "MediaPackageHLSEndpoint")
    
    if [ -z "$hls_url" ]; then
        print_error "HLS endpoint not found. Deploy infrastructure first."
        exit 1
    fi
    
    print_status "Testing HLS endpoint: $hls_url"
    
    # Test if endpoint is accessible
    if curl -s --head "$hls_url" | head -n 1 | grep -q "200 OK"; then
        print_success "HLS endpoint is accessible"
        echo -e "${GREEN}Player URL:${NC} $hls_url"
        echo
        print_status "You can test playback at:"
        echo "https://hls-js.netlify.app/demo/?src=$hls_url"
    else
        print_warning "HLS endpoint is not accessible yet (this is normal if no stream is active)"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  start       Start the MediaLive channel"
    echo "  stop        Stop the MediaLive channel"
    echo "  status      Show streaming infrastructure status"
    echo "  obs-config  Show OBS Studio configuration"
    echo "  test-hls    Test HLS endpoint accessibility"
    echo "  help        Show this help message"
    echo
}

# Main execution
main() {
    local command=${1:-status}
    
    case "$command" in
        "start")
            start_channel
            ;;
        "stop")
            stop_channel
            ;;
        "status")
            show_status
            ;;
        "obs-config")
            show_obs_config
            ;;
        "test-hls")
            test_hls_playback
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
