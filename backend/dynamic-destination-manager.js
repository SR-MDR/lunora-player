// Dynamic Destination Manager - MediaConnect + MediaLive Integration
const AWS = require('aws-sdk');

class DynamicDestinationManager {
    constructor() {
        this.mediaConnect = new AWS.MediaConnect({ region: 'us-west-2' });
        this.mediaLive = new AWS.MediaLive({ region: 'us-west-2' });
        this.dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' });
        
        // Configuration from environment variables
        this.config = {
            mediaConnectFlowArn: process.env.MEDIACONNECT_FLOW_ARN,
            destinationsTable: process.env.DESTINATIONS_TABLE || 'lunora-destinations',
            presetsTable: process.env.PRESETS_TABLE || 'lunora-presets',
            accountId: process.env.AWS_ACCOUNT_ID || '372241484305',
            region: 'us-west-2'
        };

        // Platform-specific MediaLive channel templates
        this.channelTemplates = {
            youtube: {
                name: 'YouTube Streaming Channel',
                description: 'Dynamic MediaLive channel for YouTube streaming',
                encoderSettings: {
                    VideoDescriptions: [{
                        Name: 'video_1080p30',
                        CodecSettings: {
                            H264Settings: {
                                Profile: 'HIGH',
                                Level: 'H264_LEVEL_4_1',
                                RateControlMode: 'CBR',
                                Bitrate: 6000000,
                                FramerateControl: 'SPECIFIED',
                                FramerateNumerator: 30,
                                FramerateDenominator: 1,
                                GopSize: 60,
                                GopSizeUnits: 'FRAMES'
                            }
                        },
                        Width: 1920,
                        Height: 1080
                    }],
                    AudioDescriptions: [{
                        Name: 'audio_aac',
                        AudioSelectorName: 'default-audio-selector',
                        CodecSettings: {
                            AacSettings: {
                                Bitrate: 128000,
                                CodingMode: 'CODING_MODE_2_0',
                                SampleRate: 48000
                            }
                        }
                    }],
                    OutputGroups: [{
                        Name: 'RTMP_Output_Group',
                        OutputGroupSettings: {
                            RtmpGroupSettings: {
                                AuthenticationScheme: 'COMMON',
                                CacheFullBehavior: 'DISCONNECT_IMMEDIATELY',
                                CacheLength: 30,
                                CaptionData: 'ALL',
                                RestartDelay: 15
                            }
                        },
                        Outputs: [{
                            OutputName: 'rtmp_output',
                            VideoDescriptionName: 'video_1080p30',
                            AudioDescriptionNames: ['audio_aac'],
                            OutputSettings: {
                                RtmpOutputSettings: {
                                    Destination: {
                                        DestinationRefId: 'rtmp-destination'
                                    },
                                    CertificateMode: 'SELF_SIGNED',
                                    ConnectionRetryInterval: 2,
                                    NumRetries: 3
                                }
                            }
                        }]
                    }],
                    TimecodeConfig: {
                        Source: 'EMBEDDED'
                    }
                }
            },
            twitch: {
                name: 'Twitch Streaming Channel',
                description: 'Dynamic MediaLive channel for Twitch streaming',
                encoderSettings: {
                    VideoDescriptions: [{
                        Name: 'video_1080p60',
                        CodecSettings: {
                            H264Settings: {
                                Profile: 'HIGH',
                                Level: 'H264_LEVEL_4_1',
                                RateControlMode: 'CBR',
                                Bitrate: 6000000,
                                FramerateControl: 'SPECIFIED',
                                FramerateNumerator: 60,
                                FramerateDenominator: 1,
                                GopSize: 120,
                                GopSizeUnits: 'FRAMES'
                            }
                        },
                        Width: 1920,
                        Height: 1080
                    }],
                    AudioDescriptions: [{
                        Name: 'audio_aac',
                        AudioSelectorName: 'default-audio-selector',
                        CodecSettings: {
                            AacSettings: {
                                Bitrate: 128000,
                                CodingMode: 'CODING_MODE_2_0',
                                SampleRate: 48000
                            }
                        }
                    }],
                    OutputGroups: [{
                        Name: 'RTMP_Output_Group',
                        OutputGroupSettings: {
                            RtmpGroupSettings: {
                                AuthenticationScheme: 'COMMON',
                                CacheFullBehavior: 'DISCONNECT_IMMEDIATELY',
                                CacheLength: 30,
                                CaptionData: 'ALL',
                                RestartDelay: 15
                            }
                        },
                        Outputs: [{
                            OutputName: 'rtmp_output',
                            VideoDescriptionName: 'video_1080p60',
                            AudioDescriptionNames: ['audio_aac'],
                            OutputSettings: {
                                RtmpOutputSettings: {
                                    Destination: {
                                        DestinationRefId: 'rtmp-destination'
                                    },
                                    CertificateMode: 'SELF_SIGNED',
                                    ConnectionRetryInterval: 2,
                                    NumRetries: 3
                                }
                            }
                        }]
                    }],
                    TimecodeConfig: {
                        Source: 'EMBEDDED'
                    }
                }
            },
            linkedin: {
                name: 'LinkedIn Streaming Channel',
                description: 'Dynamic MediaLive channel for LinkedIn streaming',
                encoderSettings: {
                    VideoDescriptions: [{
                        Name: 'video_720p30',
                        CodecSettings: {
                            H264Settings: {
                                Profile: 'HIGH',
                                Level: 'H264_LEVEL_3_1',
                                RateControlMode: 'CBR',
                                Bitrate: 3000000,
                                FramerateControl: 'SPECIFIED',
                                FramerateNumerator: 30,
                                FramerateDenominator: 1,
                                GopSize: 60,
                                GopSizeUnits: 'FRAMES'
                            }
                        },
                        Width: 1280,
                        Height: 720
                    }],
                    AudioDescriptions: [{
                        Name: 'audio_aac',
                        AudioSelectorName: 'default-audio-selector',
                        CodecSettings: {
                            AacSettings: {
                                Bitrate: 128000,
                                CodingMode: 'CODING_MODE_2_0',
                                SampleRate: 48000
                            }
                        }
                    }],
                    OutputGroups: [{
                        Name: 'RTMP_Output_Group',
                        OutputGroupSettings: {
                            RtmpGroupSettings: {
                                AuthenticationScheme: 'COMMON',
                                CacheFullBehavior: 'DISCONNECT_IMMEDIATELY',
                                CacheLength: 30,
                                CaptionData: 'ALL',
                                RestartDelay: 15
                            }
                        },
                        Outputs: [{
                            OutputName: 'rtmp_output',
                            VideoDescriptionName: 'video_720p30',
                            AudioDescriptionNames: ['audio_aac'],
                            OutputSettings: {
                                RtmpOutputSettings: {
                                    Destination: {
                                        DestinationRefId: 'rtmp-destination'
                                    },
                                    CertificateMode: 'SELF_SIGNED',
                                    ConnectionRetryInterval: 2,
                                    NumRetries: 3
                                }
                            }
                        }]
                    }],
                    TimecodeConfig: {
                        Source: 'EMBEDDED'
                    }
                }
            },
            custom: {
                name: 'Custom RTMP Channel',
                description: 'Dynamic MediaLive channel for custom RTMP destinations',
                encoderSettings: {
                    VideoDescriptions: [{
                        Name: 'video_1080p30',
                        CodecSettings: {
                            H264Settings: {
                                Profile: 'HIGH',
                                Level: 'H264_LEVEL_4_1',
                                RateControlMode: 'CBR',
                                Bitrate: 5000000,
                                FramerateControl: 'SPECIFIED',
                                FramerateNumerator: 30,
                                FramerateDenominator: 1,
                                GopSize: 60,
                                GopSizeUnits: 'FRAMES'
                            }
                        },
                        Width: 1920,
                        Height: 1080
                    }],
                    AudioDescriptions: [{
                        Name: 'audio_aac',
                        AudioSelectorName: 'default-audio-selector',
                        CodecSettings: {
                            AacSettings: {
                                Bitrate: 128000,
                                CodingMode: 'CODING_MODE_2_0',
                                SampleRate: 48000
                            }
                        }
                    }],
                    OutputGroups: [{
                        Name: 'RTMP_Output_Group',
                        OutputGroupSettings: {
                            RtmpGroupSettings: {
                                AuthenticationScheme: 'COMMON',
                                CacheFullBehavior: 'DISCONNECT_IMMEDIATELY',
                                CacheLength: 30,
                                CaptionData: 'ALL',
                                RestartDelay: 15
                            }
                        },
                        Outputs: [{
                            OutputName: 'rtmp_output',
                            VideoDescriptionName: 'video_1080p30',
                            AudioDescriptionNames: ['audio_aac'],
                            OutputSettings: {
                                RtmpOutputSettings: {
                                    Destination: {
                                        DestinationRefId: 'rtmp-destination'
                                    },
                                    CertificateMode: 'SELF_SIGNED',
                                    ConnectionRetryInterval: 2,
                                    NumRetries: 3
                                }
                            }
                        }]
                    }],
                    TimecodeConfig: {
                        Source: 'EMBEDDED'
                    }
                }
            }
        };
    }

    /**
     * Create a new destination with dynamic MediaLive channel
     */
    async createDestination(destinationData) {
        const { name, platform, rtmpUrl, streamKey, preset } = destinationData;
        
        try {
            console.log(`Creating dynamic destination: ${name} (${platform})`);
            
            // Generate unique destination ID
            const destinationId = `dest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const timestamp = new Date().toISOString();
            
            // Step 1: Create MediaLive input for this destination
            const inputName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_input_${destinationId}`;
            const mediaLiveInput = await this.createMediaLiveInput(inputName);
            
            // Step 2: Create MediaConnect output to the new MediaLive input
            const outputName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_output_${destinationId}`;
            const mediaConnectOutput = await this.createMediaConnectOutput(outputName, mediaLiveInput);
            
            // Step 3: Create MediaLive channel with RTMP destination
            const channelName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_channel_${destinationId}`;
            const mediaLiveChannel = await this.createMediaLiveChannel(
                channelName, 
                mediaLiveInput, 
                platform, 
                rtmpUrl, 
                streamKey
            );
            
            // Step 4: Store destination metadata in DynamoDB
            const destination = {
                destination_id: destinationId,
                name,
                platform,
                rtmp_url: rtmpUrl,
                preset: preset || platform,
                status: 'idle',
                media_live_channel_id: mediaLiveChannel.ChannelId,
                media_live_input_id: mediaLiveInput.Input.Id,
                media_connect_output_arn: mediaConnectOutput.Output.OutputArn,
                created_at: timestamp,
                updated_at: timestamp,
                metadata: {
                    channel_name: channelName,
                    input_name: inputName,
                    output_name: outputName
                }
            };
            
            await this.dynamodb.put({
                TableName: this.config.destinationsTable,
                Item: destination
            }).promise();
            
            console.log(`Successfully created dynamic destination: ${destinationId}`);
            
            return {
                success: true,
                destination_id: destinationId,
                destination,
                resources: {
                    mediaLiveChannelId: mediaLiveChannel.ChannelId,
                    mediaLiveInputId: mediaLiveInput.Input.Id,
                    mediaConnectOutputArn: mediaConnectOutput.Output.OutputArn
                }
            };
            
        } catch (error) {
            console.error('Error creating dynamic destination:', error);

            // Cleanup any partially created resources if destinationId was created
            if (typeof destinationId !== 'undefined') {
                await this.cleanupFailedDestination(destinationId);
            }

            throw new Error(`Failed to create dynamic destination: ${error.message}`);
        }
    }

    /**
     * Remove a destination and cleanup all associated resources
     */
    async removeDestination(destinationId) {
        try {
            console.log(`Removing dynamic destination: ${destinationId}`);
            
            // Get destination details from DynamoDB
            const destination = await this.getDestination(destinationId);
            if (!destination) {
                throw new Error('Destination not found');
            }
            
            // Step 1: Stop MediaLive channel if running
            if (destination.status === 'running') {
                await this.stopMediaLiveChannel(destination.media_live_channel_id);
            }
            
            // Step 2: Delete MediaLive channel
            await this.deleteMediaLiveChannel(destination.media_live_channel_id);
            
            // Step 3: Remove MediaConnect output
            await this.removeMediaConnectOutput(destination.media_connect_output_arn);
            
            // Step 4: Delete MediaLive input
            await this.deleteMediaLiveInput(destination.media_live_input_id);
            
            // Step 5: Remove from DynamoDB
            await this.dynamodb.delete({
                TableName: this.config.destinationsTable,
                Key: { destination_id: destinationId }
            }).promise();
            
            console.log(`Successfully removed dynamic destination: ${destinationId}`);
            
            return {
                success: true,
                destination_id: destinationId,
                message: 'Destination and all associated resources removed successfully'
            };
            
        } catch (error) {
            console.error('Error removing dynamic destination:', error);
            throw new Error(`Failed to remove dynamic destination: ${error.message}`);
        }
    }

    /**
     * Start streaming to a destination
     */
    async startDestination(destinationId) {
        try {
            console.log(`Starting dynamic destination: ${destinationId}`);
            
            const destination = await this.getDestination(destinationId);
            if (!destination) {
                throw new Error('Destination not found');
            }
            
            if (destination.status === 'running') {
                throw new Error('Destination is already running');
            }
            
            // Start MediaLive channel
            await this.startMediaLiveChannel(destination.media_live_channel_id);
            
            // Update status in DynamoDB
            await this.updateDestinationStatus(destinationId, 'starting');
            
            // Wait for channel to reach RUNNING state
            await this.waitForChannelState(destination.media_live_channel_id, 'RUNNING');
            
            // Update status to running
            await this.updateDestinationStatus(destinationId, 'running');
            
            console.log(`Successfully started dynamic destination: ${destinationId}`);
            
            return {
                success: true,
                destination_id: destinationId,
                status: 'running',
                message: 'Destination started successfully'
            };
            
        } catch (error) {
            console.error('Error starting dynamic destination:', error);
            
            // Update status to error
            await this.updateDestinationStatus(destinationId, 'error');
            
            throw new Error(`Failed to start dynamic destination: ${error.message}`);
        }
    }

    /**
     * Stop streaming to a destination
     */
    async stopDestination(destinationId) {
        try {
            console.log(`Stopping dynamic destination: ${destinationId}`);
            
            const destination = await this.getDestination(destinationId);
            if (!destination) {
                throw new Error('Destination not found');
            }
            
            if (destination.status !== 'running') {
                throw new Error('Destination is not running');
            }
            
            // Stop MediaLive channel
            await this.stopMediaLiveChannel(destination.media_live_channel_id);
            
            // Update status in DynamoDB
            await this.updateDestinationStatus(destinationId, 'stopping');
            
            // Wait for channel to reach IDLE state
            await this.waitForChannelState(destination.media_live_channel_id, 'IDLE');
            
            // Update status to idle
            await this.updateDestinationStatus(destinationId, 'idle');
            
            console.log(`Successfully stopped dynamic destination: ${destinationId}`);
            
            return {
                success: true,
                destination_id: destinationId,
                status: 'idle',
                message: 'Destination stopped successfully'
            };
            
        } catch (error) {
            console.error('Error stopping dynamic destination:', error);
            
            // Update status to error
            await this.updateDestinationStatus(destinationId, 'error');
            
            throw new Error(`Failed to stop dynamic destination: ${error.message}`);
        }
    }

    /**
     * Helper Methods for AWS Service Integration
     */

    async createMediaLiveInput(inputName) {
        // First, create or get input security group
        const securityGroupId = await this.getOrCreateInputSecurityGroup();

        const params = {
            Name: inputName,
            Type: 'RTP_PUSH',
            Destinations: [{
                StreamName: inputName
            }],
            InputSecurityGroups: [securityGroupId],
            Tags: {
                Project: 'lunora-player',
                Purpose: 'dynamic-streaming'
            }
        };

        const result = await this.mediaLive.createInput(params).promise();
        console.log(`Created MediaLive input: ${result.Input.Id}`);
        return result;
    }

    async getOrCreateInputSecurityGroup() {
        const securityGroupName = 'lunora-dynamic-streaming-security-group';

        try {
            // Try to find existing security group
            const listResult = await this.mediaLive.listInputSecurityGroups().promise();
            const existingGroup = listResult.InputSecurityGroups.find(
                group => group.Tags && group.Tags.Name === securityGroupName
            );

            if (existingGroup) {
                console.log(`Using existing input security group: ${existingGroup.Id}`);
                return existingGroup.Id;
            }

            // Create new security group
            const createParams = {
                WhitelistRules: [{
                    Cidr: '0.0.0.0/0'  // Allow MediaConnect's dynamic IPs
                }],
                Tags: {
                    Name: securityGroupName,
                    Project: 'lunora-player',
                    Purpose: 'dynamic-streaming-mediaconnect'
                }
            };

            const createResult = await this.mediaLive.createInputSecurityGroup(createParams).promise();
            console.log(`Created input security group: ${createResult.SecurityGroup.Id}`);
            return createResult.SecurityGroup.Id;

        } catch (error) {
            console.error('Error managing input security group:', error);
            throw error;
        }
    }

    async createMediaConnectOutput(outputName, mediaLiveInput) {
        const inputDestination = mediaLiveInput.Input.Destinations[0];

        // Extract IP address from RTP URL (format: rtp://IP:PORT)
        const urlMatch = inputDestination.Url.match(/rtp:\/\/([^:]+):(\d+)/);
        if (!urlMatch) {
            throw new Error(`Invalid MediaLive input URL format: ${inputDestination.Url}`);
        }

        const destinationIp = urlMatch[1];
        const destinationPort = parseInt(urlMatch[2]);

        const params = {
            FlowArn: this.config.mediaConnectFlowArn,
            Outputs: [{
                Name: outputName,
                Protocol: 'rtp-fec',
                Destination: destinationIp,
                Port: destinationPort,
                Description: `Dynamic output for ${outputName}`
            }]
        };

        const result = await this.mediaConnect.addFlowOutputs(params).promise();
        console.log(`Created MediaConnect output: ${result.Outputs[0].OutputArn}`);
        return { Output: result.Outputs[0] };
    }

    async createMediaLiveChannel(channelName, mediaLiveInput, platform, rtmpUrl, streamKey) {
        const template = this.channelTemplates[platform] || this.channelTemplates.custom;

        const params = {
            Name: channelName,
            ChannelClass: 'SINGLE_PIPELINE',
            RoleArn: `arn:aws:iam::${this.config.accountId}:role/lunora-player-prod-medialive-role`,
            InputSpecification: {
                Codec: 'AVC',
                MaximumBitrate: 'MAX_50_MBPS',
                Resolution: 'HD'
            },
            InputAttachments: [{
                InputId: mediaLiveInput.Input.Id,
                InputAttachmentName: `${channelName}_input`,
                InputSettings: {
                    SourceEndBehavior: 'CONTINUE',
                    AudioSelectors: [{
                        Name: 'default-audio-selector',
                        SelectorSettings: {
                            AudioTrackSelection: {
                                Tracks: [{
                                    Track: 1
                                }]
                            }
                        }
                    }],
                    VideoSelector: {
                        ColorSpace: 'FOLLOW',
                        ColorSpaceUsage: 'FALLBACK'
                    }
                }
            }],
            Destinations: [{
                Id: 'rtmp-destination',
                Settings: [{
                    Url: rtmpUrl,
                    StreamName: streamKey,
                    Username: '',
                    PasswordParam: ''
                }]
            }],
            EncoderSettings: template.encoderSettings,
            Tags: {
                Project: 'lunora-player',
                Platform: platform,
                Purpose: 'dynamic-streaming'
            }
        };

        const result = await this.mediaLive.createChannel(params).promise();
        console.log(`Created MediaLive channel: ${result.Channel.Id}`);
        return result.Channel;
    }

    async deleteMediaLiveChannel(channelId) {
        try {
            await this.mediaLive.deleteChannel({ ChannelId: channelId }).promise();
            console.log(`Deleted MediaLive channel: ${channelId}`);
        } catch (error) {
            console.warn(`Failed to delete MediaLive channel ${channelId}:`, error.message);
        }
    }

    async deleteMediaLiveInput(inputId) {
        try {
            await this.mediaLive.deleteInput({ InputId: inputId }).promise();
            console.log(`Deleted MediaLive input: ${inputId}`);
        } catch (error) {
            console.warn(`Failed to delete MediaLive input ${inputId}:`, error.message);
        }
    }

    async removeMediaConnectOutput(outputArn) {
        try {
            const params = {
                FlowArn: this.config.mediaConnectFlowArn,
                OutputArn: outputArn
            };
            await this.mediaConnect.removeFlowOutput(params).promise();
            console.log(`Removed MediaConnect output: ${outputArn}`);
        } catch (error) {
            console.warn(`Failed to remove MediaConnect output ${outputArn}:`, error.message);
        }
    }

    async startMediaLiveChannel(channelId) {
        await this.mediaLive.startChannel({ ChannelId: channelId }).promise();
        console.log(`Started MediaLive channel: ${channelId}`);
    }

    async stopMediaLiveChannel(channelId) {
        await this.mediaLive.stopChannel({ ChannelId: channelId }).promise();
        console.log(`Stopped MediaLive channel: ${channelId}`);
    }

    async getDestination(destinationId) {
        const result = await this.dynamodb.get({
            TableName: this.config.destinationsTable,
            Key: { destination_id: destinationId }
        }).promise();

        return result.Item;
    }

    async updateDestinationStatus(destinationId, status) {
        const params = {
            TableName: this.config.destinationsTable,
            Key: { destination_id: destinationId },
            UpdateExpression: 'SET #status = :status, updated_at = :timestamp',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': status,
                ':timestamp': new Date().toISOString()
            }
        };

        await this.dynamodb.update(params).promise();
        console.log(`Updated destination ${destinationId} status to: ${status}`);
    }

    async waitForChannelState(channelId, targetState, timeoutSeconds = 120) {
        const startTime = Date.now();
        const timeout = timeoutSeconds * 1000;

        while (Date.now() - startTime < timeout) {
            try {
                const result = await this.mediaLive.describeChannel({ ChannelId: channelId }).promise();
                const currentState = result.State;

                console.log(`Channel ${channelId} state: ${currentState}, waiting for: ${targetState}`);

                if (currentState === targetState) {
                    console.log(`Channel ${channelId} reached target state: ${targetState}`);
                    return result;
                }

                // Wait 10 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 10000));
            } catch (error) {
                console.error('Error checking channel state:', error);
                throw error;
            }
        }

        throw new Error(`Timeout waiting for channel ${channelId} to reach state: ${targetState}`);
    }

    async cleanupFailedDestination(destinationId) {
        try {
            console.log(`Cleaning up failed destination: ${destinationId}`);

            // Try to get destination from DynamoDB
            const destination = await this.getDestination(destinationId);
            if (destination) {
                // Cleanup resources if they exist
                if (destination.media_live_channel_id) {
                    await this.deleteMediaLiveChannel(destination.media_live_channel_id);
                }
                if (destination.media_connect_output_arn) {
                    await this.removeMediaConnectOutput(destination.media_connect_output_arn);
                }
                if (destination.media_live_input_id) {
                    await this.deleteMediaLiveInput(destination.media_live_input_id);
                }

                // Remove from DynamoDB
                await this.dynamodb.delete({
                    TableName: this.config.destinationsTable,
                    Key: { destination_id: destinationId }
                }).promise();
            }

            console.log(`Cleanup completed for failed destination: ${destinationId}`);
        } catch (error) {
            console.warn(`Failed to cleanup destination ${destinationId}:`, error.message);
        }
    }

    /**
     * List all destinations with their current status
     */
    async listDestinations() {
        try {
            const result = await this.dynamodb.scan({
                TableName: this.config.destinationsTable
            }).promise();

            const destinations = await Promise.all(result.Items.map(async (item) => {
                // Get real-time channel status if channel exists
                let channelStatus = 'unknown';
                if (item.media_live_channel_id) {
                    try {
                        const channelResult = await this.mediaLive.describeChannel({
                            ChannelId: item.media_live_channel_id
                        }).promise();
                        channelStatus = channelResult.State;
                    } catch (error) {
                        console.warn(`Failed to get channel status for ${item.media_live_channel_id}:`, error.message);
                    }
                }

                return {
                    ...item,
                    real_time_status: channelStatus
                };
            }));

            return {
                success: true,
                destinations,
                count: destinations.length
            };
        } catch (error) {
            console.error('Error listing destinations:', error);
            throw new Error(`Failed to list destinations: ${error.message}`);
        }
    }
}

module.exports = DynamicDestinationManager;
