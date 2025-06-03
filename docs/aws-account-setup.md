# AWS Account Setup for Lunora Media Services

This guide helps you configure AWS CLI to work with your **Lunora-Media-Services** account (372241484305) in the Oregon region.

## Account Information
- **Account Name**: Lunora-Media-Services
- **Account ID**: 372241484305
- **Target Region**: us-west-2 (Oregon)
- **Organization**: Lunora Solutions

## Option 1: Direct Account Access (Recommended)

If you have direct access to the Lunora-Media-Services account:

### 1. Configure AWS CLI Profile
```bash
aws configure --profile lunora-media
```

Enter the following when prompted:
- **AWS Access Key ID**: [Your access key for account 372241484305]
- **AWS Secret Access Key**: [Your secret key for account 372241484305]
- **Default region name**: `us-west-2`
- **Default output format**: `json`

### 2. Set Environment Variable
```bash
export AWS_PROFILE=lunora-media
```

### 3. Verify Configuration
```bash
aws sts get-caller-identity --profile lunora-media
```

Expected output:
```json
{
    "UserId": "...",
    "Account": "372241484305",
    "Arn": "arn:aws:iam::372241484305:user/your-username"
}
```

### 4. Deploy Infrastructure
```bash
# Use the profile for deployment
AWS_PROFILE=lunora-media ./scripts/deploy-aws.sh deploy
```

## Option 2: Cross-Account Role (If using different account)

If you're accessing from a different account in the organization:

### 1. Create Cross-Account Role (One-time setup)
In the Lunora-Media-Services account, create a role with these permissions:
- CloudFormationFullAccess
- AmazonS3FullAccess
- ElementalMediaLiveFullAccess
- ElementalMediaPackageFullAccess
- CloudFrontFullAccess
- IAMFullAccess (for creating service roles)

### 2. Configure Role Assumption
```bash
# Configure your base profile first
aws configure --profile base-account

# Create a role profile
cat >> ~/.aws/config << EOF
[profile lunora-media]
role_arn = arn:aws:iam::372241484305:role/LunoraMediaServicesRole
source_profile = base-account
region = us-west-2
EOF
```

### 3. Assume Role and Deploy
```bash
AWS_PROFILE=lunora-media ./scripts/deploy-aws.sh deploy
```

## Option 3: AWS SSO (If configured)

If your organization uses AWS SSO:

### 1. Configure SSO Profile
```bash
aws configure sso --profile lunora-media
```

Follow the prompts:
- **SSO start URL**: [Your organization's SSO URL]
- **SSO region**: us-west-2
- **Account ID**: 372241484305
- **Role name**: [Your assigned role]
- **CLI default client region**: us-west-2
- **CLI default output format**: json

### 2. Login and Deploy
```bash
aws sso login --profile lunora-media
AWS_PROFILE=lunora-media ./scripts/deploy-aws.sh deploy
```

## Verification Steps

### 1. Check Account Access
```bash
aws sts get-caller-identity --profile lunora-media
```

### 2. Check Region
```bash
aws configure get region --profile lunora-media
```

### 3. Test Media Services Access
```bash
# Test MediaLive access
aws medialive list-channels --region us-west-2 --profile lunora-media

# Test MediaPackage access
aws mediapackage list-channels --region us-west-2 --profile lunora-media

# Test S3 access
aws s3 ls --profile lunora-media
```

## Deployment Commands

Once configured, use these commands for deployment:

### Deploy Infrastructure
```bash
# Set the profile
export AWS_PROFILE=lunora-media

# Validate template
./scripts/deploy-aws.sh validate

# Deploy stack
./scripts/deploy-aws.sh deploy

# Start MediaLive channel (incurs charges)
./scripts/deploy-aws.sh start-channel
```

### Alternative: One-time Profile Usage
```bash
AWS_PROFILE=lunora-media ./scripts/deploy-aws.sh deploy
```

## Expected Resources Created

The deployment will create these resources in account 372241484305:

### S3 Resources
- **Bucket**: `lunora-media-videos-dev-372241484305`
- **Bucket Policy**: CloudFront access only

### CloudFront Resources
- **Distribution**: Global CDN for video delivery
- **Origin Access Control**: Secure S3 access

### MediaLive Resources
- **Input**: SRT input for Videon Edge nodes
- **Channel**: Live encoding channel
- **Input Security Group**: Network access control

### MediaPackage Resources
- **Channel**: HLS packaging channel
- **Origin Endpoint**: HLS delivery endpoint

### IAM Resources
- **MediaLive Role**: Service role for MediaLive operations

## Cost Considerations

### Ongoing Costs (when active)
- **MediaLive Channel**: ~$2.50/hour when running
- **MediaPackage**: ~$0.065/GB processed
- **CloudFront**: ~$0.085/GB transferred
- **S3**: ~$0.023/GB stored

### Cost Optimization
1. **Stop MediaLive channels** when not streaming
2. **Use lifecycle policies** for S3 content
3. **Monitor usage** with AWS Cost Explorer
4. **Set billing alerts** for unexpected charges

## Troubleshooting

### Access Denied Errors
1. Verify account ID: 372241484305
2. Check IAM permissions
3. Confirm region: us-west-2
4. Test with: `aws sts get-caller-identity`

### Profile Issues
```bash
# List configured profiles
aws configure list-profiles

# Check specific profile
aws configure list --profile lunora-media

# Reset profile if needed
aws configure --profile lunora-media
```

### Region Issues
```bash
# Check current region
aws configure get region --profile lunora-media

# Set region if needed
aws configure set region us-west-2 --profile lunora-media
```

## Security Best Practices

### 1. Access Keys
- Use temporary credentials when possible
- Rotate access keys regularly
- Never commit keys to version control

### 2. Permissions
- Use least privilege principle
- Create specific roles for different functions
- Monitor access with CloudTrail

### 3. Network Security
- Restrict MediaLive input security groups in production
- Use VPC endpoints for internal traffic
- Enable CloudFront security headers

## Next Steps

After successful AWS configuration:

1. **Test the deployment script**:
   ```bash
   AWS_PROFILE=lunora-media ./scripts/deploy-aws.sh validate
   ```

2. **Deploy the infrastructure**:
   ```bash
   AWS_PROFILE=lunora-media ./scripts/deploy-aws.sh deploy
   ```

3. **Configure your Videon Edge nodes** with the SRT endpoint

4. **Test end-to-end streaming** with the player

5. **Set up monitoring and alerting** for production use

## Support

If you encounter issues:
1. Check the AWS CloudFormation console for stack events
2. Review CloudWatch logs for MediaLive/MediaPackage
3. Verify network connectivity for SRT inputs
4. Contact AWS Support for service-specific issues
