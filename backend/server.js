// Lunora Player - Backend API Server
// Provides real AWS data for the monitoring dashboard

const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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

// Configuration
const CONFIG = {
    region: 'us-west-2',
    accountId: '372241484305',
    s3Bucket: 'lunora-media-videos-dev-372241484305',
    mediaPackageChannel: 'lunora-player-dev-channel'
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

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Lunora Player Backend API running on port ${PORT}`);
    console.log(`📊 Dashboard API available at http://localhost:${PORT}/api/dashboard`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📁 AWS Profile: lunora-media`);
    console.log(`🌍 AWS Region: ${CONFIG.region}`);
    console.log(`🏢 AWS Account: ${CONFIG.accountId}`);
});
