// Lunora Player - Streaming Presets Configuration
// Platform-optimized encoding presets for multi-destination streaming

const StreamingPresets = {
    // YouTube Live Optimized Presets
    youtube: {
        'preset_youtube_hd': {
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
            }
        },
        'preset_youtube_4k': {
            preset_id: 'preset_youtube_4k',
            name: 'YouTube 4K (2160p30)',
            platform: 'youtube',
            video_settings: {
                resolution: '3840x2160',
                framerate: 30,
                bitrate: 15000,
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
                buffer_size: 30000
            }
        }
    },

    // X (Twitter) Live Optimized Presets
    x: {
        'preset_x_optimized': {
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
            }
        }
    },

    // LinkedIn Live Optimized Presets
    linkedin: {
        'preset_linkedin_hd': {
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
            }
        },
        'preset_linkedin_mobile': {
            preset_id: 'preset_linkedin_mobile',
            name: 'LinkedIn Mobile (720p30)',
            platform: 'linkedin',
            video_settings: {
                resolution: '1280x720',
                framerate: 30,
                bitrate: 2000,
                codec: 'H.264',
                profile: 'Main',
                keyframe_interval: 2,
                b_frames: 1
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
                buffer_size: 4000
            }
        }
    },

    // HLS Player (Internal Testing)
    hls: {
        'preset_hls_test': {
            preset_id: 'preset_hls_test',
            name: 'HLS Player Test (1080p30)',
            platform: 'hls',
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
            description: 'Optimized for Lunora Player HLS testing'
        },
        'preset_hls_low_latency': {
            preset_id: 'preset_hls_low_latency',
            name: 'HLS Low Latency (720p30)',
            platform: 'hls',
            video_settings: {
                resolution: '1280x720',
                framerate: 30,
                bitrate: 3000,
                codec: 'H.264',
                profile: 'Main',
                keyframe_interval: 1,
                b_frames: 0
            },
            audio_settings: {
                codec: 'AAC',
                bitrate: 128,
                sample_rate: 48000,
                channels: 'stereo'
            },
            advanced_settings: {
                gop_size: 30,
                rate_control: 'CBR',
                buffer_size: 6000
            },
            description: 'Low latency configuration for testing'
        }
    },

    // HLS Player Presets (Direct to MediaPackage)
    hls: {
        'preset_hls_hd': {
            preset_id: 'preset_hls_hd',
            name: 'HLS Player HD (1080p30)',
            platform: 'hls',
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
            description: 'Optimized for direct HLS streaming via MediaPackage'
        },
        'preset_hls_720p': {
            preset_id: 'preset_hls_720p',
            name: 'HLS Player 720p (720p30)',
            platform: 'hls',
            video_settings: {
                resolution: '1280x720',
                framerate: 30,
                bitrate: 3000,
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
                buffer_size: 6000
            },
            description: 'Lower bandwidth option for HLS streaming'
        }
    },

    // Custom RTMP Presets (Flexible)
    custom: {
        'preset_custom_hd': {
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
            }
        },
        'preset_custom_sd': {
            preset_id: 'preset_custom_sd',
            name: 'Custom SD (720p30)',
            platform: 'custom',
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
                sample_rate: 48000,
                channels: 'stereo'
            },
            advanced_settings: {
                gop_size: 60,
                rate_control: 'CBR',
                buffer_size: 5000
            }
        },
        'preset_custom_low_bandwidth': {
            preset_id: 'preset_custom_low_bandwidth',
            name: 'Low Bandwidth (480p30)',
            platform: 'custom',
            video_settings: {
                resolution: '854x480',
                framerate: 30,
                bitrate: 1000,
                codec: 'H.264',
                profile: 'Baseline',
                keyframe_interval: 2,
                b_frames: 0
            },
            audio_settings: {
                codec: 'AAC',
                bitrate: 64,
                sample_rate: 44100,
                channels: 'stereo'
            },
            advanced_settings: {
                gop_size: 60,
                rate_control: 'CBR',
                buffer_size: 2000
            }
        }
    }
};

// Helper functions
const StreamingPresetsHelper = {
    // Get all presets for a platform
    getPresetsForPlatform: (platform) => {
        return StreamingPresets[platform] || {};
    },

    // Get all presets as a flat array
    getAllPresets: () => {
        const allPresets = [];
        Object.keys(StreamingPresets).forEach(platform => {
            Object.values(StreamingPresets[platform]).forEach(preset => {
                allPresets.push(preset);
            });
        });
        return allPresets;
    },

    // Get preset by ID
    getPresetById: (presetId) => {
        for (const platform of Object.keys(StreamingPresets)) {
            for (const preset of Object.values(StreamingPresets[platform])) {
                if (preset.preset_id === presetId) {
                    return preset;
                }
            }
        }
        return null;
    },

    // Get default preset for platform
    getDefaultPresetForPlatform: (platform) => {
        const platformPresets = StreamingPresets[platform];
        if (!platformPresets) return null;
        
        // Return the first preset as default
        const presetKeys = Object.keys(platformPresets);
        return presetKeys.length > 0 ? platformPresets[presetKeys[0]] : null;
    },

    // Validate preset configuration
    validatePreset: (preset) => {
        const required = ['preset_id', 'name', 'platform', 'video_settings', 'audio_settings'];
        for (const field of required) {
            if (!preset[field]) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }

        // Validate video settings
        const videoRequired = ['resolution', 'framerate', 'bitrate', 'codec'];
        for (const field of videoRequired) {
            if (!preset.video_settings[field]) {
                return { valid: false, error: `Missing video setting: ${field}` };
            }
        }

        // Validate audio settings
        const audioRequired = ['codec', 'bitrate', 'sample_rate'];
        for (const field of audioRequired) {
            if (!preset.audio_settings[field]) {
                return { valid: false, error: `Missing audio setting: ${field}` };
            }
        }

        return { valid: true };
    }
};

// Export for use in Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StreamingPresets, StreamingPresetsHelper };
} else {
    window.StreamingPresets = StreamingPresets;
    window.StreamingPresetsHelper = StreamingPresetsHelper;
}
