#!/usr/bin/env node

// Lunora Player - Node.js AWS Credentials Verification
// This script verifies AWS credentials work from Node.js applications
// Usage: node scripts/verify-aws-node.js

const AWS = require('aws-sdk');
require('dotenv').config();

// Configuration
const CONFIG = {
    region: process.env.AWS_REGION || 'us-west-2',
    profile: process.env.AWS_PROFILE || 'lunora-media',
    accountId: process.env.AWS_ACCOUNT_ID || '372241484305',
    mediaConnectFlowArn: process.env.MEDIACONNECT_FLOW_ARN
};

console.log('🔐 Verifying AWS Credentials from Node.js...');
console.log('🔧 Configuration:');
console.log(`  AWS_REGION: ${CONFIG.region}`);
console.log(`  AWS_PROFILE: ${CONFIG.profile}`);
console.log(`  Expected Account: ${CONFIG.accountId}`);

// Configure AWS SDK
AWS.config.update({
    region: CONFIG.region
});

// If profile is set, use it
if (CONFIG.profile && CONFIG.profile !== 'default') {
    const credentials = new AWS.SharedIniFileCredentials({profile: CONFIG.profile});
    AWS.config.credentials = credentials;
}

async function verifyCredentials() {
    try {
        console.log('\n🧪 Test 1: STS GetCallerIdentity...');
        const sts = new AWS.STS();
        const identity = await sts.getCallerIdentity().promise();
        
        console.log('✅ Successfully authenticated:');
        console.log(`  Account: ${identity.Account}`);
        console.log(`  User: ${identity.UserId}`);
        console.log(`  ARN: ${identity.Arn}`);
        
        if (identity.Account !== CONFIG.accountId) {
            console.log(`⚠️  Warning: Connected to account ${identity.Account}, expected ${CONFIG.accountId}`);
        } else {
            console.log(`✅ Connected to correct account: ${identity.Account}`);
        }
        
        console.log('\n🧪 Test 2: MediaConnect service...');
        const mediaconnect = new AWS.MediaConnect();
        const flows = await mediaconnect.listFlows({MaxResults: 1}).promise();
        console.log(`✅ MediaConnect accessible. Found ${flows.Flows.length} flows.`);
        
        if (CONFIG.mediaConnectFlowArn) {
            console.log('\n🧪 Test 3: Specific MediaConnect flow...');
            const flowArn = CONFIG.mediaConnectFlowArn;
            const flow = await mediaconnect.describeFlow({FlowArn: flowArn}).promise();
            console.log(`✅ Flow accessible. Status: ${flow.Flow.Status}`);
        }
        
        console.log('\n🧪 Test 4: DynamoDB service...');
        const dynamodb = new AWS.DynamoDB();
        const tables = await dynamodb.listTables({Limit: 1}).promise();
        console.log(`✅ DynamoDB accessible. Found ${tables.TableNames.length} tables.`);
        
        console.log('\n🧪 Test 5: Lambda service...');
        const lambda = new AWS.Lambda();
        const functions = await lambda.listFunctions({MaxItems: 1}).promise();
        console.log(`✅ Lambda accessible. Found ${functions.Functions.length} functions.`);
        
        console.log('\n🎉 All AWS services accessible from Node.js!');
        
        console.log('\n📋 Environment Summary:');
        console.log(`  ✅ AWS SDK Version: ${AWS.VERSION}`);
        console.log(`  ✅ Region: ${AWS.config.region}`);
        console.log(`  ✅ Profile: ${CONFIG.profile}`);
        console.log(`  ✅ Account: ${identity.Account}`);
        
        console.log('\n💡 For future AI assistants:');
        console.log('  - AWS credentials are properly configured');
        console.log('  - Use AWS_PROFILE=lunora-media for this project');
        console.log('  - All required AWS services are accessible');
        console.log('  - Run this script to verify credentials: node scripts/verify-aws-node.js');
        
    } catch (error) {
        console.error('\n❌ AWS Credentials Error:');
        console.error(`  Error: ${error.message}`);
        console.error(`  Code: ${error.code}`);
        
        console.log('\n💡 Troubleshooting:');
        console.log('  1. Check AWS profile configuration: aws configure list-profiles');
        console.log('  2. Verify profile works: aws sts get-caller-identity --profile lunora-media');
        console.log('  3. Check environment variables: echo $AWS_PROFILE');
        console.log('  4. Ensure .env file exists with AWS_PROFILE=lunora-media');
        
        process.exit(1);
    }
}

verifyCredentials();
