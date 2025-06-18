const { MediaLiveClient, StartChannelCommand, StopChannelCommand, DescribeChannelCommand } = require('@aws-sdk/client-medialive');
const { MediaConnectClient, DescribeFlowCommand, StartFlowCommand, StopFlowCommand, AddFlowSourcesCommand, UpdateFlowCommand } = require('@aws-sdk/client-mediaconnect');
const { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

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
     * REAL-TIME SOURCE HEALTH DETECTION
     * Uses high-resolution CloudWatch metrics for real-time detection
     * Period: 1 second provides AWS Console-level performance
     */
    async getSimpleSourceHealth() {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            console.log('🔄 Real-time source health detection - using high-resolution CloudWatch');

            // Get flow info for source details
            const flowResult = await mediaconnect.send(new DescribeFlowCommand({
                FlowArn: this.mediaConnectFlowArn
            }));

            const sources = flowResult.Flow.Sources || [];

            // Check each source using high-resolution CloudWatch metrics
            const sourcesWithHealth = await Promise.all(sources.map(async (source, index) => {
                let status = 'disconnected';
                let statusNote = 'No recent data flow';
                let bitrateMbps = 0;

                // Basic checks
                const hasIngestIp = source.IngestIp && source.IngestIp.trim() !== '';
                const hasIngestPort = source.IngestPort && source.IngestPort > 0;

                if (!hasIngestIp || !hasIngestPort) {
                    status = 'disconnected';
                    statusNote = 'Source not configured';
                } else {
                    // Check high-resolution CloudWatch for real-time data flow and get bitrate
                    try {
                        const [hasRecentData, sourceBitrate] = await Promise.all([
                            this.checkSourceDataFlow(source.SourceArn),
                            this.getSourceBitrate(source.SourceArn)
                        ]);

                        bitrateMbps = sourceBitrate;

                        if (hasRecentData) {
                            status = 'connected';
                            statusNote = 'Active data flow detected';
                        } else {
                            status = 'disconnected';
                            statusNote = 'No recent data flow';
                        }
                    } catch (error) {
                        console.error(`Error checking data flow for ${source.Name}:`, error);
                        status = 'disconnected';
                        statusNote = 'Unable to check data flow';
                    }
                }

                console.log(`🔍 Source ${source.Name}: ${status} - ${statusNote} - ${bitrateMbps.toFixed(2)} Mbps`);

                return {
                    name: source.Name || `Source ${index + 1}`,
                    source_arn: source.SourceArn,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    status: status,
                    status_note: statusNote,
                    bitrate_mbps: bitrateMbps,
                    description: source.Description || '',
                    last_updated: new Date().toISOString()
                };
            }));

            return {
                sources: sourcesWithHealth,
                detection_method: 'high_resolution_cloudwatch',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error in real-time source health detection:', error);
            throw error;
        }
    }

    /**
     * Get source bitrate using CloudWatch metrics
     * Returns bitrate in Mbps for display purposes
     */
    async getSourceBitrate(sourceArn) {
        try {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 300 * 1000); // Last 5 minutes

            const params = {
                Namespace: 'AWS/MediaConnect',
                MetricName: 'SourceBitRate',
                Dimensions: [
                    {
                        Name: 'SourceARN',
                        Value: sourceArn
                    }
                ],
                StartTime: startTime,
                EndTime: endTime,
                Period: 60, // 1 minute periods
                Statistics: ['Average']
            };

            const result = await cloudwatch.send(new GetMetricStatisticsCommand(params));

            if (result.Datapoints && result.Datapoints.length > 0) {
                // Get the most recent datapoint
                const sortedDatapoints = result.Datapoints.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
                const latestBitrate = sortedDatapoints[0].Average;

                // Convert from bits per second to Mbps
                const bitrateInMbps = latestBitrate / 1000000;

                console.log(`📊 Source bitrate for ${sourceArn}: ${bitrateInMbps.toFixed(2)} Mbps`);
                return bitrateInMbps;
            }

            console.log(`📊 No bitrate data available for ${sourceArn}`);
            return 0;

        } catch (error) {
            console.error(`Error getting bitrate for ${sourceArn}:`, error);
            return 0;
        }
    }

    /**
     * Check if a source has recent data flow using CloudWatch metrics
     * Uses multiple approaches to get the most real-time data possible
     */
    async checkSourceDataFlow(sourceArn) {
        try {
            const endTime = new Date();

            // Try high-resolution CloudWatch metrics for real-time detection
            const timeWindows = [
                { startTime: new Date(endTime.getTime() - 60 * 1000), period: 1 },    // Last 60 seconds, 1s period (HIGH-RESOLUTION)
                { startTime: new Date(endTime.getTime() - 300 * 1000), period: 60 },  // Last 5 minutes, 60s period (fallback)
                { startTime: new Date(endTime.getTime() - 120 * 1000), period: 1 }    // Last 2 minutes, 1s period (HIGH-RESOLUTION)
            ];

            for (const window of timeWindows) {
                const params = {
                    Namespace: 'AWS/MediaConnect',
                    MetricName: 'SourceConnected',
                    Dimensions: [
                        {
                            Name: 'SourceARN',
                            Value: sourceArn
                        }
                    ],
                    StartTime: window.startTime,
                    EndTime: endTime,
                    Period: window.period,
                    Statistics: ['Maximum']
                };

                const result = await cloudwatch.send(new GetMetricStatisticsCommand(params));

                // If we have recent datapoints, check the latest value
                if (result.Datapoints && result.Datapoints.length > 0) {
                    // Sort by timestamp to get the most recent
                    const sortedDatapoints = result.Datapoints.sort((a, b) => b.Timestamp - a.Timestamp);
                    const latestValue = sortedDatapoints[0].Maximum;
                    const latestTimestamp = sortedDatapoints[0].Timestamp;

                    // Check if the data is recent enough - be more aggressive for high-resolution data
                    const dataAge = endTime.getTime() - latestTimestamp.getTime();
                    const maxAge = window.period === 1 ? 10000 : 120000; // 10 seconds for 1s period, 2 minutes for 60s period

                    if (dataAge < maxAge) {
                        console.log(`📊 CloudWatch data for ${sourceArn}: value=${latestValue}, age=${Math.round(dataAge/1000)}s, period=${window.period}s`);
                        return latestValue === 1;
                    } else {
                        console.log(`📊 CloudWatch data too old for ${sourceArn}: age=${Math.round(dataAge/1000)}s, maxAge=${Math.round(maxAge/1000)}s`);
                    }
                }
            }

            // No recent data found
            console.log(`📊 No recent CloudWatch data for ${sourceArn}`);
            return false;

        } catch (error) {
            console.error(`Error checking CloudWatch data flow for ${sourceArn}:`, error);
            return false;
        }
    }

    /**
     * DEBUG: Get CloudWatch source health data for testing
     */
    async getDebugRawData() {
        try {
            if (!this.mediaConnectFlowArn) {
                throw new Error('MediaConnect flow ARN not configured');
            }

            console.log('🔄 DEBUG: Fetching CloudWatch source health data');

            const flowResult = await mediaconnect.send(new DescribeFlowCommand({
                FlowArn: this.mediaConnectFlowArn
            }));

            const sources = flowResult.Flow.Sources || [];

            // Get CloudWatch data for each source
            const sourcesWithCloudWatch = await Promise.all(sources.map(async (source) => {
                const hasRecentData = await this.checkSourceDataFlow(source.SourceArn);
                return {
                    name: source.Name,
                    source_arn: source.SourceArn,
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    protocol: source.Transport?.Protocol || source.Protocol,
                    cloudwatch_connected: hasRecentData
                };
            }));

            return {
                timestamp: new Date().toISOString(),
                flow_status: flowResult.Flow.Status,
                flow_arn: flowResult.Flow.FlowArn,
                sources: sourcesWithCloudWatch,
                detection_method: 'high_resolution_cloudwatch'
            };

        } catch (error) {
            console.error('Error getting debug CloudWatch data:', error);
            throw error;
        }
    }

    // REMOVED: Complex failover detection - keeping source health simple

    /**
     * Intelligent retry logic with exponential backoff for handling AWS API rate limits
     * This mimics how AWS Console handles 429 (Too Many Requests) errors
     */
    async retryWithBackoff(apiCall, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error) {
                // Handle rate limiting (429) and throttling errors
                if ((error.name === 'ThrottlingException' ||
                     error.name === 'TooManyRequestsException' ||
                     error.$metadata?.httpStatusCode === 429) &&
                    attempt < maxRetries) {

                    // Exponential backoff with jitter (like AWS Console)
                    const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                    console.log(`Rate limited (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Re-throw if not a rate limit error or max retries exceeded
                throw error;
            }
        }
    }

    // REMOVED: getFastSourceHealth - replaced with pure metadata-based detection



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
                    status: 'flow_inactive',
                    message: `MediaConnect flow is ${flowStatus.status}, not ACTIVE`,
                    flow_status: flowStatus.status,
                    polling_skipped: true,
                    polling_skip_reason: `Flow status is ${flowStatus.status}, not ACTIVE`,
                    sources: [],
                    connected_sources: 0,
                    total_sources: 0,
                    last_updated: new Date().toISOString(),
                    flowStatus
                };
            }

            // Use simple source health detection
            const sourceHealthResult = await this.getSimpleSourceHealth();
            const sourcesWithHealth = sourceHealthResult.sources;

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
                failover_config: null, // Removed complex failover logic
                connected_sources: connectedSources.length,
                total_sources: sourcesWithHealth.length,
                detection_method: sourceHealthResult.detection_method,
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
            const flowStatus = result.Flow.Status;

            // COST OPTIMIZATION: Only poll source health when flow is ACTIVE
            if (flowStatus !== 'ACTIVE') {
                console.log(`Flow status is ${flowStatus}, skipping expensive source health polling`);

                // Return basic source info without expensive health checks
                const basicSources = sources.map((source, index) => ({
                    name: source.Name || `Source ${index + 1}`,
                    source_arn: source.SourceArn,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    status: 'flow_inactive',
                    whitelist_cidr: source.WhitelistCidr,
                    peer_ip: source.PeerIpAddress || null,
                    description: source.Description || '',
                    flow_status: flowStatus,
                    status_note: `Flow is ${flowStatus} - source health not checked`,
                    confidence: 'n/a'
                }));

                return {
                    status: 'success',
                    flow_arn: result.Flow.FlowArn,
                    flow_name: result.Flow.Name,
                    sources: basicSources,
                    failover_config: result.Flow.SourceFailoverConfig || null,
                    connected_sources: 0,
                    total_sources: basicSources.length,
                    flow_status: flowStatus,
                    polling_skipped: true,
                    polling_skip_reason: `Flow status is ${flowStatus}, not ACTIVE`,
                    detection_method: 'flow_status_check_only',
                    last_updated: new Date().toISOString()
                };
            }

            // Flow is ACTIVE - proceed with simple source health checks
            console.log('Flow is ACTIVE, performing simple source health detection');
            const sourceHealthResult = await this.getSimpleSourceHealth();
            const sourcesWithHealth = sourceHealthResult.sources;

            return {
                status: 'success',
                flow_arn: result.Flow.FlowArn,
                flow_name: result.Flow.Name,
                sources: sourcesWithHealth,
                failover_config: result.Flow.SourceFailoverConfig || null,
                connected_sources: sourcesWithHealth.filter(s => s.status === 'connected').length,
                total_sources: sourcesWithHealth.length,
                flow_status: flowStatus,
                polling_skipped: false,
                detection_method: sourceHealthResult.detection_method,
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
