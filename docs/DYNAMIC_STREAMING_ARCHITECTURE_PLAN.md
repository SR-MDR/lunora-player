# Dynamic Multi-Destination Streaming Architecture Plan

## Executive Summary

This document outlines the comprehensive plan for implementing a robust, future-proof dynamic multi-destination streaming platform using AWS MediaConnect and MediaLive services. The architecture enables granular control of individual RTMP/SRT destinations with on-demand channel creation and cost-efficient resource management.

## Architecture Overview

### Current State
- ✅ MediaConnect Flow deployed (SRT input from Videon Edge)
- ✅ Working single HLS MediaLive channel (3714710)
- ✅ Frontend streaming interface operational
- ✅ 10 MediaLive channels quota approved

### Target Architecture
```
Videon Edge (SRT) → MediaConnect Flow → Dynamic MediaLive Channel Creation
                                     ↓
                                     API-Driven Destination Management:
                                     - add_flow_outputs() for MediaLive destinations
                                     - remove_flow_output() for cleanup
                                     - Support multiple instances per platform
```

## Core Requirements Addressed

### ✅ Granular Control
- Individual start/stop control per destination
- Independent destination management without affecting others
- Real-time status monitoring per destination

### ✅ Dynamic Scaling
- On-demand MediaLive channel creation
- Automatic cleanup when destinations removed
- Cost-efficient (only pay for active channels)

### ✅ Multi-Instance Support
- Multiple YouTube feeds for same event
- Multiple Twitch streams with different keys
- Platform-agnostic custom RTMP destinations

### ✅ Robust Deployment
- Based on DEPLOYMENT_LESSONS_LEARNED.md insights
- Comprehensive backup and rollback strategies
- Systematic testing and validation

## Technical Implementation Strategy

### Phase 1: Foundation Infrastructure (CloudFormation)

**Objective**: Deploy stable, core infrastructure that rarely changes

**Components**:
1. **MediaConnect Flow** (already deployed)
2. **Primary HLS MediaLive Channel** (for player output)
3. **DynamoDB Table** (destination tracking and metadata)
4. **Lambda Functions** (destination management APIs)
5. **API Gateway** (REST endpoints for frontend)
6. **IAM Roles & Policies** (comprehensive permissions)

**CloudFormation Template**: `lunora-player-dynamic-streaming-foundation.yaml`

### Phase 2: Dynamic Destination Management (API-Driven)

**Objective**: Enable real-time destination addition/removal via APIs

**Lambda Functions**:
- `addDestination`: Creates MediaLive channel + MediaConnect output
- `removeDestination`: Cleans up MediaLive channel + MediaConnect output
- `listDestinations`: Returns all active destinations with status
- `controlDestination`: Start/stop individual destinations

**API Endpoints**:
```
POST /api/destinations              # Add new destination
DELETE /api/destinations/{id}       # Remove destination
GET /api/destinations               # List all destinations
POST /api/destinations/{id}/start   # Start specific destination
POST /api/destinations/{id}/stop    # Stop specific destination
PUT /api/destinations/{id}          # Update destination settings
```

## Detailed Component Specifications

### DynamoDB Schema
```json
{
  "destinationId": "uuid-v4",
  "name": "YouTube Main Event",
  "platform": "youtube|twitch|linkedin|custom",
  "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2",
  "streamKey": "user-provided-key",
  "preset": "1080p30|720p30|1080p60|custom",
  "status": "idle|starting|running|stopping|error",
  "mediaLiveChannelId": "1234567",
  "mediaConnectOutputArn": "arn:aws:mediaconnect:...",
  "createdAt": "2025-01-XX",
  "lastModified": "2025-01-XX",
  "metadata": {
    "bandwidth": "5000000",
    "resolution": "1920x1080",
    "framerate": "30"
  }
}
```

### MediaConnect Integration
- **add_flow_outputs()**: Dynamically add MediaLive destinations
- **remove_flow_output()**: Clean removal of destinations
- **describe_flow()**: Monitor flow status and outputs

### MediaLive Channel Templates
**Platform-Specific Presets**:
- YouTube: 1080p30, 5Mbps, H.264 High Profile
- Twitch: 1080p60, 6Mbps, optimized for gaming
- LinkedIn: 720p30, 3Mbps, professional settings
- Custom: User-configurable parameters

## Deployment Strategy

### Pre-Deployment Requirements
1. **Service Limits**: 10 MediaLive channels approved ✅
2. **Permissions**: MediaConnect + MediaLive + DynamoDB access
3. **Backup**: Complete backup of current working state
4. **Testing Environment**: Isolated dev environment validation

### Deployment Sequence

#### Step 1: Infrastructure Foundation
```bash
# Deploy core CloudFormation template
aws cloudformation deploy \
  --template-file lunora-player-dynamic-streaming-foundation.yaml \
  --stack-name lunora-player-prod-dynamic-streaming \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=lunora-player \
    Environment=prod \
    MediaConnectFlowArn=$EXISTING_FLOW_ARN
```

#### Step 2: Lambda Function Deployment
```bash
# Package and deploy Lambda functions
npm run build:lambda
aws lambda update-function-code --function-name addDestination
aws lambda update-function-code --function-name removeDestination
```

#### Step 3: Frontend Configuration Update
```bash
# Update API endpoints in frontend
# Deploy to S3 buckets
# Verify connectivity
```

#### Step 4: End-to-End Testing
```bash
# Test destination addition
# Test destination removal
# Test multiple instances
# Verify cost efficiency
```

### Rollback Strategy
1. **CloudFormation Rollback**: Automatic stack rollback on failure
2. **Lambda Versioning**: Previous function versions maintained
3. **Frontend Rollback**: Previous S3 deployment preserved
4. **Database Backup**: DynamoDB point-in-time recovery enabled

## Cost Optimization

### Current vs New Architecture
**Current**: 5 always-running MediaLive channels = ~$500/month
**New**: On-demand channels = ~$100-200/month (based on actual usage)

### Cost Controls
- Automatic channel cleanup after inactivity
- Monitoring and alerting for unexpected costs
- Resource tagging for cost allocation

## Security Considerations

### IAM Permissions
- Least privilege access for Lambda functions
- Resource-specific permissions where possible
- Regular permission audits

### API Security
- API Gateway authentication
- Rate limiting and throttling
- Input validation and sanitization

### Data Protection
- Encryption at rest (DynamoDB)
- Encryption in transit (HTTPS/TLS)
- Stream key protection and rotation

## Monitoring and Observability

### CloudWatch Metrics
- MediaLive channel health
- MediaConnect flow status
- Lambda function performance
- API Gateway usage patterns

### Alerting
- Channel failure notifications
- Cost threshold alerts
- Performance degradation warnings

### Logging
- Comprehensive Lambda function logging
- API request/response logging
- MediaLive event logging

## Testing Strategy

### Unit Testing
- Lambda function logic validation
- API endpoint testing
- Error handling verification

### Integration Testing
- MediaConnect API integration
- MediaLive channel lifecycle
- DynamoDB operations

### End-to-End Testing
- Complete destination workflow
- Multi-platform streaming
- Failure recovery scenarios

## Success Metrics

### Functional Requirements
- ✅ Dynamic destination addition/removal
- ✅ Individual destination control
- ✅ Multiple instances per platform
- ✅ Cost-efficient resource usage

### Performance Requirements
- Destination addition: < 30 seconds
- Destination removal: < 10 seconds
- API response time: < 2 seconds
- 99.9% uptime for active streams

### Business Requirements
- 50%+ cost reduction vs always-on channels
- Support for 5+ simultaneous destinations
- Scalable to 20+ destinations with quota increases

## Risk Mitigation

### Technical Risks
- **Service Limits**: Pre-approved quotas, monitoring
- **API Failures**: Retry logic, error handling
- **Resource Cleanup**: Automated cleanup, monitoring

### Operational Risks
- **Deployment Failures**: Comprehensive testing, rollback plans
- **Configuration Errors**: Validation, staging environment
- **Cost Overruns**: Monitoring, alerts, automatic cleanup

## Future Enhancements

### Phase 3: Advanced Features
- Multi-region deployment
- Advanced analytics and reporting
- Custom encoding profiles
- Automated failover and redundancy

### Phase 4: Scale Optimization
- Container-based Lambda functions
- Advanced caching strategies
- Global content delivery optimization

## Implementation Timeline

### Week 1: Foundation
- CloudFormation template development
- Lambda function core logic
- DynamoDB schema implementation

### Week 2: Integration
- MediaConnect API integration
- MediaLive channel management
- API Gateway configuration

### Week 3: Testing & Deployment
- Comprehensive testing
- Production deployment
- Monitoring setup

### Week 4: Validation & Optimization
- End-to-end validation
- Performance optimization
- Documentation completion

## Conclusion

This architecture provides a robust, scalable, and cost-efficient solution for dynamic multi-destination streaming. By leveraging AWS MediaConnect's dynamic output management capabilities and implementing proper safeguards based on lessons learned, we achieve true granular control while maintaining operational excellence.

The implementation follows AWS best practices, incorporates comprehensive error handling, and provides clear rollback strategies to ensure reliable deployment and operation.
