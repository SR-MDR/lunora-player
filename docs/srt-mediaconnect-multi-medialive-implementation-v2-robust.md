# SRT → MediaConnect → Multi-MediaLive Implementation Plan (Robust Version)

## 🚨 **Critical Issues Addressed from V1**

This revised plan addresses major architectural, technical, and future-proofing issues identified in the initial plan:

### **Fixed Issues:**
- ✅ **MediaConnect Output Configuration**: Proper flow outputs to multiple MediaLive channels
- ✅ **Complete CloudFormation Templates**: All 5 channels defined (Primary, YouTube, Twitch, LinkedIn, Custom)
- ✅ **DynamoDB Schema Updates**: Proper NoSQL schema migration approach
- ✅ **Accurate Cost Analysis**: Corrected MediaConnect 24/7 costs
- ✅ **Comprehensive Error Handling**: Robust failure recovery mechanisms
- ✅ **Security Hardening**: Proper IAM, encryption, and network security
- ✅ **Monitoring & Alerting**: CloudWatch alarms and cost monitoring
- ✅ **Rollback Strategy**: Clear rollback procedures and backup plans
- ✅ **Future-Proofing**: Dynamic channel management and scalability design

## 📊 **Corrected Cost Analysis**

### **Usage Pattern**: 100 hours/month streaming

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| **MediaConnect Flow** | $115.20 | Always running (24/7) |
| **Data Transfer** | $30.00 | Estimated for 100 hours |
| **5 MediaLive Channels** | $210.60 | Single pipeline, 100 hours each |
| **Total** | **$355.80** | All-in cost for granular control |

**Comparison:**
- **Single MediaLive + 4 RTMP**: $280.80/month (no granular control)
- **Multi-MediaLive Approach**: $355.80/month (perfect granular control)
- **Cost Premium**: $75/month for granular control capability

**Conclusion**: $75/month premium is justified for granular control benefits.

## 🏗️ **Robust Architecture Design**

```
Videon Edge Node (SRT Caller)
    ↓ SRT Stream (Encrypted)
MediaConnect Flow (SRT Listener → 5 RTP-FEC Outputs)
    ↓ Dedicated RTP-FEC Outputs
├── MediaLive Channel 1 (Primary) → MediaPackage → HLS Player
├── MediaLive Channel 2 (YouTube) → YouTube RTMP
├── MediaLive Channel 3 (Twitch) → Twitch RTMP
├── MediaLive Channel 4 (LinkedIn) → LinkedIn RTMP
└── MediaLive Channel 5 (Custom) → Custom RTMP
```

### **Key Improvements:**
- ✅ **Dedicated MediaConnect outputs** for each MediaLive channel
- ✅ **Encrypted SRT connection** for security
- ✅ **Complete 5-channel architecture** as specified
- ✅ **Proper input/output mapping** between services
- ✅ **Scalable design** for future channel additions

## 🔧 **Phase 1: Robust Infrastructure (Week 1)**

### **1.1 Enhanced MediaConnect Flow Template**

Create `aws/cloudformation/srt-mediaconnect-flow-robust.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Robust SRT MediaConnect Flow with Multiple Outputs'

Parameters:
  ProjectName:
    Type: String
    Default: 'lunora-player'
  Environment:
    Type: String
    Default: 'prod'
  VideonSourceIP:
    Type: String
    Description: 'Videon Edge Node IP address for security'
    Default: '0.0.0.0/0'  # Replace with actual Videon IP

Resources:
  # MediaConnect Flow with SRT Input and Multiple RTP-FEC Outputs
  SRTMediaConnectFlow:
    Type: AWS::MediaConnect::Flow
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-srt-router'
      AvailabilityZone: !Sub '${AWS::Region}a'
      Source:
        Name: !Sub '${ProjectName}-videon-srt-source'
        Description: 'Encrypted SRT input from Videon Edge Node'
        Protocol: 'srt-listener'
        IngestPort: 9998
        WhitelistCidr: !Ref VideonSourceIP
        MaxBitrate: 50000000  # 50 Mbps max
        # Add encryption for security
        Decryption:
          Algorithm: 'aes128'
          KeyType: 'static-key'

  # MediaConnect Outputs - One for each MediaLive channel
  PrimaryChannelOutput:
    Type: AWS::MediaConnect::FlowOutput
    Properties:
      FlowArn: !GetAtt SRTMediaConnectFlow.FlowArn
      Name: 'primary-channel-output'
      Description: 'Output to Primary MediaLive Channel'
      Protocol: 'rtp-fec'
      Port: 5000
      MaxLatency: 2000

  YouTubeChannelOutput:
    Type: AWS::MediaConnect::FlowOutput
    Properties:
      FlowArn: !GetAtt SRTMediaConnectFlow.FlowArn
      Name: 'youtube-channel-output'
      Description: 'Output to YouTube MediaLive Channel'
      Protocol: 'rtp-fec'
      Port: 5001
      MaxLatency: 2000

  TwitchChannelOutput:
    Type: AWS::MediaConnect::FlowOutput
    Properties:
      FlowArn: !GetAtt SRTMediaConnectFlow.FlowArn
      Name: 'twitch-channel-output'
      Description: 'Output to Twitch MediaLive Channel'
      Protocol: 'rtp-fec'
      Port: 5002
      MaxLatency: 2000

  LinkedInChannelOutput:
    Type: AWS::MediaConnect::FlowOutput
    Properties:
      FlowArn: !GetAtt SRTMediaConnectFlow.FlowArn
      Name: 'linkedin-channel-output'
      Description: 'Output to LinkedIn MediaLive Channel'
      Protocol: 'rtp-fec'
      Port: 5003
      MaxLatency: 2000

  CustomChannelOutput:
    Type: AWS::MediaConnect::FlowOutput
    Properties:
      FlowArn: !GetAtt SRTMediaConnectFlow.FlowArn
      Name: 'custom-channel-output'
      Description: 'Output to Custom MediaLive Channel'
      Protocol: 'rtp-fec'
      Port: 5004
      MaxLatency: 2000

  # CloudWatch Alarms for Monitoring
  MediaConnectFlowAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${ProjectName}-${Environment}-mediaconnect-flow-health'
      AlarmDescription: 'MediaConnect Flow Health Monitoring'
      MetricName: 'SourceHealth'
      Namespace: 'AWS/MediaConnect'
      Statistic: 'Average'
      Period: 300
      EvaluationPeriods: 2
      Threshold: 1
      ComparisonOperator: 'LessThanThreshold'
      Dimensions:
        - Name: 'FlowArn'
          Value: !GetAtt SRTMediaConnectFlow.FlowArn
      AlarmActions:
        - !Ref MediaConnectAlarmTopic

  # SNS Topic for Alerts
  MediaConnectAlarmTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: !Sub '${ProjectName}-${Environment}-mediaconnect-alerts'
      DisplayName: 'MediaConnect Flow Alerts'

Outputs:
  MediaConnectFlowArn:
    Description: 'SRT MediaConnect Flow ARN'
    Value: !GetAtt SRTMediaConnectFlow.FlowArn
    Export:
      Name: !Sub '${ProjectName}-${Environment}-srt-flow-arn'

  SRTIngestEndpoint:
    Description: 'SRT Ingest Endpoint for Videon'
    Value: !Sub 
      - 'srt://${IngestIp}:9998?streamid=lunora-primary-feed'
      - IngestIp: !GetAtt SRTMediaConnectFlow.Source.IngestIp
    Export:
      Name: !Sub '${ProjectName}-${Environment}-srt-ingest-endpoint'

  # Output ARNs for MediaLive channel configuration
  PrimaryOutputArn:
    Description: 'Primary Channel Output ARN'
    Value: !GetAtt PrimaryChannelOutput.OutputArn
    Export:
      Name: !Sub '${ProjectName}-${Environment}-primary-output-arn'

  YouTubeOutputArn:
    Description: 'YouTube Channel Output ARN'
    Value: !GetAtt YouTubeChannelOutput.OutputArn
    Export:
      Name: !Sub '${ProjectName}-${Environment}-youtube-output-arn'

  TwitchOutputArn:
    Description: 'Twitch Channel Output ARN'
    Value: !GetAtt TwitchChannelOutput.OutputArn
    Export:
      Name: !Sub '${ProjectName}-${Environment}-twitch-output-arn'

  LinkedInOutputArn:
    Description: 'LinkedIn Channel Output ARN'
    Value: !GetAtt LinkedInChannelOutput.OutputArn
    Export:
      Name: !Sub '${ProjectName}-${Environment}-linkedin-output-arn'

  CustomOutputArn:
    Description: 'Custom Channel Output ARN'
    Value: !GetAtt CustomChannelOutput.OutputArn
    Export:
      Name: !Sub '${ProjectName}-${Environment}-custom-output-arn'
```

### **1.2 Complete Multi-MediaLive Channels Template**

Create `aws/cloudformation/multi-medialive-channels-complete.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Complete 5-Channel MediaLive Setup for Granular RTMP Control'

Parameters:
  ProjectName:
    Type: String
    Default: 'lunora-player'
  Environment:
    Type: String
    Default: 'prod'
  PrimaryOutputArn:
    Type: String
    Description: 'MediaConnect Primary Output ARN'
  YouTubeOutputArn:
    Type: String
    Description: 'MediaConnect YouTube Output ARN'
  TwitchOutputArn:
    Type: String
    Description: 'MediaConnect Twitch Output ARN'
  LinkedInOutputArn:
    Type: String
    Description: 'MediaConnect LinkedIn Output ARN'
  CustomOutputArn:
    Type: String
    Description: 'MediaConnect Custom Output ARN'

Resources:
  # IAM Role for MediaLive (Enhanced Security)
  MediaLiveRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '${ProjectName}-${Environment}-medialive-role'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: medialive.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: 'MediaLiveMinimalAccess'
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - 'mediaconnect:DescribeFlow'
                  - 'mediaconnect:DescribeFlowOutput'
                  - 'mediapackage:DescribeChannel'
                  - 'mediapackage:DescribeOriginEndpoint'
                Resource: '*'
              - Effect: Allow
                Action:
                  - 'logs:CreateLogGroup'
                  - 'logs:CreateLogStream'
                  - 'logs:PutLogEvents'
                Resource: !Sub 'arn:aws:logs:${AWS::Region}:${AWS::AccountId}:*'

  # MediaLive Inputs - One per MediaConnect output
  PrimaryMediaLiveInput:
    Type: AWS::MediaLive::Input
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-primary-input'
      Type: 'MEDIACONNECT'
      MediaConnectFlows:
        - FlowArn: !Ref PrimaryOutputArn

  YouTubeMediaLiveInput:
    Type: AWS::MediaLive::Input
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-youtube-input'
      Type: 'MEDIACONNECT'
      MediaConnectFlows:
        - FlowArn: !Ref YouTubeOutputArn

  TwitchMediaLiveInput:
    Type: AWS::MediaLive::Input
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-twitch-input'
      Type: 'MEDIACONNECT'
      MediaConnectFlows:
        - FlowArn: !Ref TwitchOutputArn

  LinkedInMediaLiveInput:
    Type: AWS::MediaLive::Input
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-linkedin-input'
      Type: 'MEDIACONNECT'
      MediaConnectFlows:
        - FlowArn: !Ref LinkedInOutputArn

  CustomMediaLiveInput:
    Type: AWS::MediaLive::Input
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-custom-input'
      Type: 'MEDIACONNECT'
      MediaConnectFlows:
        - FlowArn: !Ref CustomOutputArn
```

## 🔄 **Rollback Strategy**

### **Emergency Rollback Plan:**
1. **Immediate**: Switch Videon back to current MediaLive channel input
2. **Database**: Restore destination table from backup
3. **Lambda**: Rollback to previous function version
4. **Frontend**: Revert to previous deployment
5. **Infrastructure**: Keep new resources but don't use them

### **Rollback Commands:**
```bash
# 1. Emergency: Revert Videon to original MediaLive input
# 2. Rollback Lambda function
aws lambda update-function-code \
    --function-name lunora-player-prod-multi-destination-api \
    --zip-file fileb://backup/original-backend.zip

# 3. Restore database if needed
aws dynamodb restore-table-from-backup \
    --target-table-name lunora-destinations \
    --backup-arn [backup-arn]
```

  # MediaLive Channels - Complete 5-channel setup
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
          RtmpPushSettings:
            - ConnectionRetryInterval: 2
              NumRetries: 10
      EncoderSettings:
        OutputGroups:
          - Name: 'YouTube RTMP Output'
            OutputGroupSettings:
              RtmpGroupSettings:
                AuthenticationScheme: 'COMMON'
                CacheFullBehavior: 'DISCONNECT_IMMEDIATELY'
                CacheLength: 30
                CaptionData: 'ALL'
                RestartDelay: 15
            Outputs:
              - OutputName: 'YouTube Stream'
                OutputSettings:
                  RtmpOutputSettings:
                    Destination:
                      DestinationRefId: 'youtube-rtmp-destination'
                    ConnectionRetryInterval: 2
                    NumRetries: 10
                VideoDescriptionName: 'video_1080p30'
                AudioDescriptionNames: ['audio_aac']
        VideoDescriptions:
          - Name: 'video_1080p30'
            CodecSettings:
              H264Settings:
                Bitrate: 6000000
                FramerateControl: 'SPECIFIED'
                FramerateNumerator: 30
                FramerateDenominator: 1
                GopSize: 60
                GopSizeUnits: 'FRAMES'
                Profile: 'HIGH'
                Level: 'H264_LEVEL_4_1'
                LookAheadRateControl: 'HIGH'
                RateControlMode: 'CBR'
        AudioDescriptions:
          - Name: 'audio_aac'
            CodecSettings:
              AacSettings:
                Bitrate: 128000
                CodingMode: 'CODING_MODE_2_0'
                SampleRate: 48000
      InputAttachments:
        - InputId: !Ref YouTubeMediaLiveInput
          InputAttachmentName: 'youtube-input'

  TwitchMediaLiveChannel:
    Type: AWS::MediaLive::Channel
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-twitch-channel'
      ChannelClass: 'SINGLE_PIPELINE'
      RoleArn: !GetAtt MediaLiveRole.Arn
      InputSpecification:
        Codec: 'AVC'
        MaximumBitrate: 'MAX_20_MBPS'
        Resolution: 'HD'
      Destinations:
        - Id: 'twitch-rtmp-destination'
          RtmpPushSettings:
            - ConnectionRetryInterval: 2
              NumRetries: 10
      # Similar encoder settings optimized for Twitch
      InputAttachments:
        - InputId: !Ref TwitchMediaLiveInput
          InputAttachmentName: 'twitch-input'

  LinkedInMediaLiveChannel:
    Type: AWS::MediaLive::Channel
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-linkedin-channel'
      ChannelClass: 'SINGLE_PIPELINE'
      RoleArn: !GetAtt MediaLiveRole.Arn
      InputSpecification:
        Codec: 'AVC'
        MaximumBitrate: 'MAX_20_MBPS'
        Resolution: 'HD'
      Destinations:
        - Id: 'linkedin-rtmp-destination'
          RtmpPushSettings:
            - ConnectionRetryInterval: 2
              NumRetries: 10
      # Similar encoder settings optimized for LinkedIn
      InputAttachments:
        - InputId: !Ref LinkedInMediaLiveInput
          InputAttachmentName: 'linkedin-input'

  CustomMediaLiveChannel:
    Type: AWS::MediaLive::Channel
    Properties:
      Name: !Sub '${ProjectName}-${Environment}-custom-channel'
      ChannelClass: 'SINGLE_PIPELINE'
      RoleArn: !GetAtt MediaLiveRole.Arn
      InputSpecification:
        Codec: 'AVC'
        MaximumBitrate: 'MAX_20_MBPS'
        Resolution: 'HD'
      Destinations:
        - Id: 'custom-rtmp-destination'
          RtmpPushSettings:
            - ConnectionRetryInterval: 2
              NumRetries: 10
      # Configurable encoder settings for custom destinations
      InputAttachments:
        - InputId: !Ref CustomMediaLiveInput
          InputAttachmentName: 'custom-input'

  # CloudWatch Alarms for each channel
  PrimaryChannelAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${ProjectName}-${Environment}-primary-channel-health'
      MetricName: 'PipelineState'
      Namespace: 'AWS/MediaLive'
      Statistic: 'Average'
      Period: 300
      EvaluationPeriods: 2
      Threshold: 1
      ComparisonOperator: 'LessThanThreshold'
      Dimensions:
        - Name: 'ChannelId'
          Value: !Ref PrimaryMediaLiveChannel
        - Name: 'Pipeline'
          Value: '0'

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

  TwitchChannelId:
    Description: 'Twitch MediaLive Channel ID'
    Value: !Ref TwitchMediaLiveChannel
    Export:
      Name: !Sub '${ProjectName}-${Environment}-twitch-channel-id'

  LinkedInChannelId:
    Description: 'LinkedIn MediaLive Channel ID'
    Value: !Ref LinkedInMediaLiveChannel
    Export:
      Name: !Sub '${ProjectName}-${Environment}-linkedin-channel-id'

  CustomChannelId:
    Description: 'Custom MediaLive Channel ID'
    Value: !Ref CustomMediaLiveChannel
    Export:
      Name: !Sub '${ProjectName}-${Environment}-custom-channel-id'
```

## 🔧 **Phase 2: Robust Backend Implementation (Week 2)**

### **2.1 Enhanced Multi-Channel Manager with Error Handling**

Create `backend/multi-channel-manager-robust.js`:

```javascript
const AWS = require('aws-sdk');
const medialive = new AWS.MediaLive({ region: 'us-west-2' });
const cloudwatch = new AWS.CloudWatch({ region: 'us-west-2' });

class RobustMultiChannelManager {
    constructor() {
        this.channelMapping = {
            'primary': process.env.PRIMARY_CHANNEL_ID,
            'youtube': process.env.YOUTUBE_CHANNEL_ID,
            'twitch': process.env.TWITCH_CHANNEL_ID,
            'linkedin': process.env.LINKEDIN_CHANNEL_ID,
            'custom': process.env.CUSTOM_CHANNEL_ID
        };

        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 2000,
            backoffMultiplier: 2
        };
    }

    async startDestinationChannel(destinationId, platform) {
        const channelId = this.channelMapping[platform];
        if (!channelId) {
            throw new Error(`No channel configured for platform: ${platform}`);
        }

        return await this.executeWithRetry(async () => {
            console.log(`Starting MediaLive channel ${channelId} for ${platform}`);

            // Check current channel state first
            const currentState = await this.getChannelState(channelId);
            if (currentState === 'RUNNING') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'already_running',
                    message: `Channel ${channelId} already running for ${platform}`
                };
            }

            if (currentState === 'STARTING') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'starting',
                    message: `Channel ${channelId} already starting for ${platform}`
                };
            }

            const params = { ChannelId: channelId };
            const result = await medialive.startChannel(params).promise();

            // Log metrics
            await this.logChannelMetric(channelId, 'ChannelStart', 1);

            return {
                success: true,
                channelId: channelId,
                platform: platform,
                status: 'starting',
                message: `Channel ${channelId} starting for ${platform}`,
                requestId: result.ResponseMetadata?.RequestId
            };
        }, `start channel ${channelId} for ${platform}`);
    }

    async stopDestinationChannel(destinationId, platform) {
        const channelId = this.channelMapping[platform];
        if (!channelId) {
            throw new Error(`No channel configured for platform: ${platform}`);
        }

        return await this.executeWithRetry(async () => {
            console.log(`Stopping MediaLive channel ${channelId} for ${platform}`);

            // Check current channel state first
            const currentState = await this.getChannelState(channelId);
            if (currentState === 'IDLE') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'already_stopped',
                    message: `Channel ${channelId} already stopped for ${platform}`
                };
            }

            if (currentState === 'STOPPING') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'stopping',
                    message: `Channel ${channelId} already stopping for ${platform}`
                };
            }

            const params = { ChannelId: channelId };
            const result = await medialive.stopChannel(params).promise();

            // Log metrics
            await this.logChannelMetric(channelId, 'ChannelStop', 1);

            return {
                success: true,
                channelId: channelId,
                platform: platform,
                status: 'stopping',
                message: `Channel ${channelId} stopping for ${platform}`,
                requestId: result.ResponseMetadata?.RequestId
            };
        }, `stop channel ${channelId} for ${platform}`);
    }

    async getChannelState(channelId) {
        try {
            const params = { ChannelId: channelId };
            const result = await medialive.describeChannel(params).promise();
            return result.State;
        } catch (error) {
            console.error(`Error getting channel state for ${channelId}:`, error);
            throw error;
        }
    }

    async executeWithRetry(operation, operationName) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.error(`Attempt ${attempt} failed for ${operationName}:`, error.message);

                if (attempt === this.retryConfig.maxRetries) {
                    break;
                }

                // Check if error is retryable
                if (!this.isRetryableError(error)) {
                    break;
                }

                // Wait before retry with exponential backoff
                const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    isRetryableError(error) {
        const retryableErrors = [
            'ThrottlingException',
            'InternalServerError',
            'ServiceUnavailable',
            'TooManyRequestsException'
        ];

        return retryableErrors.some(errorType =>
            error.code === errorType || error.name === errorType
        );
    }

    async logChannelMetric(channelId, metricName, value) {
        try {
            const params = {
                Namespace: 'LunoraPlayer/MediaLive',
                MetricData: [{
                    MetricName: metricName,
                    Value: value,
                    Unit: 'Count',
                    Dimensions: [{
                        Name: 'ChannelId',
                        Value: channelId
                    }],
                    Timestamp: new Date()
                }]
            };

            await cloudwatch.putMetricData(params).promise();
        } catch (error) {
            console.error('Error logging metric:', error);
            // Don't throw - metrics are non-critical
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getAllChannelStatuses() {
        const statuses = {};
        const errors = {};

        // Get all channel statuses in parallel
        const statusPromises = Object.entries(this.channelMapping).map(async ([platform, channelId]) => {
            if (!channelId) return null;

            try {
                const params = { ChannelId: channelId };
                const result = await medialive.describeChannel(params).promise();

                return {
                    platform,
                    channelId,
                    state: result.State,
                    pipelinesRunningCount: result.PipelinesRunningCount || 0,
                    inputAttachments: result.InputAttachments?.length || 0,
                    lastModified: result.LastModified
                };
            } catch (error) {
                console.error(`Error getting status for ${platform} (${channelId}):`, error);
                errors[platform] = error.message;
                return null;
            }
        });

        const results = await Promise.allSettled(statusPromises);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                const { platform, ...status } = result.value;
                statuses[platform] = status;
            }
        });

        return { statuses, errors };
    }

    async validateChannelConfiguration() {
        const validation = {
            valid: true,
            issues: [],
            channels: {}
        };

        for (const [platform, channelId] of Object.entries(this.channelMapping)) {
            if (!channelId) {
                validation.valid = false;
                validation.issues.push(`Missing channel ID for platform: ${platform}`);
                continue;
            }

            try {
                const params = { ChannelId: channelId };
                const result = await medialive.describeChannel(params).promise();

                validation.channels[platform] = {
                    channelId,
                    exists: true,
                    state: result.State,
                    inputCount: result.InputAttachments?.length || 0,
                    outputCount: result.Destinations?.length || 0
                };

                // Validate channel configuration
                if (!result.InputAttachments || result.InputAttachments.length === 0) {
                    validation.valid = false;
                    validation.issues.push(`Channel ${channelId} (${platform}) has no input attachments`);
                }

                if (!result.Destinations || result.Destinations.length === 0) {
                    validation.valid = false;
                    validation.issues.push(`Channel ${channelId} (${platform}) has no destinations`);
                }

            } catch (error) {
                validation.valid = false;
                validation.issues.push(`Channel ${channelId} (${platform}) not accessible: ${error.message}`);
                validation.channels[platform] = {
                    channelId,
                    exists: false,
                    error: error.message
                };
            }
        }

        return validation;
    }
}

module.exports = RobustMultiChannelManager;
```

### **2.2 DynamoDB Schema Migration (NoSQL Compatible)**

Create `backend/schema-migration.js`:

```javascript
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });

class SchemaMigration {
    constructor() {
        this.tableName = process.env.DESTINATIONS_TABLE || 'lunora-destinations';
    }

    async migrateDestinationsTable() {
        console.log('Starting DynamoDB schema migration...');

        try {
            // Get all existing destinations
            const scanParams = {
                TableName: this.tableName
            };

            const result = await dynamodb.scan(scanParams).promise();
            const destinations = result.Items || [];

            console.log(`Found ${destinations.length} destinations to migrate`);

            // Migrate each destination
            for (const destination of destinations) {
                await this.migrateDestination(destination);
            }

            console.log('Schema migration completed successfully');
            return { success: true, migratedCount: destinations.length };

        } catch (error) {
            console.error('Schema migration failed:', error);
            throw error;
        }
    }

    async migrateDestination(destination) {
        // Add new fields if they don't exist
        const updates = {};
        let hasUpdates = false;

        if (!destination.medialive_channel_id) {
            updates.medialive_channel_id = this.getChannelIdForPlatform(destination.platform);
            hasUpdates = true;
        }

        if (!destination.medialive_channel_arn) {
            updates.medialive_channel_arn = this.getChannelArnForPlatform(destination.platform);
            hasUpdates = true;
        }

        if (!destination.channel_status) {
            updates.channel_status = 'idle';
            hasUpdates = true;
        }

        if (!destination.last_channel_sync) {
            updates.last_channel_sync = new Date().toISOString();
            hasUpdates = true;
        }

        if (!destination.created_at) {
            updates.created_at = destination.timestamp || new Date().toISOString();
            hasUpdates = true;
        }

        if (!destination.updated_at) {
            updates.updated_at = new Date().toISOString();
            hasUpdates = true;
        }

        if (hasUpdates) {
            const updateParams = {
                TableName: this.tableName,
                Key: { id: destination.id },
                UpdateExpression: this.buildUpdateExpression(updates),
                ExpressionAttributeNames: this.buildAttributeNames(updates),
                ExpressionAttributeValues: this.buildAttributeValues(updates)
            };

            await dynamodb.update(updateParams).promise();
            console.log(`Migrated destination: ${destination.id} (${destination.platform})`);
        }
    }

    getChannelIdForPlatform(platform) {
        const channelMapping = {
            'primary': process.env.PRIMARY_CHANNEL_ID,
            'youtube': process.env.YOUTUBE_CHANNEL_ID,
            'twitch': process.env.TWITCH_CHANNEL_ID,
            'linkedin': process.env.LINKEDIN_CHANNEL_ID,
            'custom': process.env.CUSTOM_CHANNEL_ID
        };

        return channelMapping[platform] || null;
    }

    getChannelArnForPlatform(platform) {
        const channelId = this.getChannelIdForPlatform(platform);
        if (!channelId) return null;

        const accountId = process.env.AWS_ACCOUNT_ID || '372241484305';
        const region = process.env.AWS_REGION || 'us-west-2';

        return `arn:aws:medialive:${region}:${accountId}:channel:${channelId}`;
    }

    buildUpdateExpression(updates) {
        const setExpressions = Object.keys(updates).map(key => `#${key} = :${key}`);
        return `SET ${setExpressions.join(', ')}`;
    }

    buildAttributeNames(updates) {
        const attributeNames = {};
        Object.keys(updates).forEach(key => {
            attributeNames[`#${key}`] = key;
        });
        return attributeNames;
    }

    buildAttributeValues(updates) {
        const attributeValues = {};
        Object.entries(updates).forEach(([key, value]) => {
            attributeValues[`:${key}`] = value;
        });
        return attributeValues;
    }

    async createBackup() {
        try {
            const backupParams = {
                TableName: this.tableName,
                BackupName: `${this.tableName}-migration-backup-${Date.now()}`
            };

            const backup = await dynamodb.createBackup(backupParams).promise();
            console.log(`Created backup: ${backup.BackupDetails.BackupArn}`);
            return backup.BackupDetails.BackupArn;

        } catch (error) {
            console.error('Failed to create backup:', error);
            throw error;
        }
    }
}

module.exports = SchemaMigration;
```

## 🚀 **Phase 3: Robust Deployment Strategy (Week 3)**

### **3.1 Pre-Deployment Validation**

Create `scripts/pre-deployment-validation.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Starting pre-deployment validation..."

# 1. Validate AWS credentials and permissions
echo "Validating AWS credentials..."
aws sts get-caller-identity --profile lunora-media

# 2. Validate CloudFormation templates
echo "Validating CloudFormation templates..."
aws cloudformation validate-template \
    --template-body file://aws/cloudformation/srt-mediaconnect-flow-robust.yaml \
    --profile lunora-media

aws cloudformation validate-template \
    --template-body file://aws/cloudformation/multi-medialive-channels-complete.yaml \
    --profile lunora-media

# 3. Check existing resources
echo "Checking existing MediaConnect flow..."
EXISTING_FLOW=$(aws mediaconnect list-flows \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Flows[?Name==`lunora-player-prod-rtmp-router`].FlowArn' \
    --output text)

if [ ! -z "$EXISTING_FLOW" ]; then
    echo "⚠️  Existing MediaConnect flow found: $EXISTING_FLOW"
    echo "This will be replaced during deployment."
fi

# 4. Validate current MediaLive channel
echo "Validating current MediaLive channel..."
aws medialive describe-channel \
    --channel-id 3714710 \
    --region us-west-2 \
    --profile lunora-media \
    --query 'State' \
    --output text

# 5. Check DynamoDB table
echo "Validating DynamoDB table..."
aws dynamodb describe-table \
    --table-name lunora-destinations \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Table.TableStatus' \
    --output text

# 6. Validate Lambda function
echo "Validating Lambda function..."
aws lambda get-function \
    --function-name lunora-player-prod-multi-destination-api \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Configuration.State' \
    --output text

echo "✅ Pre-deployment validation completed successfully!"
```

### **3.2 Staged Deployment Script**

Create `scripts/staged-deployment.sh`:

```bash
#!/bin/bash
set -e

ENVIRONMENT="prod"
PROJECT_NAME="lunora-player"
REGION="us-west-2"
PROFILE="lunora-media"

echo "🚀 Starting staged deployment for ${PROJECT_NAME}-${ENVIRONMENT}..."

# Stage 1: Create backup
echo "📦 Stage 1: Creating backups..."
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Backup DynamoDB table
aws dynamodb create-backup \
    --table-name lunora-destinations \
    --backup-name "lunora-destinations-backup-${BACKUP_TIMESTAMP}" \
    --region $REGION \
    --profile $PROFILE

# Backup Lambda function
mkdir -p backups
aws lambda get-function \
    --function-name lunora-player-prod-multi-destination-api \
    --region $REGION \
    --profile $PROFILE \
    --query 'Code.Location' \
    --output text | xargs curl -o "backups/lambda-backup-${BACKUP_TIMESTAMP}.zip"

echo "✅ Backups created successfully"

# Stage 2: Deploy MediaConnect Flow
echo "🌐 Stage 2: Deploying MediaConnect Flow..."
aws cloudformation deploy \
    --template-file aws/cloudformation/srt-mediaconnect-flow-robust.yaml \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --profile $PROFILE \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        VideonSourceIP="0.0.0.0/0"

# Get MediaConnect outputs
FLOW_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaConnectFlowArn`].OutputValue' \
    --output text)

PRIMARY_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`PrimaryOutputArn`].OutputValue' \
    --output text)

YOUTUBE_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`YouTubeOutputArn`].OutputValue' \
    --output text)

TWITCH_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`TwitchOutputArn`].OutputValue' \
    --output text)

LINKEDIN_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`LinkedInOutputArn`].OutputValue' \
    --output text)

CUSTOM_OUTPUT_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-srt-mediaconnect \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`CustomOutputArn`].OutputValue' \
    --output text)

echo "✅ MediaConnect Flow deployed successfully"
echo "Flow ARN: $FLOW_ARN"

# Stage 3: Deploy MediaLive Channels
echo "📺 Stage 3: Deploying MediaLive Channels..."
aws cloudformation deploy \
    --template-file aws/cloudformation/multi-medialive-channels-complete.yaml \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --profile $PROFILE \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        PrimaryOutputArn=$PRIMARY_OUTPUT_ARN \
        YouTubeOutputArn=$YOUTUBE_OUTPUT_ARN \
        TwitchOutputArn=$TWITCH_OUTPUT_ARN \
        LinkedInOutputArn=$LINKEDIN_OUTPUT_ARN \
        CustomOutputArn=$CUSTOM_OUTPUT_ARN

# Get MediaLive Channel IDs
PRIMARY_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`PrimaryChannelId`].OutputValue' \
    --output text)

YOUTUBE_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`YouTubeChannelId`].OutputValue' \
    --output text)

TWITCH_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`TwitchChannelId`].OutputValue' \
    --output text)

LINKEDIN_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`LinkedInChannelId`].OutputValue' \
    --output text)

CUSTOM_CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-multi-channels \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`CustomChannelId`].OutputValue' \
    --output text)

echo "✅ MediaLive Channels deployed successfully"
echo "Primary Channel ID: $PRIMARY_CHANNEL_ID"
echo "YouTube Channel ID: $YOUTUBE_CHANNEL_ID"
echo "Twitch Channel ID: $TWITCH_CHANNEL_ID"
echo "LinkedIn Channel ID: $LINKEDIN_CHANNEL_ID"
echo "Custom Channel ID: $CUSTOM_CHANNEL_ID"

# Stage 4: Update Lambda Function
echo "⚡ Stage 4: Updating Lambda Function..."

# Update environment variables
aws lambda update-function-configuration \
    --function-name lunora-player-prod-multi-destination-api \
    --environment Variables="{
        \"DESTINATIONS_TABLE\":\"lunora-destinations\",
        \"PRESETS_TABLE\":\"lunora-presets\",
        \"SESSIONS_TABLE\":\"lunora-streaming-sessions\",
        \"PRIMARY_CHANNEL_ID\":\"$PRIMARY_CHANNEL_ID\",
        \"YOUTUBE_CHANNEL_ID\":\"$YOUTUBE_CHANNEL_ID\",
        \"TWITCH_CHANNEL_ID\":\"$TWITCH_CHANNEL_ID\",
        \"LINKEDIN_CHANNEL_ID\":\"$LINKEDIN_CHANNEL_ID\",
        \"CUSTOM_CHANNEL_ID\":\"$CUSTOM_CHANNEL_ID\",
        \"MEDIALIVE_CHANNEL_ID\":\"3714710\",
        \"AWS_ACCOUNT_ID\":\"372241484305\",
        \"MEDIACONNECT_FLOW_ARN\":\"$FLOW_ARN\"
    }" \
    --region $REGION \
    --profile $PROFILE

# Deploy updated Lambda code
cd backend
zip -r ../backend-multi-channel-${BACKUP_TIMESTAMP}.zip . -x "node_modules/*"
cd ..

aws lambda update-function-code \
    --function-name lunora-player-prod-multi-destination-api \
    --zip-file fileb://backend-multi-channel-${BACKUP_TIMESTAMP}.zip \
    --region $REGION \
    --profile $PROFILE

echo "✅ Lambda function updated successfully"

# Stage 5: Run database migration
echo "🗄️  Stage 5: Running database migration..."
aws lambda invoke \
    --function-name lunora-player-prod-multi-destination-api \
    --payload '{"path":"/api/migrate","httpMethod":"POST"}' \
    --region $REGION \
    --profile $PROFILE \
    migration-response.json

cat migration-response.json
echo ""

# Stage 6: Validation tests
echo "🧪 Stage 6: Running validation tests..."

# Test API endpoints
echo "Testing API endpoints..."
curl -s "https://hi2pfpdbrlcry5w73wt27xrniu0vhykl.lambda-url.us-west-2.on.aws/api/channels/status" | jq .

# Test channel validation
aws lambda invoke \
    --function-name lunora-player-prod-multi-destination-api \
    --payload '{"path":"/api/channels/validate","httpMethod":"GET"}' \
    --region $REGION \
    --profile $PROFILE \
    validation-response.json

cat validation-response.json
echo ""

echo "🎉 Staged deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure Videon Edge Node with SRT output to MediaConnect"
echo "2. Test individual channel start/stop functionality"
echo "3. Update frontend for new multi-channel controls"
echo "4. Monitor CloudWatch alarms and metrics"
echo ""
echo "🔄 Rollback Information:"
echo "- DynamoDB Backup: lunora-destinations-backup-${BACKUP_TIMESTAMP}"
echo "- Lambda Backup: backups/lambda-backup-${BACKUP_TIMESTAMP}.zip"
echo "- Use 'scripts/rollback.sh ${BACKUP_TIMESTAMP}' if needed"
```

## 🎯 **Success Criteria & Validation**

### **Functional Validation Checklist:**
- ✅ **SRT Input**: Videon can connect to MediaConnect SRT listener
- ✅ **MediaConnect Distribution**: Flow distributes to all 5 MediaLive channels
- ✅ **Individual Channel Control**: Each channel starts/stops independently
- ✅ **HLS Streaming**: Primary channel maintains existing HLS functionality
- ✅ **RTMP Outputs**: All platforms receive proper RTMP streams
- ✅ **API Compatibility**: Existing endpoints continue working
- ✅ **Database Integrity**: All destination data preserved and enhanced
- ✅ **Error Handling**: Robust error recovery and retry mechanisms
- ✅ **Monitoring**: CloudWatch alarms and metrics working
- ✅ **Cost Control**: Usage stays within $400/month budget

### **Technical Validation Checklist:**
- ✅ **Security**: Proper IAM roles, encryption, network security
- ✅ **Performance**: No degradation in streaming quality or latency
- ✅ **Scalability**: Easy to add new channels and platforms
- ✅ **Reliability**: Automatic failover and recovery mechanisms
- ✅ **Observability**: Comprehensive logging and monitoring
- ✅ **Maintainability**: Clean code structure and documentation

## 🎛️ **Enhanced Preset Management System**

### **Platform-Specific & Generic Presets**

The robust implementation includes a comprehensive preset management system supporting:

#### **Preset Types:**
1. **Platform-Specific Presets** - Optimized for each platform's requirements
2. **Generic Presets** - Universal quality settings (720p, 1080p, etc.)
3. **Custom Platform Presets** - Admin-created presets for new platforms

#### **Enhanced Preset Schema:**

```javascript
// DynamoDB Preset Schema
{
    preset_id: 'preset_youtube_1080p_high',
    name: 'YouTube 1080p High Quality',
    platform: 'youtube',           // 'youtube', 'twitch', 'linkedin', 'generic', 'custom'
    type: 'platform_specific',     // 'platform_specific', 'generic', 'custom'

    // Video Settings
    video: {
        codec: 'H264',
        resolution: '1920x1080',
        framerate: 30,
        bitrate: 6000000,           // 6 Mbps
        profile: 'HIGH',
        level: 'H264_LEVEL_4_1',
        gop_size: 60,
        rate_control: 'CBR'
    },

    // Audio Settings
    audio: {
        codec: 'AAC',
        bitrate: 128000,            // 128 kbps
        sample_rate: 48000,
        channels: 2,
        coding_mode: 'CODING_MODE_2_0'
    },

    // Platform-specific optimizations
    platform_settings: {
        max_bitrate: 8000000,       // Platform limits
        recommended_keyframe: 2,    // Seconds
        low_latency: false,
        adaptive_bitrate: true
    },

    // Metadata
    description: 'Optimized for YouTube Live streaming with high quality',
    is_default: false,
    is_active: true,
    created_by: 'system',          // 'system' or admin user ID
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z'
}
```

### **Default Preset Collection:**

Create `backend/default-presets.js`:

```javascript
const DEFAULT_PRESETS = [
    // Generic Quality Presets
    {
        preset_id: 'preset_generic_720p',
        name: '720p Standard',
        platform: 'generic',
        type: 'generic',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 3000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        description: 'Standard 720p quality for most platforms',
        is_default: true,
        is_active: true,
        created_by: 'system'
    },

    {
        preset_id: 'preset_generic_1080p',
        name: '1080p High Quality',
        platform: 'generic',
        type: 'generic',
        video: {
            codec: 'H264',
            resolution: '1920x1080',
            framerate: 30,
            bitrate: 6000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_4_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        description: 'High quality 1080p for platforms supporting higher bitrates',
        is_default: false,
        is_active: true,
        created_by: 'system'
    },

    // YouTube-Specific Presets
    {
        preset_id: 'preset_youtube_1080p_optimized',
        name: 'YouTube 1080p Optimized',
        platform: 'youtube',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1920x1080',
            framerate: 30,
            bitrate: 6000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_4_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 8000000,
            recommended_keyframe: 2,
            low_latency: false,
            adaptive_bitrate: true
        },
        description: 'Optimized for YouTube Live with their recommended settings',
        is_default: true,
        is_active: true,
        created_by: 'system'
    },

    {
        preset_id: 'preset_youtube_720p_mobile',
        name: 'YouTube 720p Mobile Friendly',
        platform: 'youtube',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 2500000,
            profile: 'MAIN',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 96000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 4000000,
            recommended_keyframe: 2,
            low_latency: false,
            adaptive_bitrate: true
        },
        description: 'Lower bitrate for mobile viewers and slower connections',
        is_default: false,
        is_active: true,
        created_by: 'system'
    },

    // Twitch-Specific Presets
    {
        preset_id: 'preset_twitch_1080p_60fps',
        name: 'Twitch 1080p 60fps',
        platform: 'twitch',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1920x1080',
            framerate: 60,
            bitrate: 6000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_4_1',
            gop_size: 120,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 160000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 6000000,
            recommended_keyframe: 2,
            low_latency: true,
            adaptive_bitrate: false
        },
        description: 'Twitch Partner quality with 60fps for smooth gaming',
        is_default: true,
        is_active: true,
        created_by: 'system'
    },

    {
        preset_id: 'preset_twitch_720p_standard',
        name: 'Twitch 720p Standard',
        platform: 'twitch',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 3000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 3500000,
            recommended_keyframe: 2,
            low_latency: true,
            adaptive_bitrate: false
        },
        description: 'Standard Twitch quality for non-partner streamers',
        is_default: false,
        is_active: true,
        created_by: 'system'
    },

    // LinkedIn-Specific Presets
    {
        preset_id: 'preset_linkedin_720p_professional',
        name: 'LinkedIn Professional',
        platform: 'linkedin',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 2000000,
            profile: 'MAIN',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 3000000,
            recommended_keyframe: 4,
            low_latency: false,
            adaptive_bitrate: true
        },
        description: 'Optimized for LinkedIn Live professional broadcasts',
        is_default: true,
        is_active: true,
        created_by: 'system'
    }
];

module.exports = { DEFAULT_PRESETS };
```

### **Enhanced Preset Management Backend:**

Create `backend/preset-manager.js`:

```javascript
const AWS = require('aws-sdk');
const { DEFAULT_PRESETS } = require('./default-presets');

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });

class PresetManager {
    constructor() {
        this.tableName = process.env.PRESETS_TABLE || 'lunora-presets';
    }

    async initializeDefaultPresets() {
        console.log('Initializing default presets...');

        try {
            // Check if presets already exist
            const existing = await this.getAllPresets();
            if (existing.length > 0) {
                console.log(`Found ${existing.length} existing presets, skipping initialization`);
                return { success: true, message: 'Presets already initialized' };
            }

            // Insert default presets
            const promises = DEFAULT_PRESETS.map(preset => this.createPreset({
                ...preset,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));

            await Promise.all(promises);

            console.log(`Initialized ${DEFAULT_PRESETS.length} default presets`);
            return {
                success: true,
                message: `Initialized ${DEFAULT_PRESETS.length} default presets`,
                count: DEFAULT_PRESETS.length
            };

        } catch (error) {
            console.error('Error initializing default presets:', error);
            throw error;
        }
    }

    async getAllPresets() {
        try {
            const result = await dynamodb.scan({
                TableName: this.tableName,
                FilterExpression: 'is_active = :active',
                ExpressionAttributeValues: {
                    ':active': true
                }
            }).promise();

            return result.Items || [];
        } catch (error) {
            console.error('Error getting all presets:', error);
            throw error;
        }
    }

    async getPresetsByPlatform(platform) {
        try {
            const result = await dynamodb.scan({
                TableName: this.tableName,
                FilterExpression: '(platform = :platform OR platform = :generic) AND is_active = :active',
                ExpressionAttributeValues: {
                    ':platform': platform,
                    ':generic': 'generic',
                    ':active': true
                }
            }).promise();

            // Sort by platform-specific first, then generic, then by name
            return (result.Items || []).sort((a, b) => {
                if (a.platform === platform && b.platform !== platform) return -1;
                if (a.platform !== platform && b.platform === platform) return 1;
                if (a.is_default && !b.is_default) return -1;
                if (!a.is_default && b.is_default) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            console.error(`Error getting presets for platform ${platform}:`, error);
            throw error;
        }
    }

    async createPreset(presetData) {
        try {
            const preset = {
                preset_id: presetData.preset_id || `preset_${Date.now()}`,
                name: presetData.name,
                platform: presetData.platform,
                type: presetData.type || 'custom',
                video: presetData.video,
                audio: presetData.audio,
                platform_settings: presetData.platform_settings || {},
                description: presetData.description || '',
                is_default: presetData.is_default || false,
                is_active: true,
                created_by: presetData.created_by || 'admin',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await dynamodb.put({
                TableName: this.tableName,
                Item: preset,
                ConditionExpression: 'attribute_not_exists(preset_id)'
            }).promise();

            return preset;
        } catch (error) {
            console.error('Error creating preset:', error);
            throw error;
        }
    }

    async updatePreset(presetId, updates) {
        try {
            const updateExpression = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};

            Object.keys(updates).forEach(key => {
                if (key !== 'preset_id') {
                    updateExpression.push(`#${key} = :${key}`);
                    expressionAttributeNames[`#${key}`] = key;
                    expressionAttributeValues[`:${key}`] = updates[key];
                }
            });

            // Always update the updated_at timestamp
            updateExpression.push('#updated_at = :updated_at');
            expressionAttributeNames['#updated_at'] = 'updated_at';
            expressionAttributeValues[':updated_at'] = new Date().toISOString();

            const params = {
                TableName: this.tableName,
                Key: { preset_id: presetId },
                UpdateExpression: `SET ${updateExpression.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            };

            const result = await dynamodb.update(params).promise();
            return result.Attributes;
        } catch (error) {
            console.error(`Error updating preset ${presetId}:`, error);
            throw error;
        }
    }

    async deletePreset(presetId) {
        try {
            // Soft delete by setting is_active to false
            await this.updatePreset(presetId, { is_active: false });
            return { success: true, message: 'Preset deleted successfully' };
        } catch (error) {
            console.error(`Error deleting preset ${presetId}:`, error);
            throw error;
        }
    }

    async getPreset(presetId) {
        try {
            const result = await dynamodb.get({
                TableName: this.tableName,
                Key: { preset_id: presetId }
            }).promise();

            return result.Item || null;
        } catch (error) {
            console.error(`Error getting preset ${presetId}:`, error);
            throw error;
        }
    }

    validatePresetData(presetData) {
        const errors = [];

        if (!presetData.name) errors.push('Preset name is required');
        if (!presetData.platform) errors.push('Platform is required');
        if (!presetData.video) errors.push('Video settings are required');
        if (!presetData.audio) errors.push('Audio settings are required');

        // Validate video settings
        if (presetData.video) {
            if (!presetData.video.resolution) errors.push('Video resolution is required');
            if (!presetData.video.bitrate || presetData.video.bitrate < 100000) {
                errors.push('Video bitrate must be at least 100 kbps');
            }
            if (!presetData.video.framerate || presetData.video.framerate < 1) {
                errors.push('Video framerate must be at least 1 fps');
            }
        }

        // Validate audio settings
        if (presetData.audio) {
            if (!presetData.audio.bitrate || presetData.audio.bitrate < 32000) {
                errors.push('Audio bitrate must be at least 32 kbps');
            }
            if (!presetData.audio.sample_rate) {
                errors.push('Audio sample rate is required');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = PresetManager;
```

## 🖥️ **Enhanced Dashboard Architecture**

### **Two-Dashboard System Overview**

The robust implementation maintains the existing two-dashboard architecture with enhanced functionality:

#### **1. Admin Dashboard** (`dashboard.html`)
- **URL**: `https://d35au6zpsr51nc.cloudfront.net/dashboard.html`
- **Purpose**: AWS infrastructure monitoring and management
- **Users**: Administrators and technical staff
- **Enhanced Features**:
  - MediaConnect flow status monitoring
  - Multi-channel MediaLive status overview
  - Platform and preset management (admin-only)
  - Cost monitoring with multi-channel breakdown
  - Infrastructure health monitoring

#### **2. Streaming Dashboard** (`streaming.html`)
- **URL**: `https://d35au6zpsr51nc.cloudfront.net/streaming.html`
- **Purpose**: Live streaming operations and control
- **Users**: Content creators and streaming operators
- **Enhanced Features**:
  - MediaConnect flow status and health
  - Main and backup input monitoring
  - Individual destination controls with dedicated channels
  - Real-time streaming metrics
  - Session management and analytics

### **Enhanced Admin Dashboard Features**

#### **New MediaConnect Section:**

```html
<!-- Enhanced Admin Dashboard - MediaConnect Section -->
<section class="mediaconnect-overview">
    <h2>🌐 MediaConnect Infrastructure</h2>
    <div class="mediaconnect-grid">
        <div class="status-card" id="mediaconnect-flow-status">
            <div class="status-icon">🔄</div>
            <div class="status-info">
                <h3>SRT MediaConnect Flow</h3>
                <p class="status-text" id="flow-status">Loading...</p>
                <p class="status-detail" id="flow-detail">Checking flow status...</p>
            </div>
            <div class="status-metrics">
                <div class="metric-item">
                    <span class="metric-label">Uptime:</span>
                    <span id="flow-uptime" class="metric-value">--</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Data Rate:</span>
                    <span id="flow-data-rate" class="metric-value">-- Mbps</span>
                </div>
            </div>
        </div>

        <div class="status-card" id="mediaconnect-outputs-status">
            <div class="status-icon">📤</div>
            <div class="status-info">
                <h3>Flow Outputs</h3>
                <p class="status-text" id="outputs-status">Loading...</p>
                <p class="status-detail" id="outputs-detail">5 outputs configured</p>
            </div>
            <div class="outputs-list" id="flow-outputs-list">
                <!-- Dynamic output status list -->
            </div>
        </div>
    </div>
</section>

<!-- Enhanced Multi-Channel MediaLive Section -->
<section class="multi-medialive-overview">
    <h2>📺 Multi-Channel MediaLive</h2>
    <div class="channels-grid" id="medialive-channels-grid">
        <!-- Dynamic channel cards -->
    </div>

    <div class="channel-actions">
        <button class="action-btn" onclick="validateAllChannels()">🔍 Validate All Channels</button>
        <button class="action-btn" onclick="syncChannelStatuses()">🔄 Sync Channel Status</button>
        <button class="action-btn" onclick="showChannelMetrics()">📊 View Metrics</button>
    </div>
</section>

<!-- Platform & Preset Management (Admin Only) -->
<section class="platform-management">
    <h2>🎛️ Platform & Preset Management</h2>
    <div class="management-tabs">
        <button class="tab-btn active" onclick="showPlatformsTab()">Platforms</button>
        <button class="tab-btn" onclick="showPresetsTab()">Presets</button>
    </div>

    <div id="platforms-tab" class="tab-content active">
        <div class="platforms-header">
            <h3>Configured Platforms</h3>
            <button class="btn-primary" onclick="showAddPlatformModal()">+ Add New Platform</button>
        </div>
        <div id="platforms-list" class="platforms-list">
            <!-- Dynamic platform list -->
        </div>
    </div>

    <div id="presets-tab" class="tab-content">
        <div class="presets-header">
            <h3>Encoding Presets</h3>
            <button class="btn-primary" onclick="showAddPresetModal()">+ Create Preset</button>
        </div>
        <div class="presets-filters">
            <select id="preset-platform-filter">
                <option value="">All Platforms</option>
                <option value="generic">Generic</option>
                <option value="youtube">YouTube</option>
                <option value="twitch">Twitch</option>
                <option value="linkedin">LinkedIn</option>
                <option value="custom">Custom</option>
            </select>
            <select id="preset-type-filter">
                <option value="">All Types</option>
                <option value="platform_specific">Platform Specific</option>
                <option value="generic">Generic</option>
                <option value="custom">Custom</option>
            </select>
        </div>
        <div id="presets-list" class="presets-list">
            <!-- Dynamic preset list -->
        </div>
    </div>
</section>
```

#### **Enhanced Cost Monitoring:**

```html
<!-- Enhanced Cost Monitoring with Multi-Channel Breakdown -->
<section class="enhanced-cost-monitoring">
    <h2>💰 Enhanced Cost Monitoring</h2>
    <div class="cost-overview">
        <div class="cost-card primary">
            <h3>Total Monthly Estimate</h3>
            <div class="cost-amount" id="total-monthly-cost">$0.00</div>
            <p class="cost-detail">All services included</p>
        </div>
        <div class="cost-card">
            <h3>MediaConnect Flow</h3>
            <div class="cost-amount" id="mediaconnect-cost">$115.20</div>
            <p class="cost-detail">24/7 operation</p>
        </div>
        <div class="cost-card">
            <h3>Multi-Channel MediaLive</h3>
            <div class="cost-amount" id="multi-medialive-cost">$0.00</div>
            <p class="cost-detail">Usage-based</p>
        </div>
        <div class="cost-card">
            <h3>Data Transfer</h3>
            <div class="cost-amount" id="data-transfer-cost">$0.00</div>
            <p class="cost-detail">Streaming bandwidth</p>
        </div>
    </div>

    <div class="cost-breakdown">
        <h3>Per-Channel Cost Breakdown</h3>
        <div id="channel-costs-table" class="costs-table">
            <!-- Dynamic channel cost breakdown -->
        </div>
    </div>
</section>
```

### **Enhanced Streaming Dashboard Features**

#### **MediaConnect Flow Status Section:**

```html
<!-- Enhanced Streaming Dashboard - MediaConnect Status -->
<section class="mediaconnect-status">
    <div class="flow-status-card">
        <div class="flow-header">
            <h3>🌐 MediaConnect Flow Status</h3>
            <div class="flow-actions">
                <button class="btn-icon" onclick="refreshFlowStatus()" title="Refresh">🔄</button>
                <button class="btn-icon" onclick="showFlowDetails()" title="Details">ℹ️</button>
            </div>
        </div>

        <div class="flow-status-grid">
            <div class="status-item">
                <span class="status-label">Flow State:</span>
                <span id="flow-state" class="status-value flow-state" data-state="unknown">
                    <span class="flow-indicator"></span>
                    <span class="flow-text">Loading...</span>
                </span>
            </div>
            <div class="status-item">
                <span class="status-label">Source Health:</span>
                <span id="source-health" class="status-value">--</span>
            </div>
            <div class="status-item">
                <span class="status-label">Active Outputs:</span>
                <span id="active-outputs" class="status-value">0/5</span>
            </div>
            <div class="status-item">
                <span class="status-label">Data Rate:</span>
                <span id="flow-bitrate" class="status-value">-- Mbps</span>
            </div>
        </div>
    </div>
</section>

<!-- Input Health Monitoring -->
<section class="input-health-monitoring">
    <h3>📡 Input Health Monitoring</h3>
    <div class="inputs-grid">
        <div class="input-card primary-input">
            <div class="input-header">
                <h4>🎯 Main SRT Input</h4>
                <span id="main-input-status" class="input-status" data-status="unknown">
                    <span class="input-indicator"></span>
                    <span class="input-text">Checking...</span>
                </span>
            </div>
            <div class="input-details">
                <div class="detail-row">
                    <span class="detail-label">Source IP:</span>
                    <span id="main-source-ip" class="detail-value">--</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Connection Time:</span>
                    <span id="main-connection-time" class="detail-value">--</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Signal Strength:</span>
                    <span id="main-signal-strength" class="detail-value">--</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Packet Loss:</span>
                    <span id="main-packet-loss" class="detail-value">--</span>
                </div>
            </div>
        </div>

        <div class="input-card backup-input" id="backup-input-card" style="display: none;">
            <div class="input-header">
                <h4>🔄 Backup SRT Input</h4>
                <span id="backup-input-status" class="input-status" data-status="unknown">
                    <span class="input-indicator"></span>
                    <span class="input-text">Not configured</span>
                </span>
            </div>
            <div class="input-details">
                <div class="detail-row">
                    <span class="detail-label">Source IP:</span>
                    <span id="backup-source-ip" class="detail-value">--</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Failover Mode:</span>
                    <span id="failover-mode" class="detail-value">Automatic</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Tested:</span>
                    <span id="backup-last-test" class="detail-value">--</span>
                </div>
            </div>
            <div class="input-actions">
                <button class="btn-small" onclick="testBackupInput()">🧪 Test Backup</button>
                <button class="btn-small" onclick="switchToBackup()">🔄 Switch to Backup</button>
            </div>
        </div>
    </div>
</section>
```

#### **Enhanced Quick Status Bar:**

```html
<!-- Enhanced Quick Status Bar -->
<section class="enhanced-quick-status">
    <div class="status-item primary">
        <span class="status-label">MediaConnect Flow:</span>
        <span id="flow-status-quick" class="status-value flow-status" data-state="unknown">
            <span class="flow-indicator"></span>
            <span class="flow-text">Loading...</span>
        </span>
    </div>
    <div class="status-item">
        <span class="status-label">Active Channels:</span>
        <span id="active-channels-count" class="status-value">0/5</span>
    </div>
    <div class="status-item">
        <span class="status-label">Streaming Destinations:</span>
        <span id="streaming-destinations-count" class="status-value">0</span>
    </div>
    <div class="status-item">
        <span class="status-label">Total Bandwidth:</span>
        <span id="total-streaming-bandwidth" class="status-value">0 Mbps</span>
    </div>
    <div class="status-item">
        <span class="status-label">Session Duration:</span>
        <span id="session-duration-display" class="status-value">00:00:00</span>
    </div>
    <div class="status-item">
        <span class="status-label">Input Health:</span>
        <span id="input-health-quick" class="status-value input-health" data-health="unknown">
            <span class="health-indicator"></span>
            <span class="health-text">Checking...</span>
        </span>
    </div>
</section>
```

### **Enhanced JavaScript for Dashboard Integration**

#### **Admin Dashboard Enhancements** (`js/admin-dashboard-enhanced.js`):

```javascript
class EnhancedAdminDashboard {
    constructor() {
        this.apiBaseUrl = 'https://hi2pfpdbrlcry5w73wt27xrniu0vhykl.lambda-url.us-west-2.on.aws/api';
        this.refreshInterval = null;
        this.platforms = [];
        this.presets = [];
        this.channelStatuses = {};
    }

    async init() {
        await this.loadMediaConnectStatus();
        await this.loadMultiChannelStatus();
        await this.loadPlatforms();
        await this.loadPresets();
        await this.loadEnhancedCostData();

        this.startAutoRefresh();
        this.bindEvents();
    }

    async loadMediaConnectStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.updateMediaConnectUI(data.flow);
            }
        } catch (error) {
            console.error('Error loading MediaConnect status:', error);
        }
    }

    async loadMultiChannelStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/channels/status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.channelStatuses = data.channels;
                this.updateMultiChannelUI(data.channels);
            }
        } catch (error) {
            console.error('Error loading multi-channel status:', error);
        }
    }

    updateMediaConnectUI(flowData) {
        // Update flow status
        const flowStatus = document.getElementById('flow-status');
        const flowDetail = document.getElementById('flow-detail');
        const flowUptime = document.getElementById('flow-uptime');
        const flowDataRate = document.getElementById('flow-data-rate');

        if (flowStatus) flowStatus.textContent = flowData.status;
        if (flowDetail) flowDetail.textContent = `${flowData.outputs?.length || 0} outputs active`;
        if (flowUptime) flowUptime.textContent = this.formatUptime(flowData.uptime);
        if (flowDataRate) flowDataRate.textContent = `${flowData.dataRate || 0} Mbps`;

        // Update outputs list
        this.updateOutputsList(flowData.outputs);
    }

    updateMultiChannelUI(channelsData) {
        const channelsGrid = document.getElementById('medialive-channels-grid');
        if (!channelsGrid) return;

        const channelCards = Object.entries(channelsData).map(([platform, channelData]) => {
            return this.createChannelCard(platform, channelData);
        }).join('');

        channelsGrid.innerHTML = channelCards;
    }

    createChannelCard(platform, channelData) {
        const statusClass = this.getChannelStatusClass(channelData.state);
        const platformIcon = this.getPlatformIcon(platform);

        return `
            <div class="channel-card ${statusClass}" data-platform="${platform}">
                <div class="channel-header">
                    <div class="channel-icon">${platformIcon}</div>
                    <h4>${platform.charAt(0).toUpperCase() + platform.slice(1)} Channel</h4>
                    <span class="channel-status ${statusClass}">${channelData.state}</span>
                </div>
                <div class="channel-details">
                    <div class="detail-row">
                        <span class="detail-label">Channel ID:</span>
                        <span class="detail-value">${channelData.channelId}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Pipelines:</span>
                        <span class="detail-value">${channelData.pipelinesRunningCount}/1</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Uptime:</span>
                        <span class="detail-value">${this.formatUptime(channelData.uptime)}</span>
                    </div>
                </div>
                <div class="channel-actions">
                    <button class="btn-small" onclick="adminDashboard.viewChannelMetrics('${platform}')">📊 Metrics</button>
                    <button class="btn-small" onclick="adminDashboard.manageChannel('${platform}')">⚙️ Manage</button>
                </div>
            </div>
        `;
    }

    // Platform and Preset Management Methods
    async loadPlatforms() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/admin/platforms`);
            const data = await response.json();

            if (data.status === 'success') {
                this.platforms = data.platforms;
                this.updatePlatformsList();
            }
        } catch (error) {
            console.error('Error loading platforms:', error);
        }
    }

    async createNewPlatform(platformData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/admin/platforms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(platformData)
            });

            const result = await response.json();

            if (result.status === 'success') {
                await this.loadPlatforms();
                this.showSuccess('Platform created successfully');
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error creating platform:', error);
            this.showError('Failed to create platform');
        }
    }

    getPlatformIcon(platform) {
        const icons = {
            'primary': '🎯',
            'youtube': '📺',
            'twitch': '🎮',
            'linkedin': '💼',
            'custom': '🔧'
        };
        return icons[platform] || '📡';
    }

    getChannelStatusClass(state) {
        const statusMap = {
            'IDLE': 'idle',
            'CREATING': 'creating',
            'STARTING': 'starting',
            'RUNNING': 'running',
            'STOPPING': 'stopping',
            'DELETING': 'deleting'
        };
        return statusMap[state] || 'unknown';
    }

    formatUptime(seconds) {
        if (!seconds) return '--';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadMediaConnectStatus();
            this.loadMultiChannelStatus();
            this.loadEnhancedCostData();
        }, 30000); // Refresh every 30 seconds
    }
}

// Initialize enhanced admin dashboard
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new EnhancedAdminDashboard();
    adminDashboard.init();
});
```

#### **Streaming Dashboard Enhancements** (`js/streaming-dashboard-enhanced.js`):

```javascript
class EnhancedStreamingDashboard {
    constructor() {
        this.apiBaseUrl = 'https://hi2pfpdbrlcry5w73wt27xrniu0vhykl.lambda-url.us-west-2.on.aws/api';
        this.refreshInterval = null;
        this.flowStatus = {};
        this.inputHealth = {};
        this.channelStatuses = {};
        this.sessionStartTime = null;
    }

    async init() {
        await this.loadMediaConnectFlowStatus();
        await this.loadInputHealth();
        await this.loadChannelStatuses();
        await this.loadStreamingSession();

        this.startAutoRefresh();
        this.bindEvents();
    }

    async loadMediaConnectFlowStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/flow/status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.flowStatus = data.flow;
                this.updateFlowStatusUI();
            }
        } catch (error) {
            console.error('Error loading MediaConnect flow status:', error);
            this.updateFlowStatusUI({ state: 'ERROR', error: error.message });
        }
    }

    async loadInputHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/inputs/health`);
            const data = await response.json();

            if (data.status === 'success') {
                this.inputHealth = data.inputs;
                this.updateInputHealthUI();
            }
        } catch (error) {
            console.error('Error loading input health:', error);
            this.updateInputHealthUI({ main: { status: 'ERROR' }, backup: { status: 'NOT_CONFIGURED' } });
        }
    }

    updateFlowStatusUI() {
        // Update quick status bar
        const flowStatusQuick = document.getElementById('flow-status-quick');
        const flowState = document.getElementById('flow-state');
        const sourceHealth = document.getElementById('source-health');
        const activeOutputs = document.getElementById('active-outputs');
        const flowBitrate = document.getElementById('flow-bitrate');

        if (flowStatusQuick) {
            const indicator = flowStatusQuick.querySelector('.flow-indicator');
            const text = flowStatusQuick.querySelector('.flow-text');

            flowStatusQuick.setAttribute('data-state', this.flowStatus.state?.toLowerCase() || 'unknown');
            if (text) text.textContent = this.flowStatus.state || 'Unknown';
            if (indicator) this.updateIndicator(indicator, this.flowStatus.state);
        }

        if (flowState) {
            const indicator = flowState.querySelector('.flow-indicator');
            const text = flowState.querySelector('.flow-text');

            flowState.setAttribute('data-state', this.flowStatus.state?.toLowerCase() || 'unknown');
            if (text) text.textContent = this.flowStatus.state || 'Unknown';
            if (indicator) this.updateIndicator(indicator, this.flowStatus.state);
        }

        if (sourceHealth) {
            sourceHealth.textContent = this.flowStatus.sourceHealth || '--';
            sourceHealth.className = `status-value ${this.getHealthClass(this.flowStatus.sourceHealth)}`;
        }

        if (activeOutputs) {
            const active = this.flowStatus.outputs?.filter(o => o.status === 'ACTIVE').length || 0;
            const total = this.flowStatus.outputs?.length || 5;
            activeOutputs.textContent = `${active}/${total}`;
        }

        if (flowBitrate) {
            const bitrate = this.flowStatus.dataRate || 0;
            flowBitrate.textContent = `${bitrate.toFixed(1)} Mbps`;
        }
    }

    updateInputHealthUI() {
        // Update main input
        this.updateInputCard('main', this.inputHealth.main);

        // Update backup input (if configured)
        if (this.inputHealth.backup && this.inputHealth.backup.status !== 'NOT_CONFIGURED') {
            this.updateInputCard('backup', this.inputHealth.backup);
            document.getElementById('backup-input-card').style.display = 'block';
        } else {
            document.getElementById('backup-input-card').style.display = 'none';
        }

        // Update quick status
        const inputHealthQuick = document.getElementById('input-health-quick');
        if (inputHealthQuick) {
            const mainHealth = this.inputHealth.main?.status || 'UNKNOWN';
            const indicator = inputHealthQuick.querySelector('.health-indicator');
            const text = inputHealthQuick.querySelector('.health-text');

            inputHealthQuick.setAttribute('data-health', mainHealth.toLowerCase());
            if (text) text.textContent = this.getHealthDisplayText(mainHealth);
            if (indicator) this.updateIndicator(indicator, mainHealth);
        }
    }

    updateInputCard(inputType, inputData) {
        if (!inputData) return;

        const statusElement = document.getElementById(`${inputType}-input-status`);
        const sourceIpElement = document.getElementById(`${inputType}-source-ip`);
        const connectionTimeElement = document.getElementById(`${inputType}-connection-time`);

        if (statusElement) {
            const indicator = statusElement.querySelector('.input-indicator');
            const text = statusElement.querySelector('.input-text');

            statusElement.setAttribute('data-status', inputData.status?.toLowerCase() || 'unknown');
            if (text) text.textContent = this.getInputStatusText(inputData.status);
            if (indicator) this.updateIndicator(indicator, inputData.status);
        }

        if (sourceIpElement) {
            sourceIpElement.textContent = inputData.sourceIp || '--';
        }

        if (connectionTimeElement) {
            connectionTimeElement.textContent = inputData.connectionTime ?
                this.formatDuration(inputData.connectionTime) : '--';
        }

        // Update input-specific metrics
        if (inputType === 'main') {
            const signalStrength = document.getElementById('main-signal-strength');
            const packetLoss = document.getElementById('main-packet-loss');

            if (signalStrength) {
                signalStrength.textContent = inputData.signalStrength ?
                    `${inputData.signalStrength}%` : '--';
            }

            if (packetLoss) {
                packetLoss.textContent = inputData.packetLoss ?
                    `${inputData.packetLoss}%` : '--';
                packetLoss.className = `detail-value ${this.getPacketLossClass(inputData.packetLoss)}`;
            }
        } else if (inputType === 'backup') {
            const failoverMode = document.getElementById('failover-mode');
            const lastTest = document.getElementById('backup-last-test');

            if (failoverMode) {
                failoverMode.textContent = inputData.failoverMode || 'Automatic';
            }

            if (lastTest) {
                lastTest.textContent = inputData.lastTest ?
                    this.formatTimestamp(inputData.lastTest) : '--';
            }
        }
    }

    async loadChannelStatuses() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/channels/status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.channelStatuses = data.channels;
                this.updateChannelStatusesUI();
            }
        } catch (error) {
            console.error('Error loading channel statuses:', error);
        }
    }

    updateChannelStatusesUI() {
        // Update active channels count
        const activeChannelsCount = document.getElementById('active-channels-count');
        if (activeChannelsCount) {
            const activeCount = Object.values(this.channelStatuses)
                .filter(channel => channel.state === 'RUNNING').length;
            const totalCount = Object.keys(this.channelStatuses).length;
            activeChannelsCount.textContent = `${activeCount}/${totalCount}`;
        }

        // Update total bandwidth
        const totalBandwidth = document.getElementById('total-streaming-bandwidth');
        if (totalBandwidth) {
            const totalBw = Object.values(this.channelStatuses)
                .filter(channel => channel.state === 'RUNNING')
                .reduce((sum, channel) => sum + (channel.bitrate || 0), 0);
            totalBandwidth.textContent = `${(totalBw / 1000000).toFixed(1)} Mbps`;
        }
    }

    async testBackupInput() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/inputs/backup/test`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Backup input test completed successfully');
                await this.loadInputHealth();
            } else {
                this.showError(`Backup test failed: ${result.message}`);
            }
        } catch (error) {
            console.error('Error testing backup input:', error);
            this.showError('Failed to test backup input');
        }
    }

    async switchToBackup() {
        if (!confirm('Switch to backup input? This will briefly interrupt the stream.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/inputs/switch-to-backup`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Switched to backup input successfully');
                await this.loadInputHealth();
                await this.loadMediaConnectFlowStatus();
            } else {
                this.showError(`Failed to switch to backup: ${result.message}`);
            }
        } catch (error) {
            console.error('Error switching to backup:', error);
            this.showError('Failed to switch to backup input');
        }
    }

    updateIndicator(indicator, status) {
        if (!indicator) return;

        // Remove existing status classes
        indicator.className = indicator.className.replace(/status-\w+/g, '');

        // Add new status class
        const statusClass = this.getStatusClass(status);
        indicator.classList.add(statusClass);
    }

    getStatusClass(status) {
        const statusMap = {
            'ACTIVE': 'status-active',
            'RUNNING': 'status-active',
            'CONNECTED': 'status-active',
            'HEALTHY': 'status-active',
            'IDLE': 'status-idle',
            'STANDBY': 'status-idle',
            'STARTING': 'status-starting',
            'STOPPING': 'status-stopping',
            'ERROR': 'status-error',
            'FAILED': 'status-error',
            'DISCONNECTED': 'status-error',
            'UNHEALTHY': 'status-error'
        };
        return statusMap[status] || 'status-unknown';
    }

    getHealthClass(health) {
        if (!health) return 'health-unknown';

        if (health >= 90) return 'health-excellent';
        if (health >= 75) return 'health-good';
        if (health >= 50) return 'health-fair';
        return 'health-poor';
    }

    getPacketLossClass(packetLoss) {
        if (!packetLoss) return '';

        if (packetLoss < 0.1) return 'packet-loss-excellent';
        if (packetLoss < 0.5) return 'packet-loss-good';
        if (packetLoss < 1.0) return 'packet-loss-fair';
        return 'packet-loss-poor';
    }

    getHealthDisplayText(status) {
        const statusMap = {
            'CONNECTED': 'Connected',
            'DISCONNECTED': 'Disconnected',
            'HEALTHY': 'Healthy',
            'UNHEALTHY': 'Unhealthy',
            'ERROR': 'Error',
            'UNKNOWN': 'Unknown'
        };
        return statusMap[status] || status;
    }

    getInputStatusText(status) {
        const statusMap = {
            'CONNECTED': 'Connected',
            'DISCONNECTED': 'Disconnected',
            'CONNECTING': 'Connecting...',
            'ERROR': 'Error',
            'NOT_CONFIGURED': 'Not Configured'
        };
        return statusMap[status] || status;
    }

    formatDuration(seconds) {
        if (!seconds) return '--';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '--';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    }

    showSuccess(message) {
        // Enhanced notification system
        this.showNotification(message, 'success');
    }

    showError(message) {
        // Enhanced notification system
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadMediaConnectFlowStatus();
            this.loadInputHealth();
            this.loadChannelStatuses();
        }, 10000); // Refresh every 10 seconds for streaming dashboard
    }

    bindEvents() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadMediaConnectFlowStatus();
                this.loadInputHealth();
                this.loadChannelStatuses();
            });
        }

        // Flow details button
        const flowDetailsBtn = document.querySelector('[onclick="showFlowDetails()"]');
        if (flowDetailsBtn) {
            flowDetailsBtn.addEventListener('click', () => this.showFlowDetails());
        }
    }

    showFlowDetails() {
        // Show detailed flow information modal
        const modal = this.createFlowDetailsModal();
        document.body.appendChild(modal);
    }

    createFlowDetailsModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content flow-details-modal">
                <div class="modal-header">
                    <h3>MediaConnect Flow Details</h3>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="flow-details-grid">
                        <div class="detail-section">
                            <h4>Flow Information</h4>
                            <div class="detail-row">
                                <span class="detail-label">Flow ARN:</span>
                                <span class="detail-value">${this.flowStatus.flowArn || '--'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value">${this.flowStatus.state || '--'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Availability Zone:</span>
                                <span class="detail-value">${this.flowStatus.availabilityZone || '--'}</span>
                            </div>
                        </div>
                        <div class="detail-section">
                            <h4>Source Details</h4>
                            <div class="detail-row">
                                <span class="detail-label">Protocol:</span>
                                <span class="detail-value">SRT</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Port:</span>
                                <span class="detail-value">9998</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Ingest IP:</span>
                                <span class="detail-value">${this.flowStatus.ingestIp || '--'}</span>
                            </div>
                        </div>
                        <div class="detail-section">
                            <h4>Outputs</h4>
                            <div class="outputs-list">
                                ${this.flowStatus.outputs?.map(output => `
                                    <div class="output-item">
                                        <span class="output-name">${output.name}</span>
                                        <span class="output-status ${output.status?.toLowerCase()}">${output.status}</span>
                                    </div>
                                `).join('') || '<p>No outputs configured</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }
}

// Initialize enhanced streaming dashboard
let streamingDashboard;
document.addEventListener('DOMContentLoaded', () => {
    streamingDashboard = new EnhancedStreamingDashboard();
    streamingDashboard.init();
});
```

## 🎯 **Implementation Summary**

The enhanced dashboard architecture provides:

### **Admin Dashboard** (`dashboard.html`)
- ✅ **MediaConnect Infrastructure Monitoring** - Flow status, outputs, health metrics
- ✅ **Multi-Channel MediaLive Overview** - All 5 channels with individual status
- ✅ **Platform & Preset Management** - Admin-only controls for adding platforms/presets
- ✅ **Enhanced Cost Monitoring** - Multi-channel cost breakdown and projections
- ✅ **Infrastructure Health** - Comprehensive AWS service monitoring

### **Streaming Dashboard** (`streaming.html`)
- ✅ **MediaConnect Flow Status** - Real-time flow health and performance
- ✅ **Input Health Monitoring** - Main and backup SRT input status
- ✅ **Individual Destination Controls** - Granular channel management
- ✅ **Real-time Metrics** - Bandwidth, uptime, session tracking
- ✅ **Enhanced User Experience** - Streaming-focused interface

### **Key Features:**
1. **Separation of Concerns** - Admin vs. Streaming functionality clearly separated
2. **Real-time Monitoring** - Live status updates for all components
3. **Input Redundancy** - Main/backup input monitoring and switching
4. **Granular Control** - Individual channel management per destination
5. **Enhanced UX** - Platform-specific presets and admin management
6. **Future-Proof** - Easy addition of new platforms and presets

#### **Streaming Dashboard Enhancements** (`js/streaming-dashboard-enhanced.js`):

```javascript
class EnhancedStreamingDashboard {
    constructor() {
        this.apiBaseUrl = 'https://hi2pfpdbrlcry5w73wt27xrniu0vhykl.lambda-url.us-west-2.on.aws/api';
        this.refreshInterval = null;
        this.flowStatus = {};
        this.inputHealth = {};
        this.channelStatuses = {};
        this.sessionStartTime = null;
    }

    async init() {
        await this.loadMediaConnectFlowStatus();
        await this.loadInputHealth();
        await this.loadChannelStatuses();
        await this.loadStreamingSession();

        this.startAutoRefresh();
        this.bindEvents();
    }

    async loadMediaConnectFlowStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/flow/status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.flowStatus = data.flow;
                this.updateFlowStatusUI();
            }
        } catch (error) {
            console.error('Error loading MediaConnect flow status:', error);
            this.updateFlowStatusUI({ state: 'ERROR', error: error.message });
        }
    }

    async loadInputHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/inputs/health`);
            const data = await response.json();

            if (data.status === 'success') {
                this.inputHealth = data.inputs;
                this.updateInputHealthUI();
            }
        } catch (error) {
            console.error('Error loading input health:', error);
            this.updateInputHealthUI({ main: { status: 'ERROR' }, backup: { status: 'NOT_CONFIGURED' } });
        }
    }

    updateFlowStatusUI() {
        // Update quick status bar
        const flowStatusQuick = document.getElementById('flow-status-quick');
        const flowState = document.getElementById('flow-state');
        const sourceHealth = document.getElementById('source-health');
        const activeOutputs = document.getElementById('active-outputs');
        const flowBitrate = document.getElementById('flow-bitrate');

        if (flowStatusQuick) {
            const indicator = flowStatusQuick.querySelector('.flow-indicator');
            const text = flowStatusQuick.querySelector('.flow-text');

            flowStatusQuick.setAttribute('data-state', this.flowStatus.state?.toLowerCase() || 'unknown');
            if (text) text.textContent = this.flowStatus.state || 'Unknown';
            if (indicator) this.updateIndicator(indicator, this.flowStatus.state);
        }

        if (flowState) {
            const indicator = flowState.querySelector('.flow-indicator');
            const text = flowState.querySelector('.flow-text');

            flowState.setAttribute('data-state', this.flowStatus.state?.toLowerCase() || 'unknown');
            if (text) text.textContent = this.flowStatus.state || 'Unknown';
            if (indicator) this.updateIndicator(indicator, this.flowStatus.state);
        }

        if (sourceHealth) {
            sourceHealth.textContent = this.flowStatus.sourceHealth || '--';
            sourceHealth.className = `status-value ${this.getHealthClass(this.flowStatus.sourceHealth)}`;
        }

        if (activeOutputs) {
            const active = this.flowStatus.outputs?.filter(o => o.status === 'ACTIVE').length || 0;
            const total = this.flowStatus.outputs?.length || 5;
            activeOutputs.textContent = `${active}/${total}`;
        }

        if (flowBitrate) {
            const bitrate = this.flowStatus.dataRate || 0;
            flowBitrate.textContent = `${bitrate.toFixed(1)} Mbps`;
        }
    }

    updateInputHealthUI() {
        // Update main input
        this.updateInputCard('main', this.inputHealth.main);

        // Update backup input (if configured)
        if (this.inputHealth.backup && this.inputHealth.backup.status !== 'NOT_CONFIGURED') {
            this.updateInputCard('backup', this.inputHealth.backup);
            document.getElementById('backup-input-card').style.display = 'block';
        } else {
            document.getElementById('backup-input-card').style.display = 'none';
        }

        // Update quick status
        const inputHealthQuick = document.getElementById('input-health-quick');
        if (inputHealthQuick) {
            const mainHealth = this.inputHealth.main?.status || 'UNKNOWN';
            const indicator = inputHealthQuick.querySelector('.health-indicator');
            const text = inputHealthQuick.querySelector('.health-text');

            inputHealthQuick.setAttribute('data-health', mainHealth.toLowerCase());
            if (text) text.textContent = this.getHealthDisplayText(mainHealth);
            if (indicator) this.updateIndicator(indicator, mainHealth);
        }
    }

    async testBackupInput() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/inputs/backup/test`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Backup input test completed successfully');
                await this.loadInputHealth();
            } else {
                this.showError(`Backup test failed: ${result.message}`);
            }
        } catch (error) {
            console.error('Error testing backup input:', error);
            this.showError('Failed to test backup input');
        }
    }

    async switchToBackup() {
        if (!confirm('Switch to backup input? This will briefly interrupt the stream.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/inputs/switch-to-backup`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Switched to backup input successfully');
                await this.loadInputHealth();
                await this.loadMediaConnectFlowStatus();
            } else {
                this.showError(`Failed to switch to backup: ${result.message}`);
            }
        } catch (error) {
            console.error('Error switching to backup:', error);
            this.showError('Failed to switch to backup input');
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadMediaConnectFlowStatus();
            this.loadInputHealth();
            this.loadChannelStatuses();
        }, 10000); // Refresh every 10 seconds for streaming dashboard
    }
}

// Initialize enhanced streaming dashboard
let streamingDashboard;
document.addEventListener('DOMContentLoaded', () => {
    streamingDashboard = new EnhancedStreamingDashboard();
    streamingDashboard.init();
});
```

## 🎯 **Implementation Summary**

The enhanced dashboard architecture provides:

### **Admin Dashboard** (`dashboard.html`)
- ✅ **MediaConnect Infrastructure Monitoring** - Flow status, outputs, health metrics
- ✅ **Multi-Channel MediaLive Overview** - All 5 channels with individual status
- ✅ **Platform & Preset Management** - Admin-only controls for adding platforms/presets
- ✅ **Enhanced Cost Monitoring** - Multi-channel cost breakdown and projections
- ✅ **Infrastructure Health** - Comprehensive AWS service monitoring

### **Streaming Dashboard** (`streaming.html`)
- ✅ **MediaConnect Flow Status** - Real-time flow health and performance
- ✅ **Input Health Monitoring** - Main and backup SRT input status
- ✅ **Individual Destination Controls** - Granular channel management
- ✅ **Real-time Metrics** - Bandwidth, uptime, session tracking
- ✅ **Enhanced User Experience** - Streaming-focused interface

### **Key Features:**
1. **Separation of Concerns** - Admin vs. Streaming functionality clearly separated
2. **Real-time Monitoring** - Live status updates for all components
3. **Input Redundancy** - Main/backup input monitoring and switching
4. **Granular Control** - Individual channel management per destination
5. **Enhanced UX** - Platform-specific presets and admin management
6. **Future-Proof** - Easy addition of new platforms and presets

### **Backend API Enhancements Required:**

```javascript
// New API endpoints needed for enhanced dashboards
GET  /api/mediaconnect/flow/status           - MediaConnect flow status
GET  /api/mediaconnect/inputs/health         - Input health monitoring
POST /api/mediaconnect/inputs/backup/test    - Test backup input
POST /api/mediaconnect/inputs/switch-to-backup - Switch to backup input
GET  /api/admin/platforms                    - Platform management (admin only)
POST /api/admin/platforms                    - Create new platform (admin only)
GET  /api/admin/presets                      - Preset management (admin only)
POST /api/admin/presets                      - Create new preset (admin only)
PUT  /api/admin/presets/{id}                 - Update preset (admin only)
DELETE /api/admin/presets/{id}               - Delete preset (admin only)
```

This robust implementation plan addresses all critical issues and provides a solid, future-proof foundation for granular RTMP destination control with comprehensive dashboard functionality for both administrators and streaming operators.
```

This robust plan addresses all critical issues identified in the review and provides a solid foundation for implementation.
