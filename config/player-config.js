// Lunora Player Configuration
const PlayerConfig = {
    // AWS Configuration
    aws: {
        region: 'us-west-2', // Oregon region
        mediaLive: {
            // Will be populated with your actual channel IDs
            channels: {
                primary: 'your-primary-channel-id',
                backup: 'your-backup-channel-id'
            }
        },
        mediaPackage: {
            // Actual deployed endpoint URLs
            endpoints: {
                hls: 'https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/456a13256d454682b4bd708236618057/index.m3u8',
                dash: 'https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/456a13256d454682b4bd708236618057/index.mpd'
            }
        },
        cloudFront: {
            domain: 'your-cloudfront-domain.cloudfront.net'
        },
        s3: {
            bucket: 'lunora-media-videos-dev-372241484305',
            region: 'us-west-2'
        }
    },

    // Player Settings
    player: {
        // HLS.js configuration
        hlsConfig: {
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2,
            nudgeOffset: 0.1,
            nudgeMaxRetry: 3,
            maxFragLookUpTolerance: 0.25,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            liveDurationInfinity: false,
            enableSoftwareAES: true,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 1,
            manifestLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 1000,
            startFragPrefetch: false,
            testBandwidth: true
        },

        // Default language preferences
        defaultLanguages: {
            audio: 'en', // English
            subtitle: null // No subtitles by default
        },

        // Supported languages
        supportedLanguages: {
            'en': 'English',
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'it': 'Italiano',
            'pt': 'Português',
            'ja': '日本語',
            'ko': '한국어',
            'zh': '中文',
            'ar': 'العربية',
            'ru': 'Русский'
        },

        // Video quality preferences
        qualitySettings: {
            auto: true,
            preferredQuality: 'auto',
            maxQuality: '1080p'
        },

        // UI Settings
        ui: {
            showQualitySelector: true,
            showLanguageSelector: true,
            showFullscreenButton: true,
            showVolumeControl: true,
            showProgressBar: true,
            showTimeDisplay: true,
            autoHideControls: true,
            autoHideDelay: 3000 // 3 seconds
        }
    },

    // Videon Edge Integration
    videonEdge: {
        // SRT configuration for live feeds
        srt: {
            defaultPort: 9998,
            latency: 200, // milliseconds
            encryption: false,
            passphrase: null
        },
        
        // Edge node endpoints (to be configured)
        nodes: [
            {
                id: 'edge-node-1',
                name: 'Primary Edge Node',
                srtUrl: 'srt://your-edge-node-1:9998',
                location: 'Primary Location'
            },
            {
                id: 'edge-node-2', 
                name: 'Backup Edge Node',
                srtUrl: 'srt://your-edge-node-2:9998',
                location: 'Backup Location'
            }
        ]
    },

    // Analytics and Monitoring
    monitoring: {
        enableAnalytics: true,
        enableErrorReporting: true,
        enablePerformanceMonitoring: true,
        
        // CloudWatch integration
        cloudWatch: {
            enabled: false, // Enable when AWS credentials are configured
            namespace: 'LunoraPlayer',
            region: 'us-west-2'
        }
    },

    // Feature Flags
    features: {
        multiLanguageAudio: true,
        multiLanguageSubtitles: true,
        aiTranslation: false, // Will be enabled in phase 2
        whisperIntegration: false, // Will be enabled in phase 2
        userAuthentication: false, // Will be enabled in future phase
        adaptiveBitrate: true,
        lowLatencyMode: true,
        dvrFunctionality: false
    },

    // Test Streams for Development
    testStreams: {
        hls: [
            {
                name: 'Mux Test Stream (Multi-language)',
                url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                description: 'Test stream with multiple audio tracks'
            },
            {
                name: 'Apple Test Stream',
                url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
                description: 'Apple HLS test stream'
            },
            {
                name: 'Bitmovin Test Stream',
                url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
                description: 'Bitmovin test stream'
            }
        ]
    },

    // Error Messages
    errorMessages: {
        networkError: 'Network error occurred. Please check your connection.',
        mediaError: 'Media playback error. The stream may be unavailable.',
        hlsNotSupported: 'HLS is not supported in this browser.',
        streamNotFound: 'Stream not found or unavailable.',
        authenticationRequired: 'Authentication required to access this stream.',
        genericError: 'An unexpected error occurred. Please try again.'
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerConfig;
}
