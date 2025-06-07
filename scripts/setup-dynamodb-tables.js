#!/usr/bin/env node

// Lunora Player - DynamoDB Tables Setup Script
// This script creates the required DynamoDB tables for multi-destination streaming

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
    region: 'us-west-2'
});

// Set AWS profile
process.env.AWS_PROFILE = 'lunora-media';
process.env.AWS_SDK_LOAD_CONFIG = '1';

const dynamodb = new AWS.DynamoDB();

// Table definitions
const tables = [
    {
        TableName: 'lunora-destinations',
        KeySchema: [
            {
                AttributeName: 'destination_id',
                KeyType: 'HASH'
            }
        ],
        AttributeDefinitions: [
            {
                AttributeName: 'destination_id',
                AttributeType: 'S'
            }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        Tags: [
            {
                Key: 'Project',
                Value: 'lunora-player'
            },
            {
                Key: 'Environment',
                Value: 'dev'
            },
            {
                Key: 'Purpose',
                Value: 'multi-destination-streaming'
            }
        ]
    },
    {
        TableName: 'lunora-presets',
        KeySchema: [
            {
                AttributeName: 'preset_id',
                KeyType: 'HASH'
            }
        ],
        AttributeDefinitions: [
            {
                AttributeName: 'preset_id',
                AttributeType: 'S'
            }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        Tags: [
            {
                Key: 'Project',
                Value: 'lunora-player'
            },
            {
                Key: 'Environment',
                Value: 'dev'
            },
            {
                Key: 'Purpose',
                Value: 'streaming-presets'
            }
        ]
    },
    {
        TableName: 'lunora-streaming-sessions',
        KeySchema: [
            {
                AttributeName: 'session_id',
                KeyType: 'HASH'
            }
        ],
        AttributeDefinitions: [
            {
                AttributeName: 'session_id',
                AttributeType: 'S'
            }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        Tags: [
            {
                Key: 'Project',
                Value: 'lunora-player'
            },
            {
                Key: 'Environment',
                Value: 'dev'
            },
            {
                Key: 'Purpose',
                Value: 'streaming-sessions'
            }
        ]
    }
];

// Default presets to populate
const defaultPresets = [
    {
        preset_id: 'preset_youtube_hd',
        name: 'YouTube HD (1080p30)',
        platform: 'youtube',
        video_settings: {
            resolution: '1920x1080',
            framerate: 30,
            bitrate: 6000,
            codec: 'H.264',
            profile: 'High',
            keyframe_interval: 2,
            b_frames: 2
        },
        audio_settings: {
            codec: 'AAC',
            bitrate: 128,
            sample_rate: 48000,
            channels: 'stereo'
        },
        advanced_settings: {
            gop_size: 60,
            rate_control: 'CBR',
            buffer_size: 12000
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        preset_id: 'preset_x_optimized',
        name: 'X Optimized (720p30)',
        platform: 'x',
        video_settings: {
            resolution: '1280x720',
            framerate: 30,
            bitrate: 2500,
            codec: 'H.264',
            profile: 'Main',
            keyframe_interval: 2,
            b_frames: 1
        },
        audio_settings: {
            codec: 'AAC',
            bitrate: 128,
            sample_rate: 44100,
            channels: 'stereo'
        },
        advanced_settings: {
            gop_size: 60,
            rate_control: 'CBR',
            buffer_size: 5000
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        preset_id: 'preset_linkedin_hd',
        name: 'LinkedIn HD (1080p30)',
        platform: 'linkedin',
        video_settings: {
            resolution: '1920x1080',
            framerate: 30,
            bitrate: 4000,
            codec: 'H.264',
            profile: 'High',
            keyframe_interval: 2,
            b_frames: 2
        },
        audio_settings: {
            codec: 'AAC',
            bitrate: 128,
            sample_rate: 48000,
            channels: 'stereo'
        },
        advanced_settings: {
            gop_size: 60,
            rate_control: 'CBR',
            buffer_size: 8000
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        preset_id: 'preset_custom_hd',
        name: 'Custom HD (1080p30)',
        platform: 'custom',
        video_settings: {
            resolution: '1920x1080',
            framerate: 30,
            bitrate: 5000,
            codec: 'H.264',
            profile: 'High',
            keyframe_interval: 2,
            b_frames: 2
        },
        audio_settings: {
            codec: 'AAC',
            bitrate: 128,
            sample_rate: 48000,
            channels: 'stereo'
        },
        advanced_settings: {
            gop_size: 60,
            rate_control: 'CBR',
            buffer_size: 10000
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

async function createTable(tableParams) {
    try {
        console.log(`Creating table: ${tableParams.TableName}...`);
        
        // Check if table already exists
        try {
            await dynamodb.describeTable({ TableName: tableParams.TableName }).promise();
            console.log(`✅ Table ${tableParams.TableName} already exists`);
            return true;
        } catch (error) {
            if (error.code !== 'ResourceNotFoundException') {
                throw error;
            }
        }
        
        // Create the table
        const result = await dynamodb.createTable(tableParams).promise();
        console.log(`✅ Table ${tableParams.TableName} created successfully`);
        
        // Wait for table to be active
        console.log(`⏳ Waiting for table ${tableParams.TableName} to be active...`);
        await dynamodb.waitFor('tableExists', { TableName: tableParams.TableName }).promise();
        console.log(`✅ Table ${tableParams.TableName} is now active`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error creating table ${tableParams.TableName}:`, error.message);
        return false;
    }
}

async function populatePresets() {
    const docClient = new AWS.DynamoDB.DocumentClient();
    
    console.log('\n📝 Populating default presets...');
    
    for (const preset of defaultPresets) {
        try {
            // Check if preset already exists
            const existing = await docClient.get({
                TableName: 'lunora-presets',
                Key: { preset_id: preset.preset_id }
            }).promise();
            
            if (existing.Item) {
                console.log(`⏭️  Preset ${preset.preset_id} already exists, skipping`);
                continue;
            }
            
            await docClient.put({
                TableName: 'lunora-presets',
                Item: preset
            }).promise();
            
            console.log(`✅ Created preset: ${preset.name}`);
        } catch (error) {
            console.error(`❌ Error creating preset ${preset.preset_id}:`, error.message);
        }
    }
}

async function main() {
    console.log('🚀 Setting up DynamoDB tables for Lunora Player Multi-Destination Streaming\n');
    
    let allSuccess = true;
    
    // Create all tables
    for (const table of tables) {
        const success = await createTable(table);
        if (!success) {
            allSuccess = false;
        }
    }
    
    if (allSuccess) {
        // Populate default presets
        await populatePresets();
        
        console.log('\n🎉 All tables created and populated successfully!');
        console.log('\nNext steps:');
        console.log('1. Start the backend server: npm run backend');
        console.log('2. Open the dashboard: npm run dashboard');
        console.log('3. Add your streaming destinations in the Multi-Destination panel');
    } else {
        console.log('\n❌ Some tables failed to create. Please check the errors above.');
        process.exit(1);
    }
}

// Run the setup
main().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
});
