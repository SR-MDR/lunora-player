#!/bin/bash

# Simple script to create OBS RTMP channel using existing input
set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
RTMP_INPUT_ID="7107272"  # The input we just created

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_status() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Get infrastructure details
print_header "Getting Infrastructure Details"

MP_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaPackageChannelId`].OutputValue' \
    --output text)

ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaLiveRoleArn`].OutputValue' \
    --output text)

HLS_URL=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaPackageHLSEndpoint`].OutputValue' \
    --output text)

print_success "MediaPackage Channel: $MP_CHANNEL_ID"
print_success "MediaLive Role: $ROLE_ARN"
print_success "Using RTMP Input: $RTMP_INPUT_ID"
print_success "HLS Endpoint: $HLS_URL"

# Deploy channel using CloudFormation
print_header "Creating RTMP Channel"

cat > /tmp/obs-rtmp-channel.yaml <<EOF
AWSTemplateFormatVersion: '2010-09-09'
Description: 'OBS RTMP Channel for Production Testing'

Resources:
  MediaLiveChannel:
    Type: AWS::MediaLive::Channel
    Properties:
      Name: '${PROJECT_NAME}-${ENVIRONMENT}-obs-rtmp-channel'
      RoleArn: '${ROLE_ARN}'
      ChannelClass: 'SINGLE_PIPELINE'
      InputSpecification:
        Codec: 'AVC'
        Resolution: 'HD'
        MaximumBitrate: 'MAX_20_MBPS'
      InputAttachments:
        - InputAttachmentName: 'rtmp-input'
          InputId: '${RTMP_INPUT_ID}'
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
            - ChannelId: '${MP_CHANNEL_ID}'
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
    Description: 'MediaLive Channel ID'
EOF

# Deploy the stack
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-obs-rtmp"
print_status "Deploying CloudFormation stack: $STACK_NAME"

aws cloudformation deploy \
    --template-file /tmp/obs-rtmp-channel.yaml \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --no-fail-on-empty-changeset

# Get the channel ID
CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`ChannelId`].OutputValue' \
    --output text)

print_success "Created MediaLive channel: $CHANNEL_ID"

# Get RTMP endpoint
print_header "Getting RTMP Connection Details"
sleep 5

RTMP_URL=$(aws medialive describe-input \
    --input-id "$RTMP_INPUT_ID" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Destinations[0].Url' \
    --output text 2>/dev/null || echo "Check MediaLive console")

print_success "RTMP URL: $RTMP_URL"

# Clean up
rm -f /tmp/obs-rtmp-channel.yaml

print_header "OBS Configuration"
echo -e "${GREEN}RTMP Settings for OBS:${NC}"
if [[ "$RTMP_URL" != "Check MediaLive console" ]]; then
    echo "  Server: ${RTMP_URL%/*}"
    echo "  Stream Key: ${PROJECT_NAME}-obs-stream"
else
    echo "  Check MediaLive console for input $RTMP_INPUT_ID details"
fi
echo
echo -e "${GREEN}To start streaming:${NC}"
echo "1. Start channel: aws medialive start-channel --channel-id $CHANNEL_ID --region $AWS_REGION --profile $AWS_PROFILE"
echo "2. Configure OBS with the RTMP settings above"
echo "3. Start streaming in OBS"
echo "4. View stream at: $HLS_URL"
echo
echo -e "${GREEN}To stop streaming:${NC}"
echo "aws medialive stop-channel --channel-id $CHANNEL_ID --region $AWS_REGION --profile $AWS_PROFILE"
echo
print_header "Complete Pipeline Test"
echo "This tests: OBS → MediaLive → MediaPackage → HLS Player"
echo "Your existing dev channels (6890857, 6802366) remain completely untouched."
