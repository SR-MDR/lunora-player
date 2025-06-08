# AWS MediaLive Integration Plan
## Multi-Destination Streaming Implementation

### Overview
This document outlines the implementation plan for integrating AWS MediaLive to enable actual RTMP streaming to multiple destinations (YouTube, Restream, custom RTMP endpoints) in the Lunora Player multi-destination streaming system.

## Current State
- ✅ Frontend and backend are fully connected
- ✅ Start/stop functionality works with status persistence in DynamoDB
- ✅ Page refresh maintains correct streaming states
- ⚠️ **Missing**: Actual RTMP streaming requires MediaLive integration

## AWS MediaLive Architecture

### Core Components

#### 1. MediaLive Channel
- **Serverless**: No EC2 instances created - AWS manages all infrastructure
- Single channel acts as the main encoding engine
- Takes input stream (SRT from Videon LiveEdge Node)
- Encodes into multiple formats/bitrates simultaneously
- Supports multiple outputs to different destinations

#### 2. MediaLive Inputs
- **Primary Input**: SRT stream from Videon LiveEdge Node
- **Backup Input**: Optional secondary SRT stream for redundancy
- **Persistent**: Created once and reused across streaming sessions
- **Format**: `srt://input-endpoint:port?mode=listener`

#### 3. MediaLive Outputs
- Each destination becomes a separate output on the channel
- **HLS Output**: Streams to S3 bucket for web player consumption
- **RTMP Outputs**: Push directly to external platforms (YouTube, Restream, etc.)
- **Dynamic Management**: Outputs can be added/removed without stopping the channel

### Channel States
- **IDLE**: Channel exists but not running (costs ~$0)
- **RUNNING**: Channel is actively encoding and outputting (costs ~$1-3/hour)
- **STARTING/STOPPING**: Transitional states during configuration changes

## Destination Lifecycle Management

### Creating a Destination
```
1. User creates destination (e.g., "YouTube Channel") in web GUI
2. Backend stores destination metadata in DynamoDB
3. NO MediaLive changes at this stage - only database record created
4. Destination status: "ready"
```

### Starting a Destination
```
1. User clicks "Start" button for specific destination
2. Backend retrieves destination details from DynamoDB
3. Backend calls MediaLive API to:
   - Get current channel configuration
   - Add new RTMP output group for this destination
   - Update channel with new output configuration
4. MediaLive begins pushing stream to destination endpoint
5. Backend updates DynamoDB status to "streaming" with timestamp
6. Frontend reflects "streaming" status in real-time
```

### Stopping a Destination
```
1. User clicks "Stop" button for specific destination
2. Backend calls MediaLive API to:
   - Get current channel configuration
   - Remove the specific RTMP output for this destination
   - Update channel configuration
3. MediaLive stops pushing to that destination
4. Backend updates DynamoDB status to "ready"
5. Frontend reflects "ready" status
```

### Deleting a Destination
```
1. If destination is currently streaming, stop it first
2. Remove destination record from DynamoDB
3. No additional MediaLive changes needed (output already removed)
```

## Technical Implementation

### MediaLive API Integration

#### Starting a Destination (Pseudo-code)
```javascript
async function startDestination(destinationId) {
  // 1. Get destination details from DynamoDB
  const destination = await getDestination(destinationId);
  
  // 2. Get current MediaLive channel configuration
  const channel = await mediaLive.describeChannel({
    ChannelId: process.env.MEDIALIVE_CHANNEL_ID
  });
  
  // 3. Create new RTMP output configuration
  const newOutput = {
    OutputName: `rtmp-${destinationId}`,
    OutputSettings: {
      RtmpOutputSettings: {
        Destination: {
          DestinationRefId: destinationId
        },
        ConnectionRetryInterval: 2,
        NumRetries: 3
      }
    },
    VideoDescriptionName: "video_1080p",
    AudioDescriptionNames: ["audio_aac"]
  };
  
  // 4. Create destination endpoint configuration
  const newDestination = {
    Id: destinationId,
    Settings: [{
      Url: destination.rtmp_url,
      StreamName: destination.stream_key
    }]
  };
  
  // 5. Update MediaLive channel with new output
  await mediaLive.updateChannel({
    ChannelId: process.env.MEDIALIVE_CHANNEL_ID,
    Destinations: [...channel.Destinations, newDestination],
    EncoderSettings: {
      ...channel.EncoderSettings,
      OutputGroups: [
        ...channel.EncoderSettings.OutputGroups,
        {
          Name: `rtmp-group-${destinationId}`,
          OutputGroupSettings: {
            RtmpGroupSettings: {
              AuthenticationScheme: "COMMON",
              CacheFullBehavior: "DISCONNECT_IMMEDIATELY",
              CacheLength: 30,
              CaptionData: "ALL",
              RestartDelay: 15
            }
          },
          Outputs: [newOutput]
        }
      ]
    }
  });
  
  // 6. Update database status
  await updateDestinationStatus(destinationId, 'streaming');
}
```

#### Stopping a Destination
```javascript
async function stopDestination(destinationId) {
  // 1. Get current channel configuration
  const channel = await mediaLive.describeChannel({
    ChannelId: process.env.MEDIALIVE_CHANNEL_ID
  });
  
  // 2. Remove output group and destination
  const updatedOutputGroups = channel.EncoderSettings.OutputGroups
    .filter(group => group.Name !== `rtmp-group-${destinationId}`);
  
  const updatedDestinations = channel.Destinations
    .filter(dest => dest.Id !== destinationId);
  
  // 3. Update channel
  await mediaLive.updateChannel({
    ChannelId: process.env.MEDIALIVE_CHANNEL_ID,
    Destinations: updatedDestinations,
    EncoderSettings: {
      ...channel.EncoderSettings,
      OutputGroups: updatedOutputGroups
    }
  });
  
  // 4. Update database
  await updateDestinationStatus(destinationId, 'ready');
}
```

## Cost Structure

### Fixed Costs (When Channel is Running)
- **Standard Channel**: ~$1.50/hour for single pipeline
- **Dual Pipeline**: ~$3.00/hour for redundancy (recommended for production)
- **Channel runs only when at least one destination is streaming**

### Variable Costs
- **Data Transfer**: ~$0.02/GB for RTMP outputs
- **S3 Storage**: Minimal cost for HLS segments
- **CloudFront**: Data transfer costs for HLS delivery

### Cost Optimization Strategies
- **Auto Start/Stop**: Start channel when first destination starts, stop when last destination stops
- **Efficient Encoding**: Use appropriate bitrates for each destination
- **Monitoring**: Track usage to optimize costs

## Scaling Architecture

### Single Channel Architecture (Phase 1)
```
MediaLive Channel
├── Input: SRT from Videon LiveEdge Node
├── HLS Output → S3 → CloudFront → Web Player
├── RTMP Output 1 → YouTube
├── RTMP Output 2 → Restream
├── RTMP Output 3 → Custom RTMP Endpoint
└── RTMP Output N → Additional Destinations
```

### Multi-Channel Architecture (Future Scaling)
```
Channel 1 (Stream A - Main Event)
├── Input: SRT from Videon 1
└── Multiple RTMP outputs

Channel 2 (Stream B - Secondary Event)
├── Input: SRT from Videon 2
└── Multiple RTMP outputs

Channel N (Stream N)
├── Input: SRT from Videon N
└── Multiple RTMP outputs
```

## Error Handling & Monitoring

### Real-time Status Monitoring
- **CloudWatch Metrics**: Monitor output health per destination
- **Connection Status**: Detect RTMP connection failures
- **Bitrate Monitoring**: Track encoding performance
- **Automatic Retry**: Built-in retry logic for failed connections

### Status State Management
```
Database Status ↔ MediaLive Reality:
- "starting" → MediaLive is adding output (transitional)
- "streaming" → MediaLive confirms output is active
- "error" → MediaLive reports output connection failure
- "stopping" → MediaLive is removing output (transitional)
- "ready" → Output successfully removed from MediaLive
```

### Error Recovery
- **Connection Failures**: Automatic retry with exponential backoff
- **Stream Key Issues**: Alert user to check credentials
- **Network Issues**: Temporary status updates, auto-recovery
- **Channel Failures**: Automatic channel restart procedures

## Implementation Phases

### Phase 1: Basic RTMP Integration
**Scope**: Core MediaLive integration for RTMP streaming
- Single MediaLive channel setup
- Dynamic RTMP output addition/removal
- Basic error handling and status updates
- Integration with existing DynamoDB schema

**Deliverables**:
- MediaLive channel creation and configuration
- Updated Lambda functions for start/stop operations
- Real RTMP streaming to destinations
- Enhanced error handling

### Phase 2: Advanced Features
**Scope**: Production-ready enhancements
- Automatic channel start/stop based on destination usage
- Real-time monitoring dashboard
- Advanced retry logic and failover
- Performance optimization

**Deliverables**:
- Cost-optimized channel management
- Monitoring dashboard with real-time metrics
- Enhanced error recovery mechanisms
- Performance analytics

### Phase 3: Multi-Stream Support
**Scope**: Support for multiple simultaneous streams
- Multiple MediaLive channels
- Load balancing across channels
- Advanced monitoring and management
- Scalability for enterprise use

**Deliverables**:
- Multi-channel architecture
- Advanced management interface
- Enterprise-grade monitoring
- Scalability documentation

## Key Benefits

1. **Serverless Architecture**: No EC2 instance management required
2. **Infinite Scalability**: Add unlimited RTMP destinations
3. **Cost-Effective**: Pay only for active streaming time
4. **Enterprise Reliability**: AWS-managed infrastructure with 99.9% uptime
5. **Real-time Control**: Immediate start/stop of individual destinations
6. **Professional Quality**: Broadcast-grade encoding and delivery

## Technical Limitations

1. **Update Latency**: Channel configuration updates take 10-30 seconds
2. **Concurrent Updates**: Cannot update channel during ongoing configuration changes
3. **Minimum Cost**: ~$1.50/hour when any destination is streaming
4. **Complexity**: More sophisticated than simple RTMP relay solutions

## Next Steps

1. **Environment Setup**: Configure MediaLive channel and inputs
2. **Lambda Integration**: Implement MediaLive API calls in existing Lambda functions
3. **Testing**: Validate RTMP streaming to test destinations
4. **Production Deployment**: Deploy to production environment
5. **Monitoring Setup**: Implement CloudWatch dashboards and alerts

---

**Note**: This implementation will provide professional-grade streaming capabilities with the flexibility to stream to multiple destinations simultaneously, all managed through the existing web interface.
