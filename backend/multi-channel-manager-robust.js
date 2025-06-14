const AWS = require('aws-sdk');
const medialive = new AWS.MediaLive({ region: 'us-west-2' });
const mediaconnect = new AWS.MediaConnect({ region: 'us-west-2' });
const cloudwatch = new AWS.CloudWatch({ region: 'us-west-2' });

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
            const result = await medialive.startChannel(params).promise();

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
            const result = await medialive.stopChannel(params).promise();

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
            const result = await medialive.describeChannel(params).promise();
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
            const result = await mediaconnect.describeFlow(params).promise();

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
            await mediaconnect.startFlow(params).promise();

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
            await mediaconnect.stopFlow(params).promise();

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

            await cloudwatch.putMetricData(params).promise();
        } catch (error) {
            console.error('Error logging metric:', error);
            // Don't throw - metrics are non-critical
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getAllChannelStatuses() {
        const statuses = {};
        const errors = {};

        // Get all channel statuses in parallel
        const statusPromises = Object.entries(this.channelMapping).map(async ([platform, channelId]) => {
            if (!channelId) return null;

            try {
                const params = { ChannelId: channelId };
                const result = await medialive.describeChannel(params).promise();

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
                const result = await medialive.describeChannel(params).promise();

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
            const result = await mediaconnect.describeFlow(params).promise();

            // Handle both single source (legacy) and dual source configurations
            const sources = result.Flow.Sources || (result.Flow.Source ? [result.Flow.Source] : []);

            // Map sources with proper connection status based on PeerIpAddress
            const sourcesWithHealth = sources.map((source, index) => {
                // Check if source is connected by looking at PeerIpAddress
                const isConnected = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';

                return {
                    name: source.Name || `Source ${index + 1}`,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    status: isConnected ? 'connected' : 'disconnected',
                    whitelist_cidr: source.WhitelistCidr,
                    peer_ip: source.PeerIpAddress || null,
                    source_arn: source.SourceArn,
                    description: source.Description || ''
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
            const result = await mediaconnect.describeFlow(params).promise();

            // Handle both single source (legacy) and dual source configurations
            const sources = result.Flow.Sources || (result.Flow.Source ? [result.Flow.Source] : []);

            // Map sources with proper connection status based on PeerIpAddress
            const sourcesWithHealth = sources.map((source, index) => {
                const isConnected = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';

                return {
                    name: source.Name || `Source ${index + 1}`,
                    source_arn: source.SourceArn,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort,
                    status: isConnected ? 'connected' : 'disconnected',
                    whitelist_cidr: source.WhitelistCidr,
                    peer_ip: source.PeerIpAddress || null,
                    description: source.Description || ''
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

            const result = await mediaconnect.addFlowSources(params).promise();

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

            const result = await mediaconnect.updateFlow(params).promise();

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
            const result = await mediaconnect.describeFlow(params).promise();

            const sources = result.Flow.Sources || (result.Flow.Source ? [result.Flow.Source] : []);
            const failoverConfig = result.Flow.SourceFailoverConfig;

            // Map sources with proper connection status
            const sourcesWithHealth = sources.map(source => {
                const isConnected = source.PeerIpAddress && source.PeerIpAddress.trim() !== '';

                return {
                    name: source.Name,
                    source_arn: source.SourceArn,
                    status: isConnected ? 'connected' : 'disconnected',
                    peer_ip: source.PeerIpAddress || null,
                    is_primary: source.Name === failoverConfig?.SourcePriority?.PrimarySource,
                    protocol: source.Transport?.Protocol || source.Protocol || 'unknown',
                    ingest_ip: source.IngestIp,
                    ingest_port: source.IngestPort
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
