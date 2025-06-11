// Enhanced Lambda Handler with Dynamic Destination Management
const AWS = require('aws-sdk');
const DynamicDestinationManager = require('./dynamic-destination-manager');

// AWS Configuration
AWS.config.update({
    region: 'us-west-2'
});

// Initialize services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
const mediaConnect = new AWS.MediaConnect();

// Initialize dynamic destination manager
const destinationManager = new DynamicDestinationManager();

// Configuration
const CONFIG = {
    region: 'us-west-2',
    accountId: process.env.AWS_ACCOUNT_ID || '372241484305',
    mediaConnectFlowArn: process.env.MEDIACONNECT_FLOW_ARN,
    dynamodb: {
        destinationsTable: process.env.DESTINATIONS_TABLE || 'lunora-destinations',
        presetsTable: process.env.PRESETS_TABLE || 'lunora-presets',
        sessionsTable: process.env.SESSIONS_TABLE || 'lunora-streaming-sessions'
    },
    parameterStore: {
        prefix: process.env.PARAMETER_STORE_PREFIX || '/lunora-player/streaming'
    }
};

// Helper function to create response
const createResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
});

// Helper function to handle errors
const handleError = (error, message = 'Internal server error') => {
    console.error('Error:', error);
    return createResponse(500, {
        status: 'error',
        message,
        error: error.message
    });
};

// Main Lambda handler
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        const { httpMethod, path, pathParameters, body } = event;
        const destinationId = pathParameters?.destinationId;

        // Handle CORS preflight requests
        if (httpMethod === 'OPTIONS') {
            return createResponse(200, { message: 'CORS preflight' });
        }

        // Route requests to appropriate handlers
        switch (httpMethod) {
            case 'GET':
                if (path === '/api/destinations') {
                    return await listDestinations();
                } else if (path === '/api/destinations/status') {
                    return await getStreamingStatus();
                } else if (path === '/api/presets') {
                    return await getPresets();
                } else if (path === '/api/mediaconnect/flow/status') {
                    return await getMediaConnectFlowStatus();
                } else if (destinationId && path.includes('/metrics')) {
                    return await getDestinationMetrics(destinationId);
                }
                break;

            case 'POST':
                if (path === '/api/destinations') {
                    return await createDestination(body);
                } else if (destinationId && path.includes('/start')) {
                    return await startDestination(destinationId);
                } else if (destinationId && path.includes('/stop')) {
                    return await stopDestination(destinationId);
                }
                break;

            case 'PUT':
                if (destinationId) {
                    return await updateDestination(destinationId, body);
                }
                break;

            case 'DELETE':
                if (destinationId) {
                    return await deleteDestination(destinationId);
                }
                break;
        }

        return createResponse(404, {
            status: 'error',
            message: 'Endpoint not found'
        });

    } catch (error) {
        return handleError(error, 'Request processing failed');
    }
};

// List all destinations with real-time status
const listDestinations = async () => {
    try {
        const result = await destinationManager.listDestinations();
        
        return createResponse(200, {
            status: 'success',
            destinations: result.destinations,
            count: result.count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleError(error, 'Failed to list destinations');
    }
};

// Create new dynamic destination
const createDestination = async (body) => {
    try {
        const { name, platform, rtmp_url, stream_key, preset } = JSON.parse(body);

        // Validate required fields
        if (!name || !platform) {
            return createResponse(400, {
                status: 'error',
                message: 'Name and platform are required'
            });
        }

        // For RTMP platforms, validate RTMP URL and stream key
        if (['youtube', 'twitch', 'linkedin', 'custom'].includes(platform)) {
            if (!rtmp_url || !stream_key) {
                return createResponse(400, {
                    status: 'error',
                    message: 'RTMP URL and stream key are required for RTMP platforms'
                });
            }
        }

        // Store stream key securely in Parameter Store
        let secureStreamKey = null;
        if (stream_key) {
            const paramName = `${CONFIG.parameterStore.prefix}/destinations/temp_${Date.now()}/stream_key`;
            await ssm.putParameter({
                Name: paramName,
                Value: stream_key,
                Type: 'SecureString',
                Description: `Temporary stream key for destination ${name}`,
                Overwrite: true
            }).promise();
            secureStreamKey = paramName;
        }

        // Create dynamic destination
        const result = await destinationManager.createDestination({
            name,
            platform,
            rtmpUrl: rtmp_url,
            streamKey: stream_key,
            preset: preset || platform
        });

        // Clean up temporary parameter
        if (secureStreamKey) {
            try {
                await ssm.deleteParameter({ Name: secureStreamKey }).promise();
            } catch (e) {
                console.warn('Failed to delete temporary parameter:', e.message);
            }
        }

        return createResponse(200, {
            status: 'success',
            message: 'Dynamic destination created successfully',
            destination_id: result.destination_id,
            destination: {
                ...result.destination,
                stream_key: stream_key ? '***ENCRYPTED***' : null
            },
            resources: result.resources
        });

    } catch (error) {
        return handleError(error, 'Failed to create dynamic destination');
    }
};

// Start destination streaming
const startDestination = async (destinationId) => {
    try {
        const result = await destinationManager.startDestination(destinationId);
        
        return createResponse(200, {
            status: 'success',
            message: result.message,
            destination_id: result.destination_id,
            streaming_status: result.status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleError(error, 'Failed to start destination');
    }
};

// Stop destination streaming
const stopDestination = async (destinationId) => {
    try {
        const result = await destinationManager.stopDestination(destinationId);
        
        return createResponse(200, {
            status: 'success',
            message: result.message,
            destination_id: result.destination_id,
            streaming_status: result.status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleError(error, 'Failed to stop destination');
    }
};

// Delete destination and cleanup resources
const deleteDestination = async (destinationId) => {
    try {
        const result = await destinationManager.removeDestination(destinationId);
        
        return createResponse(200, {
            status: 'success',
            message: result.message,
            destination_id: result.destination_id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleError(error, 'Failed to delete destination');
    }
};

// Update destination (limited updates for dynamic destinations)
const updateDestination = async (destinationId, body) => {
    try {
        const { name, enabled } = JSON.parse(body);
        
        // For dynamic destinations, only allow name and enabled status updates
        const updates = {
            updated_at: new Date().toISOString()
        };
        
        if (name !== undefined) updates.name = name;
        if (enabled !== undefined) updates.enabled = enabled;
        
        const params = {
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET ' + Object.keys(updates).map(key => `#${key} = :${key}`).join(', '),
            ExpressionAttributeNames: Object.keys(updates).reduce((acc, key) => {
                acc[`#${key}`] = key;
                return acc;
            }, {}),
            ExpressionAttributeValues: Object.keys(updates).reduce((acc, key) => {
                acc[`:${key}`] = updates[key];
                return acc;
            }, {}),
            ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamodb.update(params).promise();
        
        return createResponse(200, {
            status: 'success',
            message: 'Destination updated successfully',
            destination: result.Attributes
        });
    } catch (error) {
        return handleError(error, 'Failed to update destination');
    }
};

// Get MediaConnect flow status
const getMediaConnectFlowStatus = async () => {
    try {
        if (!CONFIG.mediaConnectFlowArn) {
            return createResponse(400, {
                status: 'error',
                message: 'MediaConnect flow ARN not configured'
            });
        }

        const result = await mediaConnect.describeFlow({
            FlowArn: CONFIG.mediaConnectFlowArn
        }).promise();

        return createResponse(200, {
            status: 'success',
            flow: {
                name: result.Flow.Name,
                status: result.Flow.Status,
                description: result.Flow.Description,
                source: {
                    name: result.Flow.Source.Name,
                    ingest_ip: result.Flow.Source.IngestIp,
                    ingest_port: result.Flow.Source.IngestPort,
                    protocol: result.Flow.Source.Transport.Protocol
                },
                outputs: result.Flow.Outputs.map(output => ({
                    name: output.Name,
                    description: output.Description,
                    destination: output.Destination,
                    port: output.Port
                }))
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleError(error, 'Failed to get MediaConnect flow status');
    }
};

// Get presets
const getPresets = async () => {
    try {
        const result = await dynamodb.scan({
            TableName: CONFIG.dynamodb.presetsTable
        }).promise();

        return createResponse(200, {
            status: 'success',
            presets: result.Items,
            count: result.Items.length
        });
    } catch (error) {
        return handleError(error, 'Failed to fetch presets');
    }
};

// Get streaming status
const getStreamingStatus = async () => {
    try {
        const destinations = await destinationManager.listDestinations();
        const activeDestinations = destinations.destinations.filter(d => d.real_time_status === 'RUNNING');
        
        return createResponse(200, {
            status: 'success',
            timestamp: new Date().toISOString(),
            streaming: {
                active: activeDestinations.length > 0,
                total_destinations: destinations.count,
                active_destinations: activeDestinations.length,
                destinations: destinations.destinations.map(d => ({
                    id: d.destination_id,
                    name: d.name,
                    platform: d.platform,
                    status: d.status,
                    real_time_status: d.real_time_status,
                    channel_id: d.media_live_channel_id
                }))
            }
        });
    } catch (error) {
        return handleError(error, 'Failed to get streaming status');
    }
};

// Get destination metrics
const getDestinationMetrics = async (destinationId) => {
    try {
        // Placeholder for metrics - would integrate with CloudWatch
        return createResponse(200, {
            status: 'success',
            destination_id: destinationId,
            metrics: {
                uptime: '00:00:00',
                bitrate: 0,
                fps: 0,
                errors: 0
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleError(error, 'Failed to get destination metrics');
    }
};
