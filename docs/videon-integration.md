# Videon Edge Integration Guide

This guide covers integrating Videon Edge nodes with the Lunora Player AWS Media Services infrastructure.

## Overview

Videon Edge nodes provide professional-grade live streaming capabilities with SRT (Secure Reliable Transport) output, which integrates seamlessly with AWS MediaLive for low-latency, high-quality streaming.

## Videon Edge Node Configuration

### SRT Output Settings

Configure your Videon Edge node with these SRT settings:

#### Basic SRT Configuration
- **Protocol**: SRT Caller
- **Mode**: Caller (Edge node initiates connection)
- **Host**: [Your MediaLive SRT Input Endpoint]
- **Port**: 9998 (default, configurable in CloudFormation)
- **Stream Name**: `lunora-srt-stream`

#### Advanced SRT Settings
- **Latency**: 200ms (recommended for live streaming)
- **Encryption**: Disabled (can be enabled for additional security)
- **Bandwidth**: Auto (let SRT manage bandwidth)
- **Packet Size**: 1316 bytes (default)
- **Recovery**: Enabled

### Video Encoding Settings

For optimal compatibility with AWS MediaLive:

#### Video Configuration
- **Codec**: H.264
- **Profile**: High
- **Level**: 4.1 or higher
- **Resolution**: 1920x1080 (1080p)
- **Frame Rate**: 30fps
- **Bitrate**: 3-8 Mbps (depending on content)
- **Keyframe Interval**: 2 seconds (60 frames at 30fps)

#### Audio Configuration
- **Codec**: AAC
- **Sample Rate**: 48kHz
- **Bitrate**: 128-256 kbps
- **Channels**: Stereo (2.0)

### Multi-Language Audio Setup

For multi-language support, configure multiple audio tracks:

#### Primary Audio Track
- **Language**: English (en)
- **Codec**: AAC
- **Bitrate**: 128 kbps
- **Channels**: Stereo

#### Secondary Audio Tracks
- **Language**: Spanish (es), French (fr), etc.
- **Codec**: AAC
- **Bitrate**: 128 kbps each
- **Channels**: Stereo

#### Audio Track Metadata
Ensure proper language metadata is embedded:
```
Track 1: lang=en, label="English"
Track 2: lang=es, label="Español"
Track 3: lang=fr, label="Français"
```

## Network Configuration

### Firewall Settings
Ensure these ports are open on your network:

#### Outbound (from Videon Edge)
- **Port 9998**: SRT output to AWS MediaLive
- **Port 443**: HTTPS for management/monitoring
- **Port 53**: DNS resolution

#### Bandwidth Requirements
- **Minimum**: 5 Mbps upload per stream
- **Recommended**: 10 Mbps upload per stream
- **Buffer**: 20% additional for overhead

### Network Optimization
1. **QoS**: Prioritize SRT traffic
2. **Jitter Buffer**: Configure for network conditions
3. **Packet Loss**: Monitor and optimize
4. **Latency**: Minimize network hops

## AWS MediaLive Integration

### Input Configuration
The CloudFormation template creates a MediaLive input with:
- **Type**: SRT_CALLER
- **Port**: 9998
- **Security Group**: Allows global access (restrict in production)

### Channel Configuration
MediaLive channel settings for Videon Edge compatibility:
- **Input Specification**: HD, AVC, MAX_10_MBPS
- **Audio Handling**: Preserve multiple audio tracks
- **Video Processing**: Minimal processing for low latency

## Redundancy and Failover

### Dual Edge Node Setup

#### Primary Edge Node
- **SRT Target**: Primary MediaLive input
- **Priority**: High
- **Health Check**: Enabled

#### Backup Edge Node
- **SRT Target**: Secondary MediaLive input (if configured)
- **Priority**: Low
- **Activation**: Automatic on primary failure

### MediaLive Input Failover
Configure MediaLive for automatic failover:
1. Create multiple inputs
2. Configure input failover settings
3. Set failover detection thresholds

## Monitoring and Troubleshooting

### Videon Edge Monitoring
Monitor these metrics on your Edge node:
- **SRT Connection Status**: Connected/Disconnected
- **Bitrate**: Actual vs. target
- **Packet Loss**: Should be < 0.1%
- **Latency**: Network round-trip time
- **Buffer Health**: Input/output buffer levels

### AWS MediaLive Monitoring
Monitor in AWS CloudWatch:
- **Input Video/Audio**: Signal presence
- **Active Alerts**: Any error conditions
- **Network In**: Data received from Edge node
- **Dropped Frames**: Should be minimal

### Common Issues and Solutions

#### SRT Connection Fails
**Symptoms**: Edge node can't connect to MediaLive
**Solutions**:
1. Verify MediaLive input endpoint and port
2. Check network firewall rules
3. Confirm MediaLive input security group
4. Test with telnet: `telnet [endpoint] 9998`

#### Stream Drops Frequently
**Symptoms**: Intermittent connection loss
**Solutions**:
1. Check network stability
2. Adjust SRT latency settings
3. Monitor bandwidth utilization
4. Review MediaLive input failover settings

#### Audio Tracks Not Detected
**Symptoms**: Player shows only one audio track
**Solutions**:
1. Verify Edge node audio track configuration
2. Check audio metadata/language tags
3. Confirm MediaLive audio description settings
4. Test with media analyzer tools

#### High Latency
**Symptoms**: Delay between source and player
**Solutions**:
1. Reduce SRT latency setting
2. Optimize MediaLive segment duration
3. Use MediaPackage low-latency mode
4. Minimize network hops

## Testing and Validation

### Pre-Production Testing

#### SRT Connection Test
```bash
# Test SRT connection (requires ffmpeg with SRT support)
ffmpeg -f lavfi -i testsrc2=duration=10:size=1920x1080:rate=30 \
       -f lavfi -i sine=frequency=1000:duration=10 \
       -c:v libx264 -c:a aac \
       -f mpegts srt://[medialive-endpoint]:9998?streamid=lunora-srt-stream
```

#### Stream Quality Test
1. Start Edge node streaming
2. Monitor MediaLive input metrics
3. Check MediaPackage output quality
4. Test player functionality

### Production Validation
1. **Load Testing**: Multiple concurrent streams
2. **Failover Testing**: Simulate Edge node failure
3. **Network Testing**: Various network conditions
4. **Quality Testing**: Different content types

## Best Practices

### Configuration Management
1. **Document Settings**: Keep detailed configuration records
2. **Version Control**: Track configuration changes
3. **Backup Configs**: Regular configuration backups
4. **Change Management**: Controlled update process

### Performance Optimization
1. **Regular Monitoring**: Continuous performance tracking
2. **Capacity Planning**: Plan for peak usage
3. **Network Optimization**: Regular network analysis
4. **Hardware Maintenance**: Keep Edge nodes updated

### Security Considerations
1. **Network Segmentation**: Isolate streaming network
2. **Access Control**: Limit management access
3. **Encryption**: Consider SRT encryption for sensitive content
4. **Monitoring**: Log and monitor all connections

## Advanced Features

### Multi-Bitrate Streaming
Configure Edge node for multiple bitrate outputs:
- **High**: 1080p @ 6 Mbps
- **Medium**: 720p @ 3 Mbps  
- **Low**: 480p @ 1 Mbps

### Adaptive Bitrate
Let MediaLive handle ABR ladder generation:
1. Send single high-quality stream from Edge
2. Configure MediaLive for multiple outputs
3. Use MediaPackage for ABR packaging

### Content Protection
For premium content:
1. Enable SRT encryption on Edge node
2. Configure MediaLive for encrypted inputs
3. Implement DRM in MediaPackage

## Support and Resources

### Videon Resources
- [Videon Edge Documentation](https://www.videonlabs.com/support/)
- [SRT Configuration Guide](https://www.videonlabs.com/srt-guide/)
- [Videon Support Portal](https://support.videonlabs.com/)

### AWS Resources
- [MediaLive User Guide](https://docs.aws.amazon.com/medialive/)
- [SRT Input Configuration](https://docs.aws.amazon.com/medialive/latest/ug/srt-input.html)
- [AWS Media Services](https://aws.amazon.com/media-services/)

### Community Resources
- [SRT Alliance](https://www.srtalliance.org/)
- [AWS Media Services Forum](https://forums.aws.amazon.com/forum.jspa?forumID=230)
- [Videon Community](https://community.videonlabs.com/)

## Troubleshooting Checklist

### Pre-Deployment
- [ ] Videon Edge node firmware updated
- [ ] Network firewall configured
- [ ] AWS MediaLive input created
- [ ] SRT settings verified

### During Deployment
- [ ] SRT connection established
- [ ] MediaLive input receiving data
- [ ] Audio/video quality verified
- [ ] Language tracks detected

### Post-Deployment
- [ ] End-to-end streaming tested
- [ ] Failover scenarios tested
- [ ] Monitoring configured
- [ ] Documentation updated
