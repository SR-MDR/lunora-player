// Lunora Player - Lambda Handler for Multi-Destination Streaming API
const AWS = require('aws-sdk');

// AWS Configuration
AWS.config.update({
    region: 'us-west-2'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
const medialive = new AWS.MediaLive();
const mediaconnect = new AWS.MediaConnect();

// Configuration
const CONFIG = {
    region: 'us-west-2',
    accountId: process.env.AWS_ACCOUNT_ID || '372241484305',
    dynamodb: {
        destinationsTable: process.env.DESTINATIONS_TABLE || 'lunora-destinations',
        presetsTable: process.env.PRESETS_TABLE || 'lunora-presets',
        sessionsTable: process.env.SESSIONS_TABLE || 'lunora-streaming-sessions',
        sourcesTable: process.env.SOURCES_TABLE || 'lunora-sources'
    },
    parameterStore: {
        prefix: process.env.PARAMETER_STORE_PREFIX || '/lunora-player/streaming'
    },
    medialive: {
        channelId: process.env.MEDIALIVE_CHANNEL_ID || '3714710',
        region: process.env.MEDIALIVE_REGION || 'us-west-2'
    },
    mediaconnect: {
        flowArn: process.env.MEDIACONNECT_FLOW_ARN || null
    }
};

// Helper function to create response (CORS handled by function URL)
const createResponse = (statusCode, body) => ({
    statusCode,
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

// Helper function to get stream key from Parameter Store
const getStreamKey = async (streamKeyParam) => {
    if (!streamKeyParam) {
        throw new Error('No stream key parameter provided');
    }

    try {
        const result = await ssm.getParameter({
            Name: streamKeyParam,
            WithDecryption: true
        }).promise();

        return result.Parameter.Value;
    } catch (error) {
        console.error('Failed to retrieve stream key:', error);
        throw new Error('Failed to retrieve stream key from Parameter Store');
    }
};

// Helper function to get MediaLive channel details
const getMediaLiveChannel = async () => {
    try {
        const result = await medialive.describeChannel({
            ChannelId: CONFIG.medialive.channelId
        }).promise();

        return result;
    } catch (error) {
        console.error('Failed to get MediaLive channel:', error);
        throw new Error('Failed to get MediaLive channel details');
    }
};

// Helper function to count active streaming destinations
const getActiveDestinationsCount = async () => {
    try {
        const result = await dynamodb.scan({
            TableName: CONFIG.dynamodb.destinationsTable,
            FilterExpression: 'streaming_status = :status',
            ExpressionAttributeValues: {
                ':status': 'streaming'
            }
        }).promise();

        return result.Items.length;
    } catch (error) {
        console.error('Failed to count active destinations:', error);
        return 0;
    }
};

// Helper function to wait for MediaLive channel to reach a specific state
const waitForChannelState = async (targetState, timeoutSeconds = 60) => {
    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeout) {
        try {
            const channel = await getMediaLiveChannel();
            console.log(`Current channel state: ${channel.State}, waiting for: ${targetState}`);

            if (channel.State === targetState) {
                console.log(`Channel reached target state: ${targetState}`);
                return channel;
            }

            // Wait 5 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error('Error checking channel state:', error);
            throw error;
        }
    }

    throw new Error(`Timeout waiting for channel to reach state: ${targetState}`);
};

// ===== MEDIACONNECT INTEGRATION FUNCTIONS =====

// Get MediaConnect flow details
const getMediaConnectFlow = async () => {
    try {
        if (!CONFIG.mediaconnect.flowArn) {
            throw new Error('MediaConnect Flow ARN not configured');
        }

        const result = await mediaconnect.describeFlow({
            FlowArn: CONFIG.mediaconnect.flowArn
        }).promise();

        return result.Flow;
    } catch (error) {
        console.error('Failed to get MediaConnect flow:', error);
        throw new Error('Failed to get MediaConnect flow details');
    }
};

// Add RTMP output to MediaConnect flow
const addMediaConnectOutput = async (destination) => {
    try {
        if (!CONFIG.mediaconnect.flowArn) {
            throw new Error('MediaConnect Flow ARN not configured');
        }

        // Get stream key from Parameter Store
        let streamKey = '';
        if (destination.stream_key_param) {
            streamKey = await getStreamKey(destination.stream_key_param);
        }

        if (!destination.rtmp_url) {
            throw new Error('RTMP URL is required for MediaConnect output');
        }

        // Construct full RTMP URL with stream key
        const fullRtmpUrl = streamKey ?
            `${destination.rtmp_url}/${streamKey}` :
            destination.rtmp_url;

        const outputName = `rtmp-${destination.destination_id}`;

        const addOutputParams = {
            FlowArn: CONFIG.mediaconnect.flowArn,
            Outputs: [{
                Name: outputName,
                Description: `RTMP output for ${destination.name} (${destination.platform})`,
                Protocol: 'rtmp',
                Destination: fullRtmpUrl,
                Port: 1935,
                MaxLatency: 2000,
                SmoothingLatency: 0
            }]
        };

        console.log(`Adding MediaConnect output for destination: ${destination.name}`);
        const result = await mediaconnect.addFlowOutputs(addOutputParams).promise();

        const outputArn = result.Outputs[0].OutputArn;
        console.log(`MediaConnect output created with ARN: ${outputArn}`);

        return outputArn;
    } catch (error) {
        console.error('Failed to add MediaConnect output:', error);
        throw new Error(`Failed to add MediaConnect output: ${error.message}`);
    }
};

// Remove RTMP output from MediaConnect flow
const removeMediaConnectOutput = async (outputArn) => {
    try {
        if (!CONFIG.mediaconnect.flowArn) {
            throw new Error('MediaConnect Flow ARN not configured');
        }

        const removeParams = {
            FlowArn: CONFIG.mediaconnect.flowArn,
            OutputArn: outputArn
        };

        console.log(`Removing MediaConnect output: ${outputArn}`);
        await mediaconnect.removeFlowOutput(removeParams).promise();
        console.log('MediaConnect output removed successfully');

        return true;
    } catch (error) {
        console.error('Failed to remove MediaConnect output:', error);
        throw new Error(`Failed to remove MediaConnect output: ${error.message}`);
    }
};

// Update MediaConnect output
const updateMediaConnectOutput = async (outputArn, destination) => {
    try {
        if (!CONFIG.mediaconnect.flowArn) {
            throw new Error('MediaConnect Flow ARN not configured');
        }

        // Get stream key from Parameter Store
        let streamKey = '';
        if (destination.stream_key_param) {
            streamKey = await getStreamKey(destination.stream_key_param);
        }

        // Construct full RTMP URL with stream key
        const fullRtmpUrl = streamKey ?
            `${destination.rtmp_url}/${streamKey}` :
            destination.rtmp_url;

        const updateParams = {
            FlowArn: CONFIG.mediaconnect.flowArn,
            OutputArn: outputArn,
            Description: `RTMP output for ${destination.name} (${destination.platform})`,
            Destination: fullRtmpUrl,
            MaxLatency: 2000,
            SmoothingLatency: 0
        };

        console.log(`Updating MediaConnect output: ${outputArn}`);
        await mediaconnect.updateFlowOutput(updateParams).promise();
        console.log('MediaConnect output updated successfully');

        return true;
    } catch (error) {
        console.error('Failed to update MediaConnect output:', error);
        throw new Error(`Failed to update MediaConnect output: ${error.message}`);
    }
};

// List all MediaConnect outputs
const listMediaConnectOutputs = async () => {
    try {
        if (!CONFIG.mediaconnect.flowArn) {
            return [];
        }

        const flow = await getMediaConnectFlow();
        return flow.Outputs || [];
    } catch (error) {
        console.error('Failed to list MediaConnect outputs:', error);
        return [];
    }
};

// Synchronize MediaConnect status with database
const syncMediaConnectStatus = async () => {
    try {
        if (!CONFIG.mediaconnect.flowArn) {
            console.log('MediaConnect not configured, skipping sync');
            return;
        }

        const outputs = await listMediaConnectOutputs();
        const outputMap = new Map();

        outputs.forEach(output => {
            // Extract destination ID from output name (format: rtmp-{destination_id})
            const match = output.Name.match(/^rtmp-(.+)$/);
            if (match) {
                outputMap.set(match[1], output);
            }
        });

        // Get all destinations from database
        const result = await dynamodb.scan({
            TableName: CONFIG.dynamodb.destinationsTable
        }).promise();

        // Update destinations with MediaConnect status
        for (const destination of result.Items) {
            const mediaConnectOutput = outputMap.get(destination.destination_id);

            if (mediaConnectOutput && destination.streaming_status !== 'streaming') {
                // MediaConnect output exists but database shows not streaming
                await dynamodb.update({
                    TableName: CONFIG.dynamodb.destinationsTable,
                    Key: { destination_id: destination.destination_id },
                    UpdateExpression: 'SET streaming_status = :status, mediaconnect_output_arn = :arn',
                    ExpressionAttributeValues: {
                        ':status': 'streaming',
                        ':arn': mediaConnectOutput.OutputArn
                    }
                }).promise();
            } else if (!mediaConnectOutput && destination.streaming_status === 'streaming' && destination.mediaconnect_output_arn) {
                // Database shows streaming but no MediaConnect output exists
                await dynamodb.update({
                    TableName: CONFIG.dynamodb.destinationsTable,
                    Key: { destination_id: destination.destination_id },
                    UpdateExpression: 'SET streaming_status = :status REMOVE mediaconnect_output_arn',
                    ExpressionAttributeValues: {
                        ':status': 'ready'
                    }
                }).promise();
            }
        }

        console.log('MediaConnect status synchronization completed');
    } catch (error) {
        console.error('Failed to sync MediaConnect status:', error);
    }
};

// ===== SOURCE MANAGEMENT FUNCTIONS =====

// Get all sources
const getSources = async () => {
    try {
        const result = await dynamodb.scan({
            TableName: CONFIG.dynamodb.sourcesTable
        }).promise();

        return createResponse(200, {
            status: 'success',
            sources: result.Items,
            count: result.Items.length
        });
    } catch (error) {
        return handleError(error, 'Failed to fetch sources');
    }
};

// Create new source
const createSource = async (body) => {
    try {
        const {
            name,
            type,
            input_url,
            backup_url,
            description,
            enabled = true,
            failover_enabled = false
        } = JSON.parse(body);

        if (!name || !type || !input_url) {
            return createResponse(400, {
                status: 'error',
                message: 'Name, type, and input_url are required'
            });
        }

        const source_id = `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();

        const source = {
            source_id,
            name,
            type, // 'srt', 'rtmp', 'rtp', 'udp'
            input_url,
            backup_url: backup_url || null,
            description: description || '',
            enabled,
            failover_enabled,
            status: 'ready', // 'ready', 'active', 'error', 'testing'
            health_status: 'unknown', // 'healthy', 'degraded', 'unhealthy', 'unknown'
            created_at: timestamp,
            updated_at: timestamp,
            last_tested_at: null,
            connection_attempts: 0,
            last_error: null
        };

        await dynamodb.put({
            TableName: CONFIG.dynamodb.sourcesTable,
            Item: source
        }).promise();

        return createResponse(200, {
            status: 'success',
            message: 'Source created successfully',
            source: source
        });
    } catch (error) {
        return handleError(error, 'Failed to create source');
    }
};

// Update source
const updateSource = async (sourceId, body) => {
    try {
        const {
            name,
            type,
            input_url,
            backup_url,
            description,
            enabled,
            failover_enabled
        } = JSON.parse(body);

        // Get existing source
        const existing = await dynamodb.get({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId }
        }).promise();

        if (!existing.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Source not found'
            });
        }

        const timestamp = new Date().toISOString();
        const updates = {
            updated_at: timestamp
        };

        // Update fields if provided
        if (name !== undefined) updates.name = name;
        if (type !== undefined) updates.type = type;
        if (input_url !== undefined) updates.input_url = input_url;
        if (backup_url !== undefined) updates.backup_url = backup_url;
        if (description !== undefined) updates.description = description;
        if (enabled !== undefined) updates.enabled = enabled;
        if (failover_enabled !== undefined) updates.failover_enabled = failover_enabled;

        // Update source in DynamoDB
        const updateExpression = 'SET ' + Object.keys(updates).map(key => `#${key} = :${key}`).join(', ');
        const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
            acc[`#${key}`] = key;
            return acc;
        }, {});
        const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
            acc[`:${key}`] = updates[key];
            return acc;
        }, {});

        await dynamodb.update({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }).promise();

        // Get updated source
        const updated = await dynamodb.get({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId }
        }).promise();

        return createResponse(200, {
            status: 'success',
            message: 'Source updated successfully',
            source: updated.Item
        });
    } catch (error) {
        return handleError(error, 'Failed to update source');
    }
};

// Delete source
const deleteSource = async (sourceId) => {
    try {
        // Get existing source
        const existing = await dynamodb.get({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId }
        }).promise();

        if (!existing.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Source not found'
            });
        }

        // Check if source is currently active
        if (existing.Item.status === 'active') {
            return createResponse(400, {
                status: 'error',
                message: 'Cannot delete active source. Please stop the source first.'
            });
        }

        // Delete source from DynamoDB
        await dynamodb.delete({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId }
        }).promise();

        return createResponse(200, {
            status: 'success',
            message: 'Source deleted successfully'
        });
    } catch (error) {
        return handleError(error, 'Failed to delete source');
    }
};

// Test source connection
const testSourceConnection = async (sourceId) => {
    try {
        // Get source details
        const result = await dynamodb.get({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId }
        }).promise();

        if (!result.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Source not found'
            });
        }

        const source = result.Item;
        const timestamp = new Date().toISOString();

        // Update test timestamp and increment attempts
        await dynamodb.update({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId },
            UpdateExpression: 'SET last_tested_at = :timestamp, connection_attempts = connection_attempts + :inc',
            ExpressionAttributeValues: {
                ':timestamp': timestamp,
                ':inc': 1
            }
        }).promise();

        // Simulate connection test (in real implementation, this would test the actual connection)
        const testResult = {
            success: true,
            latency: Math.floor(Math.random() * 50) + 10, // Simulated latency 10-60ms
            bandwidth: Math.floor(Math.random() * 10000) + 5000, // Simulated bandwidth 5-15 Mbps
            packet_loss: Math.random() * 0.1, // Simulated packet loss 0-0.1%
            tested_at: timestamp
        };

        // Update health status based on test results
        const healthStatus = testResult.success ?
            (testResult.packet_loss < 0.05 ? 'healthy' : 'degraded') :
            'unhealthy';

        await dynamodb.update({
            TableName: CONFIG.dynamodb.sourcesTable,
            Key: { source_id: sourceId },
            UpdateExpression: 'SET health_status = :health, last_error = :error',
            ExpressionAttributeValues: {
                ':health': healthStatus,
                ':error': testResult.success ? null : 'Connection test failed'
            }
        }).promise();

        return createResponse(200, {
            status: 'success',
            message: 'Source connection test completed',
            source_id: sourceId,
            test_result: testResult,
            health_status: healthStatus
        });
    } catch (error) {
        return handleError(error, 'Failed to test source connection');
    }
};

// Get all destinations
const getDestinations = async () => {
    try {
        // Synchronize database status with actual MediaLive state first
        await synchronizeDestinationStatus();

        const result = await dynamodb.scan({
            TableName: CONFIG.dynamodb.destinationsTable
        }).promise();

        // Don't include actual stream keys in the response for security
        const destinations = result.Items.map(item => ({
            ...item,
            stream_key: item.stream_key_param ? '***ENCRYPTED***' : null,
            streaming_status: item.streaming_status || 'ready' // Default to 'ready' if not set
        }));

        return createResponse(200, {
            status: 'success',
            destinations: destinations,
            count: destinations.length
        });
    } catch (error) {
        return handleError(error, 'Failed to fetch destinations');
    }
};

// Create new destination
const createDestination = async (body) => {
    try {
        const { name, platform, rtmp_url, stream_key, preset_id, enabled = true } = JSON.parse(body);

        if (!name || !platform) {
            return createResponse(400, {
                status: 'error',
                message: 'Name and platform are required'
            });
        }

        const destination_id = `dest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();

        // Store stream key in Parameter Store if provided
        let stream_key_param = null;
        if (stream_key) {
            stream_key_param = `${CONFIG.parameterStore.prefix}/destinations/${destination_id}/stream_key`;
            await ssm.putParameter({
                Name: stream_key_param,
                Value: stream_key,
                Type: 'SecureString',
                Description: `Stream key for destination ${name}`,
                Overwrite: true
            }).promise();
        }

        const destination = {
            destination_id,
            name,
            platform,
            rtmp_url: rtmp_url || null,
            stream_key_param,
            preset_id: preset_id || `preset_${platform}_default`,
            enabled,
            streaming_status: 'ready', // Initialize as ready
            created_at: timestamp,
            updated_at: timestamp
        };

        await dynamodb.put({
            TableName: CONFIG.dynamodb.destinationsTable,
            Item: destination
        }).promise();

        // Return destination without sensitive data
        const responseDestination = {
            ...destination,
            stream_key: stream_key ? '***ENCRYPTED***' : null
        };
        delete responseDestination.stream_key_param;

        return createResponse(200, {
            status: 'success',
            message: 'Destination created successfully',
            destination: responseDestination
        });
    } catch (error) {
        return handleError(error, 'Failed to create destination');
    }
};

// Update destination
const updateDestination = async (destinationId, body) => {
    try {
        const { name, platform, rtmp_url, stream_key, preset_id, enabled } = JSON.parse(body);

        // Get existing destination
        const existing = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        }).promise();

        if (!existing.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Destination not found'
            });
        }

        const timestamp = new Date().toISOString();
        const updates = {
            updated_at: timestamp
        };

        // Update fields if provided
        if (name !== undefined) updates.name = name;
        if (platform !== undefined) updates.platform = platform;
        if (rtmp_url !== undefined) updates.rtmp_url = rtmp_url;
        if (preset_id !== undefined) updates.preset_id = preset_id;
        if (enabled !== undefined) updates.enabled = enabled;

        // Handle stream key update
        if (stream_key !== undefined) {
            if (stream_key) {
                // Update or create stream key in Parameter Store
                const stream_key_param = existing.Item.stream_key_param || 
                    `${CONFIG.parameterStore.prefix}/destinations/${destinationId}/stream_key`;
                
                await ssm.putParameter({
                    Name: stream_key_param,
                    Value: stream_key,
                    Type: 'SecureString',
                    Description: `Stream key for destination ${name || existing.Item.name}`,
                    Overwrite: true
                }).promise();

                updates.stream_key_param = stream_key_param;
            } else {
                // Remove stream key
                if (existing.Item.stream_key_param) {
                    try {
                        await ssm.deleteParameter({
                            Name: existing.Item.stream_key_param
                        }).promise();
                    } catch (e) {
                        console.warn('Failed to delete parameter:', e.message);
                    }
                }
                updates.stream_key_param = null;
            }
        }

        // Update destination in DynamoDB
        const updateExpression = 'SET ' + Object.keys(updates).map(key => `#${key} = :${key}`).join(', ');
        const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
            acc[`#${key}`] = key;
            return acc;
        }, {});
        const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
            acc[`:${key}`] = updates[key];
            return acc;
        }, {});

        await dynamodb.update({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }).promise();

        // Get updated destination
        const updated = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        }).promise();

        // Return destination without sensitive data
        const responseDestination = {
            ...updated.Item,
            stream_key: updated.Item.stream_key_param ? '***ENCRYPTED***' : null
        };
        delete responseDestination.stream_key_param;

        return createResponse(200, {
            status: 'success',
            message: 'Destination updated successfully',
            destination: responseDestination
        });
    } catch (error) {
        return handleError(error, 'Failed to update destination');
    }
};

// Delete destination
const deleteDestination = async (destinationId) => {
    try {
        // Get existing destination
        const existing = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        }).promise();

        if (!existing.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Destination not found'
            });
        }

        // Delete stream key from Parameter Store if it exists
        if (existing.Item.stream_key_param) {
            try {
                await ssm.deleteParameter({
                    Name: existing.Item.stream_key_param
                }).promise();
            } catch (e) {
                console.warn('Failed to delete parameter:', e.message);
            }
        }

        // Delete destination from DynamoDB
        await dynamodb.delete({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        }).promise();

        return createResponse(200, {
            status: 'success',
            message: 'Destination deleted successfully'
        });
    } catch (error) {
        return handleError(error, 'Failed to delete destination');
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
        // Get MediaLive channels
        const channels = await medialive.listChannels().promise();
        const activeChannels = channels.Channels.filter(ch => ch.State === 'RUNNING');

        // Get all destinations from DynamoDB
        const destinationsResult = await dynamodb.scan({
            TableName: CONFIG.dynamodb.destinationsTable
        }).promise();

        const streamingDestinations = destinationsResult.Items.filter(d => d.streaming_status === 'streaming');

        return createResponse(200, {
            status: 'success',
            timestamp: new Date().toISOString(),
            streaming: {
                active: activeChannels.length > 0,
                channels: activeChannels,
                destinations: {
                    total: destinationsResult.Items.length,
                    enabled: destinationsResult.Items.filter(d => d.enabled).length,
                    streaming: streamingDestinations.length,
                    list: destinationsResult.Items.map(d => ({
                        id: d.destination_id,
                        name: d.name,
                        platform: d.platform,
                        enabled: d.enabled,
                        streaming_status: d.streaming_status || 'ready',
                        streaming_started_at: d.streaming_started_at || null
                    }))
                }
            }
        });
    } catch (error) {
        return handleError(error, 'Failed to get streaming status');
    }
};

// Start streaming to a destination
const startDestination = async (destinationId) => {
    try {
        console.log(`Starting destination: ${destinationId}`);

        // Get destination details from DynamoDB
        const getParams = {
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        };

        const result = await dynamodb.get(getParams).promise();

        if (!result.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Destination not found'
            });
        }

        const destination = result.Item;

        if (!destination.enabled) {
            return createResponse(400, {
                status: 'error',
                message: 'Destination is not enabled'
            });
        }

        // Check if destination is already streaming
        if (destination.streaming_status === 'streaming') {
            return createResponse(400, {
                status: 'error',
                message: 'Destination is already streaming'
            });
        }

        // Handle HLS destinations (no MediaLive integration needed)
        if (destination.platform === 'hls') {
            const updateParams = {
                TableName: CONFIG.dynamodb.destinationsTable,
                Key: { destination_id: destinationId },
                UpdateExpression: 'SET streaming_status = :status, streaming_started_at = :timestamp',
                ExpressionAttributeValues: {
                    ':status': 'streaming',
                    ':timestamp': new Date().toISOString()
                }
            };

            await dynamodb.update(updateParams).promise();

            return createResponse(200, {
                status: 'success',
                message: `Started HLS streaming to ${destination.name}`,
                destination_id: destinationId,
                destination_name: destination.name,
                platform: destination.platform,
                streaming_status: 'streaming'
            });
        }

        // For RTMP destinations, integrate with MediaConnect
        if (destination.platform === 'youtube' || destination.platform === 'custom') {
            return await startMediaConnectDestination(destinationId, destination);
        }

        return createResponse(400, {
            status: 'error',
            message: `Unsupported platform: ${destination.platform}`
        });

    } catch (error) {
        return handleError(error, 'Failed to start destination');
    }
};

// Start RTMP destination with MediaConnect integration
const startMediaConnectDestination = async (destinationId, destination) => {
    try {
        console.log(`Starting MediaConnect RTMP destination: ${destination.name} (${destination.platform})`);

        if (!destination.rtmp_url) {
            throw new Error('RTMP URL is required for RTMP destinations');
        }

        // Ensure MediaLive channel is running first
        const channel = await getMediaLiveChannel();
        console.log(`Current MediaLive channel state: ${channel.State}`);

        if (channel.State === 'IDLE') {
            console.log('Starting MediaLive channel for MediaConnect flow...');
            await medialive.startChannel({
                ChannelId: CONFIG.medialive.channelId
            }).promise();

            // Wait for channel to be running
            await waitForChannelState('RUNNING', 120);
            console.log('MediaLive channel is now running');
        }

        // Add RTMP output to MediaConnect flow
        console.log(`Adding MediaConnect output for destination: ${destination.name}`);
        const outputArn = await addMediaConnectOutput(destination);

        // Update destination status in database
        const updateParams = {
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET streaming_status = :status, streaming_started_at = :timestamp, mediaconnect_output_arn = :outputArn, updated_at = :updated',
            ExpressionAttributeValues: {
                ':status': 'streaming',
                ':timestamp': new Date().toISOString(),
                ':outputArn': outputArn,
                ':updated': new Date().toISOString()
            }
        };

        await dynamodb.update(updateParams).promise();

        console.log(`Successfully started MediaConnect streaming to ${destination.platform} destination: ${destination.name}`);
        console.log(`MediaConnect output ARN: ${outputArn}`);

        return createResponse(200, {
            status: 'success',
            message: `Started streaming to ${destination.name}`,
            destination_id: destinationId,
            destination_name: destination.name,
            platform: destination.platform,
            streaming_status: 'streaming',
            mediaconnect_output_arn: outputArn,
            note: 'Using MediaConnect for granular RTMP destination control'
        });

    } catch (error) {
        console.error('Failed to start MediaConnect destination:', error);

        // Try to update status to error in database
        try {
            await dynamodb.update({
                TableName: CONFIG.dynamodb.destinationsTable,
                Key: { destination_id: destinationId },
                UpdateExpression: 'SET streaming_status = :status, updated_at = :timestamp, last_error = :error',
                ExpressionAttributeValues: {
                    ':status': 'error',
                    ':timestamp': new Date().toISOString(),
                    ':error': error.message
                }
            }).promise();
        } catch (dbError) {
            console.error('Failed to update error status in database:', dbError);
        }

        throw error;
    }
};

// Stop streaming to a destination
const stopDestination = async (destinationId) => {
    try {
        console.log(`Stopping destination: ${destinationId}`);

        // Get destination details from DynamoDB
        const getParams = {
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        };

        const result = await dynamodb.get(getParams).promise();

        if (!result.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Destination not found'
            });
        }

        const destination = result.Item;

        // Check if destination is actually streaming
        if (destination.streaming_status !== 'streaming') {
            return createResponse(400, {
                status: 'error',
                message: 'Destination is not currently streaming'
            });
        }

        // Handle HLS destinations (no MediaLive integration needed)
        if (destination.platform === 'hls') {
            const updateParams = {
                TableName: CONFIG.dynamodb.destinationsTable,
                Key: { destination_id: destinationId },
                UpdateExpression: 'SET streaming_status = :status, updated_at = :timestamp REMOVE streaming_started_at',
                ExpressionAttributeValues: {
                    ':status': 'ready',
                    ':timestamp': new Date().toISOString()
                }
            };

            await dynamodb.update(updateParams).promise();

            return createResponse(200, {
                status: 'success',
                message: `Stopped HLS streaming to ${destination.name}`,
                destination_id: destinationId,
                destination_name: destination.name,
                platform: destination.platform,
                streaming_status: 'ready'
            });
        }

        // For RTMP destinations, integrate with MediaConnect
        if (destination.platform === 'youtube' || destination.platform === 'custom') {
            return await stopMediaConnectDestination(destinationId, destination);
        }

        return createResponse(400, {
            status: 'error',
            message: `Unsupported platform: ${destination.platform}`
        });

    } catch (error) {
        return handleError(error, 'Failed to stop destination');
    }
};

// Stop RTMP destination with MediaConnect integration
const stopMediaConnectDestination = async (destinationId, destination) => {
    try {
        console.log(`Stopping MediaConnect RTMP destination: ${destination.name} (${destination.platform})`);

        // Check if destination has MediaConnect output ARN
        if (!destination.mediaconnect_output_arn) {
            console.warn(`No MediaConnect output ARN found for destination: ${destination.name}`);
        } else {
            // Remove RTMP output from MediaConnect flow
            console.log(`Removing MediaConnect output: ${destination.mediaconnect_output_arn}`);
            await removeMediaConnectOutput(destination.mediaconnect_output_arn);
        }

        // Update destination status in DynamoDB
        const updateParams = {
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET streaming_status = :status, updated_at = :timestamp REMOVE streaming_started_at, mediaconnect_output_arn, last_error',
            ExpressionAttributeValues: {
                ':status': 'ready',
                ':timestamp': new Date().toISOString()
            }
        };

        await dynamodb.update(updateParams).promise();

        console.log(`Successfully stopped MediaConnect streaming to ${destination.platform} destination: ${destination.name}`);

        return createResponse(200, {
            status: 'success',
            message: `Stopped streaming to ${destination.name}`,
            destination_id: destinationId,
            destination_name: destination.name,
            platform: destination.platform,
            streaming_status: 'ready',
            note: 'MediaConnect output removed - other destinations continue streaming independently'
        });

    } catch (error) {
        console.error('Failed to stop MediaConnect destination:', error);

        // Try to update status to error in database
        try {
            await dynamodb.update({
                TableName: CONFIG.dynamodb.destinationsTable,
                Key: { destination_id: destinationId },
                UpdateExpression: 'SET streaming_status = :status, updated_at = :timestamp, last_error = :error',
                ExpressionAttributeValues: {
                    ':status': 'error',
                    ':timestamp': new Date().toISOString(),
                    ':error': error.message
                }
            }).promise();
        } catch (dbError) {
            console.error('Failed to update error status in database:', dbError);
        }

        throw error;
    }
};

// Synchronize database status with actual MediaConnect and MediaLive state
const synchronizeDestinationStatus = async () => {
    try {
        console.log('Synchronizing destination status with MediaConnect and MediaLive...');

        // Sync MediaConnect status first
        await syncMediaConnectStatus();

        // Get current MediaLive channel configuration for HLS destinations
        const channel = await getMediaLiveChannel();
        const isChannelRunning = channel.State === 'RUNNING';

        // Get all destinations from database
        const destinationsResult = await dynamodb.scan({
            TableName: CONFIG.dynamodb.destinationsTable
        }).promise();

        const destinations = destinationsResult.Items || [];
        const hlsDestinations = destinations.filter(d => d.platform === 'hls');

        console.log(`Channel state: ${channel.State}, HLS destinations: ${hlsDestinations.length}`);

        // Update database status for HLS destinations based on MediaLive channel state
        for (const destination of hlsDestinations) {
            const currentStatus = destination.streaming_status || 'ready';

            if (isChannelRunning && currentStatus !== 'streaming') {
                // Update to streaming
                console.log(`Updating ${destination.name} status to streaming (MediaLive channel running)`);
                await dynamodb.update({
                    TableName: CONFIG.dynamodb.destinationsTable,
                    Key: { destination_id: destination.destination_id },
                    UpdateExpression: 'SET streaming_status = :status, streaming_started_at = :timestamp, updated_at = :updated',
                    ExpressionAttributeValues: {
                        ':status': 'streaming',
                        ':timestamp': new Date().toISOString(),
                        ':updated': new Date().toISOString()
                    }
                }).promise();
            } else if (!isChannelRunning && currentStatus === 'streaming') {
                // Update to ready
                console.log(`Updating ${destination.name} status to ready (MediaLive channel not running)`);
                await dynamodb.update({
                    TableName: CONFIG.dynamodb.destinationsTable,
                    Key: { destination_id: destination.destination_id },
                    UpdateExpression: 'SET streaming_status = :status, updated_at = :updated REMOVE streaming_started_at',
                    ExpressionAttributeValues: {
                        ':status': 'ready',
                        ':updated': new Date().toISOString()
                    }
                }).promise();
            }
        }

        console.log('Destination status synchronization completed');
        return true;
    } catch (error) {
        console.error('Failed to synchronize destination status:', error);
        return false;
    }
};

// Get MediaLive channel status
const getMediaLiveChannelStatus = async () => {
    try {
        console.log('Getting MediaLive channel status...');

        // Synchronize database status with actual MediaLive state first
        await synchronizeDestinationStatus();

        // Get current MediaLive channel configuration and state
        const channel = await getMediaLiveChannel();

        // Get active destinations count for context
        const activeDestinationsCount = await getActiveDestinationsCount();

        // Get output groups information
        const outputGroups = channel.EncoderSettings.OutputGroups.map(group => ({
            name: group.Name,
            type: group.OutputGroupSettings.MediaPackageGroupSettings ? 'MediaPackage' :
                  group.OutputGroupSettings.RtmpGroupSettings ? 'RTMP' : 'Other',
            outputs_count: group.Outputs ? group.Outputs.length : 0
        }));

        // Get destinations information
        const destinations = channel.Destinations.map(dest => ({
            id: dest.Id,
            settings_count: dest.Settings ? dest.Settings.length : 0
        }));

        const response = {
            status: 'success',
            channel: {
                id: CONFIG.medialive.channelId,
                name: channel.Name,
                state: channel.State,
                channel_class: channel.ChannelClass,
                input_specification: {
                    codec: channel.InputSpecification.Codec,
                    resolution: channel.InputSpecification.Resolution,
                    max_bitrate: channel.InputSpecification.MaximumBitrate
                },
                input_attachments_count: channel.InputAttachments ? channel.InputAttachments.length : 0,
                output_groups: outputGroups,
                destinations: destinations,
                active_destinations_count: activeDestinationsCount,
                last_updated: new Date().toISOString()
            }
        };

        console.log(`MediaLive channel status: ${channel.State}, Active destinations: ${activeDestinationsCount}`);

        return createResponse(200, response);

    } catch (error) {
        console.error('Failed to get MediaLive channel status:', error);
        return createResponse(500, {
            status: 'error',
            message: 'Failed to get MediaLive channel status',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Main Lambda handler
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    // Handle different event structures (direct invocation vs function URL)
    let httpMethod, path, pathParameters, body, headers;

    if (event.requestContext && event.requestContext.http) {
        // Function URL event structure
        httpMethod = event.requestContext.http.method;
        path = event.requestContext.http.path;
        pathParameters = event.pathParameters;
        body = event.body;
        headers = event.headers;
    } else {
        // Direct invocation event structure
        httpMethod = event.httpMethod;
        path = event.path;
        pathParameters = event.pathParameters;
        body = event.body;
        headers = event.headers;
    }

    // CORS preflight requests are handled by Function URL

    try {
        
        // Route requests
        if (path === '/api/destinations' && httpMethod === 'GET') {
            return await getDestinations();
        }
        
        if (path === '/api/destinations' && httpMethod === 'POST') {
            return await createDestination(body);
        }
        
        if (path.startsWith('/api/destinations/') && httpMethod === 'PUT') {
            const destinationId = pathParameters?.id || path.split('/').pop();
            return await updateDestination(destinationId, body);
        }
        
        if (path.startsWith('/api/destinations/') && httpMethod === 'DELETE') {
            const destinationId = pathParameters?.id || path.split('/').pop();
            return await deleteDestination(destinationId);
        }
        
        if (path === '/api/presets' && httpMethod === 'GET') {
            return await getPresets();
        }
        
        if (path === '/api/streaming/status' && httpMethod === 'GET') {
            return await getStreamingStatus();
        }

        if (path === '/api/health' && httpMethod === 'GET') {
            return createResponse(200, {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'lunora-multi-destination-api',
                version: '1.0.0'
            });
        }

        if (path === '/api/medialive/status' && httpMethod === 'GET') {
            return await getMediaLiveChannelStatus();
        }

        // Source management endpoints
        if (path === '/api/sources' && httpMethod === 'GET') {
            return await getSources();
        }

        if (path === '/api/sources' && httpMethod === 'POST') {
            return await createSource(body);
        }

        if (path.startsWith('/api/sources/') && httpMethod === 'PUT') {
            const sourceId = pathParameters?.id || path.split('/').pop();
            return await updateSource(sourceId, body);
        }

        if (path.startsWith('/api/sources/') && httpMethod === 'DELETE') {
            const sourceId = pathParameters?.id || path.split('/').pop();
            return await deleteSource(sourceId);
        }

        if (path.match(/^\/api\/sources\/[^\/]+\/test$/) && httpMethod === 'POST') {
            const sourceId = path.split('/')[3];
            return await testSourceConnection(sourceId);
        }

        // Destination control endpoints
        if (path.match(/^\/api\/destinations\/[^\/]+\/start$/) && httpMethod === 'POST') {
            const destinationId = path.split('/')[3];
            return await startDestination(destinationId);
        }

        if (path.match(/^\/api\/destinations\/[^\/]+\/stop$/) && httpMethod === 'POST') {
            const destinationId = path.split('/')[3];
            return await stopDestination(destinationId);
        }

        // Default response for unmatched routes
        return createResponse(404, {
            status: 'error',
            message: 'Endpoint not found',
            path,
            method: httpMethod
        });

    } catch (error) {
        return handleError(error, 'Request processing failed');
    }
};
