# MediaConnect Granular Control Architecture

## Overview

This document outlines the implementation of AWS MediaConnect for granular RTMP destination control while maintaining the existing HLS streaming infrastructure. This architecture provides true granular control over RTMP destinations without affecting HLS viewers.

## 🎯 **Architecture Evolution**

### **Current State (Working):**
```
OBS → MediaLive → MediaPackage → HLS Player (CloudFront)
                ↓
                RTMP Destinations (Limited Control)
```

### **New MediaConnect Architecture:**
```
OBS → MediaLive ──┬─→ MediaPackage → HLS Player (CloudFront) [UNCHANGED]
                  └─→ MediaConnect → Multiple RTMP Destinations [NEW]
```

## 🏗️ **Key Benefits of This Approach**

### **HLS Path Unchanged (Zero Impact)**
- ✅ **Same Performance**: Direct MediaLive → MediaPackage path preserved
- ✅ **Same URLs**: No changes to HLS endpoints or player
- ✅ **Same Latency**: No additional hops for HLS viewers
- ✅ **Same Reliability**: Proven HLS infrastructure untouched
- ✅ **Same Costs**: No additional MediaConnect costs for HLS

### **RTMP Granular Control (New Capability)**
- ✅ **Add Destinations**: While other streams are running
- ✅ **Edit Destinations**: Update RTMP URLs/stream keys without stopping others
- ✅ **Individual Control**: Start/stop destinations independently
- ✅ **Real-time Updates**: No MediaLive channel restarts required
- ✅ **Scalable**: Add many destinations without linear cost increase

## 📊 **Cost Analysis**

### **MediaConnect Pricing (US West Oregon)**
- **Flow Cost**: $0.16/hour (regardless of destination count)
- **Data Transfer**: $0.09/GB to internet (after 100GB/month free)
- **Total Additional Cost**: ~$391/month for 24/7 operation with 10 Mbps stream

### **Cost Comparison (Monthly, 24/7 Streaming)**
| Component | Current Setup | MediaConnect Setup | Difference |
|-----------|---------------|-------------------|------------|
| MediaLive | ~$1,894 | ~$1,894 | $0 |
| MediaConnect Flow | $0 | $115 | +$115 |
| Data Transfer | Included | $276 | +$276 |
| **Total** | **~$1,894** | **~$2,285** | **+$391** |

**Value Proposition**: $391/month (~$13/day) for complete granular control over RTMP destinations.

## 🔧 **Implementation Plan**

### **Phase 1: MediaConnect Infrastructure**
1. **Deploy MediaConnect Flow**: Create RTMP router flow
2. **Update MediaLive Channel**: Add MediaConnect output group
3. **Remove Direct RTMP**: Replace current RTMP outputs with MediaConnect
4. **Test HLS Path**: Verify no impact on existing HLS streaming

### **Phase 2: Lambda Integration**
1. **MediaConnect Manager**: Lambda function for flow management
2. **Source Management API**: Create endpoints for admin source configuration
3. **API Updates**: Integrate MediaConnect operations with existing API
4. **Database Schema**: Add sources table and track MediaConnect output ARNs
5. **Error Handling**: Robust error handling for MediaConnect operations
6. **Status Synchronization**: Real-time sync between MediaConnect and database

### **Phase 3: Frontend Updates**
1. **Admin Dashboard Integration**: Add source management to Admin Dashboard
2. **Producer Interface Enhancements**: Real-time destination management
3. **Status Indicators**: Show MediaConnect flow status
4. **Granular Controls**: Individual destination start/stop buttons
5. **Error Feedback**: User-friendly error messages

## 🖥️ **User Interface Architecture**

### **Admin Dashboard Integration**

#### **Source Management (Admin Dashboard)**
**URL**: `https://admin.yourdomain.com/sources`
**User Role**: Administrators only

**Key Features:**
- **Multi-Protocol Support**: Configure SRT (Videon), RTMP (OBS), RTP, NDI sources
- **Primary/Backup Configuration**: Set source priorities and failover rules
- **Connection Testing**: Validate source connectivity before deployment
- **Health Monitoring**: Real-time source quality and connection status
- **MediaLive Integration**: Automatic input security group and channel configuration
- **Manual Override Controls**: Emergency source switching capabilities

#### **Producer Interface (Destination Management)**
**URL**: `https://streaming.yourdomain.com`
**User Role**: Producers, content creators

**Key Features:**
- **Source Selection**: Choose from admin-configured sources
- **Destination Management**: Add/edit RTMP destinations with backup URLs
- **Granular Control**: Individual destination start/stop
- **Real-time Status**: Live monitoring of all destinations
- **Backup URL Configuration**: Optional backup RTMP destinations per platform

### **Role Separation Benefits**
- ✅ **Admin Focus**: Infrastructure and source management
- ✅ **Producer Focus**: Content creation and destination control
- ✅ **Security**: Clear separation of technical vs operational concerns
- ✅ **Scalability**: Admins configure once, producers use repeatedly

## 🏛️ **Technical Architecture**

### **MediaLive Channel Configuration**
```yaml
Current Output Groups:
  - MediaPackage: [KEEP] → HLS streaming
  - RTMP: [REMOVE] → Direct RTMP destinations

New Output Groups:
  - MediaPackage: [UNCHANGED] → HLS streaming  
  - MediaConnect: [ADD] → RTMP router flow
```

### **MediaConnect Flow Configuration**
```yaml
Flow Name: lunora-player-prod-rtmp-router
Source:
  - Protocol: RTP-FEC
  - From: MediaLive Channel 3714710
  - Port: 5000
  - Max Bitrate: 50 Mbps

Outputs: [Dynamic - Managed by Lambda]
  - YouTube RTMP
  - Restream RTMP
  - LinkedIn RTMP
  - Custom RTMP destinations
```

### **Database Schema Updates**
```yaml
Sources Table (lunora-sources): [NEW]
  Primary Fields:
    - source_id: Unique identifier
    - name: Display name (e.g., "Videon Edge A")
    - protocol: SRT, RTMP, RTP, NDI
    - connection_url: Full connection string
    - priority: 1=Primary, 2=Backup, 3=Emergency
    - enabled: Boolean status

  Configuration Fields:
    - host_ip: Source IP address
    - port: Connection port
    - stream_id: Protocol-specific stream identifier
    - encryption_type: None, AES-128, AES-256
    - health_check_enabled: Boolean
    - health_check_interval: Seconds

  MediaLive Integration:
    - medialive_input_id: Associated MediaLive input
    - input_security_group_id: AWS security group
    - input_class: STANDARD, SINGLE_PIPELINE

  Status Fields:
    - health_status: HEALTHY, DEGRADED, FAILED
    - last_health_check: Timestamp
    - connection_attempts: Counter
    - created_at, updated_at: Timestamps

Destinations Table (lunora-destinations):
  Existing Fields: [UNCHANGED]
    - destination_id
    - name, platform, rtmp_url
    - stream_key_param, preset_id
    - enabled, streaming_status
    - created_at, updated_at

  New Fields: [ADD]
    - backup_rtmp_url: Optional backup URL
    - backup_stream_key_param: Optional backup stream key
    - failover_enabled: Boolean
    - current_active_url: 'primary' | 'backup'
    - mediaconnect_output_arn: MediaConnect output ARN
    - mediaconnect_backup_output_arn: Optional backup output ARN
    - output_type: 'medialive' | 'mediaconnect'
    - last_mediaconnect_sync: Timestamp
```

## 🔄 **Migration Strategy**

### **Step 1: Parallel Deployment**
1. Deploy MediaConnect infrastructure alongside existing setup
2. Keep current MediaLive RTMP outputs functional
3. Test MediaConnect flow with test destinations
4. Verify HLS path remains unaffected

### **Step 2: Gradual Migration**
1. Migrate one destination at a time to MediaConnect
2. Test granular control functionality
3. Verify streaming quality and reliability
4. Monitor costs and performance

### **Step 3: Complete Transition**
1. Remove direct MediaLive RTMP outputs
2. Route all RTMP destinations through MediaConnect
3. Update documentation and user guides
4. Train users on new granular controls

## 🧪 **Testing Plan**

### **HLS Path Verification**
- ✅ Verify HLS endpoint unchanged: `https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/ab090a5ad83f4d26b3ae8a23f3512081/index.m3u8`
- ✅ Test HLS player functionality: `https://d35au6zpsr51nc.cloudfront.net/hls-player.html`
- ✅ Confirm no latency increase for HLS viewers
- ✅ Verify adaptive bitrate streaming still works

### **MediaConnect RTMP Testing**
- ✅ Test individual destination start/stop
- ✅ Verify granular control (add destination while streaming)
- ✅ Test stream quality to external platforms
- ✅ Confirm cost tracking and monitoring

### **End-to-End Workflow**
- ✅ OBS → MediaLive → MediaConnect → Multiple RTMP destinations
- ✅ OBS → MediaLive → MediaPackage → HLS Player (unchanged)
- ✅ Dashboard shows accurate status for all destinations
- ✅ Individual destination controls work independently

## 📋 **Success Criteria**

### **Functional Requirements**
- ✅ **HLS Streaming**: No impact on existing HLS infrastructure
- ✅ **Granular Control**: Add/edit/remove RTMP destinations independently
- ✅ **Real-time Updates**: No MediaLive channel restarts required
- ✅ **Quality Preservation**: No degradation in streaming quality
- ✅ **Cost Efficiency**: Predictable cost increase (~$391/month)

### **Technical Requirements**
- ✅ **API Compatibility**: Existing API endpoints continue working
- ✅ **Database Integrity**: No data loss during migration
- ✅ **Error Handling**: Robust error handling for all scenarios
- ✅ **Monitoring**: Real-time status updates for all components
- ✅ **Documentation**: Updated user guides and technical docs

## 🔐 **Security Considerations**

### **IAM Permissions**
```yaml
Lambda Function Permissions:
  MediaConnect:
    - mediaconnect:DescribeFlow
    - mediaconnect:AddFlowOutputs
    - mediaconnect:RemoveFlowOutput
    - mediaconnect:UpdateFlowOutput
  
  MediaLive: [EXISTING]
    - medialive:DescribeChannel
    - medialive:UpdateChannel
    - medialive:StartChannel
    - medialive:StopChannel
```

### **Network Security**
- MediaConnect flow within AWS VPC
- Encrypted data transfer between services
- Secure parameter storage for stream keys
- Access logging and monitoring

## 📈 **Monitoring and Analytics**

### **CloudWatch Metrics**
- MediaConnect flow status and health
- Data transfer volumes and costs
- Destination connection status
- Error rates and latency metrics

### **Dashboard Integration**
- Real-time MediaConnect flow status
- Individual destination health indicators
- Cost tracking and budget alerts
- Performance metrics and analytics

## 🚀 **Future Enhancements**

### **Advanced Features**
- **Multi-Channel Support**: Scale to multiple MediaLive channels
- **Load Balancing**: Distribute load across multiple flows
- **Advanced Routing**: Content-aware destination routing
- **Analytics Integration**: Detailed streaming analytics

### **Cost Optimization**
- **Reserved Bandwidth**: 12-month commitments for cost savings
- **Intelligent Routing**: Optimize data transfer costs
- **Automated Scaling**: Dynamic flow management based on demand

## 📚 **Related Documentation**

- [Multi-Destination Streaming Architecture](./multi-destination-streaming-architecture.md)
- [MediaLive Implementation Guide](./medialive-implementation-prompt.md)
- [Production Deployment Guide](./production-deployment-guide.md)
- [AWS Account Setup](./aws-account-setup.md)

---

**Implementation Status**: 🚧 In Development
**Target Completion**: Q3 2025
**Priority**: High - Enables core business requirement for granular streaming control
