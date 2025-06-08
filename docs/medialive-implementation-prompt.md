# MediaLive Integration Implementation Prompt

## Context Summary
I have a working multi-destination streaming system with:
- ✅ Frontend web interface for managing streaming destinations
- ✅ Backend Lambda API with DynamoDB for destination management
- ✅ Start/stop functionality that tracks streaming status in database
- ✅ Status persistence across page refreshes
- ⚠️ **Missing**: Actual RTMP streaming to destinations (currently only database updates)

## Current Architecture
- **Frontend**: Vanilla JavaScript web interface at CloudFront distribution
- **Backend**: Lambda function with Function URL for API endpoints
- **Database**: DynamoDB tables for destinations, presets, and sessions
- **Streaming**: AWS MediaLive channels exist but not integrated with destination management

## Implementation Goal
Integrate AWS MediaLive to enable actual RTMP streaming when users click start/stop on destinations in the web interface.

## Current AWS Resources
```
MediaLive Channels:
- Channel 3714710: lunora-player-prod-obs-rtmp-channel (IDLE)
- Channel 6802366: lunora-prod-srt-channel (IDLE) 
- Channel 6890857: lunora-prod-channel (IDLE)

MediaLive Inputs:
- Input 4739436: lunora-srt-input (SRT_CALLER)
- Input 2012618: lunora-rtmp-input (RTMP_PUSH)
- Input 7107272: lunora-player-prod-obs-rtmp-input (RTMP_PUSH)

MediaPackage Channels:
- lunora-player-dev-channel
- lunora-player-prod-channel

CloudFront Distribution:
- d35au6zpsr51nc.cloudfront.net (enabled)
```

## Current Lambda Function Structure
```
File: backend/lambda-handler.js
Key Functions:
- startDestination(destinationId) - Updates DB status to "streaming"
- stopDestination(destinationId) - Updates DB status to "ready"
- getDestinations() - Returns all destinations with streaming_status
- createDestination() - Creates new destination in DB
```

## Current DynamoDB Schema
```
Table: lunora-destinations
Fields:
- destination_id (primary key)
- name
- platform (youtube, custom, hls)
- rtmp_url
- stream_key_param (Parameter Store reference)
- preset_id
- enabled
- streaming_status (ready/streaming)
- streaming_started_at
- created_at
- updated_at
```

## Implementation Requirements

### Phase 1: Basic MediaLive Integration
1. **Choose Primary Channel**: Select which MediaLive channel to use for multi-destination streaming
2. **Update startDestination()**: 
   - Add MediaLive API calls to create RTMP outputs
   - Handle channel state management (start if idle)
   - Add error handling for MediaLive operations
3. **Update stopDestination()**:
   - Remove RTMP outputs from MediaLive channel
   - Stop channel if no destinations remain active
   - Handle cleanup and error scenarios
4. **Add MediaLive Permissions**: Ensure Lambda has proper IAM permissions
5. **Environment Variables**: Add MediaLive channel ID to Lambda config

### Technical Implementation Details
```javascript
// Required MediaLive operations:
- medialive.describeChannel() - Get current channel config
- medialive.updateChannel() - Add/remove outputs
- medialive.startChannel() - Start channel if idle
- medialive.stopChannel() - Stop channel when no outputs

// New Lambda environment variables needed:
- MEDIALIVE_CHANNEL_ID: Primary channel for streaming
- MEDIALIVE_REGION: us-west-2
```

### Expected Behavior After Implementation
1. **Start Destination**: 
   - User clicks "Start" on YouTube destination
   - Lambda adds RTMP output to MediaLive channel
   - MediaLive begins pushing stream to YouTube
   - Database status updates to "streaming"
   - Frontend shows "streaming" status

2. **Stop Destination**:
   - User clicks "Stop" on YouTube destination  
   - Lambda removes RTMP output from MediaLive channel
   - MediaLive stops pushing to YouTube
   - Database status updates to "ready"
   - Frontend shows "ready" status

3. **Multiple Destinations**:
   - Can start/stop individual destinations independently
   - MediaLive channel runs while any destination is active
   - Channel stops automatically when all destinations stopped

### Cost Optimization
- Channel should auto-start when first destination starts
- Channel should auto-stop when last destination stops
- Minimize running time to ~$1.50/hour only when needed

## Files to Modify
1. **backend/lambda-handler.js** - Add MediaLive integration
2. **scripts/deploy-lambda-api.sh** - Update environment variables
3. **docs/medialive-integration-plan.md** - Reference for implementation details

## Testing Plan
1. **Test with existing destinations**:
   - YouTube destination (Test YouTube Channel)
   - Custom RTMP destination (Restream RTMP)
   - HLS destination (should continue working)

2. **Validation steps**:
   - Verify RTMP streams actually reach destinations
   - Confirm status persistence works
   - Test error handling for invalid stream keys
   - Validate cost optimization (channel start/stop)

## Success Criteria
- ✅ Clicking "Start" on RTMP destination creates actual stream output
- ✅ External platforms (YouTube, Restream) receive the stream
- ✅ Status tracking continues to work correctly
- ✅ Multiple destinations can stream simultaneously
- ✅ Channel automatically starts/stops to minimize costs
- ✅ Error handling provides meaningful feedback to users

## Reference Documentation
- **Implementation Plan**: `docs/medialive-integration-plan.md`
- **AWS MediaLive API**: https://docs.aws.amazon.com/medialive/latest/apireference/
- **Current System**: All existing functionality should continue working

## AWS Profile
Use AWS profile: `lunora-media` for all AWS CLI operations.

## Request
Please implement Phase 1 of the MediaLive integration plan to enable actual RTMP streaming to destinations. Focus on:
1. Integrating MediaLive API calls into existing start/stop functions
2. Proper error handling and status management
3. Cost optimization through automatic channel management
4. Testing with existing destinations to verify functionality

Maintain all existing functionality while adding the missing RTMP streaming capability.
