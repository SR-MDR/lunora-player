#!/bin/bash

# Lunora Player - Duplicate MediaLive Channels for Production
# Creates production copies of existing dev channels pointing to new MediaPackage channel

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Get new MediaPackage channel ID
get_new_mediapackage_channel_id() {
    aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "Stacks[0].Outputs[?OutputKey=='MediaPackageChannelId'].OutputValue" \
        --output text
}

# Get new MediaLive role ARN
get_new_medialive_role_arn() {
    aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query "Stacks[0].Outputs[?OutputKey=='MediaLiveRoleArn'].OutputValue" \
        --output text
}

# Get existing channel configuration
get_channel_config() {
    local channel_id=$1
    aws medialive describe-channel \
        --channel-id "$channel_id" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
}

# Get existing input configuration
get_input_config() {
    local input_id=$1
    aws medialive describe-input \
        --input-id "$input_id" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE"
}

# Duplicate input security group
duplicate_input_security_group() {
    local original_sg_id=$1
    local new_name=$2
    
    print_status "Creating new input security group: $new_name"
    
    # Get original security group rules
    local whitelist_rules=$(aws medialive describe-input-security-group \
        --input-security-group-id "$original_sg_id" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'WhitelistRules' \
        --output json)
    
    # Create new security group
    aws medialive create-input-security-group \
        --whitelist-rules "$whitelist_rules" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'SecurityGroup.Id' \
        --output text
}

# Duplicate RTMP input
duplicate_rtmp_input() {
    local original_input_id=$1
    local new_sg_id=$2
    
    print_status "Duplicating RTMP input..."
    
    # Get original input config
    local input_config=$(get_input_config "$original_input_id")
    local stream_name=$(echo "$input_config" | jq -r '.Destinations[0].StreamName // "lunora-prod-stream"')
    
    # Create new RTMP input
    aws medialive create-input \
        --name "${PROJECT_NAME}-${ENVIRONMENT}-rtmp-input" \
        --type RTMP_PUSH \
        --input-security-groups "$new_sg_id" \
        --destinations StreamName="$stream_name" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Input.Id' \
        --output text
}

# Duplicate SRT input
duplicate_srt_input() {
    local original_input_id=$1
    local new_sg_id=$2
    
    print_status "Duplicating SRT input..."
    
    # Get original input config
    local input_config=$(get_input_config "$original_input_id")
    local stream_id=$(echo "$input_config" | jq -r '.SrtSettings.SrtCallerSources[0].StreamId // "lunora-prod-srt-stream"')
    local port=$(echo "$input_config" | jq -r '.SrtSettings.SrtCallerSources[0].SrtListenerPort // 9998')
    local latency=$(echo "$input_config" | jq -r '.SrtSettings.SrtCallerSources[0].MinimumLatency // 2000')
    
    # Create new SRT input
    aws medialive create-input \
        --name "${PROJECT_NAME}-${ENVIRONMENT}-srt-input" \
        --type SRT_CALLER \
        --input-security-groups "$new_sg_id" \
        --srt-settings "SrtCallerSources=[{SrtListenerAddress=0.0.0.0,SrtListenerPort=$port,StreamId=$stream_id,MinimumLatency=$latency}]" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Input.Id' \
        --output text
}

# Create channel configuration JSON
create_channel_config() {
    local channel_name=$1
    local input_id=$2
    local input_name=$3
    local mp_channel_id=$4
    local role_arn=$5
    
    cat > "/tmp/${channel_name}-config.json" << EOF
{
    "Name": "$channel_name",
    "RoleArn": "$role_arn",
    "ChannelClass": "SINGLE_PIPELINE",
    "InputSpecification": {
        "Codec": "AVC",
        "Resolution": "HD",
        "MaximumBitrate": "MAX_20_MBPS"
    },
    "InputAttachments": [
        {
            "InputAttachmentName": "$input_name",
            "InputId": "$input_id",
            "InputSettings": {
                "AudioSelectors": [
                    {
                        "Name": "Default",
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
                    "ColorSpace": "REC_709",
                    "ColorSpaceUsage": "FORCE"
                },
                "SourceEndBehavior": "CONTINUE"
            }
        }
    ],
    "Destinations": [
        {
            "Id": "mediapackage",
            "MediaPackageSettings": {
                "ChannelId": "$mp_channel_id"
            }
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
                "Name": "Default"
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
                            "DestinationRefId": "mediapackage"
                        }
                    }
                },
                "Outputs": [
                    {
                        "AudioDescriptionNames": [
                            "Default"
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
}

# Create MediaLive channel
create_channel() {
    local config_file=$1
    
    aws medialive create-channel \
        --cli-input-json "file://$config_file" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'Channel.Id' \
        --output text
}

# Main execution
main() {
    print_status "Duplicating MediaLive channels for production environment"
    
    # Get required values
    local mp_channel_id=$(get_new_mediapackage_channel_id)
    local role_arn=$(get_new_medialive_role_arn)
    
    if [ -z "$mp_channel_id" ] || [ -z "$role_arn" ]; then
        print_error "Failed to get required infrastructure values"
        exit 1
    fi
    
    print_status "Using MediaPackage Channel: $mp_channel_id"
    print_status "Using MediaLive Role: $role_arn"
    
    # Existing channel and input IDs
    local rtmp_channel_id="6890857"
    local srt_channel_id="6802366"
    local rtmp_input_id="2012618"
    local srt_input_id="4739436"
    
    # Create new security groups
    print_status "Creating new input security groups..."
    local rtmp_sg_id=$(duplicate_input_security_group "5445923" "lunora-prod-rtmp-sg")
    local srt_sg_id=$(duplicate_input_security_group "5445923" "lunora-prod-srt-sg")
    
    print_success "Created RTMP security group: $rtmp_sg_id"
    print_success "Created SRT security group: $srt_sg_id"
    
    # Create new inputs
    local new_rtmp_input_id=$(duplicate_rtmp_input "$rtmp_input_id" "$rtmp_sg_id")
    local new_srt_input_id=$(duplicate_srt_input "$srt_input_id" "$srt_sg_id")
    
    print_success "Created RTMP input: $new_rtmp_input_id"
    print_success "Created SRT input: $new_srt_input_id"
    
    # Create channel configurations
    create_channel_config "${PROJECT_NAME}-${ENVIRONMENT}-rtmp-channel" "$new_rtmp_input_id" "rtmp-input" "$mp_channel_id" "$role_arn"
    create_channel_config "${PROJECT_NAME}-${ENVIRONMENT}-srt-channel" "$new_srt_input_id" "srt-input" "$mp_channel_id" "$role_arn"
    
    # Create channels
    print_status "Creating production MediaLive channels..."
    local new_rtmp_channel_id=$(create_channel "/tmp/${PROJECT_NAME}-${ENVIRONMENT}-rtmp-channel-config.json")
    local new_srt_channel_id=$(create_channel "/tmp/${PROJECT_NAME}-${ENVIRONMENT}-srt-channel-config.json")
    
    # Clean up temp files
    rm -f "/tmp/${PROJECT_NAME}-${ENVIRONMENT}-rtmp-channel-config.json"
    rm -f "/tmp/${PROJECT_NAME}-${ENVIRONMENT}-srt-channel-config.json"
    
    print_success "Created RTMP channel: $new_rtmp_channel_id"
    print_success "Created SRT channel: $new_srt_channel_id"
    
    # Get connection information
    sleep 5  # Wait for resources to be fully created
    
    echo
    print_success "Production MediaLive channels created successfully!"
    echo
    print_status "Connection Information:"
    echo
    
    # RTMP endpoint
    local rtmp_url=$(aws medialive describe-input --input-id "$new_rtmp_input_id" --region "$AWS_REGION" --profile "$AWS_PROFILE" --query 'Destinations[0].Url' --output text)
    echo -e "${GREEN}RTMP Channel ID:${NC} $new_rtmp_channel_id"
    echo -e "${GREEN}RTMP Endpoint:${NC} $rtmp_url"
    echo
    
    # SRT endpoint
    echo -e "${GREEN}SRT Channel ID:${NC} $new_srt_channel_id"
    echo -e "${GREEN}SRT Endpoint:${NC} srt://0.0.0.0:9998?streamid=lunora-prod-srt-stream"
    echo
    
    # MediaPackage HLS endpoint
    local hls_url=$(aws cloudformation describe-stacks --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-infrastructure" --region "$AWS_REGION" --profile "$AWS_PROFILE" --query "Stacks[0].Outputs[?OutputKey=='MediaPackageHLSEndpoint'].OutputValue" --output text)
    echo -e "${GREEN}HLS Endpoint:${NC} $hls_url"
    echo
    
    print_warning "Remember to start the channels before streaming!"
    echo "RTMP: aws medialive start-channel --channel-id $new_rtmp_channel_id --region $AWS_REGION --profile $AWS_PROFILE"
    echo "SRT:  aws medialive start-channel --channel-id $new_srt_channel_id --region $AWS_REGION --profile $AWS_PROFILE"
}

main "$@"
