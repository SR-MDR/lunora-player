# Manual MediaLive Setup for OBS Testing

## Quick Setup Guide

Since we have the infrastructure deployed successfully, here's how to quickly set up MediaLive for OBS testing:

### Current Infrastructure Status ✅
- **MediaPackage Channel**: `lunora-player-prod-channel`
- **HLS Endpoint**: `https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/ab090a5ad83f4d26b3ae8a23f3512081/index.m3u8`
- **IAM Role**: `arn:aws:iam::372241484305:role/lunora-player-prod-medialive-role`

### Step 1: Create MediaLive Input Security Group

```bash
aws medialive create-input-security-group \
    --whitelist-rules Cidr=0.0.0.0/0 \
    --region us-west-2 \
    --profile lunora-media
```

**Note the Security Group ID from the output**

### Step 2: Create RTMP Input

```bash
aws medialive create-input \
    --name "lunora-player-prod-rtmp-input" \
    --type RTMP_PUSH \
    --input-security-groups "YOUR_SECURITY_GROUP_ID" \
    --destinations StreamName="lunora-player-prod-stream" \
    --region us-west-2 \
    --profile lunora-media
```

**Note the Input ID and Destinations URL from the output**

### Step 3: Create MediaLive Channel (Simplified)

Use AWS Console for this step:

1. Go to AWS MediaLive Console
2. Click "Create channel"
3. **General info**:
   - Name: `lunora-player-prod-channel`
   - IAM role: `lunora-player-prod-medialive-role`
   - Channel class: `SINGLE_PIPELINE`

4. **Input attachments**:
   - Add the RTMP input created in Step 2
   - Input name: `rtmp-input`

5. **Output groups**:
   - Add output group: `MediaPackage`
   - Destination: `lunora-player-prod-channel`

6. **Video settings**:
   - Resolution: 1920x1080
   - Bitrate: 5000000
   - Framerate: 30

7. **Audio settings**:
   - Codec: AAC
   - Bitrate: 128000

8. Click "Create channel"

### Step 4: Start the Channel

```bash
aws medialive start-channel \
    --channel-id "YOUR_CHANNEL_ID" \
    --region us-west-2 \
    --profile lunora-media
```

### Step 5: Configure OBS

1. Open OBS Studio
2. Go to Settings > Stream
3. **Service**: Custom Streaming Server
4. **Server**: `rtmp://YOUR_INPUT_DESTINATION/live`
5. **Stream Key**: `lunora-player-prod-stream`

### Step 6: Test the Pipeline

1. Start streaming in OBS
2. Wait 2-3 minutes for the stream to propagate
3. Test HLS playback at: `https://hls-js.netlify.app/demo/?src=YOUR_HLS_ENDPOINT`

## Current Values

Based on our deployment:

- **MediaPackage Channel ID**: `lunora-player-prod-channel`
- **HLS Endpoint**: `https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/ab090a5ad83f4d26b3ae8a23f3512081/index.m3u8`
- **IAM Role ARN**: `arn:aws:iam::372241484305:role/lunora-player-prod-medialive-role`

## Testing the HLS Player Destination

Once streaming is working, you can add the HLS endpoint as a destination in the multi-destination streaming interface:

1. Go to `http://localhost:8082/streaming.html`
2. Add a new destination:
   - **Type**: HLS Player
   - **Name**: Lunora Player Test
   - **URL**: Use the MediaPackage HLS endpoint above
3. Start streaming to test the complete pipeline

## Troubleshooting

### Common Issues:
1. **Channel won't start**: Check IAM role permissions
2. **No video in player**: Wait 2-3 minutes for stream propagation
3. **OBS connection fails**: Verify RTMP endpoint and stream key
4. **HLS player shows error**: Check if MediaLive channel is running

### Useful Commands:

```bash
# Check channel status
aws medialive describe-channel --channel-id YOUR_CHANNEL_ID --region us-west-2 --profile lunora-media

# Stop channel (to save costs)
aws medialive stop-channel --channel-id YOUR_CHANNEL_ID --region us-west-2 --profile lunora-media

# Check MediaPackage channel
aws mediapackage describe-channel --id lunora-player-prod-channel --region us-west-2 --profile lunora-media
```

## Next Steps

Once this manual setup is working:

1. ✅ Test OBS → MediaLive → MediaPackage → HLS Player pipeline
2. ✅ Verify multi-destination streaming integration
3. ✅ Add HLS player as a destination option
4. 🔄 Automate the MediaLive setup with working CloudFormation
5. 🔄 Add SRT input support for Videon nodes
6. 🔄 Implement source management UI

## Cost Management

**Important**: MediaLive charges ~$2.40/hour when running. Always stop the channel when not testing:

```bash
aws medialive stop-channel --channel-id YOUR_CHANNEL_ID --region us-west-2 --profile lunora-media
```
