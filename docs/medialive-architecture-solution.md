# MediaLive Architecture Solution for Independent Destination Management

## Problem Statement

AWS MediaLive channels **cannot be updated while they are in RUNNING state**. This creates a fundamental challenge for multi-destination streaming where destinations need to be started and stopped independently without affecting other active streams.

## Current Limitation

The initial implementation attempted to dynamically add/remove RTMP output groups to the MediaLive channel configuration. However, this approach fails because:

1. **MediaLive channels cannot be updated while RUNNING**
2. **Stopping the channel to update configuration interrupts ALL active streams**
3. **This breaks the requirement for independent destination management**

## Solution Options

### Option 1: Pre-configured RTMP Output Groups (Recommended)

**Approach**: Pre-configure multiple RTMP output groups in the MediaLive channel and control them via destination URL updates or schedule actions.

**Pros**:
- No channel restarts required
- True independent destination control
- Cost-effective (single channel)
- Supports real-time destination management

**Cons**:
- Limited number of pre-configured outputs
- Requires channel reconfiguration for new destination types

**Implementation**:
```yaml
# MediaLive Channel with Pre-configured RTMP Outputs
OutputGroups:
  - Name: "MediaPackage"
    # HLS output for player
  - Name: "RTMP-Slot-1"
    # YouTube/Custom RTMP output
  - Name: "RTMP-Slot-2" 
    # Additional RTMP output
  - Name: "RTMP-Slot-3"
    # Additional RTMP output
```

### Option 2: MediaLive Schedule Actions

**Approach**: Use MediaLive's schedule actions to start/stop outputs without channel updates.

**Pros**:
- Dynamic output control
- No channel restarts
- Supports complex scheduling

**Cons**:
- More complex implementation
- Limited schedule action types for RTMP
- Requires careful timing management

### Option 3: Multiple MediaLive Channels

**Approach**: Create separate MediaLive channels for each destination type.

**Pros**:
- Complete independence
- Simple implementation
- No cross-destination interference

**Cons**:
- Expensive (~$1.50/hour per channel)
- Complex input management
- Resource overhead

### Option 4: Hybrid Approach (Current Implementation)

**Approach**: Track streaming status in database while using pre-configured MediaLive outputs.

**Pros**:
- Maintains existing UI/UX
- Provides foundation for future enhancement
- Cost-effective development approach

**Cons**:
- Requires manual MediaLive channel configuration
- Limited to pre-configured destinations

## Recommended Implementation Plan

### Phase 1: Enhanced Status Tracking (Current)
- ✅ Track destination streaming status in DynamoDB
- ✅ Manage MediaLive channel start/stop based on active destinations
- ✅ Provide API endpoints for destination control
- ⚠️ Requires manual MediaLive channel configuration for actual RTMP outputs

### Phase 2: Pre-configured RTMP Outputs
- Create MediaLive channel with multiple RTMP output groups
- Map destinations to specific output slots
- Use destination URL updates to control active outputs
- Implement automatic slot assignment

### Phase 3: Dynamic Output Management
- Implement MediaLive schedule actions for runtime control
- Add support for unlimited destinations
- Optimize cost through intelligent channel management

## Current Implementation Status

The current Lambda implementation provides:

1. **Database Status Management**: Tracks streaming status for all destinations
2. **Channel Lifecycle Management**: Starts/stops MediaLive channel based on active destinations
3. **Error Handling**: Comprehensive error handling and status updates
4. **API Compatibility**: Maintains existing frontend API contract

### What Works Now:
- ✅ Start/stop destination status tracking
- ✅ MediaLive channel start/stop optimization
- ✅ Frontend integration (status persistence, real-time updates)
- ✅ Cost optimization (channel only runs when needed)

### What Requires Manual Setup:
- ⚠️ MediaLive channel must be manually configured with RTMP output groups
- ⚠️ Destination URLs must be manually mapped to output groups
- ⚠️ Stream keys must be manually configured in MediaLive

## Next Steps

### Immediate (Phase 1 Complete):
1. **Test current implementation** with existing destinations
2. **Verify status tracking** works correctly
3. **Confirm channel start/stop** optimization functions

### Short-term (Phase 2):
1. **Create script to configure MediaLive channel** with pre-configured RTMP outputs
2. **Implement destination-to-output mapping** in Lambda functions
3. **Add automatic URL/stream key updates** to MediaLive destinations

### Long-term (Phase 3):
1. **Implement MediaLive schedule actions** for dynamic control
2. **Add support for unlimited destinations**
3. **Optimize for cost and performance**

## Testing Strategy

### Current Implementation Testing:
1. **Start destination**: Verify status updates to "streaming" and channel starts
2. **Stop destination**: Verify status updates to "ready" and channel stops when no active destinations
3. **Multiple destinations**: Test independent status management
4. **Error scenarios**: Verify error handling and status recovery

### Future Implementation Testing:
1. **Actual RTMP streaming**: Verify streams reach external platforms
2. **Independent control**: Confirm destinations can be started/stopped without affecting others
3. **Performance**: Test with multiple simultaneous destinations
4. **Cost optimization**: Verify channel management reduces costs

## Conclusion

The current implementation provides a solid foundation for multi-destination streaming with proper status tracking and cost optimization. While it requires manual MediaLive configuration for actual RTMP streaming, it maintains the user experience and provides the infrastructure for future enhancements.

The architecture is designed to evolve from status tracking to full dynamic output management while preserving the existing API and user interface.
