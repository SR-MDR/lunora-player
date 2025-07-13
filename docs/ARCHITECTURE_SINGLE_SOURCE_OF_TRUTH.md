# Single Source of Truth Architecture

## Problem Statement

The current system has **dual sources of truth** for streaming status:
- **Database**: Stores `streaming_status: "streaming"` 
- **AWS Services**: Actual MediaLive channel state `"IDLE"`

This creates inconsistencies, race conditions, and operational confusion.

## Solution: Single Source of Truth

### Database Role: Configuration & Presets ONLY
```javascript
// DynamoDB Table: streaming-destinations
{
  destination_id: "dest_123",
  name: "YouTube Main Channel",
  platform: "youtube",
  rtmp_url: "rtmp://a.rtmp.youtube.com/live2",
  stream_key_param: "/lunora-player/streaming/dest_123", // SSM Parameter
  preset_id: "preset_youtube_hd",
  media_live_channel_id: "74271",
  media_live_input_id: "8133122",
  media_connect_output_arn: "arn:aws:mediaconnect:...",
  created_at: "2025-01-15T10:00:00Z",
  // NO streaming_status field!
}
```

### AWS Services: Real-time Status ONLY
```javascript
// Get actual status from AWS
const getDestinationStatus = async (destinationId) => {
  const destination = await getDestinationConfig(destinationId);
  
  // Get real-time status from AWS
  const channel = await medialive.send(new DescribeChannelCommand({
    ChannelId: destination.media_live_channel_id
  }));
  
  return {
    destination_id: destinationId,
    name: destination.name,
    platform: destination.platform,
    streaming_status: mapChannelStateToStatus(channel.State), // RUNNING -> "streaming"
    channel_state: channel.State,
    last_updated: new Date().toISOString()
  };
};
```

## Benefits

### ✅ **Eliminates Inconsistencies**
- Single source of truth for status
- No database/AWS sync issues
- Real-time accuracy

### ✅ **Simplifies Operations**
- Start/stop operations work on AWS directly
- Status is always current
- No database state management

### ✅ **Better Reliability**
- AWS services are authoritative
- No race conditions
- Automatic recovery from failures

## Implementation Changes

### 1. Remove Status from Database
```sql
-- Remove streaming_status column from destinations table
ALTER TABLE streaming_destinations DROP COLUMN streaming_status;
```

### 2. Update API Endpoints
```javascript
// Before: Check database for status
const destination = await dynamodb.get({destination_id});
return {status: destination.streaming_status}; // ❌ Unreliable

// After: Check AWS for status  
const destination = await getDestinationConfig(destinationId);
const channel = await medialive.describeChannel(destination.channel_id);
return {status: mapChannelState(channel.State)}; // ✅ Reliable
```

### 3. Frontend Polling
```javascript
// Poll AWS status directly via API
const status = await fetch('/api/destinations/dest_123/status');
// Returns real-time AWS status, not cached database value
```

## Migration Strategy

### Phase 1: Add AWS Status Checking
- Create new endpoints that check AWS directly
- Keep database status for comparison
- Identify discrepancies

### Phase 2: Switch Frontend
- Update frontend to use AWS-based status
- Remove database status dependencies
- Test thoroughly

### Phase 3: Remove Database Status
- Drop streaming_status column
- Clean up old code
- Update documentation

## Status Mapping

```javascript
const mapChannelStateToStatus = (channelState) => {
  switch (channelState) {
    case 'RUNNING': return 'streaming';
    case 'STARTING': return 'starting';
    case 'STOPPING': return 'stopping';
    case 'IDLE': return 'stopped';
    default: return 'unknown';
  }
};
```

## Error Handling

```javascript
const getDestinationStatus = async (destinationId) => {
  try {
    const destination = await getDestinationConfig(destinationId);
    const channel = await medialive.describeChannel(destination.channel_id);
    return {status: mapChannelState(channel.State)};
  } catch (error) {
    if (error.name === 'NotFoundException') {
      return {status: 'not_found'};
    }
    return {status: 'error', error: error.message};
  }
};
```

## Conclusion

This architecture eliminates the fundamental issue of dual sources of truth by:
- Using **Database** for configuration and presets
- Using **AWS Services** as the single source of truth for status
- Providing real-time, accurate status information
- Eliminating sync issues and race conditions
