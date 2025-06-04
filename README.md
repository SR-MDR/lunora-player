# Lunora Player

[![GitHub](https://img.shields.io/github/license/SR-MDR/lunora-player)](https://github.com/SR-MDR/lunora-player/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/SR-MDR/lunora-player)](https://github.com/SR-MDR/lunora-player/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/SR-MDR/lunora-player)](https://github.com/SR-MDR/lunora-player/issues)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![AWS](https://img.shields.io/badge/AWS-Media%20Services-orange.svg)](https://aws.amazon.com/media-services/)

A modern, browser-based video player with multi-language support and AWS Media Services integration for HLS streaming.

## Features

### Current (MVP)
- ✅ HTML5 video player with HLS.js support
- ✅ Multi-language audio track selection
- ✅ Multi-language subtitle/caption support
- ✅ Fullscreen and windowed playback modes
- ✅ AWS MediaLive integration for live streaming
- ✅ AWS MediaPackage for HLS packaging
- ✅ CloudFront CDN distribution
- ✅ S3 storage for video files
- ✅ SRT input support for Videon Edge nodes
- ✅ Responsive design for all screen sizes
- ✅ Keyboard shortcuts for player control

### Planned (Future Phases)
- 🔄 AI-powered translation using Whisper
- 🔄 Automatic speech recognition
- 🔄 User authentication and access control
- 🔄 Advanced analytics and monitoring
- 🔄 DVR functionality for live streams

## Quick Start

### Prerequisites
- Node.js (for development server)
- AWS CLI configured with access to Lunora-Media-Services account (372241484305)
- AWS account with Media Services enabled in us-west-2 region

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure AWS Access
```bash
# Configure AWS CLI for Lunora-Media-Services account
aws configure --profile lunora-media
# Enter credentials for account 372241484305, region us-west-2

# Set the profile for deployment
export AWS_PROFILE=lunora-media
```

### 3. Deploy AWS Infrastructure
```bash
# Deploy the AWS Media Services stack
./scripts/deploy-aws.sh deploy

# Start the MediaLive channel (this will incur AWS charges)
./scripts/deploy-aws.sh start-channel
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Open the Player
Navigate to `http://localhost:8080` in your browser.

### 6. Monitor AWS Services (Real-time Dashboard)
```bash
# Start both backend API and dashboard (recommended)
npm start

# Or start services individually:
npm run backend    # API server on port 3000
npm run dashboard  # Dashboard on port 8081

# Or use the startup script
./scripts/start-dashboard.sh

# Command-line monitoring tool
./scripts/monitor-aws.sh status
```

**Dashboard URLs:**
- **Real-time Dashboard**: `http://localhost:8081/dashboard.html`
- **Backend API**: `http://localhost:3000/api/health`
- **Video Player**: `http://localhost:8080`
- **Videon Test Page**: `http://localhost:8082/videon-test.html`

## Architecture

### Frontend Components
- **HTML5 Video Player**: Built with HLS.js for adaptive streaming
- **Language Selector**: Dynamic audio and subtitle track selection
- **Responsive UI**: Works on desktop, tablet, and mobile devices

### AWS Backend Services
- **MediaLive**: Live stream ingestion and encoding
- **MediaPackage**: HLS packaging and origin services
- **CloudFront**: Global content delivery network
- **S3**: Video file storage and static hosting

### Integration Points
- **Videon Edge Nodes**: SRT input for live feeds
- **HLS Streaming**: Adaptive bitrate streaming
- **Multi-language Support**: Separate audio and subtitle tracks

## Configuration

### Player Configuration
Edit `config/player-config.js` to customize:
- HLS.js settings
- Default language preferences
- Quality settings
- UI options

### AWS Configuration
The `config/aws-config.js` file is auto-generated during deployment but can be manually edited if needed.

### Environment Variables
Copy `.env.example` to `.env` and update with your values:
```bash
cp .env.example .env
```

## Usage

### Loading Streams

#### Live Stream (AWS MediaLive)
1. Configure your Videon Edge node to send SRT to the MediaLive input
2. Start the MediaLive channel
3. Use the live stream URL in the player

#### Video on Demand (S3)
1. Upload video files to your S3 bucket
2. Ensure files are accessible via CloudFront
3. Use the CloudFront URL in the player

#### Test Streams
The player includes several test streams for development and testing.

### Language Selection
1. Click the "Settings" button (⚙️) in the player
2. Select desired audio language
3. Select desired subtitle language (or "No Subtitles")
4. Click "Apply" to change languages

### Keyboard Shortcuts
- `Space` or `K`: Play/Pause
- `F`: Toggle fullscreen
- `M`: Toggle mute
- `←/→`: Seek backward/forward 10 seconds
- `↑/↓`: Volume up/down

## Development

### Project Structure
```
lunora-player/
├── index.html              # Main player page
├── css/
│   └── player.css          # Player styles
├── js/
│   ├── player.js           # Main player logic
│   └── language-selector.js # Language selection
├── config/
│   ├── player-config.js    # Player configuration
│   └── aws-config.js       # AWS configuration (auto-generated)
├── aws/
│   └── cloudformation/
│       └── media-services.yaml # AWS infrastructure
├── scripts/
│   └── deploy-aws.sh       # Deployment script
└── docs/                   # Documentation
```

### Adding New Features
1. Update the appropriate JavaScript modules
2. Add new configuration options to `player-config.js`
3. Update the CSS for any UI changes
4. Test with various stream types

### AWS Infrastructure Updates
1. Modify `aws/cloudformation/media-services.yaml`
2. Run `./scripts/deploy-aws.sh validate` to check the template
3. Deploy with `./scripts/deploy-aws.sh deploy`

## Videon Edge Integration

### Connectivity Testing
Before configuring streaming, test connectivity between your Videon Edge node and the Lunora Player backend:

```bash
# Test connectivity using the command-line script
./scripts/test-videon-connectivity.sh all

# Or test individual components
./scripts/test-videon-connectivity.sh basic    # Basic GET test
./scripts/test-videon-connectivity.sh post     # POST data test
./scripts/test-videon-connectivity.sh status   # Stream status check
```

**Web-based Testing:**
- Open `http://localhost:8082/videon-test.html` for interactive testing
- Test GET/POST requests directly from your browser
- View real-time responses and status

### API Endpoints for Videon Edge Nodes
Your Videon Edge node can use these endpoints for monitoring and testing:

- **GET** `http://localhost:3000/api/videon/test` - Basic connectivity test
- **POST** `http://localhost:3000/api/videon/test` - Data transmission test
- **GET** `http://localhost:3000/api/videon/stream-status` - Stream infrastructure status

### SRT Configuration
1. Configure your Videon Edge node with the SRT output settings:
   - **Protocol**: SRT Caller
   - **Host**: Your MediaLive input endpoint
   - **Port**: 9998 (or as configured)
   - **Latency**: 200ms (recommended)

2. Start streaming from your Videon Edge node
3. Monitor the MediaLive channel for incoming stream

### HTTP Monitoring (Optional)
Configure your Videon Edge node to periodically check connectivity:
- **URL**: `http://localhost:3000/api/videon/test`
- **Method**: GET or POST
- **Interval**: 60 seconds
- **Timeout**: 10 seconds
- **User-Agent**: `Videon-Edge/[firmware-version]`

### Multiple Edge Nodes
The system supports multiple Videon Edge nodes for redundancy:
- Configure primary and backup nodes
- Use MediaLive input failover for automatic switching
- Monitor stream health via CloudWatch

## Monitoring and Troubleshooting

### AWS CloudWatch
Monitor your streams using CloudWatch metrics:
- MediaLive channel health
- MediaPackage origin metrics
- CloudFront cache performance

### Common Issues
1. **Stream not loading**: Check MediaLive channel status
2. **No audio tracks**: Verify stream contains multiple audio tracks
3. **CORS errors**: Check CloudFront CORS configuration
4. **High latency**: Adjust MediaLive and MediaPackage settings

### Debug Mode
Enable debug mode in `config/player-config.js`:
```javascript
hlsConfig: {
    debug: true,
    // ... other settings
}
```

## Cost Optimization

### AWS Costs
- **MediaLive**: Charges per hour when channel is running
- **MediaPackage**: Charges per GB of content packaged
- **CloudFront**: Charges per GB of data transfer
- **S3**: Charges for storage and requests

### Recommendations
1. Stop MediaLive channels when not in use
2. Use appropriate CloudFront price class
3. Implement S3 lifecycle policies for old content
4. Monitor usage with AWS Cost Explorer

## Security

### Current Security Measures
- CloudFront HTTPS enforcement
- S3 bucket access via CloudFront only
- CORS configuration for web player
- Input security groups for MediaLive

### Future Security Enhancements
- User authentication and authorization
- Content encryption at rest and in transit
- Access logging and monitoring
- Rate limiting and DDoS protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review AWS Media Services documentation
3. Open an issue in the repository
