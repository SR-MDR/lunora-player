#!/bin/bash

# Lunora Player - Create MediaLive Channel with AWS CLI
# Simple approach for immediate OBS testing

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

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get MediaPackage channel ID
get_mediapackage_channel_id() {
    aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "Stacks[0].Outputs[?OutputKey=='MediaPackageChannelId'].OutputValue" \
        --output text
}

# Get MediaLive role ARN
get_medialive_role_arn() {
    aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "Stacks[0].Outputs[?OutputKey=='MediaLiveRoleArn'].OutputValue" \
        --output text
}

# Create MediaLive input security group
create_input_security_group() {
    print_status "Creating MediaLive input security group..."

    aws medialive create-input-security-group \
        --whitelist-rules Cidr=0.0.0.0/0 \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'SecurityGroup.Id' \
        --output text
}

# Create MediaLive RTMP input
create_rtmp_input() {
    local sg_id=$1

    print_status "Creating MediaLive RTMP input..."

    aws medialive create-input \
        --name "${PROJECT_NAME}-${ENVIRONMENT}-rtmp-input" \
        --type RTMP_PUSH \
        --input-security-groups "$sg_id" \
        --destinations StreamName="${PROJECT_NAME}-${ENVIRONMENT}-stream" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Input.Id' \
        --output text
}

# Get input destinations
get_input_destinations() {
    local input_id=$1
    
    aws medialive describe-input \
        --input-id "$input_id" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Destinations[0].Url' \
        --output text
}

# Create MediaLive channel
create_medialive_channel() {
    local input_id=$1
    local channel_id=$2
    local role_arn=$3
    
    print_status "Creating MediaLive channel..."
    
    # Create channel configuration JSON
    cat > /tmp/medialive-channel.json << EOF
{
    "Name": "${PROJECT_NAME}-${ENVIRONMENT}-channel",
    "RoleArn": "$role_arn",
    "ChannelClass": "SINGLE_PIPELINE",
    "InputSpecification": {
        "Codec": "AVC",
        "Resolution": "HD",
        "MaximumBitrate": "MAX_20_MBPS"
    },
    "InputAttachments": [
        {
            "InputAttachmentName": "rtmp-input",
            "InputId": "$input_id",
            "InputSettings": {
                "AudioSelectors": [
                    {
                        "Name": "default-audio",
                        "SelectorSettings": {
                            "AudioTrackSelection": {
                                "Tracks": [
                                    {
                                        "Track": 1
                                    }
                                ]
                            }
                        }
                    }
                ],
                "VideoSelector": {
                    "ColorSpace": "REC_709"
                }
            }
        }
    ],
    "Destinations": [
        {
            "Id": "mediapackage-destination",
            "MediaPackageSettings": {
                "ChannelId": "$channel_id"
            },
            "Settings": [
                {
                    "PasswordParam": "",
                    "Url": "https://mediapackage.${AWS_REGION}.amazonaws.com/in/v1/${channel_id}/channel",
                    "Username": ""
                }
            ]
        }
    ],
    "EncoderSettings": {
        "TimecodeConfig": {
            "Source": "EMBEDDED"
        },
        "AudioDescriptions": [
            {
                "AudioTypeControl": "FOLLOW_INPUT",
                "CodecSettings": {
                    "AacSettings": {
                        "Bitrate": 128000,
                        "CodingMode": "CODING_MODE_2_0",
                        "InputType": "NORMAL",
                        "Profile": "LC",
                        "RateControlMode": "CBR",
                        "RawFormat": "NONE",
                        "SampleRate": 48000,
                        "Spec": "MPEG4"
                    }
                },
                "LanguageCodeControl": "FOLLOW_INPUT",
                "Name": "audio_1"
            }
        ],
        "VideoDescriptions": [
            {
                "CodecSettings": {
                    "H264Settings": {
                        "AdaptiveQuantization": "HIGH",
                        "AfdSignaling": "NONE",
                        "Bitrate": 5000000,
                        "ColorMetadata": "INSERT",
                        "EntropyEncoding": "CABAC",
                        "FlickerAq": "ENABLED",
                        "FramerateControl": "SPECIFIED",
                        "FramerateNumerator": 30,
                        "FramerateDenominator": 1,
                        "GopBReference": "DISABLED",
                        "GopClosedCadence": 1,
                        "GopNumBFrames": 2,
                        "GopSize": 90,
                        "GopSizeUnits": "FRAMES",
                        "Level": "H264_LEVEL_AUTO",
                        "LookAheadRateControl": "MEDIUM",
                        "NumRefFrames": 3,
                        "ParControl": "SPECIFIED",
                        "Profile": "HIGH",
                        "RateControlMode": "CBR",
                        "Syntax": "DEFAULT",
                        "SceneChangeDetect": "ENABLED",
                        "SpatialAq": "ENABLED",
                        "TemporalAq": "ENABLED"
                    }
                },
                "Height": 1080,
                "Name": "video_1080p",
                "RespondToAfd": "NONE",
                "ScalingBehavior": "DEFAULT",
                "Sharpness": 50,
                "Width": 1920
            }
        ],
        "OutputGroups": [
            {
                "Name": "MediaPackage",
                "OutputGroupSettings": {
                    "MediaPackageGroupSettings": {
                        "Destination": {
                            "DestinationRefId": "mediapackage-destination"
                        }
                    }
                },
                "Outputs": [
                    {
                        "AudioDescriptionNames": [
                            "audio_1"
                        ],
                        "OutputName": "output_1080p",
                        "OutputSettings": {
                            "MediaPackageOutputSettings": {}
                        },
                        "VideoDescriptionName": "video_1080p"
                    }
                ]
            }
        ]
    }
}
EOF

    aws medialive create-channel \
        --cli-input-json file:///tmp/medialive-channel.json \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Channel.Id' \
        --output text

    # Clean up temp file
    rm -f /tmp/medialive-channel.json
}

# Main execution
main() {
    print_status "Creating MediaLive infrastructure for OBS testing"
    
    # Get required values
    local mp_channel_id=$(get_mediapackage_channel_id)
    local role_arn=$(get_medialive_role_arn)
    
    if [ -z "$mp_channel_id" ] || [ -z "$role_arn" ]; then
        print_error "Failed to get required infrastructure values"
        print_error "MediaPackage Channel ID: $mp_channel_id"
        print_error "MediaLive Role ARN: $role_arn"
        exit 1
    fi
    
    print_status "Using MediaPackage Channel: $mp_channel_id"
    print_status "Using MediaLive Role: $role_arn"
    
    # Create resources
    local sg_id=$(create_input_security_group)
    print_success "Created input security group: $sg_id"
    
    local input_id=$(create_rtmp_input "$sg_id")
    print_success "Created RTMP input: $input_id"
    
    local ml_channel_id=$(create_medialive_channel "$input_id" "$mp_channel_id" "$role_arn")
    print_success "Created MediaLive channel: $ml_channel_id"
    
    # Get RTMP endpoint
    sleep 5  # Wait for input to be fully created
    local rtmp_url=$(get_input_destinations "$input_id")
    
    echo
    print_success "MediaLive infrastructure created successfully!"
    echo
    print_status "OBS Configuration:"
    echo -e "${GREEN}Server:${NC} rtmp://$rtmp_url/live"
    echo -e "${GREEN}Stream Key:${NC} ${PROJECT_NAME}-${ENVIRONMENT}-stream"
    echo
    print_status "MediaLive Channel ID: $ml_channel_id"
    print_status "Start the channel with: aws medialive start-channel --channel-id $ml_channel_id --region $AWS_REGION --profile $AWS_PROFILE"
}

main "$@"
