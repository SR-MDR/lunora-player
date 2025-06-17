# AWS Credentials Setup for Lunora Player

This document provides comprehensive information about AWS credentials configuration for the Lunora Player project to prevent credential-related issues in future development sessions.

## 🔧 Current Configuration

### AWS Account Details
- **Account ID**: 372241484305 (Lunora Media Services)
- **Region**: us-west-2 (Oregon)
- **Organization Master Account**: 937643917608
- **Cross-Account Role**: OrganizationAccountAccessRole

### AWS Profile Configuration
The project uses the `lunora-media` AWS profile configured in `~/.aws/config`:

```ini
[profile lunora-media]
role_arn = arn:aws:iam::372241484305:role/OrganizationAccountAccessRole
source_profile = lunora-management
region = us-west-2
output = json
```

## 🚀 Quick Verification

### For AI Assistants
If you encounter AWS credential issues, run these commands to verify setup:

```bash
# Quick verification
npm run verify-aws

# Detailed CLI verification  
npm run verify-aws-cli

# Manual verification
aws sts get-caller-identity --profile lunora-media
```

### Expected Output
```json
{
    "UserId": "AROAVNK2SJII7UJS4BGRN:session-name",
    "Account": "372241484305",
    "Arn": "arn:aws:sts::372241484305:assumed-role/OrganizationAccountAccessRole/session-name"
}
```

## 📁 Project Files

### Environment Configuration
- **`.env`**: Contains AWS_PROFILE=lunora-media and other settings
- **`.env.example`**: Template with correct AWS configuration
- **`config/aws-config.js`**: Application-specific AWS settings

### Verification Scripts
- **`scripts/verify-aws-credentials.sh`**: Bash script for comprehensive AWS CLI testing
- **`scripts/verify-aws-node.js`**: Node.js script for SDK verification
- **`npm run verify-aws`**: Quick Node.js verification
- **`npm run verify-aws-cli`**: Comprehensive CLI verification

## 🔐 How It Works

### Local Development
When running `npm start`, the following environment is set:
```bash
AWS_PROFILE=lunora-media
AWS_SDK_LOAD_CONFIG=1
```

### Lambda Deployment
The deployment script uses:
```bash
aws lambda update-function-code --profile lunora-media
```

### Runtime Authentication
- **Local**: Uses AWS profile with cross-account role assumption
- **Lambda**: Uses attached IAM execution role (no local credentials needed)

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. "Unable to locate credentials"
```bash
# Check profile exists
aws configure list-profiles

# Verify profile works
aws sts get-caller-identity --profile lunora-media

# Check environment variables
echo $AWS_PROFILE
```

#### 2. "Access Denied" errors
```bash
# Verify account access
aws sts get-caller-identity --profile lunora-media

# Check service permissions
aws mediaconnect list-flows --profile lunora-media --max-results 1
```

#### 3. Node.js SDK issues
```bash
# Verify Node.js can access AWS
npm run verify-aws

# Check environment loading
node -e "require('dotenv').config(); console.log(process.env.AWS_PROFILE)"
```

### Environment Variables Checklist
Ensure these are set in your `.env` file:
```bash
AWS_REGION=us-west-2
AWS_PROFILE=lunora-media
AWS_SDK_LOAD_CONFIG=1
AWS_ACCOUNT_ID=372241484305
```

## 📋 For Future AI Assistants

### Before Making AWS Calls
1. **Always verify credentials first**: Run `npm run verify-aws`
2. **Check environment**: Ensure `AWS_PROFILE=lunora-media` is set
3. **Use correct region**: All resources are in `us-west-2`
4. **Account verification**: Confirm account ID is `372241484305`

### Common Commands
```bash
# Verify credentials
npm run verify-aws

# Test specific service
aws mediaconnect describe-flow --flow-arn "arn:aws:mediaconnect:us-west-2:372241484305:flow:1-DgdVCAEFAAsHBgVS-e049c6465752:lunora-player-prod-srt-router" --profile lunora-media

# Deploy backend
./scripts/deploy-backend.sh

# Start development
npm start
```

### Key Resources
- **MediaConnect Flow**: `arn:aws:mediaconnect:us-west-2:372241484305:flow:1-DgdVCAEFAAsHBgVS-e049c6465752:lunora-player-prod-srt-router`
- **Lambda Function**: `lunora-player-prod-dynamic-streaming-api`
- **Backend URL**: `https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws`

## 🔄 Maintenance

### Regular Checks
- Verify credentials monthly: `npm run verify-aws`
- Update AWS SDK versions as needed
- Monitor for AWS profile changes
- Test deployment pipeline regularly

### Security Notes
- Never commit AWS credentials to git
- Use IAM roles for production deployments
- Regularly rotate access keys
- Monitor CloudTrail for unusual activity

---

**Last Updated**: 2025-06-17  
**Verified Working**: ✅ All services accessible  
**Next Review**: 2025-07-17
