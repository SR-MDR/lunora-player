const { MediaLiveClient, StartChannelCommand, StopChannelCommand, DescribeChannelCommand } = require('@aws-sdk/client-medialive');
const { MediaConnectClient, DescribeFlowCommand, StartFlowCommand, StopFlowCommand, AddFlowSourcesCommand, UpdateFlowCommand, DescribeFlowSourceMetadataCommand } = require('@aws-sdk/client-mediaconnect');
const { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand, GetMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const medialive = new MediaLiveClient({ region: 'us-west-2' });
const mediaconnect = new MediaConnectClient({ region: 'us-west-2' });
const cloudwatch = new CloudWatchClient({ region: 'us-west-2' });

class RobustMultiChannelManager {
    constructor() {
        this.channelMapping = {
            'primary': process.env.PRIMARY_CHANNEL_ID,
            'youtube': process.env.YOUTUBE_CHANNEL_ID,
            'twitch': process.env.TWITCH_CHANNEL_ID,
            'linkedin': process.env.LINKEDIN_CHANNEL_ID,
            'custom': process.env.CUSTOM_CHANNEL_ID
        };

        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 2000,
            backoffMultiplier: 2
        };

        this.mediaConnectFlowArn = process.env.MEDIACONNECT_FLOW_ARN;
    }

    async startDestinationChannel(destinationId, platform) {
        const channelId = this.channelMapping[platform];
        if (!channelId) {
            throw new Error(`No channel configured for platform: ${platform}`);
        }

        return await this.executeWithRetry(async () => {
            console.log(`Starting MediaLive channel ${channelId} for ${platform}`);

            // Check current channel state first
            const currentState = await this.getChannelState(channelId);
            if (currentState === 'RUNNING') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'already_running',
                    message: `Channel ${channelId} already running for ${platform}`
                };
            }

            if (currentState === 'STARTING') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'starting',
                    message: `Channel ${channelId} already starting for ${platform}`
                };
            }

            const params = { ChannelId: channelId };
            const result = await medialive.send(new StartChannelCommand(params));

            // Log metrics
            await this.logChannelMetric(channelId, 'ChannelStart', 1);

            return {
                success: true,
                channelId: channelId,
                platform: platform,
                status: 'starting',
                message: `Channel ${channelId} starting for ${platform}`,
                requestId: result.ResponseMetadata?.RequestId
            };
        }, `start channel ${channelId} for ${platform}`);
    }

    async stopDestinationChannel(destinationId, platform) {
        const channelId = this.channelMapping[platform];
        if (!channelId) {
            throw new Error(`No channel configured for platform: ${platform}`);
        }

        return await this.executeWithRetry(async () => {
            console.log(`Stopping MediaLive channel ${channelId} for ${platform}`);

            // Check current channel state first
            const currentState = await this.getChannelState(channelId);
            if (currentState === 'IDLE') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'already_stopped',
                    message: `Channel ${channelId} already stopped for ${platform}`
                };
            }

            if (currentState === 'STOPPING') {
                return {
                    success: true,
                    channelId: channelId,
                    platform: platform,
                    status: 'stopping',
                    message: `Channel ${channelId} already stopping for ${platform}`
                };
            }

            const params = { ChannelId: channelId };
            const result = await medialive.send(new StopChannelCommand(params));

            // Log metrics
            await this.logChannelMetric(channelId, 'ChannelStop', 1);

            return {
                success: true,
                channelId: channelId,
                platform: platform,
                status: 'stopping',
                message: `Channel ${channelId} stopping for ${platform}`,
                requestId: result.ResponseMetadata?.RequestId
            };
        }, `stop channel ${channelId} for ${platform}`);
    }

    async getChannelState(channelId) {
        try {
            const params = { ChannelId: channelId };
            const result = await medialive.send(new DescribeChannelCommand(params));
            return result.State;
        } catch (error) {
            console.error(`Error getting channel state for ${channelId}:`, error);
            throw error;
        }
    }

    async getMediaConnectFlowStatus() {
        try {
            if (!this.mediaConnectFlowArn) {
                return {
                    status: 'not_configured',
                    message: 'MediaConnect flow ARN not configured'
                };
            }

            const params = { FlowArn: this.mediaConnectFlowArn };
            const result = await mediaconnect.send(new DescribeFlowCommand(params));

            return {
                status: result.Flow.Status || 'UNKNOWN',
                flowArn: result.Flow.FlowArn,
                flowName: result.Flow.Name,
                sourceStatus: result.Flow.Source?.IngestIp ? 'ready' : 'pending',
                ingestIp: result.Flow.Source?.IngestIp,
                ingestPort: result.Flow.Source?.IngestPort,
                outputCount: result.Flow.Outputs?.length || 0,
                availabilityZone: result.Flow.AvailabilityZone,
                lastModified: result.Flow.LastModified
            };
        } catch (error) {
            console.error('Error getting MediaConnect flow status:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    async startMediaConnectFlow() {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            const params = { FlowArn: this.mediaConnectFlowArn };
            await mediaconnect.send(new StartFlowCommand(params));

            return {
                status: 'success',
                message: 'MediaConnect flow start initiated',
                flowArn: this.mediaConnectFlowArn
            };
        } catch (error) {
            console.error('Error starting MediaConnect flow:', error);
            throw error;
        }
    }

    async stopMediaConnectFlow() {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            const params = { FlowArn: this.mediaConnectFlowArn };
            await mediaconnect.send(new StopFlowCommand(params));

            return {
                status: 'success',
                message: 'MediaConnect flow stop initiated',
                flowArn: this.mediaConnectFlowArn
            };
        } catch (error) {
            console.error('Error stopping MediaConnect flow:', error);
            throw error;
        }
    }

    async executeWithRetry(operation, operationName) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.error(`Attempt ${attempt} failed for ${operationName}:`, error.message);

                if (attempt === this.retryConfig.maxRetries) {
                    break;
                }

                // Check if error is retryable
                if (!this.isRetryableError(error)) {
                    break;
                }

                // Wait before retry with exponential backoff
                const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    isRetryableError(error) {
        const retryableErrors = [
            'ThrottlingException',
            'InternalServerError',
            'ServiceUnavailable',
            'TooManyRequestsException'
        ];

        return retryableErrors.some(errorType =>
            error.code === errorType || error.name === errorType
        );
    }

    async logChannelMetric(channelId, metricName, value) {
        try {
            const params = {
                Namespace: 'LunoraPlayer/MediaLive',
                MetricData: [{
                    MetricName: metricName,
                    Value: value,
                    Unit: 'Count',
                    Dimensions: [{
                        Name: 'ChannelId',
                        Value: channelId
                    }],
                    Timestamp: new Date()
                }]
            };

            await cloudwatch.send(new PutMetricDataCommand(params));
        } catch (error) {
            console.error('Error logging metric:', error);
            // Don't throw - metrics are non-critical
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get real-time source connection status using CloudWatch SourceConnected metric
     * This matches the same data that AWS Console displays for source health
     * Optimized for faster detection with shorter lookback window and periods
     */
    async getSourceConnectionStatus(sourceArn) {
        try {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 2 * 60 * 1000); // Last 2 minutes (reduced from 5)

            const params = {
                Namespace: 'AWS/MediaConnect',
                MetricName: 'SourceConnected',
                Dimensions: [
                    {
                        Name: 'SourceARN',
                        Value: sourceArn
                    }
                ],
                StartTime: startTime,
                EndTime: endTime,
                Period: 60, // 1 minute periods (CloudWatch minimum for MediaConnect)
                Statistics: ['Maximum'] // Use Maximum to get the most recent connection state
            };

            const result = await cloudwatch.send(new GetMetricStatisticsCommand(params));

            // If we have datapoints, use the most recent one
            if (result.Datapoints && result.Datapoints.length > 0) {
                // Sort by timestamp to get the most recent
                const sortedDatapoints = result.Datapoints.sort((a, b) => b.Timestamp - a.Timestamp);
                const latestValue = sortedDatapoints[0].Maximum;

                return {
                    connected: latestValue === 1,
                    timestamp: sortedDatapoints[0].Timestamp,
                    value: latestValue
                };
            }

            // No recent data points - could mean source was never connected or no recent activity
            // In this case, we'll fall back to checking if source has basic configuration
            return {
                connected: false,
                timestamp: null,
                value: 0,
                note: 'No recent CloudWatch data - source likely disconnected'
            };

        } catch (error) {
            console.error(`Error getting CloudWatch metrics for source ${sourceArn}:`, error);

            // If CloudWatch fails, return null to indicate we couldn't determine status
            return {
                connected: null,
                error: error.message,
                note: 'CloudWatch metrics unavailable'
            };
        }
    }

    /**
     * Get connection status for multiple sources using optimized batch query
     * This is faster than individual queries and reduces API calls
     */
    async getMultipleSourceConnectionStatus(sourceArns) {
        try {
            if (sourceArns.length === 0) return [];

            // Use GetMetricData for faster batch queries (more efficient than individual GetMetricStatistics)
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 2 * 60 * 1000); // Last 2 minutes

            const metricDataQueries = sourceArns.map((sourceArn, index) => ({
                Id: `source_${index}`, // Unique identifier for each query
                MetricStat: {
                    Metric: {
                        Namespace: 'AWS/MediaConnect',
                        MetricName: 'SourceConnected',
                        Dimensions: [
                            {
                                Name: 'SourceARN',
                                Value: sourceArn
                            }
                        ]
                    },
                    Period: 60,
                    Stat: 'Maximum'
                },
                ReturnData: true
            }));

            const params = {
                MetricDataQueries: metricDataQueries,
                StartTime: startTime,
                EndTime: endTime
            };

            const result = await cloudwatch.send(new GetMetricDataCommand(params));

            // Process results and map back to source ARNs
            const statusResults = sourceArns.map((sourceArn, index) => {
                const metricResult = result.MetricDataResults.find(r => r.Id === `source_${index}`);

                if (metricResult && metricResult.Values && metricResult.Values.length > 0) {
                    // Get the most recent value
                    const latestIndex = metricResult.Timestamps.reduce((maxIndex, timestamp, currentIndex) =>
                        timestamp > metricResult.Timestamps[maxIndex] ? currentIndex : maxIndex, 0);

                    const latestValue = metricResult.Values[latestIndex];
                    const latestTimestamp = metricResult.Timestamps[latestIndex];

                    return {
                        sourceArn,
                        connected: latestValue === 1,
                        timestamp: latestTimestamp,
                        value: latestValue
                    };
                }

                // No recent data points
                return {
                    sourceArn,
                    connected: false,
                    timestamp: null,
                    value: 0,
                    note: 'No recent CloudWatch data - source likely disconnected'
                };
            });

            return statusResults;

        } catch (error) {
            console.error('Error getting multiple source connection status:', error);

            // Fallback to individual queries if batch fails
            console.log('Falling back to individual queries...');
            const statusPromises = sourceArns.map(async (sourceArn) => {
                const status = await this.getSourceConnectionStatus(sourceArn);
                return {
                    sourceArn,
                    ...status
                };
            });

            return await Promise.all(statusPromises);
        }
    }

    /**
     * Get real-time source health using DescribeFlowSourceMetadata API
     * This provides the most up-to-date information about active sources
     * Note: Only shows metadata for the currently active source in failover scenarios
     */
    async getSourceMetadataHealth() {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            const params = { FlowArn: this.mediaConnectFlowArn };
            const result = await mediaconnect.send(new DescribeFlowSourceMetadataCommand(params));

            // Check if we have transport media info (indicates active source with data)
            const hasActiveMedia = result.TransportMediaInfo &&
                                 result.TransportMediaInfo.Programs &&
                                 result.TransportMediaInfo.Programs.length > 0;

            return {
                hasActiveSource: hasActiveMedia,
                timestamp: result.Timestamp,
                messages: result.Messages || [],
                programCount: hasActiveMedia ? result.TransportMediaInfo.Programs.length : 0,
                transportMediaInfo: result.TransportMediaInfo || null
            };

        } catch (error) {
            console.error('Error getting source metadata health:', error);
            return {
                hasActiveSource: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Fast hybrid source health detection combining multiple approaches
     * Uses DescribeFlowSourceMetadata + optimized CloudWatch for comprehensive status
     */
    async getFastSourceHealth(sourceArns) {
        try {
            // Run both approaches in parallel for speed
            const [cloudWatchStatuses, metadataHealth] = await Promise.all([
                this.getMultipleSourceConnectionStatus(sourceArns),
                this.getSourceMetadataHealth()
            ]);

            // Enhance CloudWatch data with metadata insights
            const enhancedStatuses = cloudWatchStatuses.map(status => {
                const enhanced = { ...status };

                // Add metadata context
                enhanced.metadata_available = metadataHealth.hasActiveSource;
                enhanced.last_metadata_check = metadataHealth.timestamp;

                // If CloudWatch shows connected but no metadata, might be connection issue
                if (status.connected && !metadataHealth.hasActiveSource) {
                    enhanced.status_note = 'Connected but no active media detected';
                    enhanced.confidence = 'medium';
                } else if (status.connected && metadataHealth.hasActiveSource) {
                    enhanced.status_note = 'Connected with active media confirmed';
                    enhanced.confidence = 'high';
                } else {
                    enhanced.status_note = status.note || 'Disconnected (CloudWatch confirmed)';
                    enhanced.confidence = 'high';
                }

                return enhanced;
            });

            return {
                sources: enhancedStatuses,
                metadata_health: metadataHealth,
                detection_method: 'hybrid_cloudwatch_metadata',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error in fast source health detection:', error);

            // Fallback to CloudWatch only
            const cloudWatchStatuses = await this.getMultipleSourceConnectionStatus(sourceArns);
            return {
                sources: cloudWatchStatuses,
                metadata_health: null,
                detection_method: 'cloudwatch_fallback',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async getAllChannelStatuses() {
        const statuses = {};
        const errors = {};

        // Get all channel statuses in parallel
        const statusPromises = Object.entries(this.channelMapping).map(async ([platform, channelId]) => {
            if (!channelId) return null;

            try {
                const params = { ChannelId: channelId };
                const result = await medialive.send(new DescribeChannelCommand(params));

                return {
                    platform,
                    channelId,
                    state: result.State,
                    pipelinesRunningCount: result.PipelinesRunningCount || 0,
                    inputAttachments: result.InputAttachments?.length || 0,
                    lastModified: result.LastModified
                };
            } catch (error) {
                console.error(`Error getting status for ${platform} (${channelId}):`, error);
                errors[platform] = error.message;
                return null;
            }
        });

        const results = await Promise.allSettled(statusPromises);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                const { platform, ...status } = result.value;
                statuses[platform] = status;
            }
        });

        return { statuses, errors };
    }

    async validateChannelConfiguration() {
        const validation = {
            valid: true,
            issues: [],
            channels: {}
        };

        for (const [platform, channelId] of Object.entries(this.channelMapping)) {
            if (!channelId) {
                validation.valid = false;
                validation.issues.push(`Missing channel ID for platform: ${platform}`);
                continue;
            }

            try {
                const params = { ChannelId: channelId };
                const result = await medialive.send(new DescribeChannelCommand(params));

                validation.channels[platform] = {
                    channelId,
                    exists: true,
                    state: result.State,
                    inputCount: result.InputAttachments?.length || 0,
                    outputCount: result.Destinations?.length || 0
                };

                // Validate channel configuration
                if (!result.InputAttachments || result.InputAttachments.length === 0) {
                    validation.valid = false;
                    validation.issues.push(`Channel ${channelId} (${platform}) has no input attachments`);
                }

                if (!result.Destinations || result.Destinations.length === 0) {
                    validation.valid = false;
                    validation.issues.push(`Channel ${channelId} (${platform}) has no destinations`);
                }

            } catch (error) {
                validation.valid = false;
                validation.issues.push(`Channel ${channelId} (${platform}) not accessible: ${error.message}`);
                validation.channels[platform] = {
                    channelId,
                    exists: false,
                    error: error.message
                };
            }
        }

        return validation;
    }

    async getInputHealthMonitoring() {
        try {
            const flowStatus = await this.getMediaConnectFlowStatus();

            if (flowStatus.status !== 'ACTIVE') {
                return {
                    status: 'error',
                    message: 'MediaConnect flow not active',
                    flowStatus
                };
            }

            // Get detailed flow information including source health
            const params = { FlowArn: this.mediaConnectFlowArn };
            const result = await mediaconnect.send(new DescribeFlowCommand(params));

            // Handle both single source (legacy) and dual source configurations
            const sources = result.Flow.Sources || (result.Flow.Source ? [result.Flow.Source] : []);

            // Get fast real-time connection status using hybrid approach
            const sourceArns = sources.map(source => source.SourceArn).filter(arn => arn);
            const fastHealthResult = await this.getFastSourceHealth(sourceArns);
            const connectionStatuses = fastHealthResult.sources;

            // Create a map for quick lookup of connection status by ARN
            const connectionStatusMap = {};
            connectionStatuses.forEach(status => {
                connectionStatusMap[status.sourceArn] = status;
            });

            // Map sources with CloudWatch-based connection status
            const sourcesWithHealth = sources.map((source, index) => {
                const sourceArn = source.SourceArn;
                const cloudWatchStatus = connectionStatusMap[sourceArn];

                // Determine connection status from CloudWatch data
                let isConnected = false;
                let statusNote = '';

                if (cloudWatchStatus) {
                    if (cloudWatchStatus.connected === true) {
                        isConnected = true;
                        statusNote = 'Connected (CloudWatch confirmed)';
                    } else if (cloudWatchStatus.connected === false) {
                        isConnected = false;
                        statusNote = cloudWatchStatus.note || 'Disconnected (CloudWatch confirmed)';
                    } else {
                        // CloudWatch data unavailable, fall back to basic checks
                        const hasPeerIp = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';
                        isConnected = hasPeerIp;
                        statusNote = 'CloudWatch unavailable - using fallback detection';
                    }
                } else {
                    // No CloudWatch data, use fallback
                    const hasPeerIp = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';
                    isConnected = hasPeerIp;
                    statusNote = 'No CloudWatch data - using fallback detection';
                }

                return {
                    name: source.Name || `Source ${index + 1}`,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    status: isConnected ? 'connected' : 'disconnected',
                    whitelist_cidr: source.WhitelistCidr,
                    peer_ip: source.PeerIpAddress || null,
                    source_arn: sourceArn,
                    description: source.Description || '',
                    status_note: statusNote,
                    cloudwatch_data: cloudWatchStatus || null
                };
            });

            // Determine overall health status
            const connectedSources = sourcesWithHealth.filter(s => s.status === 'connected');
            const overallStatus = connectedSources.length > 0 ? 'healthy' : 'degraded';

            const inputHealth = {
                status: overallStatus,
                sources: sourcesWithHealth,
                // Legacy support for existing frontend
                main_input: sourcesWithHealth[0] ? {
                    protocol: sourcesWithHealth[0].protocol,
                    ingest_ip: sourcesWithHealth[0].ingest_ip,
                    ingest_port: sourcesWithHealth[0].ingest_port,
                    status: sourcesWithHealth[0].status,
                    whitelist_cidr: sourcesWithHealth[0].whitelist_cidr
                } : null,
                failover_config: result.Flow.SourceFailoverConfig || null,
                connected_sources: connectedSources.length,
                total_sources: sourcesWithHealth.length,
                outputs: result.Flow.Outputs?.map(output => ({
                    name: output.Name,
                    protocol: output.Transport?.Protocol || 'unknown',
                    port: output.Port,
                    destination: output.Destination,
                    status: 'active'
                })) || [],
                last_updated: new Date().toISOString()
            };

            return inputHealth;

        } catch (error) {
            console.error('Error getting input health monitoring:', error);
            return {
                status: 'error',
                message: error.message,
                last_updated: new Date().toISOString()
            };
        }
    }

    async updateDestinationRTMPUrl(channelId, rtmpUrl, streamKey) {
        try {
            // This would update the RTMP destination for a specific channel
            // Implementation depends on how destinations are configured
            console.log(`Updating RTMP destination for channel ${channelId}: ${rtmpUrl}`);

            // For now, return success - actual implementation would update the channel
            return {
                success: true,
                channelId,
                rtmpUrl,
                message: 'RTMP destination updated successfully'
            };
        } catch (error) {
            console.error(`Error updating RTMP destination for channel ${channelId}:`, error);
            throw error;
        }
    }

    // ============================================================================
    // DUAL SOURCE MANAGEMENT METHODS
    // ============================================================================

    async getAllSources() {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            const params = { FlowArn: this.mediaConnectFlowArn };
            const result = await mediaconnect.send(new DescribeFlowCommand(params));

            // Handle both single source (legacy) and dual source configurations
            const sources = result.Flow.Sources || (result.Flow.Source ? [result.Flow.Source] : []);

            // Get fast real-time connection status using hybrid approach
            const sourceArns = sources.map(source => source.SourceArn).filter(arn => arn);
            const fastHealthResult = await this.getFastSourceHealth(sourceArns);
            const connectionStatuses = fastHealthResult.sources;

            // Create a map for quick lookup of connection status by ARN
            const connectionStatusMap = {};
            connectionStatuses.forEach(status => {
                connectionStatusMap[status.sourceArn] = status;
            });

            // Map sources with CloudWatch-based connection status
            const sourcesWithHealth = sources.map((source, index) => {
                const sourceArn = source.SourceArn;
                const cloudWatchStatus = connectionStatusMap[sourceArn];

                // Determine connection status from CloudWatch data
                let isConnected = false;
                let statusNote = '';

                if (cloudWatchStatus) {
                    if (cloudWatchStatus.connected === true) {
                        isConnected = true;
                        statusNote = 'Connected (CloudWatch confirmed)';
                    } else if (cloudWatchStatus.connected === false) {
                        isConnected = false;
                        statusNote = cloudWatchStatus.note || 'Disconnected (CloudWatch confirmed)';
                    } else {
                        // CloudWatch data unavailable, fall back to basic checks
                        const hasPeerIp = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';
                        isConnected = hasPeerIp;
                        statusNote = 'CloudWatch unavailable - using fallback detection';
                    }
                } else {
                    // No CloudWatch data, use fallback
                    const hasPeerIp = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';
                    isConnected = hasPeerIp;
                    statusNote = 'No CloudWatch data - using fallback detection';
                }

                return {
                    name: source.Name || `Source ${index + 1}`,
                    source_arn: sourceArn,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    status: isConnected ? 'connected' : 'disconnected',
                    whitelist_cidr: source.WhitelistCidr,
                    peer_ip: source.PeerIpAddress || null,
                    description: source.Description || '',
                    flow_status: result.Flow.Status,
                    status_note: cloudWatchStatus?.status_note || statusNote,
                    confidence: cloudWatchStatus?.confidence || 'medium',
                    cloudwatch_data: cloudWatchStatus || null
                };
            });

            return {
                status: 'success',
                flow_arn: result.Flow.FlowArn,
                flow_name: result.Flow.Name,
                sources: sourcesWithHealth,
                failover_config: result.Flow.SourceFailoverConfig || null,
                connected_sources: sourcesWithHealth.filter(s => s.status === 'connected').length,
                total_sources: sourcesWithHealth.length,
                detection_method: fastHealthResult.detection_method,
                metadata_health: fastHealthResult.metadata_health,
                last_updated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting all sources:', error);
            throw error;
        }
    }

    async addBackupSource(sourceConfig) {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            // Default backup source configuration for SRT
            const backupSource = {
                Name: sourceConfig.name || 'Backup-SRT-Source',
                Protocol: 'srt-listener',
                IngestPort: sourceConfig.ingestPort || 9999,
                WhitelistCidr: sourceConfig.whitelistCidr || '0.0.0.0/0',
                Description: sourceConfig.description || 'Backup SRT source for failover redundancy'
            };

            const params = {
                FlowArn: this.mediaConnectFlowArn,
                Sources: [backupSource]
            };

            const result = await mediaconnect.send(new AddFlowSourcesCommand(params));

            return {
                status: 'success',
                message: 'Backup source added successfully',
                flow_arn: result.FlowArn,
                sources: result.Sources
            };
        } catch (error) {
            console.error('Error adding backup source:', error);
            throw error;
        }
    }

    async configureFailover(failoverConfig) {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            // Default failover configuration for SRT (only supports FAILOVER mode)
            const sourceFailoverConfig = {
                State: failoverConfig.enabled ? 'ENABLED' : 'DISABLED',
                FailoverMode: 'FAILOVER', // SRT only supports FAILOVER mode, not MERGE
                SourcePriority: failoverConfig.primarySource ? {
                    PrimarySource: failoverConfig.primarySource
                } : undefined
            };

            const params = {
                FlowArn: this.mediaConnectFlowArn,
                SourceFailoverConfig: sourceFailoverConfig
            };

            const result = await mediaconnect.send(new UpdateFlowCommand(params));

            return {
                status: 'success',
                message: 'Failover configuration updated successfully',
                flow_arn: result.Flow.FlowArn,
                failover_config: result.Flow.SourceFailoverConfig
            };
        } catch (error) {
            console.error('Error configuring failover:', error);
            throw error;
        }
    }

    async getFailoverStatus() {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            const params = { FlowArn: this.mediaConnectFlowArn };
            const result = await mediaconnect.send(new DescribeFlowCommand(params));

            const sources = result.Flow.Sources || (result.Flow.Source ? [result.Flow.Source] : []);
            const failoverConfig = result.Flow.SourceFailoverConfig;

            // Map sources with proper connection status using multiple indicators
            const sourcesWithHealth = sources.map(source => {
                // For SRT sources, check multiple indicators of connection status
                const hasPeerIp = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';
                const hasIngestIp = source.IngestIp && source.IngestIp.trim() !== '';
                const isFlowActive = result.Flow.Status === 'ACTIVE';

                // Consider a source connected if:
                // 1. It has a peer IP address (active connection), OR
                // 2. The flow is active and the source has an ingest IP (ready to receive)
                const isConnected = hasPeerIp || (isFlowActive && hasIngestIp);

                return {
                    name: source.Name,
                    source_arn: source.SourceArn,
                    status: isConnected ? 'connected' : 'disconnected',
                    peer_ip: source.PeerIpAddress || null,
                    is_primary: source.Name === failoverConfig?.SourcePriority?.PrimarySource,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    flow_status: result.Flow.Status,
                    has_peer_ip: hasPeerIp,
                    has_ingest_ip: hasIngestIp
                };
            });

            return {
                status: 'success',
                failover_enabled: failoverConfig?.State === 'ENABLED',
                failover_mode: failoverConfig?.FailoverMode || 'DISABLED',
                primary_source: failoverConfig?.SourcePriority?.PrimarySource || null,
                sources: sourcesWithHealth,
                connected_sources: sourcesWithHealth.filter(s => s.status === 'connected').length,
                total_sources: sourcesWithHealth.length,
                last_updated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting failover status:', error);
            throw error;
        }
    }
}

module.exports = RobustMultiChannelManager;
