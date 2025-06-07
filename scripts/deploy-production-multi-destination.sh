#!/bin/bash

# Lunora Player - Production Multi-Destination Streaming Deployment
# This script deploys the complete multi-destination streaming system to AWS production

set -e

# Configuration
PROJECT_NAME="lunora-player"
ENVIRONMENT="prod"
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
AWS_ACCOUNT_ID="372241484305"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header() {
    echo ""
    echo "=========================================="
    echo "  $1"
    echo "=========================================="
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    print_success "AWS CLI found"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js found"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm found"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE &> /dev/null; then
        print_error "AWS credentials not configured for profile: $AWS_PROFILE"
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
    if [ "$account_id" != "$AWS_ACCOUNT_ID" ]; then
        print_error "Wrong AWS account. Expected: $AWS_ACCOUNT_ID, Got: $account_id"
        exit 1
    fi
    print_success "AWS credentials verified for account: $AWS_ACCOUNT_ID"
    
    # Check if required files exist
    if [ ! -f "aws/cloudformation/multi-destination-stack.yaml" ]; then
        print_error "CloudFormation template not found: aws/cloudformation/multi-destination-stack.yaml"
        exit 1
    fi
    print_success "CloudFormation template found"
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found"
        exit 1
    fi
    print_success "package.json found"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    print_status "Installing npm dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Build Lambda function packages
build_lambda_functions() {
    print_header "Building Lambda Functions"
    
    # Create build directory
    mkdir -p dist/lambda
    
    # Create multi-destination API Lambda package
    print_status "Building multi-destination API Lambda function..."
    
    # Copy backend server code and modify for Lambda
    cp backend/server.js dist/lambda/multi-destination-api.js
    
    # Create Lambda handler wrapper
    cat > dist/lambda/index.js << 'EOF'
const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
    region: process.env.AWS_REGION || 'us-west-2'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();

// Configuration from environment variables
const CONFIG = {
    region: process.env.REGION,
    accountId: process.env.AWS_ACCOUNT_ID,
    dynamodb: {
        destinationsTable: process.env.DESTINATIONS_TABLE,
        presetsTable: process.env.PRESETS_TABLE,
        sessionsTable: process.env.SESSIONS_TABLE
    },
    parameterStore: {
        prefix: process.env.PARAMETER_STORE_PREFIX
    },
    kmsKeyId: process.env.KMS_KEY_ID
};

// Helper functions
const generateId = (prefix) => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getSecureParameter = async (parameterName) => {
    try {
        const result = await ssm.getParameter({
            Name: parameterName,
            WithDecryption: true
        }).promise();
        return result.Parameter.Value;
    } catch (error) {
        console.error(`Error getting parameter ${parameterName}:`, error.message);
        return null;
    }
};

const storeSecureParameter = async (parameterName, value, description = '') => {
    try {
        await ssm.putParameter({
            Name: parameterName,
            Value: value,
            Type: 'SecureString',
            Description: description,
            Overwrite: true,
            KeyId: CONFIG.kmsKeyId
        }).promise();
        return true;
    } catch (error) {
        console.error(`Error storing parameter ${parameterName}:`, error.message);
        return false;
    }
};

// Lambda handler
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const { httpMethod, path, pathParameters, body } = event;
    
    try {
        // Route requests based on path and method
        if (path === '/destinations' && httpMethod === 'GET') {
            return await getDestinations();
        } else if (path === '/destinations' && httpMethod === 'POST') {
            return await createDestination(JSON.parse(body || '{}'));
        } else if (path.startsWith('/destinations/') && httpMethod === 'PUT') {
            const destinationId = pathParameters.id;
            return await updateDestination(destinationId, JSON.parse(body || '{}'));
        } else if (path.startsWith('/destinations/') && httpMethod === 'DELETE') {
            const destinationId = pathParameters.id;
            return await deleteDestination(destinationId);
        } else if (path === '/presets' && httpMethod === 'GET') {
            return await getPresets();
        } else if (path === '/streaming/status' && httpMethod === 'GET') {
            return await getStreamingStatus();
        } else {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Not found' })
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// API Functions
async function getDestinations() {
    const result = await dynamodb.scan({
        TableName: CONFIG.dynamodb.destinationsTable
    }).promise();

    const destinations = result.Items.map(item => ({
        ...item,
        stream_key: item.stream_key_param ? '***ENCRYPTED***' : null
    }));

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            status: 'success',
            destinations: destinations,
            count: destinations.length
        })
    };
}

async function createDestination(data) {
    const { name, platform, rtmp_url, stream_key, preset_id, enabled = true } = data;

    if (!name || !platform) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                status: 'error',
                message: 'Name and platform are required'
            })
        };
    }

    const destination_id = generateId('dest');
    const timestamp = new Date().toISOString();

    let stream_key_param = null;
    if (stream_key) {
        stream_key_param = `${CONFIG.parameterStore.prefix}/${platform}/stream-key-${destination_id}`;
        const stored = await storeSecureParameter(
            stream_key_param, 
            stream_key, 
            `Stream key for ${name} (${platform})`
        );
        if (!stored) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    status: 'error',
                    message: 'Failed to store stream key securely'
                })
            };
        }
    }

    const destination = {
        destination_id,
        name,
        platform,
        rtmp_url: rtmp_url || null,
        stream_key_param,
        preset_id: preset_id || `preset_${platform}_default`,
        enabled,
        created_at: timestamp,
        updated_at: timestamp
    };

    await dynamodb.put({
        TableName: CONFIG.dynamodb.destinationsTable,
        Item: destination
    }).promise();

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            status: 'success',
            message: 'Destination created successfully',
            destination: {
                ...destination,
                stream_key: stream_key ? '***ENCRYPTED***' : null
            }
        })
    };
}

async function getPresets() {
    const result = await dynamodb.scan({
        TableName: CONFIG.dynamodb.presetsTable
    }).promise();

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            status: 'success',
            presets: result.Items,
            count: result.Items.length
        })
    };
}

async function getStreamingStatus() {
    // Placeholder - would integrate with MediaLive API
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            status: 'success',
            timestamp: new Date().toISOString(),
            streaming: {
                active: false,
                channels: [],
                destinations: {
                    total: 0,
                    enabled: 0,
                    list: []
                }
            }
        })
    };
}
EOF

    # Create package.json for Lambda
    cat > dist/lambda/package.json << 'EOF'
{
  "name": "lunora-multi-destination-api",
  "version": "1.0.0",
  "description": "Lambda function for multi-destination streaming API",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1400.0"
  }
}
EOF

    # Install Lambda dependencies
    cd dist/lambda
    npm install --production
    cd ../..
    
    # Create deployment package
    cd dist/lambda
    zip -r ../multi-destination-api.zip .
    cd ../..
    
    print_success "Lambda function package created: dist/multi-destination-api.zip"
}

# Deploy infrastructure
deploy_infrastructure() {
    print_header "Deploying Multi-Destination Infrastructure"
    
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-multi-destination"
    
    print_status "Deploying CloudFormation stack: $stack_name"
    
    aws cloudformation deploy \
        --template-file aws/cloudformation/multi-destination-stack.yaml \
        --stack-name $stack_name \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --capabilities CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            ProjectName=$PROJECT_NAME \
            Environment=$ENVIRONMENT
    
    print_success "Infrastructure deployed successfully"
}

# Update Lambda function code
update_lambda_functions() {
    print_header "Updating Lambda Functions"
    
    local function_name="${PROJECT_NAME}-${ENVIRONMENT}-multi-destination-api"
    
    print_status "Updating Lambda function: $function_name"
    
    aws lambda update-function-code \
        --function-name $function_name \
        --zip-file fileb://dist/multi-destination-api.zip \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
    
    print_success "Lambda function updated"
}

# Populate default presets
populate_presets() {
    print_header "Populating Default Presets"
    
    # Use the existing setup script but modify for production
    print_status "Running preset population script..."
    
    # Set environment variables for production
    export AWS_PROFILE=$AWS_PROFILE
    export AWS_SDK_LOAD_CONFIG=1
    
    # Modify the setup script to use production table names
    node -e "
    const AWS = require('aws-sdk');
    AWS.config.update({ region: '$AWS_REGION' });
    process.env.AWS_PROFILE = '$AWS_PROFILE';
    process.env.AWS_SDK_LOAD_CONFIG = '1';
    
    // Import and run the setup with production table names
    const { StreamingPresets } = require('./config/streaming-presets.js');
    const docClient = new AWS.DynamoDB.DocumentClient();
    
    const defaultPresets = [
        {
            preset_id: 'preset_youtube_hd',
            name: 'YouTube HD (1080p30)',
            platform: 'youtube',
            video_settings: {
                resolution: '1920x1080',
                framerate: 30,
                bitrate: 6000,
                codec: 'H.264',
                profile: 'High',
                keyframe_interval: 2,
                b_frames: 2
            },
            audio_settings: {
                codec: 'AAC',
                bitrate: 128,
                sample_rate: 48000,
                channels: 'stereo'
            },
            advanced_settings: {
                gop_size: 60,
                rate_control: 'CBR',
                buffer_size: 12000
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
        // Add other presets...
    ];
    
    async function populatePresets() {
        const tableName = '${PROJECT_NAME}-presets-${ENVIRONMENT}';
        console.log('Populating presets in table:', tableName);
        
        for (const preset of defaultPresets) {
            try {
                await docClient.put({
                    TableName: tableName,
                    Item: preset,
                    ConditionExpression: 'attribute_not_exists(preset_id)'
                }).promise();
                console.log('Created preset:', preset.name);
            } catch (error) {
                if (error.code === 'ConditionalCheckFailedException') {
                    console.log('Preset already exists:', preset.name);
                } else {
                    console.error('Error creating preset:', error);
                }
            }
        }
    }
    
    populatePresets().then(() => {
        console.log('Preset population completed');
    }).catch(error => {
        console.error('Error populating presets:', error);
        process.exit(1);
    });
    "
    
    print_success "Default presets populated"
}

# Main deployment function
main() {
    print_header "Lunora Player - Production Multi-Destination Deployment"
    
    print_status "Configuration:"
    print_status "  Project: $PROJECT_NAME"
    print_status "  Environment: $ENVIRONMENT"
    print_status "  Region: $AWS_REGION"
    print_status "  Profile: $AWS_PROFILE"
    print_status "  Account: $AWS_ACCOUNT_ID"
    
    # Run deployment steps
    check_prerequisites
    install_dependencies
    build_lambda_functions
    deploy_infrastructure
    update_lambda_functions
    populate_presets
    
    print_header "Deployment Complete"
    print_success "Multi-destination streaming system deployed to production!"
    
    # Get outputs
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-multi-destination"
    local api_url=$(aws cloudformation describe-stacks \
        --stack-name $stack_name \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'Stacks[0].Outputs[?OutputKey==`APIGatewayURL`].OutputValue' \
        --output text)
    
    print_status "API Gateway URL: $api_url"
    print_status "Next steps:"
    print_status "1. Update frontend configuration to use production API URL"
    print_status "2. Deploy frontend applications to S3/CloudFront"
    print_status "3. Configure custom domain and SSL certificates"
    print_status "4. Test multi-destination streaming functionality"
}

# Run main function
main "$@"
