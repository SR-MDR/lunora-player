const DEFAULT_PRESETS = [
    // Generic Quality Presets
    {
        preset_id: 'preset_generic_720p',
        name: '720p Standard',
        platform: 'generic',
        type: 'generic',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 3000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        description: 'Standard 720p quality for most platforms',
        is_default: true,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },

    {
        preset_id: 'preset_generic_1080p',
        name: '1080p High Quality',
        platform: 'generic',
        type: 'generic',
        video: {
            codec: 'H264',
            resolution: '1920x1080',
            framerate: 30,
            bitrate: 6000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_4_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        description: 'High quality 1080p for platforms supporting higher bitrates',
        is_default: false,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },

    // YouTube-Specific Presets
    {
        preset_id: 'preset_youtube_1080p_optimized',
        name: 'YouTube 1080p Optimized',
        platform: 'youtube',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1920x1080',
            framerate: 30,
            bitrate: 6000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_4_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 8000000,
            recommended_keyframe: 2,
            low_latency: false,
            adaptive_bitrate: true
        },
        description: 'Optimized for YouTube Live with their recommended settings',
        is_default: true,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },

    {
        preset_id: 'preset_youtube_720p_mobile',
        name: 'YouTube 720p Mobile Friendly',
        platform: 'youtube',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 2500000,
            profile: 'MAIN',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 96000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 4000000,
            recommended_keyframe: 2,
            low_latency: false,
            adaptive_bitrate: true
        },
        description: 'Lower bitrate for mobile viewers and slower connections',
        is_default: false,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },

    // Twitch-Specific Presets
    {
        preset_id: 'preset_twitch_1080p_60fps',
        name: 'Twitch 1080p 60fps',
        platform: 'twitch',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1920x1080',
            framerate: 60,
            bitrate: 6000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_4_1',
            gop_size: 120,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 6000000,
            recommended_keyframe: 2,
            low_latency: true,
            adaptive_bitrate: false
        },
        description: 'High framerate gaming optimized for Twitch',
        is_default: true,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },

    {
        preset_id: 'preset_twitch_720p_standard',
        name: 'Twitch 720p Standard',
        platform: 'twitch',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 3000000,
            profile: 'HIGH',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 3500000,
            recommended_keyframe: 2,
            low_latency: true,
            adaptive_bitrate: false
        },
        description: 'Standard quality for Twitch streaming',
        is_default: false,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },

    // LinkedIn-Specific Presets
    {
        preset_id: 'preset_linkedin_720p_professional',
        name: 'LinkedIn 720p Professional',
        platform: 'linkedin',
        type: 'platform_specific',
        video: {
            codec: 'H264',
            resolution: '1280x720',
            framerate: 30,
            bitrate: 2500000,
            profile: 'MAIN',
            level: 'H264_LEVEL_3_1',
            gop_size: 60,
            rate_control: 'CBR'
        },
        audio: {
            codec: 'AAC',
            bitrate: 128000,
            sample_rate: 48000,
            channels: 2,
            coding_mode: 'CODING_MODE_2_0'
        },
        platform_settings: {
            max_bitrate: 3000000,
            recommended_keyframe: 2,
            low_latency: false,
            adaptive_bitrate: true
        },
        description: 'Professional quality optimized for LinkedIn Live',
        is_default: true,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

module.exports = { DEFAULT_PRESETS };
