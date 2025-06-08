#!/bin/bash

# Lunora Player - Create Production RTMP Channel for OBS Testing
# Creates new RTMP channel pointing to lunora-player-prod-channel

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"

# Use available input security group
INPUT_SECURITY_GROUP="4350659"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_status() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Get infrastructure details
get_infrastructure_details() {
    print_status "Getting infrastructure details..."

    # Get MediaPackage channel ID
    MP_CHANNEL_ID=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaPackageChannelId`].OutputValue' \
        --output text)

    # Get MediaLive role ARN
    ROLE_ARN=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaLiveRoleArn`].OutputValue' \
        --output text)

    # Get HLS endpoint
    HLS_URL=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaPackageHLSEndpoint`].OutputValue' \
        --output text)

    print_success "MediaPackage Channel: $MP_CHANNEL_ID"
    print_success "MediaLive Role: $ROLE_ARN"
    print_success "Input Security Group: $INPUT_SECURITY_GROUP"
    print_success "HLS Endpoint: $HLS_URL"
}

# Create RTMP input
create_rtmp_input() {
    print_status "Creating RTMP input..."

    local input_id=$(aws medialive create-input \
        --name "${PROJECT_NAME}-${ENVIRONMENT}-obs-rtmp-input" \
        --type "RTMP_PUSH" \
        --input-security-groups "$INPUT_SECURITY_GROUP" \
        --destinations StreamName="${PROJECT_NAME}-obs-stream" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Input.Id' \
        --output text)

    echo "$input_id"
}

# Create MediaLive channel using CloudFormation template
create_channel() {
    local channel_name="$1"
    local input_id="$2"
    local input_name="$3"

    print_status "Creating MediaLive channel: $channel_name"

    # Create a temporary CloudFormation template
    local template_file="/tmp/rtmp-channel.yaml"
    cat > "$template_file" <<EOF
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Production RTMP Channel for OBS Testing'

Resources:
  MediaLiveChannel:
    Type: AWS::MediaLive::Channel
    Properties:
      Name: '$channel_name'
      RoleArn: '$ROLE_ARN'
      ChannelClass: 'SINGLE_PIPELINE'
      InputSpecification:
        Codec: 'AVC'
        Resolution: 'HD'
        MaximumBitrate: 'MAX_20_MBPS'
      InputAttachments:
        - InputAttachmentName: '$input_name'
          InputId: '$input_id'
          InputSettings:
            AudioSelectors:
              - Name: 'default-audio'
                SelectorSettings:
                  AudioTrackSelection:
                    Tracks:
                      - Track: 1
            VideoSelector:
              ColorSpace: 'REC_709'
      Destinations:
        - Id: 'mediapackage-destination'
          MediaPackageSettings:
            ChannelId: '$MP_CHANNEL_ID'
          Settings:
            - PasswordParam: ''
              Url: 'https://mediapackage.us-west-2.amazonaws.com/in/v1/$MP_CHANNEL_ID/channel'
              Username: ''
      EncoderSettings:
        TimecodeConfig:
          Source: 'EMBEDDED'
        AudioDescriptions:
          - AudioSelectorName: 'default-audio'
            AudioTypeControl: 'FOLLOW_INPUT'
            LanguageCodeControl: 'FOLLOW_INPUT'
            Name: 'audio_1_aac'
            CodecSettings:
              AacSettings:
                Bitrate: 128000
                CodingMode: 'CODING_MODE_2_0'
                InputType: 'NORMAL'
                Profile: 'LC'
                RateControlMode: 'CBR'
                RawFormat: 'NONE'
                SampleRate: 48000
                Spec: 'MPEG4'
        VideoDescriptions:
          - Name: 'video_1080p30'
            CodecSettings:
              H264Settings:
                Bitrate: 5000000
                FramerateControl: 'SPECIFIED'
                FramerateNumerator: 30
                FramerateDenominator: 1
                GopBReference: 'DISABLED'
                GopClosedCadence: 1
                GopNumBFrames: 2
                GopSize: 90
                GopSizeUnits: 'FRAMES'
                Level: 'H264_LEVEL_4_1'
                LookAheadRateControl: 'MEDIUM'
                NumRefFrames: 3
                ParControl: 'SPECIFIED'
                Profile: 'HIGH'
                RateControlMode: 'CBR'
                Syntax: 'DEFAULT'
            Height: 1080
            Width: 1920
        OutputGroups:
          - Name: 'MediaPackage'
            OutputGroupSettings:
              MediaPackageGroupSettings:
                Destination:
                  DestinationRefId: 'mediapackage-destination'
            Outputs:
              - OutputName: '1080p30'
                VideoDescriptionName: 'video_1080p30'
                AudioDescriptionNames:
                  - 'audio_1_aac'
                OutputSettings:
                  MediaPackageOutputSettings: {}

Outputs:
  ChannelId:
    Value: !Ref MediaLiveChannel
EOF

    # Deploy the stack
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-obs-rtmp"
    aws cloudformation deploy \
        --template-file "$template_file" \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --no-fail-on-empty-changeset

    # Get the channel ID
    local channel_id=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs[?OutputKey==`ChannelId`].OutputValue' \
        --output text)

    # Clean up temp file
    rm -f "$template_file"

    echo "$channel_id"
}

# Get input destinations
get_input_destinations() {
    local input_id="$1"

    print_status "Getting RTMP endpoint for input: $input_id"
    sleep 5  # Wait for input to be fully created

    local rtmp_url=$(aws medialive describe-input \
        --input-id "$input_id" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Destinations[0].Url' \
        --output text 2>/dev/null)

    if [ -z "$rtmp_url" ] || [ "$rtmp_url" = "None" ]; then
        print_warning "Could not get RTMP URL automatically. Please check MediaLive console."
        echo "Check input $input_id in MediaLive console"
    else
        echo "$rtmp_url"
    fi
}

# Main function
main() {
    print_header "Creating Production RTMP Channel for OBS Testing"

    # Get infrastructure details
    get_infrastructure_details

    # Create RTMP input
    print_header "Creating RTMP Input"
    RTMP_INPUT_ID=$(create_rtmp_input)
    print_success "Created RTMP input: $RTMP_INPUT_ID"

    # Create RTMP channel
    print_header "Creating RTMP Channel"
    RTMP_CHANNEL_ID=$(create_channel "${PROJECT_NAME}-${ENVIRONMENT}-obs-rtmp-channel" "$RTMP_INPUT_ID" "rtmp-input")
    print_success "Created RTMP channel: $RTMP_CHANNEL_ID"

    # Get connection information
    print_header "Connection Information"

    # RTMP endpoint
    RTMP_URL=$(get_input_destinations "$RTMP_INPUT_ID")
    print_success "RTMP URL: $RTMP_URL"

    # HLS endpoint
    print_success "HLS Endpoint: $HLS_URL"

    print_header "OBS Configuration"
    echo -e "${GREEN}RTMP Settings for OBS:${NC}"
    echo "  Server: ${RTMP_URL%/*}"
    echo "  Stream Key: ${PROJECT_NAME}-obs-stream"
    echo
    echo -e "${GREEN}To start streaming:${NC}"
    echo "1. Start RTMP channel: aws medialive start-channel --channel-id $RTMP_CHANNEL_ID --region $AWS_REGION --profile $AWS_PROFILE"
    echo "2. Configure OBS with the RTMP settings above"
    echo "3. Start streaming in OBS"
    echo "4. View stream at: $HLS_URL"
    echo
    print_warning "Remember to stop channel when done to avoid charges!"
    echo "Stop RTMP: aws medialive stop-channel --channel-id $RTMP_CHANNEL_ID --region $AWS_REGION --profile $AWS_PROFILE"
    echo
    print_header "Testing the Complete Pipeline"
    echo "This tests: OBS → MediaLive → MediaPackage → HLS Player"
    echo "Your existing dev channels remain completely untouched."
}

main "$@"
