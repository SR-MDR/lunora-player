# Production Deployment Guide - Lunora Player with SRT Ingest

## Architecture Overview

### Production Stack Components

```
Production Environment with SRT Ingest:
├── Frontend (Static Web Apps)
│   ├── Player App (S3 + CloudFront)
│   ├── Dashboard App (S3 + CloudFront)
│   └── Videon Test App (S3 + CloudFront)
│
├── Backend API (Serverless)
│   ├── AWS Lambda Functions
│   ├── API Gateway
│   └── DynamoDB (optional)
│
├── Media Services (AWS Native)
│   ├── MediaLive (SRT ingest + live streaming)
│   ├── MediaPackage (HLS packaging)
│   ├── S3 (video storage)
│   └── CloudFront (video delivery)
│
├── SRT Ingest Pipeline
│   ├── LiveEdge Node (SRT source)
│   ├── MediaLive Input (SRT receiver)
│   ├── MediaLive Channel (encoding)
│   └── MediaPackage (HLS output)
│
└── Monitoring & Security
    ├── CloudWatch (metrics/logs)
    ├── WAF (security)
    ├── Cognito (authentication)
    └── Route 53 (DNS)
```

## Current Infrastructure Status

### Existing Resources (Account: 372241484305)
- ✅ **AWS Profile**: lunora-media configured
- ✅ **Region**: us-west-2 (Oregon)
- ✅ **MediaPackage Channel**: lunora-player-dev-channel
- ✅ **HLS Endpoint**: Active and functional
- ✅ **S3 Bucket**: lunora-media-videos-dev-372241484305
- ✅ **Backend API**: Real AWS data integration
- ⚠️ **MediaLive Channel**: Needs SRT input configuration
- ⚠️ **Domain/SSL**: Needs production setup
- ⚠️ **Production Environment**: Needs deployment

## Deployment Options

### Option 1: Serverless (Recommended)

**Pros:**
- Auto-scaling
- Pay-per-use
- No server management
- High availability built-in

**Cons:**
- Cold start latency
- AWS vendor lock-in
- Function timeout limits

**Cost:** ~$50-200/month for moderate usage

### Option 2: Container-based (ECS/EKS)

**Pros:**
- More control
- Better for complex applications
- Easier local development parity
- Multi-cloud portability

**Cons:**
- More management overhead
- Higher baseline costs
- Need container expertise

**Cost:** ~$200-500/month minimum

### Option 3: Traditional EC2

**Pros:**
- Full control
- Familiar deployment model
- Easy migration from local

**Cons:**
- Manual scaling
- Server management
- Higher operational overhead

**Cost:** ~$100-300/month + management time

## Recommended Production Architecture

### Frontend Deployment
```yaml
# S3 + CloudFront for each app
Resources:
  PlayerBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: lunora-player-prod
      WebsiteConfiguration:
        IndexDocument: index.html
  
  DashboardBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: lunora-dashboard-prod
      WebsiteConfiguration:
        IndexDocument: dashboard.html
  
  VideonTestBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: lunora-videon-test-prod
      WebsiteConfiguration:
        IndexDocument: videon-test.html
  
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - Id: PlayerOrigin
            DomainName: !GetAtt PlayerBucket.DomainName
            CustomOriginConfig:
              HTTPPort: 80
              OriginProtocolPolicy: http-only
        DefaultCacheBehavior:
          TargetOriginId: PlayerOrigin
          ViewerProtocolPolicy: redirect-to-https
        Aliases:
          - player.yourdomain.com
```

### Backend API (Lambda)
```yaml
# API Gateway + Lambda functions
Resources:
  ApiGateway:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: lunora-player-api
      EndpointConfiguration:
        Types: [REGIONAL]
  
  HealthFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: lunora-health-check
      Runtime: nodejs18.x
      Handler: health.handler
      Code:
        ZipFile: |
          exports.handler = async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString()
              })
            };
          };
  
  VideonTestFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: lunora-videon-test
      Runtime: nodejs18.x
      Handler: videon.handler
      Environment:
        Variables:
          AWS_ACCOUNT_ID: !Ref AWS::AccountId
          REGION: !Ref AWS::Region
```

## Domain and SSL Setup

### Custom Domain Configuration
```bash
# Route 53 hosted zone
Domain: yourdomain.com
├── player.yourdomain.com (Player app)
├── dashboard.yourdomain.com (Dashboard)
├── api.yourdomain.com (Backend API)
└── videon.yourdomain.com (Videon testing)

# SSL Certificates (ACM)
- *.yourdomain.com (wildcard certificate)
- Automatic renewal
- CloudFront integration
```

## Environment Configuration

### Production Environment Variables
```bash
# Backend Lambda environment
NODE_ENV=production
AWS_REGION=us-west-2
CORS_ORIGIN=https://player.yourdomain.com
LOG_LEVEL=info
MEDIAPACKAGE_CHANNEL=lunora-player-prod-channel

# Frontend build-time variables
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENVIRONMENT=production
REACT_APP_MEDIAPACKAGE_ENDPOINT=https://your-prod-endpoint.mediapackage.us-west-2.amazonaws.com
```

## Security Considerations

### Production Security
- WAF rules for DDoS protection
- API rate limiting
- CORS configuration
- Authentication (Cognito)
- VPC endpoints for internal communication
- Secrets Manager for sensitive data
- CloudTrail for audit logging

### Access Control
```yaml
# IAM roles and policies
LambdaExecutionRole:
  Policies:
    - MediaPackageReadOnly
    - MediaLiveReadOnly
    - S3ReadOnly
    - CloudWatchLogs
    - XRayTracing
```

## Monitoring and Alerting

### CloudWatch Setup
- Custom metrics for video streaming
- Log aggregation from all services
- Alarms for error rates and latency
- Dashboard for operational metrics

### Third-party Options
- DataDog for advanced monitoring
- New Relic for APM
- Sentry for error tracking

## CI/CD Pipeline

### Deployment Pipeline
```yaml
# GitHub Actions workflow
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and deploy to S3
        run: |
          npm run build
          aws s3 sync dist/ s3://lunora-player-prod
          aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
  
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Lambda functions
        run: |
          npm run build:lambda
          aws lambda update-function-code --function-name lunora-health-check --zip-file fileb://dist/health.zip
```

## Cost Optimization

### Production Cost Estimates
```
Monthly costs (moderate usage):
├── CloudFront: $20-50
├── Lambda: $10-30
├── API Gateway: $5-15
├── S3 Storage: $5-20
├── MediaPackage: $50-200 (usage-based)
├── MediaLive: $0-500 (when running)
├── Route 53: $1-5
└── Monitoring: $10-30
Total: $100-850/month
```

### Optimization Strategies
- Use CloudFront caching effectively
- Implement S3 lifecycle policies
- Stop MediaLive channels when not needed
- Use Reserved Instances for predictable workloads
- Monitor and optimize Lambda memory allocation

## Backup and Disaster Recovery

### Backup Strategy
- S3 cross-region replication
- Lambda function versioning
- Infrastructure as Code (CloudFormation)
- Database backups (if using RDS)
- Configuration backup in Git

### Disaster Recovery
- Multi-AZ deployment
- Auto-scaling groups
- Health checks and auto-recovery
- Runbook for manual recovery procedures

## Migration from Local to Production

### Step-by-Step Migration
1. Set up AWS infrastructure (CloudFormation)
2. Deploy backend API (Lambda functions)
3. Build and deploy frontend apps (S3 + CloudFront)
4. Configure custom domains and SSL
5. Set up monitoring and alerting
6. Test end-to-end functionality
7. Configure CI/CD pipeline
8. Go live with DNS cutover

### Testing Strategy
- Staging environment that mirrors production
- Load testing with realistic traffic
- Security testing and penetration testing
- Performance testing and optimization
- User acceptance testing
