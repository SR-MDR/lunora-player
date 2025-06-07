# Lunora Player - Production Deployment Guide

## 🚀 Complete Production Deployment Strategy

This guide covers deploying the complete Lunora Player multi-destination streaming system to AWS production environment.

## Prerequisites

### Required Tools
- **AWS CLI** v2.x configured with lunora-media profile
- **Node.js** v18+ and npm
- **Git** for version control
- **Domain name** for production URLs (optional but recommended)
- **SSL Certificate** in AWS Certificate Manager (for custom domain)

### AWS Account Setup
- **Account ID**: 372241484305 (Lunora-Media-Services)
- **Region**: us-west-2 (Oregon)
- **Profile**: lunora-media
- **Permissions**: Full access to MediaLive, MediaPackage, S3, CloudFront, DynamoDB, Lambda, API Gateway, Parameter Store

## Phase 1: Infrastructure Deployment

### Step 1: Deploy Multi-Destination Infrastructure

```bash
# Make deployment script executable
chmod +x scripts/deploy-production-multi-destination.sh

# Deploy the complete multi-destination streaming infrastructure
./scripts/deploy-production-multi-destination.sh
```

This deploys:
- ✅ **DynamoDB Tables**: destinations, presets, streaming sessions
- ✅ **Lambda Functions**: Multi-destination API
- ✅ **API Gateway**: RESTful API endpoints
- ✅ **KMS Key**: Parameter Store encryption
- ✅ **IAM Roles**: Secure service permissions
- ✅ **Default Presets**: Platform-optimized encoding settings

### Step 2: Deploy Media Services Infrastructure

```bash
# Deploy existing media services (if not already deployed)
./scripts/deploy-aws.sh deploy
```

This ensures:
- ✅ **MediaPackage Channel**: HLS endpoint for video delivery
- ✅ **MediaLive Channel**: SRT input for Videon LiveEdge nodes
- ✅ **S3 Buckets**: Video storage and static hosting
- ✅ **CloudFront**: CDN for global content delivery

## Phase 2: Frontend Applications Deployment

### Step 3: Build Production Frontend

```bash
# Install dependencies
npm install

# Build production versions of all frontend applications
npm run build:production
```

### Step 4: Deploy Frontend Applications

```bash
# Deploy complete production stack including frontend
./scripts/deploy-production.sh \
    --domain "yourdomain.com" \
    --certificate "arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id"
```

This deploys:
- ✅ **Video Player**: S3 + CloudFront distribution
- ✅ **AWS Dashboard**: S3 + CloudFront distribution  
- ✅ **Streaming Control**: S3 + CloudFront distribution
- ✅ **Custom Domain**: Route 53 + SSL certificates
- ✅ **CDN Configuration**: Optimized caching and compression

## Phase 3: Configuration and Testing

### Step 5: Update Production Configuration

After deployment, update the configuration files with actual AWS resource IDs:

```bash
# Get deployment outputs
aws cloudformation describe-stacks \
    --stack-name lunora-player-prod-multi-destination \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Stacks[0].Outputs'

# Update config/production-config.js with actual values:
# - API Gateway URL
# - CloudFront distribution IDs
# - MediaPackage endpoint URLs
# - S3 bucket names
```

### Step 6: Test Multi-Destination Streaming

1. **Access Streaming Control**: `https://streaming.yourdomain.com`
2. **Add Test Destination**: Create a test YouTube/X/LinkedIn destination
3. **Test Connectivity**: Use the "Test" button for each destination
4. **Start Streaming**: Begin multi-destination streaming
5. **Monitor Status**: Verify real-time status updates

## Phase 4: Domain and SSL Setup

### Step 7: Configure Custom Domain (Optional)

```bash
# Create Route 53 hosted zone (if not exists)
aws route53 create-hosted-zone \
    --name yourdomain.com \
    --caller-reference $(date +%s) \
    --profile lunora-media

# Request SSL certificate in us-east-1 (required for CloudFront)
aws acm request-certificate \
    --domain-name yourdomain.com \
    --subject-alternative-names "*.yourdomain.com" \
    --validation-method DNS \
    --region us-east-1 \
    --profile lunora-media
```

### Step 8: Update DNS Records

Point your domain to the CloudFront distributions:
- **yourdomain.com** → Player CloudFront distribution
- **streaming.yourdomain.com** → Streaming control CloudFront distribution
- **dashboard.yourdomain.com** → Dashboard CloudFront distribution

## Phase 5: Monitoring and Optimization

### Step 9: Set Up Monitoring

```bash
# Deploy CloudWatch dashboard
aws cloudwatch put-dashboard \
    --dashboard-name "LunoraPlayerProduction" \
    --dashboard-body file://aws/cloudwatch/production-dashboard.json \
    --region us-west-2 \
    --profile lunora-media
```

### Step 10: Configure Alerts

```bash
# Create CloudWatch alarms for critical metrics
aws cloudwatch put-metric-alarm \
    --alarm-name "LunoraPlayer-HighErrorRate" \
    --alarm-description "High error rate in multi-destination API" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --region us-west-2 \
    --profile lunora-media
```

## Production URLs

After successful deployment, your applications will be available at:

### With Custom Domain
- **Video Player**: `https://yourdomain.com`
- **Streaming Control**: `https://streaming.yourdomain.com`
- **AWS Dashboard**: `https://dashboard.yourdomain.com`
- **API Endpoint**: `https://api.yourdomain.com`

### With CloudFront URLs
- **Video Player**: `https://d1234567890.cloudfront.net`
- **Streaming Control**: `https://d0987654321.cloudfront.net`
- **AWS Dashboard**: `https://d1122334455.cloudfront.net`
- **API Endpoint**: `https://abcdef1234.execute-api.us-west-2.amazonaws.com/prod`

## Cost Optimization

### Production Cost Estimates (Monthly)

**Core Infrastructure:**
- **MediaLive**: $0 (when idle) to $200+ (when streaming 24/7)
- **MediaPackage**: $0.065 per GB delivered
- **CloudFront**: $0.085 per GB (first 10TB)
- **S3**: $5-20 for storage and requests
- **DynamoDB**: $5-15 for configuration storage
- **Lambda**: $5-25 for API requests
- **Parameter Store**: $2-5 for encrypted parameters

**Total Estimated Cost**: $20-300/month depending on usage

### Cost Optimization Strategies

1. **Stop MediaLive when not streaming**:
   ```bash
   aws medialive stop-channel --channel-id YOUR_CHANNEL_ID
   ```

2. **Use S3 Intelligent Tiering** for video storage
3. **Configure CloudFront caching** for static assets
4. **Monitor and set billing alerts**

## Security Best Practices

### Step 11: Secure Production Environment

1. **Enable AWS CloudTrail** for audit logging
2. **Configure VPC** for network isolation (optional)
3. **Set up IAM policies** with least privilege access
4. **Enable S3 bucket encryption** and versioning
5. **Configure WAF** for API Gateway protection

### Step 12: Backup and Disaster Recovery

1. **Enable DynamoDB point-in-time recovery**
2. **Set up S3 cross-region replication**
3. **Create Lambda function versioning**
4. **Document recovery procedures**

## Maintenance and Updates

### Regular Maintenance Tasks

1. **Monitor CloudWatch metrics** and logs
2. **Update Lambda function dependencies** monthly
3. **Review and rotate access keys** quarterly
4. **Test disaster recovery procedures** quarterly
5. **Update SSL certificates** before expiration

### Deployment Updates

```bash
# Update Lambda functions
./scripts/deploy-production-multi-destination.sh

# Update frontend applications
npm run build:production
aws s3 sync dist/ s3://your-bucket/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

## Troubleshooting

### Common Issues

**API Gateway 502 errors**
- Check Lambda function logs in CloudWatch
- Verify IAM permissions for Lambda execution role
- Test Lambda function directly

**DynamoDB access denied**
- Verify IAM policies include DynamoDB permissions
- Check table names match configuration
- Ensure tables exist in correct region

**Parameter Store encryption errors**
- Verify KMS key permissions
- Check Parameter Store parameter names
- Ensure Lambda has KMS decrypt permissions

**MediaLive streaming issues**
- Verify MediaLive channel is running
- Check input security group settings
- Test SRT connectivity from Videon nodes

### Support Resources

- **AWS Documentation**: https://docs.aws.amazon.com/
- **CloudWatch Logs**: Monitor Lambda and API Gateway logs
- **AWS Support**: For infrastructure issues
- **GitHub Issues**: For application-specific problems

## Next Steps

After successful production deployment:

1. **Configure streaming destinations** with real platform credentials
2. **Test end-to-end streaming** from Videon nodes to platforms
3. **Set up monitoring dashboards** for operational visibility
4. **Train users** on the streaming control interface
5. **Plan scaling strategy** for multiple channels/regions

The Lunora Player multi-destination streaming system is now ready for production use with enterprise-grade reliability, security, and scalability!
