# Multi-Source Streaming Architecture Plan

## Overview
Lunora Player multi-destination streaming system with flexible input source management, redundancy, and failover capabilities. Includes integrated HLS player destination for complete closed-loop testing.

## Architecture Goals
- **Flexible Input Sources**: Support SRT, RTMP, RTP, File, WebRTC inputs
- **Redundancy**: Main + backup source failover within AWS AZ
- **Admin-Controlled**: Source management restricted to admin users
- **Immediate Testing**: RTMP input for OBS testing while Videon unavailable
- **Production Ready**: SRT primary for Videon LiveEdge nodes

## Input Source Types

### Primary Sources (Production)
1. **SRT Input** - Videon LiveEdge nodes
   - Primary: Videon encoder #1 → SRT stream
   - Backup: Videon encoder #2 → SRT stream  
   - Automatic failover in MediaLive
   - Redundancy within selected AWS AZ

2. **RTMP Input** - Alternative encoders
   - OBS Studio, other software encoders
   - Hardware encoders with RTMP output
   - Backup option for SRT sources

### Testing/Development Sources
3. **MP4 File Input** - Static content testing
4. **WebRTC Input** - Browser-based testing
5. **RTP Input** - Professional equipment

## Streaming Destinations

### External Platforms
1. **YouTube Live** - Platform-optimized encoding presets
2. **X (Twitter) Live** - Social media streaming
3. **LinkedIn Live** - Professional broadcasting
4. **Custom RTMP** - Generic RTMP destinations

### Internal Testing Destination
5. **HLS Player** - Integrated Lunora Player for closed-loop testing
   - **Purpose**: Complete pipeline testing without external dependencies
   - **Configuration**: Automatic MediaPackage HLS endpoint integration
   - **Benefits**:
     - Test complete OBS → MediaLive → MediaPackage → Player pipeline
     - Verify stream quality and latency
     - Debug encoding settings before going live to external platforms
     - No external API keys required for testing
   - **Usage**: Always available as a destination option in multi-destination interface
   - **Monitoring**: Real-time playback status and quality metrics

### Destination Management
- **Individual Control**: Start/stop each destination independently
- **Master Control**: Start/stop all destinations simultaneously
- **Status Monitoring**: Real-time streaming status for each destination
- **Quality Presets**: Platform-optimized encoding settings
- **Failover**: Automatic retry on connection failures

## Deployment Modes

### Single Channel Mode
- One active input source
- Simpler configuration
- Lower cost
- Suitable for basic streaming

### Main + Backup Mode (Recommended Production)
- Two SRT inputs from separate Videon encoders
- Automatic failover in MediaLive
- Redundancy within AWS AZ
- Higher reliability for critical streams

## Technical Implementation

### MediaLive Input Configuration
```
Input Type Selection → MediaLive Input Creation → Failover Configuration
```

### Source Management Flow
1. **Admin Dashboard**: Source type selection
2. **Dynamic Configuration**: Show relevant fields per input type
3. **MediaLive Setup**: Create appropriate input configuration
4. **Failover Setup**: Configure backup sources if selected
5. **Status Monitoring**: Track active/backup source status

### Input Types Configuration
- **SRT**: Listener mode, port configuration, encryption
- **RTMP**: Push URL generation, stream key management
- **File**: S3 bucket location, loop settings
- **WebRTC**: Browser integration, quality settings

## Implementation Phases

### Phase 1: RTMP Testing (Immediate - Current Priority)
**Goal**: Get streaming pipeline working with OBS
- [x] Multi-destination streaming frontend deployed
- [ ] Create MediaLive channel with RTMP input
- [ ] Configure MediaPackage for HLS output
- [ ] Test OBS → MediaLive → MediaPackage → Player pipeline
- [ ] Verify multi-destination streaming works end-to-end

### Phase 2: Source Management UI (Next)
**Goal**: Admin interface for source configuration
- [ ] Add source type selection to admin dashboard
- [ ] Dynamic configuration forms per input type
- [ ] MediaLive input creation API endpoints
- [ ] Source status monitoring
- [ ] Input switching capabilities

### Phase 3: SRT + Redundancy (When Videon Available)
**Goal**: Production SRT inputs with failover
- [ ] SRT input configuration in MediaLive
- [ ] Dual Videon encoder setup
- [ ] Automatic failover configuration
- [ ] Redundancy testing within AWS AZ
- [ ] Production deployment validation

### Phase 4: Advanced Features (Future)
**Goal**: Enhanced reliability and monitoring
- [ ] Multi-channel support (multiple simultaneous streams)
- [ ] Advanced monitoring and alerting
- [ ] Performance optimization
- [ ] Scaling architecture documentation

## Current Status
- **Deployed**: Multi-destination streaming frontend and API
- **Testing Ready**: OBS Studio available for RTMP testing
- **Videon Availability**: Available for testing in a few days
- **Next Action**: Create MediaLive channel with RTMP input for immediate testing

## Configuration Details

### Videon LiveEdge Node Setup
- **Input Format**: 1080i59.94
- **Output Protocol**: SRT (preferred over RTMP)
- **Bandwidth**: Up to 50,000 max available
- **Redundancy**: Two separate encoders for main/backup

### AWS MediaLive Failover
- **Input Failover**: Automatic switching between main/backup
- **AZ Redundancy**: Deploy within single AZ for latency
- **Health Monitoring**: Source availability detection
- **Seamless Switching**: Minimize interruption during failover

### Admin Access Control
- **Source Management**: Admin-only configuration
- **User Roles**: 
  - Basic users: Stream URL/key input only
  - Admin users: Full source management access
  - Super admin: Infrastructure management

## Testing Strategy

### Immediate Testing (OBS)
1. Configure MediaLive RTMP input
2. Set up OBS with test video file playback
3. Test complete pipeline: OBS → MediaLive → MediaPackage → HLS Player
4. Verify HLS Player destination works (closed-loop testing)
5. Test external multi-destination outputs (YouTube, X, LinkedIn)
6. Validate stream quality and latency
7. Document configuration for replication

### Production Testing (Videon)
1. Configure SRT inputs for dual Videon encoders
2. Test failover scenarios
3. Validate redundancy within AZ
4. Performance and reliability testing
5. Production deployment validation

## Success Criteria
- [ ] OBS streaming works end-to-end within 1 day
- [ ] Multi-destination outputs function correctly
- [ ] Admin source management interface operational
- [ ] SRT failover configuration ready for Videon testing
- [ ] Production deployment architecture documented
