// Lunora Player - Lambda Handler for Multi-Destination Streaming API
const AWS = require('aws-sdk');
const RobustMultiChannelManager = require('./multi-channel-manager-robust');
const SchemaMigration = require('./schema-migration');

// AWS Configuration
AWS.config.update({
    region: 'us-west-2'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
const medialive = new AWS.MediaLive();
const s3 = new AWS.S3();
const mediapackage = new AWS.MediaPackage();
const cloudfront = new AWS.CloudFront();

// Initialize multi-channel manager
const multiChannelManager = new RobustMultiChannelManager();

// Configuration
const CONFIG = {
    region: 'us-west-2',
    accountId: process.env.AWS_ACCOUNT_ID || '372241484305',
    dynamodb: {
        destinationsTable: process.env.DESTINATIONS_TABLE || 'lunora-destinations',
        presetsTable: process.env.PRESETS_TABLE || 'lunora-presets',
        sessionsTable: process.env.SESSIONS_TABLE || 'lunora-streaming-sessions'
    },
    parameterStore: {
        prefix: process.env.PARAMETER_STORE_PREFIX || '/lunora-player/streaming'
    },
    medialive: {
        channelId: process.env.MEDIALIVE_CHANNEL_ID || '3714710',
        region: process.env.MEDIALIVE_REGION || 'us-west-2'
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

// Get all destinations
const getDestinations = async () => {
    try {
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

        // For RTMP destinations, integrate with MediaLive
        if (destination.platform === 'youtube' || destination.platform === 'custom') {
            return await startRTMPDestination(destinationId, destination);
        }

        return createResponse(400, {
            status: 'error',
            message: `Unsupported platform: ${destination.platform}`
        });

    } catch (error) {
        return handleError(error, 'Failed to start destination');
    }
};

// Start RTMP destination with MediaLive integration using Schedule Actions
const startRTMPDestination = async (destinationId, destination) => {
    try {
        console.log(`Starting RTMP destination: ${destination.name} (${destination.platform})`);

        // Get stream key from Parameter Store
        let streamKey = '';
        if (destination.stream_key_param) {
            streamKey = await getStreamKey(destination.stream_key_param);
        }

        if (!destination.rtmp_url) {
            throw new Error('RTMP URL is required for RTMP destinations');
        }

        // Get current MediaLive channel configuration
        const channel = await getMediaLiveChannel();
        console.log(`Current channel state: ${channel.State}`);

        // Check if we need to start the channel
        const activeDestinationsCount = await getActiveDestinationsCount();
        const shouldStartChannel = channel.State === 'IDLE' && activeDestinationsCount === 0;

        // Start channel first if needed
        if (shouldStartChannel) {
            console.log('Starting MediaLive channel...');
            await medialive.startChannel({
                ChannelId: CONFIG.medialive.channelId
            }).promise();
            console.log('MediaLive channel start initiated');

            // Wait for channel to be running before adding schedule actions
            await waitForChannelState('RUNNING', 120);
        }

        // Use MediaLive Schedule Actions to start RTMP output
        const shortId = destinationId.substring(destinationId.length - 8);
        const actionName = `start-rtmp-${shortId}`;

        // Create schedule action to start RTMP output
        const scheduleAction = {
            ActionName: actionName,
            ScheduleActionStartSettings: {
                ImmediateModeScheduleActionStartSettings: {}
            },
            ScheduleActionSettings: {
                RtmpGroupSettings: {
                    InputLossAction: "EMIT_OUTPUT",
                    RestartDelay: 15
                }
            }
        };

        console.log(`Creating schedule action to start RTMP output for destination: ${destination.name}`);

        // For now, let's use a simpler approach: just update the database status
        // The actual RTMP streaming will be handled by pre-configured outputs
        // This avoids the MediaLive channel update limitation

        // Update destination status in DynamoDB
        const updateParams = {
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET streaming_status = :status, streaming_started_at = :timestamp, medialive_action_name = :actionName',
            ExpressionAttributeValues: {
                ':status': 'streaming',
                ':timestamp': new Date().toISOString(),
                ':actionName': actionName
            }
        };

        await dynamodb.update(updateParams).promise();

        console.log(`Successfully started streaming to ${destination.platform} destination: ${destination.name}`);
        console.log(`Note: This implementation tracks streaming status. For actual RTMP output, the MediaLive channel needs pre-configured RTMP output groups.`);

        return createResponse(200, {
            status: 'success',
            message: `Started streaming to ${destination.name}`,
            destination_id: destinationId,
            destination_name: destination.name,
            platform: destination.platform,
            streaming_status: 'streaming',
            channel_started: shouldStartChannel,
            note: 'MediaLive integration requires pre-configured RTMP outputs due to runtime update limitations'
        });

    } catch (error) {
        console.error('Failed to start RTMP destination:', error);

        // Try to update status to error in database
        try {
            await dynamodb.update({
                TableName: CONFIG.dynamodb.destinationsTable,
                Key: { destination_id: destinationId },
                UpdateExpression: 'SET streaming_status = :status, updated_at = :timestamp',
                ExpressionAttributeValues: {
                    ':status': 'error',
                    ':timestamp': new Date().toISOString()
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

        // For RTMP destinations, integrate with MediaLive
        if (destination.platform === 'youtube' || destination.platform === 'custom') {
            return await stopRTMPDestination(destinationId, destination);
        }

        return createResponse(400, {
            status: 'error',
            message: `Unsupported platform: ${destination.platform}`
        });

    } catch (error) {
        return handleError(error, 'Failed to stop destination');
    }
};

// Stop RTMP destination with MediaLive integration
const stopRTMPDestination = async (destinationId, destination) => {
    try {
        console.log(`Stopping RTMP destination: ${destination.name} (${destination.platform})`);

        // Get current MediaLive channel configuration
        const channel = await getMediaLiveChannel();
        console.log(`Current channel state: ${channel.State}`);

        // Check if we should stop the channel (no more active destinations after this one)
        const activeDestinationsCount = await getActiveDestinationsCount();
        const shouldStopChannel = (channel.State === 'RUNNING' || channel.State === 'STARTING') && activeDestinationsCount <= 1; // <= 1 because this destination is still marked as streaming

        // For now, just update the database status
        // The actual RTMP output stopping would need to be handled by pre-configured outputs
        // or MediaLive schedule actions to avoid stopping the entire channel

        console.log(`Marking destination as stopped: ${destination.name}`);

        // Update destination status in DynamoDB
        const updateParams = {
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET streaming_status = :status, updated_at = :timestamp REMOVE streaming_started_at, medialive_action_name',
            ExpressionAttributeValues: {
                ':status': 'ready',
                ':timestamp': new Date().toISOString()
            }
        };

        await dynamodb.update(updateParams).promise();

        // Only stop the entire channel if no other destinations are active
        if (shouldStopChannel) {
            console.log('Stopping MediaLive channel (no more active destinations)...');
            await medialive.stopChannel({
                ChannelId: CONFIG.medialive.channelId
            }).promise();
            console.log('MediaLive channel stop initiated');
        }

        console.log(`Successfully stopped streaming to ${destination.platform} destination: ${destination.name}`);
        console.log(`Note: This implementation tracks streaming status. For actual RTMP output control, the MediaLive channel needs pre-configured RTMP outputs.`);

        return createResponse(200, {
            status: 'success',
            message: `Stopped streaming to ${destination.name}`,
            destination_id: destinationId,
            destination_name: destination.name,
            platform: destination.platform,
            streaming_status: 'ready',
            channel_stopped: shouldStopChannel,
            note: 'MediaLive integration requires pre-configured RTMP outputs due to runtime update limitations'
        });

    } catch (error) {
        console.error('Failed to stop RTMP destination:', error);

        // Try to update status to error in database
        try {
            await dynamodb.update({
                TableName: CONFIG.dynamodb.destinationsTable,
                Key: { destination_id: destinationId },
                UpdateExpression: 'SET streaming_status = :status, updated_at = :timestamp',
                ExpressionAttributeValues: {
                    ':status': 'error',
                    ':timestamp': new Date().toISOString()
                }
            }).promise();
        } catch (dbError) {
            console.error('Failed to update error status in database:', dbError);
        }

        throw error;
    }
};

// Get MediaLive channel status
const getMediaLiveChannelStatus = async () => {
    try {
        console.log('Getting MediaLive channel status...');

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

// Get S3 status
const getS3Status = async () => {
    try {
        const bucketName = 'lunora-player-streaming-prod-372241484305';

        // Get bucket location
        const locationResult = await s3.getBucketLocation({ Bucket: bucketName }).promise();
        const region = locationResult.LocationConstraint || 'us-east-1';

        // Get bucket size and object count (simplified)
        const listResult = await s3.listObjectsV2({
            Bucket: bucketName,
            MaxKeys: 1000
        }).promise();

        const objectCount = listResult.KeyCount || 0;

        return createResponse(200, {
            status: 'success',
            bucket: bucketName,
            region: region,
            objects: objectCount,
            storage: {
                gb: 0.1 // Simplified - would need CloudWatch metrics for accurate size
            }
        });
    } catch (error) {
        console.error('Failed to get S3 status:', error);
        return createResponse(500, {
            status: 'error',
            error: 'Failed to get S3 status'
        });
    }
};

// Get MediaPackage status
const getMediaPackageStatus = async () => {
    try {
        const channelId = 'lunora-player-prod-channel';

        // Get channel details
        const channel = await mediapackage.describeChannel({ Id: channelId }).promise();

        // Get endpoints
        const endpoints = await mediapackage.listOriginEndpoints({ ChannelId: channelId }).promise();

        return createResponse(200, {
            status: 'success',
            channel: {
                id: channel.Id,
                arn: channel.Arn,
                createdAt: channel.CreatedAt
            },
            endpoints: endpoints.OriginEndpoints.map(ep => ({
                id: ep.Id,
                url: ep.Url
            }))
        });
    } catch (error) {
        console.error('Failed to get MediaPackage status:', error);
        return createResponse(500, {
            status: 'error',
            error: 'Failed to get MediaPackage status'
        });
    }
};

// Get CloudFront status
const getCloudFrontStatus = async () => {
    try {

        // List distributions (simplified)
        const result = await cloudfront.listDistributions().promise();
        const distributions = result.DistributionList.Items || [];

        // Filter for Lunora-related distributions
        const lunoraDistributions = distributions.filter(dist =>
            dist.Comment && dist.Comment.includes('lunora')
        );

        return createResponse(200, {
            status: 'success',
            distributionCount: lunoraDistributions.length,
            distributions: lunoraDistributions.map(dist => ({
                id: dist.Id,
                domainName: dist.DomainName,
                status: dist.Status
            }))
        });
    } catch (error) {
        console.error('Failed to get CloudFront status:', error);
        return createResponse(500, {
            status: 'error',
            error: 'Failed to get CloudFront status'
        });
    }
};

// Get MediaPackage metrics
const getMediaPackageMetrics = async () => {
    try {
        return createResponse(200, {
            status: 'success',
            requests: {
                total: 0
            },
            egress: {
                totalGB: 0
            },
            note: 'Real metrics would require CloudWatch integration'
        });
    } catch (error) {
        console.error('Failed to get MediaPackage metrics:', error);
        return createResponse(500, {
            status: 'error',
            error: 'Failed to get MediaPackage metrics'
        });
    }
};

// Get cost information
const getCostInformation = async () => {
    try {
        return createResponse(200, {
            status: 'success',
            total: 0.00,
            breakdown: {
                s3: {
                    storage: 0.00,
                    requests: 0.00
                },
                mediaPackage: {
                    estimated: 0.00
                },
                cloudFront: {
                    estimated: 0.00
                }
            },
            note: 'Real cost data would require AWS Cost Explorer API integration'
        });
    } catch (error) {
        console.error('Failed to get cost information:', error);
        return createResponse(500, {
            status: 'error',
            error: 'Failed to get cost information'
        });
    }
};

// Multi-Channel Management Functions
const getMultiChannelStatus = async () => {
    try {
        const result = await multiChannelManager.getAllChannelStatuses();
        const flowStatus = await multiChannelManager.getMediaConnectFlowStatus();

        return createResponse(200, {
            status: 'success',
            timestamp: new Date().toISOString(),
            mediaconnect_flow: flowStatus,
            channels: result.statuses,
            errors: result.errors
        });
    } catch (error) {
        return handleError(error, 'Failed to get multi-channel status');
    }
};

const startDestinationChannel = async (destinationId) => {
    try {
        // Get destination details
        const destination = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        }).promise();

        if (!destination.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Destination not found'
            });
        }

        const platform = destination.Item.platform;
        const result = await multiChannelManager.startDestinationChannel(destinationId, platform);

        // Update destination status in database
        await dynamodb.update({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET channel_status = :status, last_channel_sync = :timestamp',
            ExpressionAttributeValues: {
                ':status': result.status,
                ':timestamp': new Date().toISOString()
            }
        }).promise();

        return createResponse(200, {
            status: 'success',
            message: result.message,
            destination_id: destinationId,
            platform: platform,
            channel_id: result.channelId,
            channel_status: result.status
        });
    } catch (error) {
        return handleError(error, 'Failed to start destination channel');
    }
};

const stopDestinationChannel = async (destinationId) => {
    try {
        // Get destination details
        const destination = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId }
        }).promise();

        if (!destination.Item) {
            return createResponse(404, {
                status: 'error',
                message: 'Destination not found'
            });
        }

        const platform = destination.Item.platform;
        const result = await multiChannelManager.stopDestinationChannel(destinationId, platform);

        // Update destination status in database
        await dynamodb.update({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET channel_status = :status, last_channel_sync = :timestamp',
            ExpressionAttributeValues: {
                ':status': result.status,
                ':timestamp': new Date().toISOString()
            }
        }).promise();

        return createResponse(200, {
            status: 'success',
            message: result.message,
            destination_id: destinationId,
            platform: platform,
            channel_id: result.channelId,
            channel_status: result.status
        });
    } catch (error) {
        return handleError(error, 'Failed to stop destination channel');
    }
};

const getMediaConnectFlowStatus = async () => {
    try {
        const result = await multiChannelManager.getMediaConnectFlowStatus();
        return createResponse(200, {
            status: 'success',
            timestamp: new Date().toISOString(),
            flow: result
        });
    } catch (error) {
        return handleError(error, 'Failed to get MediaConnect flow status');
    }
};

const getInputHealthMonitoring = async () => {
    try {
        const result = await multiChannelManager.getInputHealthMonitoring();
        return createResponse(200, {
            status: 'success',
            timestamp: new Date().toISOString(),
            input_health: result
        });
    } catch (error) {
        return handleError(error, 'Failed to get input health monitoring');
    }
};

const validateChannelConfiguration = async () => {
    try {
        const result = await multiChannelManager.validateChannelConfiguration();
        return createResponse(200, {
            status: 'success',
            timestamp: new Date().toISOString(),
            validation: result
        });
    } catch (error) {
        return handleError(error, 'Failed to validate channel configuration');
    }
};

const runDatabaseMigration = async () => {
    try {
        const migration = new SchemaMigration();
        const result = await migration.runFullMigration();
        return createResponse(200, {
            status: 'success',
            timestamp: new Date().toISOString(),
            migration: result
        });
    } catch (error) {
        return handleError(error, 'Failed to run database migration');
    }
};

const getAdminPlatforms = async () => {
    try {
        // Return available platforms and their configurations
        const platforms = [
            { id: 'youtube', name: 'YouTube Live', type: 'rtmp', default_preset: 'preset_youtube_1080p_optimized' },
            { id: 'twitch', name: 'Twitch', type: 'rtmp', default_preset: 'preset_twitch_1080p_60fps' },
            { id: 'linkedin', name: 'LinkedIn Live', type: 'rtmp', default_preset: 'preset_linkedin_720p_professional' },
            { id: 'custom', name: 'Custom RTMP', type: 'rtmp', default_preset: 'preset_generic_1080p' },
            { id: 'primary', name: 'Primary HLS', type: 'hls', default_preset: 'preset_generic_720p' }
        ];

        return createResponse(200, {
            status: 'success',
            platforms: platforms,
            count: platforms.length
        });
    } catch (error) {
        return handleError(error, 'Failed to get admin platforms');
    }
};

const getAdminPresets = async () => {
    try {
        // Get all presets with admin details
        const result = await dynamodb.scan({
            TableName: CONFIG.dynamodb.presetsTable
        }).promise();

        return createResponse(200, {
            status: 'success',
            presets: result.Items,
            count: result.Items.length,
            by_platform: result.Items.reduce((acc, preset) => {
                if (!acc[preset.platform]) acc[preset.platform] = [];
                acc[preset.platform].push(preset);
                return acc;
            }, {}),
            by_type: result.Items.reduce((acc, preset) => {
                if (!acc[preset.type]) acc[preset.type] = [];
                acc[preset.type].push(preset);
                return acc;
            }, {})
        });
    } catch (error) {
        return handleError(error, 'Failed to get admin presets');
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

        if (path === '/api/s3/status' && httpMethod === 'GET') {
            return await getS3Status();
        }

        if (path === '/api/mediapackage/status' && httpMethod === 'GET') {
            return await getMediaPackageStatus();
        }

        if (path === '/api/cloudfront/status' && httpMethod === 'GET') {
            return await getCloudFrontStatus();
        }

        if (path === '/api/metrics/mediapackage' && httpMethod === 'GET') {
            return await getMediaPackageMetrics();
        }

        if (path === '/api/costs' && httpMethod === 'GET') {
            return await getCostInformation();
        }

        if (path.match(/^\/api\/destinations\/[^\/]+\/start$/) && httpMethod === 'POST') {
            const destinationId = path.split('/')[3];
            return await startDestination(destinationId);
        }

        if (path.match(/^\/api\/destinations\/[^\/]+\/stop$/) && httpMethod === 'POST') {
            const destinationId = path.split('/')[3];
            return await stopDestination(destinationId);
        }

        // New Multi-Channel Management Endpoints
        if (path === '/api/channels/status' && httpMethod === 'GET') {
            return await getMultiChannelStatus();
        }

        if (path.match(/^\/api\/destinations\/[^\/]+\/start-channel$/) && httpMethod === 'POST') {
            const destinationId = path.split('/')[3];
            return await startDestinationChannel(destinationId);
        }

        if (path.match(/^\/api\/destinations\/[^\/]+\/stop-channel$/) && httpMethod === 'POST') {
            const destinationId = path.split('/')[3];
            return await stopDestinationChannel(destinationId);
        }

        if (path === '/api/mediaconnect/flow/status' && httpMethod === 'GET') {
            return await getMediaConnectFlowStatus();
        }

        if (path === '/api/mediaconnect/inputs/health' && httpMethod === 'GET') {
            return await getInputHealthMonitoring();
        }

        if (path === '/api/channels/validate' && httpMethod === 'GET') {
            return await validateChannelConfiguration();
        }

        if (path === '/api/migrate' && httpMethod === 'POST') {
            return await runDatabaseMigration();
        }

        if (path === '/api/admin/platforms' && httpMethod === 'GET') {
            return await getAdminPlatforms();
        }

        if (path === '/api/admin/presets' && httpMethod === 'GET') {
            return await getAdminPresets();
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
