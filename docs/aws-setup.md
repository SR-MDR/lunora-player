# AWS Setup Guide for Lunora Player

This guide walks you through setting up the AWS infrastructure for the Lunora Player.

## Prerequisites

### AWS Account Setup
1. **AWS Account**: Ensure you have an active AWS account
2. **IAM Permissions**: Your AWS user/role needs the following permissions:
   - CloudFormation (full access)
   - MediaLive (full access)
   - MediaPackage (full access)
   - S3 (full access)
   - CloudFront (full access)
   - IAM (limited - for creating service roles)

### AWS CLI Configuration
1. **Install AWS CLI**: Download from [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

2. **Configure Credentials**:
   ```bash
   aws configure
   ```
   Enter your:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region: `us-west-2` (Oregon)
   - Default output format: `json`

3. **Verify Configuration**:
   ```bash
   aws sts get-caller-identity
   ```

## Deployment Steps

### 1. Validate Template
Before deploying, validate the CloudFormation template:
```bash
./scripts/deploy-aws.sh validate
```

### 2. Deploy Infrastructure
Deploy the complete AWS Media Services stack:
```bash
./scripts/deploy-aws.sh deploy
```

This will create:
- S3 bucket for video storage
- CloudFront distribution for content delivery
- MediaPackage channel for HLS packaging
- MediaLive input for SRT streams
- MediaLive channel for encoding
- IAM roles and security groups

### 3. Review Outputs
After deployment, review the stack outputs:
```bash
./scripts/deploy-aws.sh outputs
```

Key outputs include:
- **MediaPackage HLS Endpoint**: Your live stream URL
- **CloudFront Domain**: CDN domain for video delivery
- **S3 Bucket Name**: Where to upload video files
- **SRT Input Endpoint**: Where to send live streams

## Configuration Details

### MediaLive Channel Settings
The deployed MediaLive channel includes:
- **Input**: SRT Caller on port 9998
- **Encoding**: H.264 video, AAC audio
- **Output**: 1080p30 to MediaPackage
- **Audio**: 128kbps AAC stereo

### MediaPackage Settings
- **Segment Duration**: 6 seconds
- **Playlist Window**: 60 seconds
- **Format**: HLS with audio rendition groups

### CloudFront Configuration
- **Origin**: S3 bucket with OAC (Origin Access Control)
- **Caching**: Optimized for video content
- **HTTPS**: Enforced for all requests
- **CORS**: Configured for web player access

## Post-Deployment Configuration

### 1. Update Player Configuration
The deployment script automatically updates:
- `config/aws-config.js` with actual endpoint URLs
- `config/player-config.js` with MediaPackage endpoints

### 2. Start MediaLive Channel
⚠️ **Important**: Starting the channel incurs AWS charges (~$2.50/hour)

```bash
./scripts/deploy-aws.sh start-channel
```

### 3. Configure Videon Edge Node
Update your Videon Edge node with the SRT endpoint:
- **Protocol**: SRT Caller
- **Host**: [MediaLive Input Endpoint]
- **Port**: 9998
- **Stream Name**: lunora-srt-stream

## Testing the Setup

### 1. Test with Sample Stream
Use the built-in test stream first:
1. Open the player in your browser
2. Select "Test Stream" option
3. Click "Load Stream"
4. Verify playback works

### 2. Test Live Stream
1. Start your Videon Edge node streaming
2. Verify MediaLive channel shows "Running" status
3. Use the MediaPackage HLS endpoint in the player
4. Test language selection if multiple audio tracks

### 3. Test VOD Content
1. Upload a test video to your S3 bucket
2. Access via CloudFront URL
3. Test playback in the player

## Monitoring and Maintenance

### CloudWatch Metrics
Monitor these key metrics:
- **MediaLive**: Channel state, input video/audio
- **MediaPackage**: Origin requests, egress bytes
- **CloudFront**: Cache hit ratio, origin latency

### Cost Monitoring
Set up billing alerts for:
- MediaLive channel hours
- MediaPackage data processing
- CloudFront data transfer
- S3 storage and requests

### Regular Maintenance
1. **Stop unused channels**: MediaLive charges per hour
2. **Clean old content**: Implement S3 lifecycle policies
3. **Monitor costs**: Review AWS Cost Explorer monthly
4. **Update security**: Rotate access keys regularly

## Troubleshooting

### Common Issues

#### MediaLive Channel Won't Start
- Check IAM role permissions
- Verify input security group settings
- Ensure SRT input is properly configured

#### No Stream Output
- Verify Videon Edge node is streaming
- Check MediaLive input for incoming data
- Monitor MediaPackage channel health

#### Player Can't Load Stream
- Verify CORS configuration on CloudFront
- Check MediaPackage endpoint accessibility
- Test with curl: `curl -I [HLS_ENDPOINT]`

#### High Costs
- Stop MediaLive channels when not needed
- Use appropriate CloudFront price class
- Implement S3 intelligent tiering

### Debug Commands

Check MediaLive channel status:
```bash
aws medialive describe-channel --channel-id [CHANNEL_ID] --region us-west-2
```

Check MediaPackage channel:
```bash
aws mediapackage describe-channel --id [CHANNEL_ID] --region us-west-2
```

Test HLS endpoint:
```bash
curl -I [HLS_ENDPOINT_URL]
```

## Security Considerations

### Network Security
- MediaLive input security groups restrict access
- CloudFront enforces HTTPS
- S3 bucket blocks public access

### Access Control
- Use IAM roles with minimal permissions
- Rotate access keys regularly
- Enable CloudTrail for audit logging

### Content Protection
- Consider DRM for premium content
- Implement signed URLs for restricted access
- Use WAF for additional protection

## Scaling Considerations

### High Availability
- Use multiple MediaLive inputs for redundancy
- Configure input failover
- Deploy across multiple AZs

### Performance
- Use CloudFront edge locations globally
- Optimize MediaPackage segment settings
- Monitor and adjust based on usage

### Cost Optimization
- Use reserved capacity for predictable workloads
- Implement auto-scaling for variable demand
- Regular cost reviews and optimization

## Next Steps

After successful deployment:
1. Configure your Videon Edge nodes
2. Test end-to-end streaming
3. Implement monitoring and alerting
4. Plan for production scaling
5. Consider additional features (AI translation, authentication)
