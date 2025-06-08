// Lunora Player - Backend API Server
// Provides real AWS data for the monitoring dashboard

const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: [
        'https://d35au6zpsr51nc.cloudfront.net',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// AWS Configuration
AWS.config.update({
    region: 'us-west-2'
});

// Set AWS profile via environment variable
process.env.AWS_PROFILE = 'lunora-media';
process.env.AWS_SDK_LOAD_CONFIG = '1';

// AWS Service clients
const s3 = new AWS.S3();
const mediaPackage = new AWS.MediaPackage();
const mediaLive = new AWS.MediaLive();
const cloudFront = new AWS.CloudFront();
const cloudWatch = new AWS.CloudWatch();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();

// Configuration
const CONFIG = {
    region: 'us-west-2',
    accountId: '372241484305',
    s3Bucket: 'lunora-media-videos-dev-372241484305',
    mediaPackageChannel: 'lunora-player-dev-channel',
    // Multi-destination streaming configuration
    dynamodb: {
        destinationsTable: 'lunora-destinations',
        presetsTable: 'lunora-presets',
        sessionsTable: 'lunora-streaming-sessions'
    },
    parameterStore: {
        prefix: '/lunora-player/streaming'
    }
};

// Utility function to handle AWS errors
const handleAWSError = (error, res, defaultValue = null) => {
    console.error('AWS Error:', error.message);
    if (defaultValue !== null) {
        return defaultValue;
    }
    res.status(500).json({ error: error.message });
    return null;
};

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: ['s3', 'mediapackage', 'medialive', 'cloudfront', 'cloudwatch']
    });
});

// Get S3 bucket status and metrics
app.get('/api/s3/status', async (req, res) => {
    try {
        // Check if bucket exists
        await s3.headBucket({ Bucket: CONFIG.s3Bucket }).promise();
        
        // Get bucket metrics
        const objects = await s3.listObjectsV2({ Bucket: CONFIG.s3Bucket }).promise();
        
        const totalSize = objects.Contents.reduce((sum, obj) => sum + obj.Size, 0);
        const objectCount = objects.Contents.length;
        
        // Get bucket location
        const location = await s3.getBucketLocation({ Bucket: CONFIG.s3Bucket }).promise();
        
        res.json({
            status: 'active',
            bucket: CONFIG.s3Bucket,
            region: location.LocationConstraint || 'us-east-1',
            storage: {
                bytes: totalSize,
                mb: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                gb: Math.round(totalSize / 1024 / 1024 / 1024 * 100) / 100
            },
            objects: objectCount,
            lastModified: objects.Contents.length > 0 ? 
                Math.max(...objects.Contents.map(obj => new Date(obj.LastModified))) : null
        });
    } catch (error) {
        handleAWSError(error, res);
    }
});

// Get MediaPackage status and metrics
app.get('/api/mediapackage/status', async (req, res) => {
    try {
        // Get channel info
        const channel = await mediaPackage.describeChannel({ 
            Id: CONFIG.mediaPackageChannel 
        }).promise();
        
        // Get origin endpoints
        const endpoints = await mediaPackage.listOriginEndpoints({ 
            ChannelId: CONFIG.mediaPackageChannel 
        }).promise();
        
        res.json({
            status: 'active',
            channel: {
                id: channel.Id,
                description: channel.Description,
                createdAt: channel.CreatedAt,
                arn: channel.Arn
            },
            endpoints: endpoints.OriginEndpoints.map(ep => ({
                id: ep.Id,
                url: ep.Url,
                description: ep.Description,
                createdAt: ep.CreatedAt
            }))
        });
    } catch (error) {
        handleAWSError(error, res);
    }
});

// Get MediaLive status
app.get('/api/medialive/status', async (req, res) => {
    try {
        const channels = await mediaLive.listChannels().promise();
        
        const channelDetails = await Promise.all(
            channels.Channels.map(async (channel) => {
                try {
                    const details = await mediaLive.describeChannel({ 
                        ChannelId: channel.Id 
                    }).promise();
                    return {
                        id: channel.Id,
                        name: channel.Name,
                        state: channel.State,
                        createdAt: details.CreatedAt,
                        inputAttachments: details.InputAttachments?.length || 0,
                        destinations: details.Destinations?.length || 0
                    };
                } catch (err) {
                    console.error(`Error getting details for channel ${channel.Id}:`, err.message);
                    return {
                        id: channel.Id,
                        name: channel.Name,
                        state: channel.State,
                        error: err.message
                    };
                }
            })
        );
        
        res.json({
            status: channels.Channels.length > 0 ? 'active' : 'inactive',
            channelCount: channels.Channels.length,
            channels: channelDetails
        });
    } catch (error) {
        handleAWSError(error, res);
    }
});

// Get CloudFront status
app.get('/api/cloudfront/status', async (req, res) => {
    try {
        const distributions = await cloudFront.listDistributions().promise();
        
        res.json({
            status: distributions.DistributionList.Items.length > 0 ? 'active' : 'inactive',
            distributionCount: distributions.DistributionList.Items.length,
            distributions: distributions.DistributionList.Items.map(dist => ({
                id: dist.Id,
                domainName: dist.DomainName,
                status: dist.Status,
                enabled: dist.Enabled,
                comment: dist.Comment,
                lastModified: dist.LastModifiedTime
            }))
        });
    } catch (error) {
        handleAWSError(error, res);
    }
});

// Get CloudWatch metrics for MediaPackage
app.get('/api/metrics/mediapackage', async (req, res) => {
    try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        
        // Get origin requests metric
        const requestsParams = {
            Namespace: 'AWS/MediaPackage',
            MetricName: 'OriginRequests',
            Dimensions: [
                {
                    Name: 'Channel',
                    Value: CONFIG.mediaPackageChannel
                }
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600, // 1 hour
            Statistics: ['Sum']
        };
        
        const requestsData = await cloudWatch.getMetricStatistics(requestsParams).promise();
        
        // Get egress bytes metric
        const egressParams = {
            Namespace: 'AWS/MediaPackage',
            MetricName: 'EgressBytes',
            Dimensions: [
                {
                    Name: 'Channel',
                    Value: CONFIG.mediaPackageChannel
                }
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600,
            Statistics: ['Sum']
        };
        
        const egressData = await cloudWatch.getMetricStatistics(egressParams).promise();
        
        // Calculate totals
        const totalRequests = requestsData.Datapoints.reduce((sum, dp) => sum + dp.Sum, 0);
        const totalEgressBytes = egressData.Datapoints.reduce((sum, dp) => sum + dp.Sum, 0);
        
        res.json({
            period: '24h',
            requests: {
                total: totalRequests,
                datapoints: requestsData.Datapoints.map(dp => ({
                    timestamp: dp.Timestamp,
                    value: dp.Sum
                }))
            },
            egress: {
                totalBytes: totalEgressBytes,
                totalGB: Math.round(totalEgressBytes / 1024 / 1024 / 1024 * 100) / 100,
                datapoints: egressData.Datapoints.map(dp => ({
                    timestamp: dp.Timestamp,
                    value: dp.Sum
                }))
            }
        });
    } catch (error) {
        console.error('CloudWatch metrics error:', error.message);
        // Return empty metrics if CloudWatch data is not available
        res.json({
            period: '24h',
            requests: { total: 0, datapoints: [] },
            egress: { totalBytes: 0, totalGB: 0, datapoints: [] },
            note: 'CloudWatch metrics may not be available yet for new resources'
        });
    }
});

// Get cost information (simplified - real implementation would use Cost Explorer API)
app.get('/api/costs', async (req, res) => {
    try {
        // Note: AWS Cost Explorer API requires special permissions and has limited availability
        // For now, we'll provide estimated costs based on usage
        
        // Get S3 storage size
        const s3Status = await s3.listObjectsV2({ Bucket: CONFIG.s3Bucket }).promise();
        const totalBytes = s3Status.Contents.reduce((sum, obj) => sum + obj.Size, 0);
        const storageGB = totalBytes / 1024 / 1024 / 1024;
        
        // Estimate costs (these are rough estimates)
        const costs = {
            s3: {
                storage: storageGB * 0.023, // $0.023 per GB/month
                requests: Math.max(s3Status.Contents.length * 0.0004, 0.01) // Minimum $0.01 for having bucket
            },
            mediaPackage: {
                // MediaPackage charges per GB processed - estimate based on having active channel
                estimated: 0.05 // Small estimate for having channel ready
            },
            mediaLive: {
                // MediaLive charges per hour when running
                estimated: 0 // Would need channel running time
            },
            cloudFront: {
                // CloudFront charges per GB transferred
                estimated: 0 // Would need transfer metrics
            }
        };
        
        const totalEstimated = Object.values(costs).reduce((sum, service) => {
            return sum + Object.values(service).reduce((serviceSum, cost) => serviceSum + cost, 0);
        }, 0);
        
        res.json({
            currency: 'USD',
            period: 'current_month',
            total: Math.round(totalEstimated * 100) / 100,
            breakdown: costs,
            note: 'Cost estimates based on current usage. For accurate costs, use AWS Cost Explorer.'
        });
    } catch (error) {
        handleAWSError(error, res);
    }
});

// Get comprehensive dashboard data
app.get('/api/dashboard', async (req, res) => {
    try {
        const [s3Response, mpResponse, mlResponse, cfResponse] = await Promise.allSettled([
            fetch(`http://localhost:${PORT}/api/s3/status`).then(r => r.json()),
            fetch(`http://localhost:${PORT}/api/mediapackage/status`).then(r => r.json()),
            fetch(`http://localhost:${PORT}/api/medialive/status`).then(r => r.json()),
            fetch(`http://localhost:${PORT}/api/cloudfront/status`).then(r => r.json())
        ]);

        res.json({
            timestamp: new Date().toISOString(),
            s3: s3Response.status === 'fulfilled' ? s3Response.value : { error: s3Response.reason },
            mediaPackage: mpResponse.status === 'fulfilled' ? mpResponse.value : { error: mpResponse.reason },
            mediaLive: mlResponse.status === 'fulfilled' ? mlResponse.value : { error: mlResponse.reason },
            cloudFront: cfResponse.status === 'fulfilled' ? cfResponse.value : { error: cfResponse.reason }
        });
    } catch (error) {
        handleAWSError(error, res);
    }
});

// Videon Edge Node Testing Endpoints
app.get('/api/videon/test', (req, res) => {
    const timestamp = new Date().toISOString();
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    console.log(`Videon test request from ${clientIP} at ${timestamp}`);

    res.json({
        status: 'success',
        message: 'Videon Edge Node connectivity test successful',
        timestamp: timestamp,
        server: {
            name: 'Lunora Player Backend',
            version: '1.0.0',
            region: CONFIG.region,
            account: CONFIG.accountId
        },
        client: {
            ip: clientIP,
            userAgent: req.headers['user-agent'] || 'Unknown'
        },
        endpoints: {
            health: `http://localhost:${PORT}/api/health`,
            mediapackage: `http://localhost:${PORT}/api/mediapackage/status`,
            medialive: `http://localhost:${PORT}/api/medialive/status`,
            dashboard: `http://localhost:8081/dashboard.html`
        }
    });
});

app.post('/api/videon/test', (req, res) => {
    const timestamp = new Date().toISOString();
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const payload = req.body;

    console.log(`Videon POST test from ${clientIP} at ${timestamp}:`, payload);

    res.json({
        status: 'success',
        message: 'Videon Edge Node POST test successful',
        timestamp: timestamp,
        received: payload,
        client: {
            ip: clientIP,
            userAgent: req.headers['user-agent'] || 'Unknown'
        },
        echo: {
            ...payload,
            serverProcessedAt: timestamp
        }
    });
});

// Videon Edge Node stream status endpoint
app.get('/api/videon/stream-status', async (req, res) => {
    try {
        // Check MediaLive channels for active streams
        const channels = await mediaLive.listChannels().promise();
        const activeChannels = [];

        for (const channel of channels.Channels) {
            if (channel.State === 'RUNNING') {
                try {
                    const details = await mediaLive.describeChannel({
                        ChannelId: channel.Id
                    }).promise();

                    activeChannels.push({
                        id: channel.Id,
                        name: channel.Name,
                        state: channel.State,
                        inputAttachments: details.InputAttachments?.length || 0,
                        destinations: details.Destinations?.length || 0
                    });
                } catch (err) {
                    console.error(`Error getting details for channel ${channel.Id}:`, err.message);
                }
            }
        }

        // Check MediaPackage for active streams
        const mpChannel = await mediaPackage.describeChannel({
            Id: CONFIG.mediaPackageChannel
        }).promise();

        const endpoints = await mediaPackage.listOriginEndpoints({
            ChannelId: CONFIG.mediaPackageChannel
        }).promise();

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            streaming: {
                mediaLive: {
                    totalChannels: channels.Channels.length,
                    activeChannels: activeChannels.length,
                    channels: activeChannels
                },
                mediaPackage: {
                    channel: {
                        id: mpChannel.Id,
                        status: 'active'
                    },
                    endpoints: endpoints.OriginEndpoints.map(ep => ({
                        id: ep.Id,
                        url: ep.Url,
                        type: ep.HlsPackage ? 'HLS' : ep.DashPackage ? 'DASH' : 'Unknown'
                    }))
                }
            },
            recommendations: activeChannels.length === 0 ? [
                'No active MediaLive channels found',
                'Create and start a MediaLive channel to receive SRT streams',
                'Configure Videon Edge node to send SRT to MediaLive input'
            ] : [
                'MediaLive channels are active and ready',
                'Configure Videon Edge node SRT output to MediaLive input',
                'Monitor stream health via dashboard'
            ]
        });
    } catch (error) {
        handleAWSError(error, res);
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// MULTI-DESTINATION STREAMING API ENDPOINTS
// ============================================================================

// Helper function to generate unique IDs
const generateId = (prefix) => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to get secure parameter from Parameter Store
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

// Helper function to store secure parameter in Parameter Store
const storeSecureParameter = async (parameterName, value, description = '') => {
    try {
        await ssm.putParameter({
            Name: parameterName,
            Value: value,
            Type: 'SecureString',
            Description: description,
            Overwrite: true
        }).promise();
        return true;
    } catch (error) {
        console.error(`Error storing parameter ${parameterName}:`, error.message);
        return false;
    }
};

// ============================================================================
// DESTINATIONS API
// ============================================================================

// Get all destinations
app.get('/api/destinations', async (req, res) => {
    try {
        const result = await dynamodb.scan({
            TableName: CONFIG.dynamodb.destinationsTable
        }).promise();

        // Don't include actual stream keys in the response for security
        const destinations = result.Items.map(item => ({
            ...item,
            stream_key: item.stream_key_param ? '***ENCRYPTED***' : null
        }));

        res.json({
            status: 'success',
            destinations: destinations,
            count: destinations.length
        });
    } catch (error) {
        console.error('Error fetching destinations:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch destinations',
            error: error.message
        });
    }
});

// Create new destination
app.post('/api/destinations', async (req, res) => {
    try {
        const { name, platform, rtmp_url, stream_key, preset_id, enabled = true } = req.body;

        if (!name || !platform) {
            return res.status(400).json({
                status: 'error',
                message: 'Name and platform are required'
            });
        }

        const destination_id = generateId('dest');
        const timestamp = new Date().toISOString();

        // Store stream key securely in Parameter Store if provided (not needed for HLS)
        let stream_key_param = null;
        if (stream_key && platform !== 'hls') {
            stream_key_param = `${CONFIG.parameterStore.prefix}/${platform}/stream-key-${destination_id}`;
            const stored = await storeSecureParameter(
                stream_key_param,
                stream_key,
                `Stream key for ${name} (${platform})`
            );
            if (!stored) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to store stream key securely'
                });
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

        // Return destination without sensitive data
        const responseDestination = {
            ...destination,
            stream_key: stream_key ? '***ENCRYPTED***' : null
        };
        delete responseDestination.stream_key_param;

        res.json({
            status: 'success',
            message: 'Destination created successfully',
            destination: responseDestination
        });
    } catch (error) {
        console.error('Error creating destination:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create destination',
            error: error.message
        });
    }
});

// Update destination
app.put('/api/destinations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, platform, rtmp_url, stream_key, preset_id, enabled } = req.body;

        // Get existing destination
        const existing = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: id }
        }).promise();

        if (!existing.Item) {
            return res.status(404).json({
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
            let stream_key_param = existing.Item.stream_key_param;
            if (!stream_key_param) {
                stream_key_param = `${CONFIG.parameterStore.prefix}/${platform || existing.Item.platform}/stream-key-${id}`;
            }

            const stored = await storeSecureParameter(
                stream_key_param,
                stream_key,
                `Stream key for ${name || existing.Item.name} (${platform || existing.Item.platform})`
            );

            if (!stored) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to update stream key securely'
                });
            }

            updates.stream_key_param = stream_key_param;
        }

        // Build update expression
        const updateExpression = 'SET ' + Object.keys(updates).map(key => `#${key} = :${key}`).join(', ');
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};

        Object.keys(updates).forEach(key => {
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = updates[key];
        });

        await dynamodb.update({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }).promise();

        res.json({
            status: 'success',
            message: 'Destination updated successfully'
        });
    } catch (error) {
        console.error('Error updating destination:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update destination',
            error: error.message
        });
    }
});

// Delete destination
app.delete('/api/destinations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get existing destination to clean up Parameter Store
        const existing = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: id }
        }).promise();

        if (!existing.Item) {
            return res.status(404).json({
                status: 'error',
                message: 'Destination not found'
            });
        }

        // Delete from DynamoDB
        await dynamodb.delete({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: id }
        }).promise();

        // Clean up Parameter Store if stream key exists
        if (existing.Item.stream_key_param) {
            try {
                await ssm.deleteParameter({
                    Name: existing.Item.stream_key_param
                }).promise();
            } catch (error) {
                console.warn(`Warning: Could not delete parameter ${existing.Item.stream_key_param}:`, error.message);
            }
        }

        res.json({
            status: 'success',
            message: 'Destination deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting destination:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete destination',
            error: error.message
        });
    }
});

// Start destination streaming
app.post('/api/destinations/:id/start', async (req, res) => {
    try {
        const { id } = req.params;

        // Get destination details
        const result = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: id }
        }).promise();

        if (!result.Item) {
            return res.status(404).json({
                status: 'error',
                message: 'Destination not found'
            });
        }

        const destination = result.Item;

        if (destination.platform === 'hls') {
            // For HLS destinations, we need to start the MediaLive channel
            const channelId = '3714710'; // The OBS RTMP channel we created

            try {
                await medialive.startChannel({ ChannelId: channelId }).promise();

                res.json({
                    status: 'success',
                    message: 'HLS streaming started successfully',
                    channel_id: channelId,
                    hls_url: 'https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/ab090a5ad83f4d26b3ae8a23f3512081/index.m3u8'
                });
            } catch (error) {
                if (error.code === 'ConflictException') {
                    res.json({
                        status: 'success',
                        message: 'HLS streaming already active',
                        channel_id: channelId,
                        hls_url: 'https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/ab090a5ad83f4d26b3ae8a23f3512081/index.m3u8'
                    });
                } else {
                    throw error;
                }
            }
        } else {
            // For other platforms, simulate starting RTMP stream
            res.json({
                status: 'success',
                message: `Started streaming to ${destination.platform}`,
                destination_id: id
            });
        }
    } catch (error) {
        console.error('Error starting destination:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to start destination',
            error: error.message
        });
    }
});

// Stop destination streaming
app.post('/api/destinations/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;

        // Get destination details
        const result = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: id }
        }).promise();

        if (!result.Item) {
            return res.status(404).json({
                status: 'error',
                message: 'Destination not found'
            });
        }

        const destination = result.Item;

        if (destination.platform === 'hls') {
            // For HLS destinations, stop the MediaLive channel
            const channelId = '3714710'; // The OBS RTMP channel we created

            try {
                await medialive.stopChannel({ ChannelId: channelId }).promise();

                res.json({
                    status: 'success',
                    message: 'HLS streaming stopped successfully',
                    channel_id: channelId
                });
            } catch (error) {
                if (error.code === 'ConflictException') {
                    res.json({
                        status: 'success',
                        message: 'HLS streaming already stopped',
                        channel_id: channelId
                    });
                } else {
                    throw error;
                }
            }
        } else {
            // For other platforms, simulate stopping RTMP stream
            res.json({
                status: 'success',
                message: `Stopped streaming to ${destination.platform}`,
                destination_id: id
            });
        }
    } catch (error) {
        console.error('Error stopping destination:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to stop destination',
            error: error.message
        });
    }
});

// Test destination connectivity
app.post('/api/destinations/:id/test', async (req, res) => {
    try {
        const { id } = req.params;

        // Get destination details
        const result = await dynamodb.get({
            TableName: CONFIG.dynamodb.destinationsTable,
            Key: { destination_id: id }
        }).promise();

        if (!result.Item) {
            return res.status(404).json({
                status: 'error',
                message: 'Destination not found'
            });
        }

        const destination = result.Item;

        // For now, return a simulated test result
        // In a full implementation, this would actually test RTMP connectivity
        const testResult = {
            status: 'success',
            destination_id: id,
            name: destination.name,
            platform: destination.platform,
            connectivity: 'reachable',
            latency: Math.floor(Math.random() * 100) + 50, // Simulated latency
            timestamp: new Date().toISOString()
        };

        res.json(testResult);
    } catch (error) {
        console.error('Error testing destination:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to test destination',
            error: error.message
        });
    }
});

// ============================================================================
// PRESETS API
// ============================================================================

// Get all presets
app.get('/api/presets', async (req, res) => {
    try {
        const { platform } = req.query;

        let params = {
            TableName: CONFIG.dynamodb.presetsTable
        };

        // Filter by platform if specified
        if (platform) {
            params.FilterExpression = 'platform = :platform';
            params.ExpressionAttributeValues = {
                ':platform': platform
            };
        }

        const result = await dynamodb.scan(params).promise();

        res.json({
            status: 'success',
            presets: result.Items,
            count: result.Items.length
        });
    } catch (error) {
        console.error('Error fetching presets:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch presets',
            error: error.message
        });
    }
});

// Create new preset
app.post('/api/presets', async (req, res) => {
    try {
        const { name, platform, video_settings, audio_settings, advanced_settings } = req.body;

        if (!name || !platform || !video_settings || !audio_settings) {
            return res.status(400).json({
                status: 'error',
                message: 'Name, platform, video_settings, and audio_settings are required'
            });
        }

        const preset_id = generateId('preset');
        const timestamp = new Date().toISOString();

        const preset = {
            preset_id,
            name,
            platform,
            video_settings,
            audio_settings,
            advanced_settings: advanced_settings || {},
            created_at: timestamp,
            updated_at: timestamp
        };

        await dynamodb.put({
            TableName: CONFIG.dynamodb.presetsTable,
            Item: preset
        }).promise();

        res.json({
            status: 'success',
            message: 'Preset created successfully',
            preset: preset
        });
    } catch (error) {
        console.error('Error creating preset:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create preset',
            error: error.message
        });
    }
});

// ============================================================================
// STREAMING CONTROL API
// ============================================================================

// Get streaming status
app.get('/api/streaming/status', async (req, res) => {
    try {
        // Get MediaLive channel status
        const channels = await mediaLive.listChannels().promise();
        const activeChannels = [];

        for (const channel of channels.Channels) {
            if (channel.State === 'RUNNING') {
                try {
                    const details = await mediaLive.describeChannel({
                        ChannelId: channel.Id
                    }).promise();

                    activeChannels.push({
                        id: channel.Id,
                        name: channel.Name,
                        state: channel.State,
                        destinations: details.Destinations?.length || 0,
                        inputAttachments: details.InputAttachments?.length || 0
                    });
                } catch (err) {
                    console.error(`Error getting channel details for ${channel.Id}:`, err.message);
                }
            }
        }

        // Get active destinations from DynamoDB
        const destinationsResult = await dynamodb.scan({
            TableName: CONFIG.dynamodb.destinationsTable,
            FilterExpression: 'enabled = :enabled',
            ExpressionAttributeValues: {
                ':enabled': true
            }
        }).promise();

        res.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            streaming: {
                active: activeChannels.length > 0,
                channels: activeChannels,
                destinations: {
                    total: destinationsResult.Items.length,
                    enabled: destinationsResult.Items.filter(d => d.enabled).length,
                    list: destinationsResult.Items.map(d => ({
                        id: d.destination_id,
                        name: d.name,
                        platform: d.platform,
                        enabled: d.enabled
                    }))
                }
            }
        });
    } catch (error) {
        console.error('Error getting streaming status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get streaming status',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Lunora Player Backend API running on port ${PORT}`);
    console.log(`📊 Dashboard API available at http://localhost:${PORT}/api/dashboard`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🎯 Multi-destination API: http://localhost:${PORT}/api/destinations`);
    console.log(`📁 AWS Profile: lunora-media`);
    console.log(`🌍 AWS Region: ${CONFIG.region}`);
    console.log(`🏢 AWS Account: ${CONFIG.accountId}`);
});
