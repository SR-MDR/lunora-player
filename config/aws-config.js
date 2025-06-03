// AWS Configuration - Updated with actual deployed resources
const AWSConfig = {
    region: 'us-west-2',
    mediaPackage: {
        hlsEndpoint: 'https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/456a13256d454682b4bd708236618057/index.m3u8',
        channelId: 'lunora-player-dev-channel',
        ingestEndpoints: [
            {
                id: 'dcafb96d0d704bee9d15b5b8151d693d',
                url: 'https://49ba15978337b692.mediapackage.us-west-2.amazonaws.com/in/v2/dcafb96d0d704bee9d15b5b8151d693d/dcafb96d0d704bee9d15b5b8151d693d/channel',
                username: 'bbf46935b6e347cd86ab12fdaaa54949',
                password: '583d42b6b01d4c6cae7a296af5db9960'
            },
            {
                id: '61539f3a3e1e4a7fbb2212e00cf5a38e',
                url: 'https://38d25782ad257427.mediapackage.us-west-2.amazonaws.com/in/v2/dcafb96d0d704bee9d15b5b8151d693d/61539f3a3e1e4a7fbb2212e00cf5a38e/channel',
                username: 'ecfd90107c1e4b4892b5bc2633549689',
                password: '62fbb576dcd042a0a9381380365429c2'
            }
        ]
    },
    cloudFront: {
        domain: 'your-cloudfront-domain.cloudfront.net'
    },
    s3: {
        bucket: 'lunora-media-videos-dev-372241484305'
    },
    stackName: 'lunora-player-manual-setup',
    environment: 'dev'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AWSConfig;
}
