# SRT → MediaConnect → Multi-MediaLive Implementation Prompt

## 🎯 **Context & Objective**

I need to implement a robust **SRT → MediaConnect → Multi-MediaLive** architecture for granular RTMP destination control. This replaces the previous MediaConnect RTMP output approach (which doesn't work due to AWS protocol limitations) with a multi-channel solution that provides true granular control for streaming to multiple platforms.

## 📊 **Current State**

### **Working Production System:**
- **Current Branch**: `feature/mediaconnect-granular-control` (rolled back to commit `8a9d32e`)
- **Production Lambda**: `lunora-player-prod-multi-destination-api` (working)
- **Frontend URLs**: 
  - Admin Dashboard: `https://d35au6zpsr51nc.cloudfront.net/dashboard.html`
  - Streaming Dashboard: `https://d35au6zpsr51nc.cloudfront.net/streaming.html`
- **Current MediaLive Channel**: `3714710` (lunora-player-prod-obs-rtmp-channel)
- **Database Tables**: `lunora-destinations`, `lunora-presets`, `lunora-streaming-sessions`

### **Usage Pattern**: 
- **80-100 hours/month** streaming (not 24/7)
- **Cost-conscious** approach preferred
- **Granular control** required for individual destination start/stop

## 🏗️ **Target Architecture**

```
Videon Edge Node (SRT Caller, Encrypted)
    ↓ SRT Stream (AES-128)
MediaConnect Flow (SRT Listener → 5 Dedicated RTP-FEC Outputs)
    ↓ Port 5000-5004
├── MediaLive Channel 1 (Primary) → MediaPackage → HLS Player
├── MediaLive Channel 2 (YouTube) → YouTube RTMP
├── MediaLive Channel 3 (Twitch) → Twitch RTMP
├── MediaLive Channel 4 (LinkedIn) → LinkedIn RTMP
└── MediaLive Channel 5 (Custom) → Custom RTMP
```

### **Cost Analysis (100 hours/month):**
- **MediaConnect Flow**: $115.20/month (24/7 operation)
- **Data Transfer**: $30.00/month (estimated)
- **5 MediaLive Channels**: $210.60/month (single pipeline, 100 hours each)
- **Total**: $355.80/month (vs $280.80 for single channel with no granular control)
- **Cost Premium**: $75/month for granular control capability

## 📋 **Implementation Requirements**

### **1. Platform-Specific & Generic Presets**
- **Platform-Specific**: YouTube, Twitch, LinkedIn optimized settings
- **Generic**: 720p, 1080p universal quality settings
- **Custom Platform Presets**: Admin-created presets for new platforms
- **Default Collection**: Ready-to-use presets for all platforms

### **2. Two-Dashboard Architecture**
- **Admin Dashboard** (`dashboard.html`): Infrastructure monitoring, platform/preset management (admin-only)
- **Streaming Dashboard** (`streaming.html`): Live streaming operations, MediaConnect flow status, input health monitoring

### **3. Enhanced "Add Destination" Functionality**
- **Maintain current user-friendly form** for adding destinations
- **Platform-specific preset selection** with auto-populated settings
- **Dedicated channel assignment** per destination
- **Real-time individual status** monitoring

### **4. Input Health Monitoring**
- **Main SRT input** status and metrics
- **Backup SRT input** monitoring (if configured)
- **Failover capability** with manual switch option
- **Real-time health indicators** on streaming dashboard

## 📁 **Key Documents Created**

### **Comprehensive Implementation Plan:**
- `docs/srt-mediaconnect-multi-medialive-implementation-v2-robust.md` - Complete robust implementation plan
- `docs/implementation-review-summary.md` - Review findings and improvements

### **Plan Includes:**
- ✅ **Complete CloudFormation templates** for MediaConnect flow and 5 MediaLive channels
- ✅ **Enhanced backend implementation** with multi-channel manager and preset system
- ✅ **Default preset collection** with platform-specific optimizations
- ✅ **Dashboard enhancements** for both admin and streaming interfaces
- ✅ **Deployment scripts** with staged rollout and rollback procedures
- ✅ **Monitoring and alerting** setup with CloudWatch integration

## 🚀 **Implementation Steps**

### **Phase 1: Infrastructure (Week 1)**
1. **Create new Git branch**: `feature/srt-mediaconnect-multi-medialive-robust`
2. **Deploy MediaConnect flow** with SRT input and 5 RTP-FEC outputs
3. **Deploy 5 MediaLive channels** with dedicated inputs from MediaConnect
4. **Test SRT → MediaConnect → MediaLive** connectivity

### **Phase 2: Backend (Week 2)**
1. **Implement multi-channel manager** with robust error handling
2. **Deploy preset management system** with default presets
3. **Update Lambda function** with new APIs and environment variables
4. **Run database migration** for multi-channel schema

### **Phase 3: Frontend (Week 3)**
1. **Enhance admin dashboard** with MediaConnect monitoring and platform/preset management
2. **Update streaming dashboard** with flow status and input health monitoring
3. **Enhance destination management** with platform-specific presets
4. **Test end-to-end functionality**

### **Phase 4: Deployment (Week 4)**
1. **Configure Videon Edge** for SRT output to MediaConnect
2. **Production testing** with all destinations
3. **Monitor and optimize** based on real usage
4. **Documentation and training**

## 🔧 **Technical Specifications**

### **MediaConnect Flow:**
- **Protocol**: SRT listener on port 9998
- **Encryption**: AES-128 for security
- **Outputs**: 5 dedicated RTP-FEC outputs (ports 5000-5004)
- **Monitoring**: CloudWatch alarms and health checks

### **MediaLive Channels:**
- **Configuration**: Single pipeline for cost efficiency
- **Input**: MediaConnect RTP-FEC (dedicated per channel)
- **Encoding**: Platform-optimized presets
- **Monitoring**: Individual channel health and metrics

### **Backend APIs:**
```
GET  /api/channels/status                    - Multi-channel status
POST /api/destinations/{id}/start-channel    - Start individual channel
POST /api/destinations/{id}/stop-channel     - Stop individual channel
GET  /api/mediaconnect/flow/status           - MediaConnect flow status
GET  /api/mediaconnect/inputs/health         - Input health monitoring
GET  /api/admin/platforms                    - Platform management (admin)
GET  /api/admin/presets                      - Preset management (admin)
```

## 🎯 **Success Criteria**

### **Functional Requirements:**
- ✅ **Granular Control**: Start/stop individual destinations independently
- ✅ **Single SRT Input**: Videon sends one SRT stream to MediaConnect
- ✅ **HLS Unchanged**: Existing HLS streaming continues working
- ✅ **Cost Effective**: Total cost under $400/month for 100 hours usage
- ✅ **Real-time Control**: Add/remove destinations without affecting others

### **Technical Requirements:**
- ✅ **API Compatibility**: Existing endpoints continue working
- ✅ **Database Integrity**: No data loss during implementation
- ✅ **Performance**: No degradation in streaming quality
- ✅ **Monitoring**: Real-time status for all channels and flow
- ✅ **Error Handling**: Robust error handling for channel failures

## 🚨 **Critical Notes**

### **Rollback Strategy:**
- **Emergency rollback**: Switch Videon back to current MediaLive channel input
- **Database backup**: Created before migration
- **Lambda backup**: Previous function version preserved
- **Infrastructure**: Keep new resources but revert to old configuration

### **Security Considerations:**
- **SRT encryption**: AES-128 for secure transport
- **IAM least privilege**: Minimal required permissions
- **Network security**: Restrict MediaConnect access to Videon IP
- **Credential management**: Encrypted stream keys in database

## 📞 **Request for Implementation**

Please help me implement this robust SRT → MediaConnect → Multi-MediaLive architecture following the comprehensive plan in `docs/srt-mediaconnect-multi-medialive-implementation-v2-robust.md`. 

**Start with:**
1. Creating the new Git branch
2. Implementing the CloudFormation templates for MediaConnect flow and multi-MediaLive channels
3. Setting up the enhanced backend with multi-channel management and preset system

The goal is to achieve true granular control for RTMP destinations while maintaining cost efficiency and providing enhanced dashboard functionality for both administrators and streaming operators.
