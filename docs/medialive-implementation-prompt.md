# MediaConnect Granular Control Implementation - Updated June 2025

## Context Summary
I have a working multi-destination streaming system with:
- ✅ Frontend web interface for managing streaming destinations with MediaLive status indicator
- ✅ Backend Lambda API with DynamoDB for destination management
- ✅ Start/stop functionality that tracks streaming status in database
- ✅ Status persistence across page refreshes
- ✅ Production deployment with S3/CloudFront hosting
- ✅ **TESTED**: End-to-end workflow OBS → MediaLive → Restream RTMP (working but poor quality - frame loss)
- ✅ **FIXED**: Dashboard backend API connection and status synchronization
- ✅ **TESTED**: End-to-end workflow OBS → MediaLive → HLS Stream (working but poor quality - frame loss)
- 🚧 **IN PROGRESS**: MediaConnect implementation for granular RTMP control

## Current Architecture
- **Frontend**: Vanilla JavaScript web interface at CloudFront distribution
- **Backend**: Lambda function with Function URL for API endpoints
- **Database**: DynamoDB tables for destinations, presets, and sessions
- **Streaming**: AWS MediaLive channels exist but not integrated with destination management
- **Hosting**: S3 bucket with CloudFront CDN for production deployment

## Implementation Goals
1. **End-to-End Workflow Testing**: OBS RTMP → MediaLive → HLS Player + Restream RTMP
2. **Backup URL Support**: Add primary/backup URL and stream key fields for each destination
3. **Dashboard API Connection**: Connect dashboard.html to backend API for monitoring
4. **MediaLive Integration**: Enable actual RTMP streaming when users start/stop destinations

## Current AWS Resources

### AWS Account Information
- **Account ID**: 372241484305
- **Region**: us-west-2 (Oregon)
- **Profile**: lunora-media

### MediaLive Channels
- **Channel 3714710**: lunora-player-prod-obs-rtmp-channel (IDLE)
  - Input: RTMP_PUSH (Input 7107272)
  - Outputs: MediaPackage + Restream RTMP
- **Channel 6802366**: lunora-prod-srt-channel (IDLE)
  - Input: SRT_CALLER (Input 4739436)
- **Channel 6890857**: lunora-prod-channel (IDLE)

### MediaLive Inputs
- **Input 4739436**: lunora-srt-input (SRT_CALLER)
- **Input 2012618**: lunora-rtmp-input (RTMP_PUSH)
- **Input 7107272**: lunora-player-prod-obs-rtmp-input (RTMP_PUSH)
  - Primary URL: rtmp://100.21.217.195:1935/live/obs-stream

### MediaPackage Channels
- **lunora-player-dev-channel**
- **lunora-player-prod-channel**
  - HLS Endpoint: https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/ab090a5ad83f4d26b3ae8a23f3512081/index.m3u8

### Production Hosting
- **S3 Bucket**: lunora-player-streaming-prod-372241484305
- **CloudFront Distribution**: d35au6zpsr51nc.cloudfront.net
  - Streaming Interface: https://d35au6zpsr51nc.cloudfront.net/streaming.html
  - Dashboard: https://d35au6zpsr51nc.cloudfront.net/dashboard.html
  - HLS Player: https://d35au6zpsr51nc.cloudfront.net/hls-player.html

### CloudFormation Stacks
- **lunora-player-prod-infrastructure**: Core MediaLive/MediaPackage resources
- **lunora-player-prod-multi-destination**: Lambda API and DynamoDB tables
- **lunora-player-prod-obs-rtmp**: OBS RTMP channel configuration

### DynamoDB Tables
- **lunora-player-destinations-prod**: Streaming destinations
- **lunora-player-presets-prod**: Encoding presets
- **lunora-player-streaming-sessions-prod**: Session tracking

### Lambda Functions
- **lunora-player-prod-multi-destination-api**: Main API handler
  - Function URL: Available for API endpoints
  - Environment variables configured for production tables

## Current Working Lambda Function Structure (June 9, 2025)
```
File: backend/index.js (WORKING - DO NOT REPLACE)
Runtime: Node.js 22.x with AWS SDK v2 dependencies included
Handler: index.handler
Environment Variables:
- DESTINATIONS_TABLE: lunora-destinations
- PRESETS_TABLE: lunora-presets
- SESSIONS_TABLE: lunora-streaming-sessions
- PARAMETER_STORE_PREFIX: /lunora-player/streaming
- MEDIALIVE_CHANNEL_ID: 3714710
- MEDIALIVE_REGION: us-west-2
- NODE_ENV: prod
- AWS_ACCOUNT_ID: 372241484305

Key Functions:
- startDestination(destinationId) - Updates DB status to "streaming" + MediaLive integration
- stopDestination(destinationId) - Updates DB status to "ready" + MediaLive integration
- getDestinations() - Returns all destinations with streaming_status
- createDestination() - Creates new destination in DB with Parameter Store integration
- getStreamingStatus() - Returns MediaLive channel status (WORKING)
- getMediaLiveChannelStatus() - Returns real MediaLive channel state
- Health check endpoint: /api/health (WORKING)

API Base URL: https://hi2pfpdbrlcry5w73wt27xrniu0vhykl.lambda-url.us-west-2.on.aws/api
Status: ✅ FULLY FUNCTIONAL as of June 9, 2025
```

## Current DynamoDB Schema

### Destinations Table (lunora-player-destinations-prod)
```
Fields:
- destination_id (primary key)
- name
- platform (youtube, custom, hls, restream)
- rtmp_url (primary URL)
- stream_key_param (Parameter Store reference for primary key)
- preset_id
- enabled
- streaming_status (ready/streaming/error)
- streaming_started_at
- created_at
- updated_at

NEEDED ADDITIONS:
- backup_rtmp_url (backup URL)
- backup_stream_key_param (Parameter Store reference for backup key)
- failover_enabled (boolean)
- current_url_type (primary/backup)
```

## Implementation Requirements

### Phase 1: MediaConnect Infrastructure Deployment
1. **Deploy MediaConnect Flow**: Create RTMP router flow using CloudFormation
2. **Update MediaLive Channel**: Replace direct RTMP outputs with MediaConnect output
3. **Preserve HLS Path**: Ensure MediaPackage output remains unchanged
4. **Test Infrastructure**: Verify MediaConnect flow receives stream from MediaLive
5. **IAM Permissions**: Add MediaConnect permissions to Lambda functions

### Phase 2: MediaConnect Lambda Integration
1. **MediaConnect Manager Function**: Deploy dedicated Lambda for flow management
2. **Update Main API**: Integrate MediaConnect operations with existing destination API
3. **Database Schema Updates**: Add MediaConnect output ARN tracking
4. **Error Handling**: Robust error handling for MediaConnect operations
5. **Status Synchronization**: Real-time sync between MediaConnect and database

### Phase 2: End-to-End Workflow Testing
1. **OBS RTMP Input**: Test streaming from OBS to MediaLive channel
   - Use RTMP URL: rtmp://100.21.217.195:1935/live/obs-stream
   - Verify MediaLive channel receives and processes stream
2. **HLS Output Testing**: Verify HLS stream works in player
   - Test HLS endpoint: https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/ab090a5ad83f4d26b3ae8a23f3512081/index.m3u8
   - Confirm playback in https://d35au6zpsr51nc.cloudfront.net/hls-player.html
3. **RTMP Destination Testing**: Test streaming to external platforms
   - Verify Restream RTMP output works
   - Test YouTube/custom RTMP destinations

### Phase 3: Backup URL Support
1. **Database Schema Updates**: Add backup URL fields to destinations table
2. **Frontend Updates**: Add backup URL/stream key input fields
3. **Backend Logic**: Implement failover logic for backup URLs
4. **Testing**: Verify automatic failover when primary URL fails

### Phase 4: Dashboard API Connection
1. **API Endpoint Discovery**: Find correct backend API URL for dashboard
2. **Dashboard JavaScript Updates**: Connect dashboard.html to backend API
3. **Real-time Monitoring**: Implement status updates and metrics display
4. **Error Handling**: Add proper error states and user feedback

### Technical Implementation Details
```javascript
// Required MediaConnect operations:
- mediaconnect.describeFlow() - Get current flow config
- mediaconnect.addFlowOutputs() - Add RTMP destinations
- mediaconnect.removeFlowOutput() - Remove RTMP destinations
- mediaconnect.updateFlowOutput() - Update destination settings

// Required MediaLive operations (simplified):
- medialive.describeChannel() - Get current channel config
- medialive.updateChannel() - Add MediaConnect output (one-time)
- medialive.startChannel() - Start channel if idle
- medialive.stopChannel() - Stop channel when no destinations

// New Lambda environment variables needed:
- MEDIACONNECT_FLOW_ARN: MediaConnect flow for RTMP routing
- MEDIACONNECT_MANAGER_FUNCTION: MediaConnect manager Lambda ARN
- MEDIALIVE_CHANNEL_ID: Primary channel for streaming (unchanged)
- MEDIALIVE_REGION: us-west-2 (unchanged)
```

### Expected Behavior After MediaConnect Implementation
1. **Start Destination (Granular Control)**:
   - User clicks "Start" on YouTube destination
   - Lambda calls MediaConnect to add RTMP output to flow
   - MediaConnect begins pushing stream to YouTube (no MediaLive restart)
   - Database status updates to "streaming" with MediaConnect output ARN
   - Frontend shows "streaming" status immediately

2. **Stop Destination (Independent Control)**:
   - User clicks "Stop" on YouTube destination
   - Lambda calls MediaConnect to remove RTMP output from flow
   - MediaConnect stops pushing to YouTube (other destinations unaffected)
   - Database status updates to "ready"
   - Frontend shows "ready" status

3. **Add/Edit Destinations (Real-time)**:
   - User adds new destination or edits existing RTMP URL/stream key
   - Lambda calls MediaConnect to add/update output in real-time
   - No interruption to other active destinations
   - No MediaLive channel restart required
   - Immediate configuration changes take effect

4. **HLS Streaming (Unchanged)**:
   - HLS viewers experience no changes or interruptions
   - MediaLive → MediaPackage path preserved
   - Same HLS endpoints and player functionality
   - No impact on existing HLS infrastructure

### Cost Optimization
- Channel should auto-start when first destination starts
- Channel should auto-stop when last destination stops
- Minimize running time to ~$1.50/hour only when needed

## Current Issues to Address

### 1. Streaming Quality Optimization (CRITICAL)
**Problem**: End-to-end workflows are working but experiencing poor quality with significant frame loss
**Tested Workflows**:
- ✅ OBS → MediaLive Channel 3714710 → Restream RTMP (functional but poor quality)
- ✅ OBS → MediaLive Channel 3714710 → HLS Stream (functional but poor quality)

**Quality Issues Observed**:
- Significant frame loss during streaming
- Poor video quality compared to direct OBS streaming
- Potential encoding/bitrate mismatch between OBS output and MediaLive input settings

**Requirements for Resolution**:
- Analyze MediaLive channel 3714710 encoding settings
- Compare OBS output settings with MediaLive input expectations
- Optimize MediaLive encoder configuration for quality vs. cost
- Test different bitrate/resolution combinations
- Verify network bandwidth is sufficient for streaming quality
- Consider MediaLive channel class (STANDARD vs. SINGLE_PIPELINE) impact on quality

**MediaLive Settings to Review**:
- Input resolution and frame rate settings
- Encoder bitrate and quality settings
- GOP (Group of Pictures) configuration
- B-frame settings
- Rate control method (CBR vs. VBR)
- Buffer settings for network stability

### 2. Dashboard API Connection
**Problem**: Dashboard at https://d35au6zpsr51nc.cloudfront.net/dashboard.html is not connected to backend
**Requirements**:
- Find Lambda Function URL for lunora-player-prod-multi-destination-api
- Update dashboard.js to connect to correct API endpoint
- Implement real-time status monitoring
- Add error handling for API connection failures

### 3. Backup URL Support
**Problem**: No failover capability for destination URLs
**Requirements**:
- Add backup_rtmp_url and backup_stream_key_param fields to DynamoDB
- Update frontend forms to accept primary/backup URLs
- Implement automatic failover logic in Lambda functions
- Add UI indicators for current URL type (primary/backup)

## ⚠️ CRITICAL DEPLOYMENT WARNINGS ⚠️

### DO NOT MODIFY WORKING LAMBDA FUNCTIONS WITHOUT PROPER BACKUP
**Error Made on June 9, 2025**: Attempted to modify working `backend/index.js` Lambda function by:
1. Creating a new `backend/lambda-handler.js` file with additional endpoints
2. Deploying the new file without including AWS SDK dependencies
3. Breaking the production API that was working perfectly

**What Went Wrong**:
- The working Lambda function used `backend/index.js` with proper AWS SDK v2 dependencies
- Node.js 22.x runtime does not include AWS SDK by default (unlike older runtimes)
- Deploying without `node_modules/` caused "Cannot find module 'aws-sdk'" errors
- Changed handler configuration from `index.handler` to `lambda-handler.handler` breaking the deployment
- Modified environment variables incorrectly (table names)

**NEVER DO THIS**:
1. ❌ Deploy Lambda code without testing dependencies locally first
2. ❌ Modify working production Lambda functions without creating backups
3. ❌ Change Lambda handler configuration without understanding the current setup
4. ❌ Assume AWS SDK is available in all Node.js runtimes
5. ❌ Modify environment variables without verifying table names exist
6. ❌ Deploy untested code to production APIs that frontend depends on

**ALWAYS DO THIS**:
1. ✅ Test Lambda functions locally with proper dependencies before deployment
2. ✅ Include `node_modules/` with AWS SDK when deploying to Node.js 22.x
3. ✅ Create deployment backups before modifying working systems
4. ✅ Verify table names and environment variables before deployment
5. ✅ Test API endpoints after deployment to ensure they work
6. ✅ Keep working versions intact while developing new features

**Recovery Process**:
- Restored original `backend/index.js` file
- Added AWS SDK dependency: `npm install aws-sdk`
- Deployed with dependencies: `zip -r package.zip index.js node_modules/ package.json`
- Restored correct environment variables with original table names
- Verified API functionality before declaring success

## Files to Modify
1. **backend/index.js** - Add MediaLive integration and backup URL support (DO NOT REPLACE - MODIFY EXISTING)
2. **js/dashboard.js** - Connect to backend API (VERIFY CORRECT API URL FIRST)
3. **streaming.html** - Add backup URL fields to destination forms
4. **js/multi-destination.js** - Handle backup URL functionality
5. **DynamoDB Schema** - Add backup URL fields

## Testing Plan
1. **End-to-End Workflow** (✅ COMPLETED - Quality Issues Found):
   - ✅ Stream from OBS to rtmp://100.21.217.195:1935/live/obs-stream
   - ✅ Verify HLS playback at CloudFront player URL
   - ✅ Test RTMP output to Restream destination
   - ✅ Monitor MediaLive channel status in frontend
   - ⚠️ **ISSUE**: Poor streaming quality with frame loss - requires MediaLive optimization

2. **Dashboard Connection**:
   - Access dashboard.html and verify API connectivity
   - Test real-time status updates
   - Validate error handling for API failures

3. **Backup URL Testing**:
   - Configure destinations with primary/backup URLs
   - Test automatic failover when primary URL fails
   - Verify UI shows current URL type

## Success Criteria
- ⚠️ Complete OBS → MediaLive → HLS/RTMP workflow working (functional but poor quality)
- ❌ Dashboard connected to backend API with real-time monitoring
- ❌ Backup URL support with automatic failover
- ✅ MediaLive channel status indicator functional
- ✅ All existing functionality preserved
- ❌ Cost optimization through automatic channel management
- ❌ **PRIORITY**: MediaLive encoding optimization for quality streaming

## AWS Profile
Use AWS profile: `lunora-media` for all AWS CLI operations.

## MediaConnect Implementation Status

### ✅ **Completed (June 9, 2025)**
- **Dashboard API Connection**: Fixed and deployed
- **Status Synchronization**: Database now syncs with actual MediaLive state
- **Production Deployment**: All frontend/backend components working
- **Documentation**: Updated architecture and implementation guides

### 🚧 **In Progress (Current Branch: feature/mediaconnect-granular-control)**
- **MediaConnect CloudFormation**: Template created for infrastructure deployment
- **Lambda Integration**: Planning MediaConnect API integration
- **Database Schema**: Designing MediaConnect output ARN tracking
- **Cost Analysis**: Completed - $391/month for unlimited RTMP destinations

### ⏳ **Next Steps**
1. **Deploy MediaConnect Infrastructure**: CloudFormation stack deployment
2. **Update MediaLive Channel**: Add MediaConnect output group
3. **Lambda Function Updates**: Integrate MediaConnect operations
4. **Testing**: End-to-end workflow validation
5. **Migration**: Gradual transition from direct RTMP to MediaConnect

### 🎯 **Success Criteria**
- ✅ **HLS Streaming**: No impact on existing HLS infrastructure
- ⏳ **Granular Control**: Add/edit/remove RTMP destinations independently
- ⏳ **Real-time Updates**: No MediaLive channel restarts required
- ⏳ **Cost Efficiency**: Predictable $391/month for unlimited destinations
- ⏳ **Quality Preservation**: No degradation in streaming quality

## Current Status
- All AWS services stopped to minimize costs
- Frontend deployed to production with MediaLive status indicator
- Backend Lambda API deployed and functional
- Ready for MediaConnect infrastructure deployment and testing
