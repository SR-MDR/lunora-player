# 🎉 **DYNAMIC MEDIALIVE CHANNEL CREATION - COMPLETE IMPLEMENTATION GUIDE**

<!-- DO NOT DELETE - CRITICAL REFERENCE DOCUMENTATION -->
<!-- This document contains all key learnings and requirements for dynamic MediaLive channel creation -->
<!-- Last Updated: 2025-06-11 -->
<!-- Status: ✅ WORKING - Successfully streaming to Restream -->

## 📋 **Complete Requirements Checklist**

### **1. AWS Service Limits & Quotas**
- **MediaLive Push Inputs**: Default limit is 5 per region
- **MediaConnect Outputs per Flow**: Default limit is 50 per flow
- **Request increases via**: [AWS Service Quotas Console](https://console.aws.amazon.com/servicequotas/home?region=us-west-2#!/services/medialive/quotas)

### **2. IAM Permissions Required**
```yaml
# Lambda Role Permissions
- medialive:CreateChannel
- medialive:DeleteChannel
- medialive:CreateInput
- medialive:DeleteInput
- medialive:CreateInputSecurityGroup
- medialive:DescribeInputSecurityGroup
- medialive:UpdateInputSecurityGroup
- mediaconnect:AddFlowOutputs
- mediaconnect:RemoveFlowOutput
- mediaconnect:DescribeFlow
- iam:PassRole  # For MediaLive service role
```

### **3. MediaLive Service Role**
- **Required Role**: `lunora-player-prod-medialive-role` (existing)
- **ARN**: `arn:aws:iam::372241484305:role/lunora-player-prod-medialive-role`
- **Lambda must have `iam:PassRole` permission** for this specific role

## 🔧 **Critical MediaLive Channel Configuration**

### **Channel Class Setting**
```javascript
{
  ChannelClass: 'SINGLE_PIPELINE',  // CRITICAL: Must be set explicitly
  // Without this, defaults to STANDARD (2 pipelines) requiring 2 destinations
}
```

### **Destination Configuration**
```javascript
Destinations: [{
  Id: 'rtmp-destination',  // Must use hyphens, not underscores
  Settings: [{              // Exactly 1 setting for SINGLE_PIPELINE
    Url: rtmpUrl,          // e.g., "rtmp://live.restream.io/live"
    StreamName: streamKey, // e.g., "re_9790072_fa415b883ee7365d2c36"
    Username: '',
    PasswordParam: ''
  }]
}]
```

### **Audio/Video Selector Configuration**
```javascript
InputSettings: {
  AudioSelectors: [{
    Name: 'default-audio-selector',  // Use hyphens, not underscores
    SelectorSettings: {
      AudioTrackSelection: {         // Use AudioTrackSelection, not AudioLanguageSelection
        Tracks: [{ Track: 1 }]
      }
    }
  }],
  VideoSelector: {
    ColorSpace: 'FOLLOW',
    ColorSpaceUsage: 'FALLBACK'
  }
}
```

### **Audio Description Configuration**
```javascript
AudioDescriptions: [{
  Name: 'audio_aac',
  AudioSelectorName: 'default-audio-selector',  // REQUIRED: Must reference AudioSelector
  CodecSettings: {
    AacSettings: {
      Bitrate: 128000,
      CodingMode: 'CODING_MODE_2_0',
      SampleRate: 48000
    }
  }
}]
```

## 🚨 **Critical Validation Rules**

### **Naming Conventions**
- **Destination IDs**: Only letters, numbers, and hyphens
- **Audio Selector Names**: Only letters, numbers, and hyphens
- **No underscores allowed** in MediaLive identifiers
- **Cannot start or end with hyphens**

### **AWS API Parameter Casing**
```javascript
// CORRECT (PascalCase for AWS API):
VideoDescriptions: [{
  Name: 'video_1080p30',
  CodecSettings: {
    H264Settings: {
      Profile: 'HIGH',
      Level: 'H264_LEVEL_4_1',
      RateControlMode: 'CBR'
    }
  }
}]

// WRONG (camelCase):
videoDescriptions: [{
  codecSettings: {
    h264Settings: { ... }
  }
}]
```

## 🔄 **Complete Working Flow**

### **1. MediaConnect Output Creation**
```javascript
// Creates RTP output from MediaConnect flow to MediaLive input
const mediaConnectOutput = await this.createMediaConnectOutput(outputName, mediaLiveInput);
```

### **2. MediaLive Input Creation**
```javascript
// Creates RTP_PUSH input to receive from MediaConnect
const mediaLiveInput = await this.createMediaLiveInput(inputName);
```

### **3. MediaLive Channel Creation**
```javascript
// Creates SINGLE_PIPELINE channel with RTMP output
const mediaLiveChannel = await this.createMediaLiveChannel(
  channelName, 
  mediaLiveInput, 
  platform, 
  rtmpUrl, 
  streamKey
);
```

## 📊 **Resource Cleanup Strategy**

### **Orphaned Resource Detection**
```bash
# List orphaned MediaLive inputs
aws medialive list-inputs --query 'Inputs[?State==`DETACHED`]'

# List MediaConnect outputs
aws mediaconnect describe-flow --flow-arn [FLOW_ARN] --query 'Flow.Outputs'
```

### **Cleanup Commands**
```bash
# Delete orphaned MediaLive inputs
aws medialive delete-input --input-id [INPUT_ID]

# Remove MediaConnect outputs
aws mediaconnect remove-flow-output --flow-arn [FLOW_ARN] --output-arn [OUTPUT_ARN]
```

## 🎯 **Platform-Specific Templates**

### **Custom RTMP (Working)**
```javascript
custom: {
  name: 'Custom RTMP Channel',
  description: 'Dynamic MediaLive channel for custom RTMP destinations',
  encoderSettings: {
    VideoDescriptions: [{ /* 1080p30 config */ }],
    AudioDescriptions: [{ /* AAC config */ }],
    OutputGroups: [{ /* RTMP output group */ }],
    TimecodeConfig: { Source: 'EMBEDDED' }
  }
}
```

## 🔍 **Troubleshooting Guide**

### **Common Errors & Solutions**

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing required key 'AudioSelectorName'` | AudioDescription missing selector reference | Add `AudioSelectorName: 'default-audio-selector'` |
| `DestinationId should include only numbers, letters and hyphen` | Using underscores in IDs | Change `rtmp_destination` → `rtmp-destination` |
| `Exactly 2 destinations settings required` | Channel defaulting to STANDARD class | Add `ChannelClass: 'SINGLE_PIPELINE'` |
| `Exactly 1 destinations settings required` | Multiple settings in SINGLE_PIPELINE | Use exactly 1 setting in Settings array |
| `Not authorized to perform: iam:PassRole` | Missing PassRole permission | Add PassRole for MediaLive service role |
| `Too many push inputs` | Hit service limit of 5 | Clean up orphaned inputs or request quota increase |

## 🚀 **Next Steps for Scaling**

### **Service Limit Increases Needed**
1. **MediaLive Push Inputs**: 5 → 20 (for 10-15 destinations)
2. **MediaLive Channels**: 5 → 20 (for scaling)

### **Architecture Considerations**
- Each destination requires its own MediaLive channel
- MediaConnect flow can support up to 50 outputs
- Consider cost optimization for idle channels
- Implement proper cleanup for stopped destinations

## ✅ **Verified Working Configuration**

**Test Case**: Restream RTMP destination
- **Platform**: custom
- **RTMP URL**: `rtmp://live.restream.io/live`
- **Stream Key**: `re_9790072_fa415b883ee7365d2c36`
- **Preset**: 1080p30
- **Status**: ✅ Successfully streaming

---

**CRITICAL SUCCESS FACTORS:**
1. ✅ `ChannelClass: 'SINGLE_PIPELINE'` - Must be explicit
2. ✅ Exactly 1 destination setting for single pipeline
3. ✅ Hyphen-based naming (no underscores)
4. ✅ Correct AWS API parameter casing (PascalCase)
5. ✅ Required `AudioSelectorName` in AudioDescriptions
6. ✅ Proper IAM PassRole permissions
7. ✅ Service limit management and cleanup

This configuration is WORKING and successfully streaming to Restream!
