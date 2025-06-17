const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { CreateBackupCommand } = require('@aws-sdk/client-dynamodb');
const { DEFAULT_PRESETS } = require('./default-presets');

const dynamodbClient = new DynamoDBClient({ region: 'us-west-2' });
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

class SchemaMigration {
    constructor() {
        this.destinationsTable = process.env.DESTINATIONS_TABLE || 'lunora-destinations';
        this.presetsTable = process.env.PRESETS_TABLE || 'lunora-presets';
        this.sessionsTable = process.env.SESSIONS_TABLE || 'lunora-streaming-sessions';
    }

    async migrateDestinationsTable() {
        console.log('Starting DynamoDB destinations table migration...');

        try {
            // Get all existing destinations
            const scanParams = {
                TableName: this.destinationsTable
            };

            const result = await dynamodb.send(new ScanCommand(scanParams));
            const destinations = result.Items || [];

            console.log(`Found ${destinations.length} destinations to migrate`);

            // Migrate each destination
            for (const destination of destinations) {
                await this.migrateDestination(destination);
            }

            console.log('Destinations table migration completed successfully');
            return { success: true, migratedCount: destinations.length };

        } catch (error) {
            console.error('Destinations table migration failed:', error);
            throw error;
        }
    }

    async migrateDestination(destination) {
        // Add new fields if they don't exist
        const updates = {};
        let hasUpdates = false;

        if (!destination.medialive_channel_id) {
            updates.medialive_channel_id = this.getChannelIdForPlatform(destination.platform);
            hasUpdates = true;
        }

        if (!destination.medialive_channel_arn) {
            updates.medialive_channel_arn = this.getChannelArnForPlatform(destination.platform);
            hasUpdates = true;
        }

        if (!destination.channel_status) {
            updates.channel_status = 'idle';
            hasUpdates = true;
        }

        if (!destination.last_channel_sync) {
            updates.last_channel_sync = new Date().toISOString();
            hasUpdates = true;
        }

        if (!destination.created_at) {
            updates.created_at = destination.timestamp || new Date().toISOString();
            hasUpdates = true;
        }

        if (!destination.updated_at) {
            updates.updated_at = new Date().toISOString();
            hasUpdates = true;
        }

        // Add preset_id if not exists
        if (!destination.preset_id) {
            updates.preset_id = this.getDefaultPresetForPlatform(destination.platform);
            hasUpdates = true;
        }

        if (hasUpdates) {
            const updateParams = {
                TableName: this.destinationsTable,
                Key: { destination_id: destination.destination_id },
                UpdateExpression: this.buildUpdateExpression(updates),
                ExpressionAttributeNames: this.buildAttributeNames(updates),
                ExpressionAttributeValues: this.buildAttributeValues(updates)
            };

            await dynamodb.send(new UpdateCommand(updateParams));
            console.log(`Migrated destination: ${destination.destination_id} (${destination.platform})`);
        }
    }

    async populateDefaultPresets() {
        console.log('Populating default presets...');

        try {
            for (const preset of DEFAULT_PRESETS) {
                // Check if preset already exists
                const getParams = {
                    TableName: this.presetsTable,
                    Key: { preset_id: preset.preset_id }
                };

                const existingPreset = await dynamodb.send(new GetCommand(getParams));
                
                if (!existingPreset.Item) {
                    // Insert new preset
                    const putParams = {
                        TableName: this.presetsTable,
                        Item: preset
                    };

                    await dynamodb.send(new PutCommand(putParams));
                    console.log(`Added preset: ${preset.preset_id} (${preset.name})`);
                } else {
                    console.log(`Preset already exists: ${preset.preset_id}`);
                }
            }

            console.log('Default presets population completed');
            return { success: true, presetsCount: DEFAULT_PRESETS.length };

        } catch (error) {
            console.error('Failed to populate default presets:', error);
            throw error;
        }
    }

    getChannelIdForPlatform(platform) {
        const channelMapping = {
            'primary': process.env.PRIMARY_CHANNEL_ID,
            'youtube': process.env.YOUTUBE_CHANNEL_ID,
            'twitch': process.env.TWITCH_CHANNEL_ID,
            'linkedin': process.env.LINKEDIN_CHANNEL_ID,
            'custom': process.env.CUSTOM_CHANNEL_ID
        };

        return channelMapping[platform] || null;
    }

    getChannelArnForPlatform(platform) {
        const channelId = this.getChannelIdForPlatform(platform);
        if (!channelId) return null;

        const accountId = process.env.AWS_ACCOUNT_ID || '372241484305';
        const region = process.env.AWS_REGION || 'us-west-2';

        return `arn:aws:medialive:${region}:${accountId}:channel:${channelId}`;
    }

    getDefaultPresetForPlatform(platform) {
        const defaultPresets = {
            'youtube': 'preset_youtube_1080p_optimized',
            'twitch': 'preset_twitch_1080p_60fps',
            'linkedin': 'preset_linkedin_720p_professional',
            'primary': 'preset_generic_720p',
            'custom': 'preset_generic_1080p'
        };

        return defaultPresets[platform] || 'preset_generic_720p';
    }

    buildUpdateExpression(updates) {
        const setExpressions = Object.keys(updates).map(key => `#${key} = :${key}`);
        return `SET ${setExpressions.join(', ')}`;
    }

    buildAttributeNames(updates) {
        const attributeNames = {};
        Object.keys(updates).forEach(key => {
            attributeNames[`#${key}`] = key;
        });
        return attributeNames;
    }

    buildAttributeValues(updates) {
        const attributeValues = {};
        Object.entries(updates).forEach(([key, value]) => {
            attributeValues[`:${key}`] = value;
        });
        return attributeValues;
    }

    async createBackup(tableName) {
        try {
            const backupParams = {
                TableName: tableName,
                BackupName: `${tableName}-migration-backup-${Date.now()}`
            };

            const backup = await dynamodbClient.send(new CreateBackupCommand(backupParams));
            console.log(`Created backup for ${tableName}: ${backup.BackupDetails.BackupArn}`);
            return backup.BackupDetails.BackupArn;

        } catch (error) {
            console.error(`Failed to create backup for ${tableName}:`, error);
            throw error;
        }
    }

    async runFullMigration() {
        console.log('🚀 Starting full schema migration...');

        try {
            // Create backups first
            console.log('📦 Creating backups...');
            const destinationsBackup = await this.createBackup(this.destinationsTable);
            const presetsBackup = await this.createBackup(this.presetsTable);

            // Run migrations
            console.log('🔄 Running migrations...');
            const destinationsMigration = await this.migrateDestinationsTable();
            const presetsMigration = await this.populateDefaultPresets();

            console.log('✅ Full migration completed successfully!');
            return {
                success: true,
                backups: {
                    destinations: destinationsBackup,
                    presets: presetsBackup
                },
                migrations: {
                    destinations: destinationsMigration,
                    presets: presetsMigration
                }
            };

        } catch (error) {
            console.error('❌ Full migration failed:', error);
            throw error;
        }
    }
}

module.exports = SchemaMigration;
