# SRT → MediaConnect → Multi-MediaLive Implementation Plan

## 🎯 **Implementation Objective**

Implement granular RTMP destination control using **SRT → MediaConnect → Multiple MediaLive Channels** architecture. This provides true granular control (start/stop individual destinations) while maintaining cost efficiency for 80-100 hours/month streaming usage.

## 📊 **Cost Analysis & Justification**

### **Usage Pattern**: 100 hours/month (not 24/7)

| Architecture Option | Monthly Cost | Granular Control | Complexity |
|-------------------|--------------|------------------|------------|
| **4 Separate MediaLive Channels** | $168.48 | ✅ Perfect | Low |
| **MediaConnect + Multi-MediaLive** | $145.20 | ✅ Perfect | Medium |
| **Single MediaLive + 4 RTMP** | $280.80 | ❌ Limited | Low |

**Conclusion**: Multiple MediaLive channels are cost-effective for this usage pattern and provide perfect granular control.

## 🏗️ **Target Architecture**

```
Videon Edge Node (SRT Sender)
    ↓ SRT Stream
MediaConnect Flow (SRT Input → RTP-FEC Distribution)
    ↓ RTP-FEC Outputs
├── MediaLive Channel 1 → MediaPackage → HLS Player (Primary)
├── MediaLive Channel 2 → YouTube RTMP
├── MediaLive Channel 3 → Twitch RTMP  
├── MediaLive Channel 4 → LinkedIn RTMP
└── MediaLive Channel 5 → Custom RTMP
```

### **Key Benefits:**
- ✅ **Single SRT input** from Videon (no complex splitting)
- ✅ **Perfect granular control** - each destination independent
- ✅ **Cost effective** for 100 hours/month usage
- ✅ **AWS native** - no external dependencies
- ✅ **Scalable** - add more channels easily

## 📋 **Implementation Phases**

### **Phase 1: Infrastructure Deployment (Week 1)**

#### **1.1 Update MediaConnect Flow for SRT Input**
```bash
# Modify existing MediaConnect flow to accept SRT input
aws cloudformation update-stack \
    --stack-name lunora-player-prod-mediaconnect \
    --template-body file://aws/cloudformation/srt-mediaconnect-flow.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-west-2 \
    --profile lunora-media
```

#### **1.2 Deploy Multiple MediaLive Channels**
```bash
# Deploy 4 additional MediaLive channels for RTMP destinations
aws cloudformation deploy \
    --template-file aws/cloudformation/multi-medialive-channels.yaml \
    --stack-name lunora-player-prod-multi-channels \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-west-2 \
    --profile lunora-media \
    --parameter-overrides \
        MediaConnectFlowArn=arn:aws:mediaconnect:us-west-2:372241484305:flow:... \
        ProjectName=lunora-player \
        Environment=prod
```

#### **1.3 Test SRT → MediaConnect → MediaLive Path**
```bash
# Test connectivity from Videon to MediaConnect
# Test MediaConnect distribution to all MediaLive channels
# Verify each channel can start/stop independently
```

### **Phase 2: Backend API Development (Week 2)**

#### **2.1 Multi-Channel Management Functions**
Add to `backend/index.js`:

```javascript
// Multi-MediaLive channel management
const startDestinationChannel = async (destinationId) => {
    // Start specific MediaLive channel for destination
    // Update destination status in database
};

const stopDestinationChannel = async (destinationId) => {
    // Stop specific MediaLive channel for destination  
    // Update destination status in database
};

const getMultiChannelStatus = async () => {
    // Get status of all MediaLive channels
    // Sync with database status
};
```

#### **2.2 Enhanced API Endpoints**
```javascript
// New endpoints for multi-channel control
POST /api/destinations/{id}/start-channel - Start specific MediaLive channel
POST /api/destinations/{id}/stop-channel - Stop specific MediaLive channel
GET /api/channels/status - Get all MediaLive channel statuses
POST /api/channels/sync - Sync all channel statuses with database
```

#### **2.3 Database Schema Updates**
```sql
-- Add MediaLive channel tracking to destinations table
ALTER TABLE lunora-destinations ADD COLUMN medialive_channel_id VARCHAR;
ALTER TABLE lunora-destinations ADD COLUMN medialive_channel_arn VARCHAR;
ALTER TABLE lunora-destinations ADD COLUMN channel_status VARCHAR DEFAULT 'idle';
ALTER TABLE lunora-destinations ADD COLUMN last_channel_sync TIMESTAMP;
```

### **Phase 3: Frontend Updates (Week 3)**

#### **3.1 Individual Destination Controls**
Update `js/multi-destination.js`:
- Individual start/stop buttons per destination
- Real-time channel status indicators  
- Independent destination management
- No page refresh required for destination changes

#### **3.2 Multi-Channel Status Dashboard**
Update `js/dashboard.js`:
- Show status of all MediaLive channels
- MediaConnect flow status monitoring
- Source connectivity status (Videon SRT)
- Cost tracking per channel

### **Phase 4: Testing & Deployment (Week 4)**

#### **4.1 End-to-End Testing**
- SRT input from Videon to MediaConnect
- MediaConnect distribution to all channels
- Individual channel start/stop functionality
- RTMP output to all platforms
- HLS streaming unchanged

#### **4.2 Production Deployment**
- Deploy updated Lambda function
- Update frontend with new controls
- Configure Videon for SRT output to MediaConnect
- Test all destinations independently

## 🔧 **Technical Implementation Details**

### **MediaConnect Flow Configuration**
```yaml
Flow Name: lunora-player-prod-srt-router
Source:
  Protocol: SRT
  Port: 9998
  Encryption: None (or AES-128 if required)
  Latency: 200ms
  
Outputs:
  - Name: medialive-channel-1-input
    Protocol: RTP-FEC  
    Destination: MediaLive Channel 1 input
    Port: 5000
  - Name: medialive-channel-2-input
    Protocol: RTP-FEC
    Destination: MediaLive Channel 2 input  
    Port: 5001
  # ... additional outputs for each channel
```

### **MediaLive Channel Configuration**
```yaml
Channel 1 (Primary - HLS):
  Input: MediaConnect RTP-FEC (Port 5000)
  Outputs:
    - MediaPackage (HLS)
    
Channel 2 (YouTube):
  Input: MediaConnect RTP-FEC (Port 5001)  
  Outputs:
    - RTMP Push (YouTube Live)
    
Channel 3 (Twitch):
  Input: MediaConnect RTP-FEC (Port 5002)
  Outputs:
    - RTMP Push (Twitch)
    
# ... additional channels for each destination
```

### **Videon Edge Configuration**
```yaml
SRT Output Configuration:
  Protocol: SRT
  Mode: Caller
  Destination: MediaConnect Flow Ingest IP
  Port: 9998
  Latency: 200ms
  Encryption: None
  Stream ID: lunora-primary-feed
```

## 🚨 **Critical Success Factors**

### **1. Preserve Existing Functionality**
- ✅ **HLS streaming** must continue working (Channel 1)
- ✅ **Current API endpoints** must remain functional
- ✅ **Database data** must be preserved
- ✅ **Production URLs** must continue serving content

### **2. Cost Management**
- ✅ **Monitor channel usage** - only run when streaming
- ✅ **Automatic channel shutdown** after streaming ends
- ✅ **Cost alerts** for unexpected usage
- ✅ **Usage reporting** for budget planning

### **3. Operational Reliability**
- ✅ **Channel health monitoring** for all channels
- ✅ **Automatic failover** if primary channel fails
- ✅ **Error handling** for individual channel failures
- ✅ **Status synchronization** between channels and database

## 📁 **Files to Create/Modify**

### **New CloudFormation Templates**
- `aws/cloudformation/srt-mediaconnect-flow.yaml` - Updated MediaConnect flow
- `aws/cloudformation/multi-medialive-channels.yaml` - Multiple MediaLive channels

### **Backend Updates**
- `backend/index.js` - Add multi-channel management functions
- `backend/multi-channel-manager.js` - Dedicated channel management module

### **Frontend Updates**  
- `js/multi-destination.js` - Individual destination controls
- `js/dashboard.js` - Multi-channel status monitoring
- `css/multi-destination.css` - Updated styling for new controls

### **Documentation Updates**
- `docs/videon-srt-configuration.md` - Videon setup for SRT output
- `docs/multi-channel-operations.md` - Operational procedures
- `docs/cost-monitoring-guide.md` - Cost tracking and optimization

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ **Granular Control**: Start/stop individual destinations independently
- ✅ **Single SRT Input**: Videon sends one SRT stream to MediaConnect
- ✅ **HLS Unchanged**: Existing HLS streaming continues working
- ✅ **Cost Effective**: Total cost under $200/month for 100 hours usage
- ✅ **Real-time Control**: Add/remove destinations without affecting others

### **Technical Requirements**
- ✅ **API Compatibility**: Existing endpoints continue working
- ✅ **Database Integrity**: No data loss during implementation
- ✅ **Performance**: No degradation in streaming quality
- ✅ **Monitoring**: Real-time status for all channels
- ✅ **Error Handling**: Robust error handling for channel failures

This implementation provides the granular control you need while being cost-effective for your 80-100 hours/month usage pattern, using proven AWS services without external dependencies.

## 🔧 **Detailed Implementation Steps**

### **Step 1: Create SRT MediaConnect Flow CloudFormation Template**

Create `aws/cloudformation/srt-mediaconnect-flow.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'SRT MediaConnect Flow for Multi-MediaLive Distribution'

Parameters:
  ProjectName:
    Type: String
    Default: 'lunora-player'
  Environment:
    Type: String
    Default: 'prod'

Resources:
  SRTMediaConnectFlow:
    Type: AWS::MediaConnect::Flow
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-srt-router'
      AvailabilityZone: !Sub '${AWS::Region}a'
      Source:
        Name: !Sub '${ProjectName}-videon-srt-source'
        Description: 'SRT input from Videon Edge Node'
        Protocol: 'srt-listener'
        IngestPort: 9998
        WhitelistCidr: '0.0.0.0/0'  # Restrict to Videon IP in production
        MaxBitrate: 50000000  # 50 Mbps max

Outputs:
  MediaConnectFlowArn:
    Description: 'SRT MediaConnect Flow ARN'
    Value: !GetAtt SRTMediaConnectFlow.FlowArn
    Export:
      Name: !Sub '${ProjectName}-${Environment}-srt-flow-arn'

  SRTIngestEndpoint:
    Description: 'SRT Ingest Endpoint for Videon'
    Value: !Sub
      - 'srt://${IngestIp}:9998'
      - IngestIp: !GetAtt SRTMediaConnectFlow.Source.IngestIp
    Export:
      Name: !Sub '${ProjectName}-${Environment}-srt-ingest-endpoint'
```

### **Step 2: Create Multi-MediaLive Channels CloudFormation Template**

Create `aws/cloudformation/multi-medialive-channels.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Multiple MediaLive Channels for Granular RTMP Control'

Parameters:
  ProjectName:
    Type: String
    Default: 'lunora-player'
  Environment:
    Type: String
    Default: 'prod'
  MediaConnectFlowArn:
    Type: String
    Description: 'ARN of the MediaConnect flow'

Resources:
  # MediaLive Channel 1: Primary (HLS + MediaPackage)
  PrimaryMediaLiveChannel:
    Type: AWS::MediaLive::Channel
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-primary-channel'
      ChannelClass: 'SINGLE_PIPELINE'
      RoleArn: !GetAtt MediaLiveRole.Arn
      InputSpecification:
        Codec: 'AVC'
        MaximumBitrate: 'MAX_50_MBPS'
        Resolution: 'HD'
      Destinations:
        - Id: 'mediapackage-destination'
          MediaPackageSettings:
            - ChannelId: !Sub '${ProjectName}-${Environment}-channel'
      InputAttachments:
        - InputId: !Ref PrimaryMediaLiveInput
          InputAttachmentName: 'primary-input'

  # MediaLive Channel 2: YouTube RTMP
  YouTubeMediaLiveChannel:
    Type: AWS::MediaLive::Channel
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-youtube-channel'
      ChannelClass: 'SINGLE_PIPELINE'
      RoleArn: !GetAtt MediaLiveRole.Arn
      InputSpecification:
        Codec: 'AVC'
        MaximumBitrate: 'MAX_20_MBPS'
        Resolution: 'HD'
      Destinations:
        - Id: 'youtube-rtmp-destination'
          Settings:
            - StreamName: 'youtube-stream'
              Url: 'rtmp://a.rtmp.youtube.com/live2'
      InputAttachments:
        - InputId: !Ref YouTubeMediaLiveInput
          InputAttachmentName: 'youtube-input'

  # Additional channels for Twitch, LinkedIn, Custom RTMP...
  # (Similar structure for each destination)

  # MediaLive Inputs (one per channel)
  PrimaryMediaLiveInput:
    Type: AWS::MediaLive::Input
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-primary-input'
      Type: 'MEDIACONNECT'
      MediaConnectFlows:
        - FlowArn: !Ref MediaConnectFlowArn

  YouTubeMediaLiveInput:
    Type: AWS::MediaLive::Input
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-youtube-input'
      Type: 'MEDIACONNECT'
      MediaConnectFlows:
        - FlowArn: !Ref MediaConnectFlowArn

  # IAM Role for MediaLive
  MediaLiveRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: medialive.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AWSElementalMediaLiveFullAccess
        - arn:aws:iam::aws:policy/AWSElementalMediaPackageFullAccess

Outputs:
  PrimaryChannelId:
    Description: 'Primary MediaLive Channel ID'
    Value: !Ref PrimaryMediaLiveChannel
    Export:
      Name: !Sub '${ProjectName}-${Environment}-primary-channel-id'

  YouTubeChannelId:
    Description: 'YouTube MediaLive Channel ID'
    Value: !Ref YouTubeMediaLiveChannel
    Export:
      Name: !Sub '${ProjectName}-${Environment}-youtube-channel-id'
```

### **Step 3: Backend Implementation - Multi-Channel Manager**

Create `backend/multi-channel-manager.js`:

```javascript
const AWS = require('aws-sdk');
const medialive = new AWS.MediaLive({ region: 'us-west-2' });

const CHANNEL_MAPPING = {
    'primary': process.env.PRIMARY_CHANNEL_ID,
    'youtube': process.env.YOUTUBE_CHANNEL_ID,
    'twitch': process.env.TWITCH_CHANNEL_ID,
    'linkedin': process.env.LINKEDIN_CHANNEL_ID,
    'custom': process.env.CUSTOM_CHANNEL_ID
};

class MultiChannelManager {
    async startDestinationChannel(destinationId, platform) {
        try {
            const channelId = CHANNEL_MAPPING[platform];
            if (!channelId) {
                throw new Error(`No channel configured for platform: ${platform}`);
            }

            console.log(`Starting MediaLive channel ${channelId} for ${platform}`);

            const params = {
                ChannelId: channelId
            };

            const result = await medialive.startChannel(params).promise();

            return {
                success: true,
                channelId: channelId,
                platform: platform,
                status: 'starting',
                message: `Channel ${channelId} starting for ${platform}`
            };
        } catch (error) {
            console.error(`Error starting channel for ${platform}:`, error);
            throw error;
        }
    }

    async stopDestinationChannel(destinationId, platform) {
        try {
            const channelId = CHANNEL_MAPPING[platform];
            if (!channelId) {
                throw new Error(`No channel configured for platform: ${platform}`);
            }

            console.log(`Stopping MediaLive channel ${channelId} for ${platform}`);

            const params = {
                ChannelId: channelId
            };

            const result = await medialive.stopChannel(params).promise();

            return {
                success: true,
                channelId: channelId,
                platform: platform,
                status: 'stopping',
                message: `Channel ${channelId} stopping for ${platform}`
            };
        } catch (error) {
            console.error(`Error stopping channel for ${platform}:`, error);
            throw error;
        }
    }

    async getAllChannelStatuses() {
        try {
            const statuses = {};

            for (const [platform, channelId] of Object.entries(CHANNEL_MAPPING)) {
                if (channelId) {
                    const params = { ChannelId: channelId };
                    const result = await medialive.describeChannel(params).promise();

                    statuses[platform] = {
                        channelId: channelId,
                        state: result.State,
                        pipelinesRunningCount: result.PipelinesRunningCount || 0
                    };
                }
            }

            return statuses;
        } catch (error) {
            console.error('Error getting channel statuses:', error);
            throw error;
        }
    }

    async getChannelStatus(platform) {
        try {
            const channelId = CHANNEL_MAPPING[platform];
            if (!channelId) {
                return { error: `No channel configured for platform: ${platform}` };
            }

            const params = { ChannelId: channelId };
            const result = await medialive.describeChannel(params).promise();

            return {
                platform: platform,
                channelId: channelId,
                state: result.State,
                pipelinesRunningCount: result.PipelinesRunningCount || 0,
                inputAttachments: result.InputAttachments || []
            };
        } catch (error) {
            console.error(`Error getting status for ${platform}:`, error);
            throw error;
        }
    }
}

module.exports = MultiChannelManager;
```

### **Step 4: Update Backend Lambda Function**

Update `backend/index.js` to integrate multi-channel management:

```javascript
const MultiChannelManager = require('./multi-channel-manager');
const channelManager = new MultiChannelManager();

// Add new API endpoints for multi-channel control
exports.handler = async (event) => {
    // ... existing code ...

    // New multi-channel endpoints
    if (event.path === '/api/channels/status' && event.httpMethod === 'GET') {
        return await getAllChannelStatuses();
    }

    if (event.path.startsWith('/api/destinations/') && event.path.endsWith('/start-channel') && event.httpMethod === 'POST') {
        const destinationId = event.path.split('/')[3];
        return await startDestinationChannel(destinationId);
    }

    if (event.path.startsWith('/api/destinations/') && event.path.endsWith('/stop-channel') && event.httpMethod === 'POST') {
        const destinationId = event.path.split('/')[3];
        return await stopDestinationChannel(destinationId);
    }

    // ... existing endpoints ...
};

async function startDestinationChannel(destinationId) {
    try {
        // Get destination details from database
        const destination = await getDestination(destinationId);
        if (!destination) {
            return createResponse(404, { error: 'Destination not found' });
        }

        // Start the corresponding MediaLive channel
        const result = await channelManager.startDestinationChannel(destinationId, destination.platform);

        // Update destination status in database
        await updateDestinationStatus(destinationId, 'starting', result.channelId);

        return createResponse(200, {
            status: 'success',
            message: `Started channel for ${destination.platform}`,
            channelId: result.channelId
        });
    } catch (error) {
        console.error('Error starting destination channel:', error);
        return createResponse(500, { error: 'Failed to start destination channel' });
    }
}

async function stopDestinationChannel(destinationId) {
    try {
        // Get destination details from database
        const destination = await getDestination(destinationId);
        if (!destination) {
            return createResponse(404, { error: 'Destination not found' });
        }

        // Stop the corresponding MediaLive channel
        const result = await channelManager.stopDestinationChannel(destinationId, destination.platform);

        // Update destination status in database
        await updateDestinationStatus(destinationId, 'stopping', result.channelId);

        return createResponse(200, {
            status: 'success',
            message: `Stopped channel for ${destination.platform}`,
            channelId: result.channelId
        });
    } catch (error) {
        console.error('Error stopping destination channel:', error);
        return createResponse(500, { error: 'Failed to stop destination channel' });
    }
}

async function getAllChannelStatuses() {
    try {
        const statuses = await channelManager.getAllChannelStatuses();
        return createResponse(200, {
            status: 'success',
            channels: statuses
        });
    } catch (error) {
        console.error('Error getting channel statuses:', error);
        return createResponse(500, { error: 'Failed to get channel statuses' });
    }
}
```

## 🚀 **Deployment Commands**

### **Deploy Infrastructure:**
```bash
# 1. Deploy SRT MediaConnect Flow
cd /Users/steverichards/dev/business/lunora-player
aws cloudformation deploy \
    --template-file aws/cloudformation/srt-mediaconnect-flow.yaml \
    --stack-name lunora-player-prod-srt-mediaconnect \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-west-2 \
    --profile lunora-media

# 2. Get MediaConnect Flow ARN
FLOW_ARN=$(aws cloudformation describe-stacks \
    --stack-name lunora-player-prod-srt-mediaconnect \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaConnectFlowArn`].OutputValue' \
    --output text)

# 3. Deploy Multi-MediaLive Channels
aws cloudformation deploy \
    --template-file aws/cloudformation/multi-medialive-channels.yaml \
    --stack-name lunora-player-prod-multi-channels \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-west-2 \
    --profile lunora-media \
    --parameter-overrides \
        MediaConnectFlowArn=$FLOW_ARN \
        ProjectName=lunora-player \
        Environment=prod

# 4. Update Lambda Environment Variables
aws lambda update-function-configuration \
    --function-name lunora-player-prod-multi-destination-api \
    --environment Variables='{
        "DESTINATIONS_TABLE":"lunora-destinations",
        "PRESETS_TABLE":"lunora-presets",
        "SESSIONS_TABLE":"lunora-streaming-sessions",
        "PRIMARY_CHANNEL_ID":"$(aws cloudformation describe-stacks --stack-name lunora-player-prod-multi-channels --query 'Stacks[0].Outputs[?OutputKey==`PrimaryChannelId`].OutputValue' --output text)",
        "YOUTUBE_CHANNEL_ID":"$(aws cloudformation describe-stacks --stack-name lunora-player-prod-multi-channels --query 'Stacks[0].Outputs[?OutputKey==`YouTubeChannelId`].OutputValue' --output text)",
        "MEDIALIVE_CHANNEL_ID":"3714710",
        "AWS_ACCOUNT_ID":"372241484305"
    }' \
    --region us-west-2 \
    --profile lunora-media

# 5. Deploy Updated Lambda Function
cd backend
zip -r ../backend-multi-channel.zip . -x "node_modules/*"
aws lambda update-function-code \
    --function-name lunora-player-prod-multi-destination-api \
    --zip-file fileb://../backend-multi-channel.zip \
    --region us-west-2 \
    --profile lunora-media
```

### **Configure Videon Edge Node:**
```yaml
# Videon Edge SRT Output Configuration
Protocol: SRT
Mode: Caller
Destination: [MediaConnect SRT Ingest IP from CloudFormation output]
Port: 9998
Latency: 200ms
Stream ID: lunora-primary-feed
Encryption: None
```

## 📋 **Next Steps After Documentation**

1. **Create new Git branch**: `git checkout -b feature/srt-mediaconnect-multi-medialive`
2. **Create CloudFormation templates** as specified above
3. **Implement multi-channel manager** backend module
4. **Update Lambda function** with new endpoints
5. **Test infrastructure deployment** in development
6. **Update frontend** for individual destination controls
7. **Deploy to production** and configure Videon

This implementation plan provides a clear, step-by-step approach to achieving granular RTMP destination control while maintaining cost efficiency for your 80-100 hours/month usage pattern.
