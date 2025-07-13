#!/bin/bash

# Fix Restream RTMP Stream Key
# This script updates the MediaLive channel with the correct Restream stream key

set -e

# Configuration
CHANNEL_ID="3714710"
PROFILE="lunora-media"
REGION="us-west-2"

echo "🔧 Fixing Restream RTMP Stream Key Configuration"
echo "================================================"

# Check if stream key is provided
if [ -z "$1" ]; then
    echo "❌ Error: Stream key required"
    echo ""
    echo "Usage: $0 <your-restream-stream-key>"
    echo ""
    echo "To get your Restream stream key:"
    echo "1. Log into your Restream account"
    echo "2. Go to Settings > Channel Settings"
    echo "3. Copy your Stream Key"
    echo ""
    echo "Example: $0 re_1234567_abcdef123456"
    exit 1
fi

STREAM_KEY="$1"

echo "📋 Configuration:"
echo "   Channel ID: $CHANNEL_ID"
echo "   Stream Key: ${STREAM_KEY:0:10}... (truncated for security)"
echo "   Profile: $PROFILE"
echo "   Region: $REGION"
echo ""

# Get current channel configuration
echo "🔍 Getting current channel configuration..."
CHANNEL_CONFIG=$(aws medialive describe-channel \
    --channel-id "$CHANNEL_ID" \
    --profile "$PROFILE" \
    --region "$REGION")

if [ $? -ne 0 ]; then
    echo "❌ Failed to get channel configuration"
    exit 1
fi

echo "✅ Channel configuration retrieved"

# Check if channel is running
CHANNEL_STATE=$(echo "$CHANNEL_CONFIG" | jq -r '.State')
echo "📊 Current channel state: $CHANNEL_STATE"

if [ "$CHANNEL_STATE" != "RUNNING" ] && [ "$CHANNEL_STATE" != "IDLE" ]; then
    echo "⚠️  Warning: Channel is in state '$CHANNEL_STATE'"
    echo "   This script works best when channel is RUNNING or IDLE"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted by user"
        exit 1
    fi
fi

# Update the RTMP destination with new stream key
echo ""
echo "🔄 Updating RTMP destination with new stream key..."

# Extract current encoder settings and update the RTMP destination
UPDATED_CONFIG=$(echo "$CHANNEL_CONFIG" | jq --arg streamkey "$STREAM_KEY" '
    .EncoderSettings.OutputGroups |= map(
        if .OutputGroupSettings.RtmpGroupSettings then
            .Outputs[0].OutputSettings.RtmpOutputSettings.Destination.StreamName = $streamkey
        else
            .
        end
    )
')

# Create the update request
UPDATE_REQUEST=$(echo "$CHANNEL_CONFIG" | jq --arg streamkey "$STREAM_KEY" '{
    ChannelId: .Id,
    EncoderSettings: (.EncoderSettings | 
        .OutputGroups |= map(
            if .OutputGroupSettings.RtmpGroupSettings then
                .Outputs[0].OutputSettings.RtmpOutputSettings.Destination.StreamName = $streamkey
            else
                .
            end
        )
    )
}')

# Apply the update
echo "📤 Applying channel update..."
aws medialive update-channel \
    --cli-input-json "$UPDATE_REQUEST" \
    --profile "$PROFILE" \
    --region "$REGION" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Channel updated successfully!"
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Wait 30-60 seconds for the change to take effect"
    echo "2. Check your Restream dashboard for incoming stream"
    echo "3. Verify the stream is working in the Lunora GUI"
    echo ""
    echo "🔗 Restream Dashboard: https://restream.io/dashboard"
    echo "🔗 Lunora Streaming GUI: https://d35au6zpsr51nc.cloudfront.net/streaming.html"
else
    echo "❌ Failed to update channel"
    exit 1
fi

echo ""
echo "🎉 Stream key update complete!"
