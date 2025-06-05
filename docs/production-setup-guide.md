# Lunora Player - Production Setup Guide with SRT Ingest

## Overview

This guide walks you through deploying the Lunora Player to AWS production with full SRT ingest capability for your LiveEdge Node.

## Prerequisites

### Required Information
- **Domain Name**: Your production domain (e.g., `yourdomain.com`)
- **SSL Certificate**: ACM certificate ARN for your domain
- **LiveEdge Node**: IP address and configuration access
- **AWS Account**: Lunora-Media-Services (372241484305)

### Required Tools
- AWS CLI configured with `lunora-media` profile
- Node.js and npm
- Git
- curl (for testing)
- jq (for JSON parsing)

## Step 1: Domain and SSL Certificate Setup

### 1.1 Request SSL Certificate in ACM

```bash
# Request wildcard certificate (must be in us-east-1 for CloudFront)
aws acm request-certificate \
    --domain-name "*.yourdomain.com" \
    --subject-alternative-names "yourdomain.com" \
    --validation-method DNS \
    --region us-east-1 \
    --profile lunora-media

# Note the certificate ARN from the output
```

### 1.2 Validate Certificate

1. Go to AWS Console → Certificate Manager (us-east-1)
2. Find your certificate and click "Create records in Route 53"
3. Wait for validation to complete (usually 5-30 minutes)

### 1.3 Set Up Route 53 (if not already configured)

```bash
# Create hosted zone for your domain
aws route53 create-hosted-zone \
    --name yourdomain.com \
    --caller-reference $(date +%s) \
    --profile lunora-media
```

## Step 2: Production Deployment

### 2.1 Set Environment Variables

```bash
export DOMAIN_NAME="yourdomain.com"
export CERTIFICATE_ARN="arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id"
export AWS_PROFILE="lunora-media"
```

### 2.2 Deploy Production Infrastructure

```bash
# Make deployment script executable
chmod +x scripts/deploy-production-srt.sh

# Deploy complete production stack
./scripts/deploy-production-srt.sh \
    --domain "$DOMAIN_NAME" \
    --certificate "$CERTIFICATE_ARN"
```

### 2.3 Verify Deployment

```bash
# Test the deployment
chmod +x scripts/test-production-srt.sh
./scripts/test-production-srt.sh --domain "$DOMAIN_NAME"
```

## Step 3: Configure DNS Records

After deployment, create DNS records pointing to your CloudFront distributions:

```bash
# Get CloudFront distribution domains from deployment output
aws cloudformation describe-stacks \
    --stack-name lunora-player-prod-infrastructure \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Stacks[0].Outputs'
```

Create CNAME records:
- `player.yourdomain.com` → `d1234567890123.cloudfront.net`
- `dashboard.yourdomain.com` → `d0987654321098.cloudfront.net`
- `api.yourdomain.com` → Your API Gateway domain

## Step 4: Configure LiveEdge Node for SRT

### 4.1 Get SRT Configuration

```bash
# Get SRT input details
./scripts/test-production-srt.sh --domain "$DOMAIN_NAME" | grep "SRT URL"
```

### 4.2 LiveEdge Node Configuration

1. **Access LiveEdge Node web interface**
2. **Navigate to Output Settings**
3. **Configure SRT Output:**
   - **Mode**: Caller
   - **URL**: `srt://your-medialive-input.medialive.us-west-2.amazonaws.com:9998`
   - **Latency**: 200ms
   - **Encryption**: Optional (recommended for production)
   - **Stream ID**: `lunora-player-prod-srt-stream`

### 4.3 Video Settings (Recommended)

- **Resolution**: 1920x1080 or 1280x720
- **Frame Rate**: 30 fps
- **Bitrate**: 2-5 Mbps (depending on bandwidth)
- **Codec**: H.264
- **Audio**: AAC, 48kHz, Stereo

## Step 5: Start MediaLive Channel

### 5.1 Start the Channel

```bash
# Get MediaLive channel ID
CHANNEL_ID=$(aws cloudformation describe-stacks \
    --stack-name lunora-player-prod-medialive-srt \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaLiveChannelId`].OutputValue' \
    --output text)

# Start the channel
aws medialive start-channel \
    --channel-id "$CHANNEL_ID" \
    --region us-west-2 \
    --profile lunora-media

echo "MediaLive channel started: $CHANNEL_ID"
```

### 5.2 Monitor Channel Status

```bash
# Monitor channel startup
aws medialive describe-channel \
    --channel-id "$CHANNEL_ID" \
    --region us-west-2 \
    --profile lunora-media \
    --query 'State'
```

## Step 6: Test Complete Pipeline

### 6.1 Start SRT Stream from LiveEdge Node

1. Start streaming from your LiveEdge Node
2. Verify SRT connection in LiveEdge Node interface
3. Check for green status indicators

### 6.2 Verify MediaLive Reception

```bash
# Check MediaLive channel for input signal
aws medialive describe-channel \
    --channel-id "$CHANNEL_ID" \
    --region us-west-2 \
    --profile lunora-media
```

### 6.3 Test HLS Playback

```bash
# Get HLS endpoint URL
HLS_URL=$(aws mediapackage describe-origin-endpoint \
    --id lunora-player-prod-hls \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Url' \
    --output text)

echo "HLS URL: $HLS_URL"

# Test HLS endpoint
curl -I "$HLS_URL"
```

### 6.4 Test Production Player

Open in browser:
- **Player**: `https://player.yourdomain.com`
- **Dashboard**: `https://dashboard.yourdomain.com`

## Step 7: Production Monitoring

### 7.1 Set Up CloudWatch Alarms

```bash
# Create alarm for MediaLive channel state
aws cloudwatch put-metric-alarm \
    --alarm-name "MediaLive-Channel-State" \
    --alarm-description "MediaLive channel not running" \
    --metric-name "ChannelState" \
    --namespace "AWS/MediaLive" \
    --statistic "Average" \
    --period 300 \
    --threshold 1 \
    --comparison-operator "LessThanThreshold" \
    --dimensions Name=Channel,Value="$CHANNEL_ID" \
    --evaluation-periods 2 \
    --region us-west-2 \
    --profile lunora-media
```

### 7.2 Continuous Monitoring

```bash
# Run continuous monitoring
./scripts/test-production-srt.sh --domain "$DOMAIN_NAME" --monitor
```

## Step 8: Production URLs

After successful deployment, your applications will be available at:

- **Video Player**: `https://player.yourdomain.com`
- **Dashboard**: `https://dashboard.yourdomain.com`
- **API Health**: `https://api.yourdomain.com/health`
- **Videon Test**: `https://api.yourdomain.com/api/videon/test`

## Troubleshooting

### Common Issues

1. **Certificate Validation Failed**
   - Ensure certificate is in us-east-1 region
   - Verify DNS validation records

2. **SRT Connection Failed**
   - Check MediaLive channel state
   - Verify security group allows UDP traffic on port 9998
   - Confirm LiveEdge Node SRT configuration

3. **HLS Playback Issues**
   - Verify MediaPackage endpoint accessibility
   - Check MediaLive channel is receiving input
   - Confirm CloudFront distribution is deployed

4. **DNS Resolution Issues**
   - Verify CNAME records are created
   - Check CloudFront distribution status
   - Allow time for DNS propagation (up to 48 hours)

### Getting Help

```bash
# Check deployment status
aws cloudformation describe-stacks \
    --region us-west-2 \
    --profile lunora-media

# Check MediaLive logs
aws logs describe-log-groups \
    --log-group-name-prefix "/aws/medialive" \
    --region us-west-2 \
    --profile lunora-media
```

## Cost Management

### Expected Monthly Costs (Production)

- **MediaLive**: $0-500 (when running)
- **MediaPackage**: $50-200 (usage-based)
- **CloudFront**: $20-100 (traffic-based)
- **S3**: $5-20 (storage)
- **Lambda**: $5-15 (API calls)
- **Route 53**: $1-5 (DNS queries)

**Total**: $80-840/month (depending on usage)

### Cost Optimization

1. **Stop MediaLive when not streaming**
2. **Use CloudFront caching effectively**
3. **Implement S3 lifecycle policies**
4. **Monitor usage with AWS Cost Explorer**

## Security Considerations

1. **Enable WAF** for CloudFront distributions
2. **Use VPC endpoints** for internal communication
3. **Implement API rate limiting**
4. **Enable CloudTrail** for audit logging
5. **Use Secrets Manager** for sensitive configuration

## Next Steps

1. **Set up CI/CD pipeline** for automated deployments
2. **Implement user authentication** with Cognito
3. **Add advanced monitoring** with custom metrics
4. **Configure backup and disaster recovery**
5. **Scale to multiple regions** if needed
