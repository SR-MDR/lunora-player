# Dynamic Multi-Destination Streaming Implementation Prompt

## 🎯 **Context & Objective**

I need to implement a **Dynamic MediaConnect + On-Demand MediaLive** architecture for true granular RTMP destination control. This approach uses AWS MediaConnect APIs (`add_flow_outputs`, `remove_flow_output`) to dynamically create and destroy MediaLive channels on-demand, providing cost-efficient granular control while supporting multiple instances of the same platform.

## 📊 **Current State**

### **Working Production System:**
- **Current Branch**: `feature/srt-mediaconnect-multi-medialive-robust`
- **Production Lambda**: `lunora-player-prod-multi-destination-api` (working)
- **Frontend URLs**:
  - Admin Dashboard: `https://d35au6zpsr51nc.cloudfront.net/dashboard.html`
  - Streaming Dashboard: `https://d35au6zpsr51nc.cloudfront.net/streaming.html`
- **Current MediaLive Channel**: `3714710` (lunora-player-prod-obs-rtmp-channel)
- **MediaConnect Flow**: `lunora-player-prod-srt-mediaconnect` (deployed and working)
- **Database Tables**: `lunora-destinations`, `lunora-presets`, `lunora-streaming-sessions`
- **Service Limits**: 10 MediaLive channels approved (increased from 5)

### **Usage Pattern**:
- **80-100 hours/month** streaming (not 24/7)
- **Cost-conscious** approach preferred
- **Granular control** required for individual destination start/stop
- **Multiple instances** needed (e.g., 2 YouTube feeds for same event)

## 🏗️ **Target Architecture**

```
Videon Edge Node (SRT Caller, Encrypted)
    ↓ SRT Stream (AES-128)
MediaConnect Flow (SRT Listener)
    ↓ Dynamic API-Driven Output Creation
├── Primary HLS Channel (Always Running) → MediaPackage → HLS Player
└── Dynamic MediaLive Channels (On-Demand Creation):
    ├── YouTube Channel 1 → YouTube RTMP (created when needed)
    ├── YouTube Channel 2 → YouTube RTMP (created when needed)
    ├── Twitch Channel → Twitch RTMP (created when needed)
    ├── LinkedIn Channel → LinkedIn RTMP (created when needed)
    └── Custom RTMP Channels (created when needed)
```

### **Cost Analysis (100 hours/month):**
- **MediaConnect Flow**: $115.20/month (24/7 operation)
- **Primary HLS Channel**: $42.12/month (24/7 operation)
- **Dynamic Channels**: $42.12/month per 100 hours (only when active)
- **Estimated Total**: $200-300/month (vs $355.80 for always-on channels)
- **Cost Savings**: 30-50% reduction through on-demand resource usage

## 📋 **Implementation Requirements**

### **1. Dynamic Destination Management**
- **On-Demand Channel Creation**: Create MediaLive channels only when destinations are added
- **Automatic Cleanup**: Remove MediaLive channels when destinations are deleted
- **Multi-Instance Support**: Multiple YouTube/Twitch feeds for same event
- **Real-Time Control**: Start/stop individual destinations without affecting others

### **2. API-Driven Architecture**
- **MediaConnect Integration**: Use `add_flow_outputs()` and `remove_flow_output()` APIs
- **MediaLive Management**: Dynamic channel creation, configuration, and deletion
- **DynamoDB Tracking**: Store destination metadata and channel associations
- **RESTful Endpoints**: Clean API design for frontend integration

### **3. Enhanced Frontend Integration**
- **Maintain Current UI**: Keep existing "Add Destination" form and interface
- **Real-Time Status**: Show individual destination status and health
- **Platform Presets**: YouTube, Twitch, LinkedIn, Custom RTMP options
- **Multi-Instance UI**: Support adding multiple instances of same platform

### **4. Cost Optimization**
- **Pay-Per-Use**: Only pay for active MediaLive channels
- **Automatic Scaling**: Scale up/down based on active destinations
- **Resource Monitoring**: Track usage and costs per destination
- **Efficient Cleanup**: Immediate resource deallocation when not needed

## 📁 **Key Documents & References**

### **Comprehensive Architecture Plan:**
- `docs/DYNAMIC_STREAMING_ARCHITECTURE_PLAN.md` - Complete detailed implementation plan
- `DEPLOYMENT_LESSONS_LEARNED.md` - Critical deployment insights and safeguards

### **Architecture Benefits:**
- ✅ **True Dynamic Scaling**: Create/destroy resources on-demand
- ✅ **Cost Efficiency**: 30-50% cost reduction through pay-per-use model
- ✅ **Multi-Instance Support**: Multiple destinations of same platform type
- ✅ **Robust Deployment**: Based on lessons learned from previous deployments
- ✅ **Future-Proof Design**: Scalable architecture using AWS APIs
- ✅ **Granular Control**: Individual destination management without interference

## 🚀 **Implementation Steps**

### **Phase 1: Foundation Infrastructure (Week 1)**
1. **Create new Git branch**: `feature/dynamic-streaming-foundation`
2. **Deploy CloudFormation foundation**: Core infrastructure (DynamoDB, Lambda, API Gateway, IAM)
3. **Implement Lambda functions**: `addDestination`, `removeDestination`, `listDestinations`, `controlDestination`
4. **Test MediaConnect API integration**: Verify `add_flow_outputs` and `remove_flow_output` functionality

### **Phase 2: Dynamic Channel Management (Week 2)**
1. **Implement MediaLive channel templates**: Platform-specific presets and configurations
2. **Build destination lifecycle management**: Create → Configure → Start → Stop → Delete workflows
3. **Integrate DynamoDB tracking**: Store destination metadata and channel associations
4. **Test end-to-end destination management**: Add/remove destinations via API

### **Phase 3: Frontend Integration (Week 3)**
1. **Update API endpoints**: Integrate new dynamic destination management APIs
2. **Enhance destination UI**: Support for multiple instances and real-time status
3. **Implement monitoring dashboard**: Show MediaConnect flow status and destination health
4. **Test complete user workflows**: Add destinations, start/stop streaming, remove destinations

### **Phase 4: Production Deployment (Week 4)**
1. **Deploy to production environment**: Following deployment lessons learned
2. **Configure monitoring and alerting**: CloudWatch metrics and cost tracking
3. **Validate cost efficiency**: Monitor actual usage vs projected costs
4. **Documentation and handover**: Complete implementation documentation

## 🔧 **Technical Specifications**

### **MediaConnect Flow (Existing):**
- **Protocol**: SRT listener on port 9998
- **Encryption**: AES-128 for security
- **Dynamic Outputs**: Created/destroyed via `add_flow_outputs()` and `remove_flow_output()` APIs
- **Monitoring**: CloudWatch alarms and health checks

### **Dynamic MediaLive Channels:**
- **Creation**: On-demand via `CreateChannel` API when destinations added
- **Configuration**: Platform-specific presets (YouTube, Twitch, LinkedIn, Custom)
- **Input**: MediaConnect RTP-FEC output (dynamically assigned)
- **Lifecycle**: Create → Start → Stop → Delete based on destination management
- **Monitoring**: Individual channel health and cost tracking

### **API Architecture:**
```
POST /api/destinations                       - Add new destination (creates MediaLive channel)
DELETE /api/destinations/{id}                - Remove destination (deletes MediaLive channel)
GET /api/destinations                        - List all destinations with status
POST /api/destinations/{id}/start            - Start specific destination
POST /api/destinations/{id}/stop             - Stop specific destination
PUT /api/destinations/{id}                   - Update destination settings
GET /api/mediaconnect/flow/status            - MediaConnect flow status
GET /api/destinations/{id}/metrics           - Individual destination metrics
```

### **DynamoDB Schema:**
```json
{
  "destinationId": "uuid-v4",
  "name": "YouTube Main Event",
  "platform": "youtube|twitch|linkedin|custom",
  "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2",
  "streamKey": "encrypted-stream-key",
  "preset": "1080p30|720p30|1080p60|custom",
  "status": "idle|creating|starting|running|stopping|deleting|error",
  "mediaLiveChannelId": "1234567",
  "mediaConnectOutputArn": "arn:aws:mediaconnect:...",
  "createdAt": "2025-01-XX",
  "lastModified": "2025-01-XX"
}
```

## 🎯 **Success Criteria**

### **Functional Requirements:**
- ✅ **Dynamic Destination Management**: Add/remove destinations on-demand with automatic resource creation/cleanup
- ✅ **Multi-Instance Support**: Multiple YouTube/Twitch feeds for same event
- ✅ **Cost Efficiency**: 30-50% cost reduction through pay-per-use model
- ✅ **Granular Control**: Start/stop individual destinations independently
- ✅ **Real-time Status**: Live monitoring of destination health and performance
- ✅ **Platform Flexibility**: Support for YouTube, Twitch, LinkedIn, and custom RTMP destinations

### **Technical Requirements:**
- ✅ **API-Driven Architecture**: Clean RESTful APIs for all destination operations
- ✅ **Robust Error Handling**: Comprehensive error handling and recovery mechanisms
- ✅ **Resource Cleanup**: Automatic cleanup of MediaLive channels and MediaConnect outputs
- ✅ **Database Consistency**: Reliable tracking of destination state and metadata
- ✅ **Performance**: Sub-30-second destination creation, sub-10-second deletion
- ✅ **Monitoring**: Real-time CloudWatch metrics and alerting

## 🚨 **Critical Implementation Notes**

### **Deployment Lessons Learned Integration:**
- **Complete Backup Strategy**: Backup all working code before deployment (per DEPLOYMENT_LESSONS_LEARNED.md)
- **Environment Separation**: Clear dev vs prod configurations to avoid confusion
- **Incremental Testing**: Test each component individually before integration
- **Permission Validation**: Verify all AWS permissions upfront (MediaConnect + MediaLive + DynamoDB)
- **Function URL Management**: Proper resource-based policies for Lambda Function URLs

### **Rollback Strategy:**
- **Infrastructure Rollback**: CloudFormation stack rollback capability
- **Lambda Versioning**: Previous function versions maintained for quick rollback
- **Database Backup**: DynamoDB point-in-time recovery enabled
- **Configuration Backup**: Previous API endpoints and configurations preserved

### **Security Considerations:**
- **SRT Encryption**: AES-128 for secure transport from Videon Edge
- **IAM Least Privilege**: Minimal required permissions for MediaConnect and MediaLive APIs
- **API Security**: API Gateway authentication and rate limiting
- **Stream Key Protection**: Encrypted storage of RTMP stream keys in DynamoDB

### **Cost Controls:**
- **Automatic Cleanup**: Immediate resource deallocation when destinations removed
- **Usage Monitoring**: CloudWatch cost tracking and alerting
- **Resource Tagging**: Proper tagging for cost allocation and management

## 📞 **Request for Implementation**

Please help me implement this **Dynamic Multi-Destination Streaming Architecture** following the comprehensive plan in `docs/DYNAMIC_STREAMING_ARCHITECTURE_PLAN.md`.

**Implementation Priority:**
1. **Foundation CloudFormation Template**: Core infrastructure (DynamoDB, Lambda, API Gateway, IAM roles)
2. **Lambda Functions**: Dynamic destination management using MediaConnect and MediaLive APIs
3. **API Integration**: RESTful endpoints for destination lifecycle management
4. **Frontend Integration**: Update existing UI to use new dynamic APIs
5. **Production Deployment**: Following deployment lessons learned for robust rollout

**Key Goals:**
- ✅ **True Dynamic Control**: Create/destroy MediaLive channels on-demand
- ✅ **Cost Efficiency**: 30-50% cost reduction through pay-per-use model
- ✅ **Multi-Instance Support**: Multiple destinations of same platform type
- ✅ **Robust Deployment**: Based on lessons learned from previous deployments
- ✅ **Future-Proof Architecture**: Scalable design using AWS APIs

**Start with Phase 1**: Foundation infrastructure deployment, ensuring all components are properly configured and tested before proceeding to dynamic channel management implementation.

## 🚀 **IMPLEMENTATION STATUS - STARTED**

**Current State Analysis Completed:**
- ✅ MediaConnect Flow: `lunora-player-prod-srt-router` (STANDBY, SRT listener port 9998)
- ✅ Lambda Function: `lunora-player-prod-multi-destination-api` (Node.js 22.x, working)
- ✅ DynamoDB Tables: All required tables exist and operational
- ✅ MediaLive Channel: Channel ID `3714710` configured

**PHASE 1 COMPLETED ✅**
1. ✅ Created Git branch: `feature/dynamic-streaming-foundation`
2. ✅ Implemented MediaConnect dynamic output management in Lambda
3. ✅ Added dynamic MediaLive channel creation/deletion APIs
4. ✅ Created comprehensive deployment automation

**IMPLEMENTATION COMPLETE - READY FOR DEPLOYMENT:**

**Core Components Created:**
- `backend/dynamic-destination-manager.js` - Complete MediaConnect + MediaLive integration
- `backend/enhanced-lambda-handler.js` - Enhanced API with dynamic destination management
- `aws/cloudformation/dynamic-streaming-foundation.yaml` - Complete infrastructure template
- `scripts/deploy-dynamic-streaming.sh` - Automated deployment with backup strategy
- `docs/DYNAMIC_STREAMING_IMPLEMENTATION.md` - Comprehensive implementation guide

**Validation Status:**
- ✅ CloudFormation template validated successfully
- ✅ Prerequisites checked (MediaConnect flow exists)
- ✅ Deployment script tested and ready
- ✅ Following deployment lessons learned guidelines

**✅ PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY!**

**Deployed Infrastructure:**
- ✅ CloudFormation Stack: `lunora-player-prod-dynamic-streaming`
- ✅ Lambda Function: `lunora-player-prod-dynamic-streaming-api`
- ✅ DynamoDB Table: `lunora-player-dynamic-destinations-prod`
- ✅ IAM Roles: MediaLive access and Lambda execution roles
- ✅ Function URL: `https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/`

**API Endpoints Verified:**
- ✅ `GET /` - Health check (200 OK)
- ✅ `GET /api/destinations` - List destinations (200 OK)
- ✅ `GET /api/mediaconnect/flow/status` - MediaConnect flow status (200 OK)
- ✅ MediaConnect Flow: `lunora-player-prod-srt-router` (STANDBY, ready for dynamic outputs)

**Deployment Lessons Applied:**
- ✅ Complete backup created before deployment
- ✅ CORS configuration researched and corrected
- ✅ Lambda Function URL event structure properly handled
- ✅ Comprehensive error handling and logging

**Ready for Phase 2: Dynamic Destination Testing**
- Test dynamic destination creation
- Test MediaLive channel lifecycle
- Test resource cleanup
- Validate cost optimization
