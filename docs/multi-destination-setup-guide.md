# Multi-Destination Streaming Setup Guide

## Overview

The Lunora Player now supports multi-destination streaming, allowing you to broadcast simultaneously to multiple platforms including YouTube Live, X (Twitter) Live, LinkedIn Live, and custom RTMP destinations.

## 🚀 Quick Start

### 1. Set Up DynamoDB Tables

First, create the required DynamoDB tables for storing destinations and presets:

```bash
npm run setup-db
```

This will create:
- `lunora-destinations` - Stores streaming destination configurations
- `lunora-presets` - Stores encoding presets for different platforms
- `lunora-streaming-sessions` - Tracks streaming session history

### 2. Start the Services

Start both the backend API and dashboard:

```bash
npm start
```

This runs:
- Backend API on `http://localhost:3000`
- Dashboard on `http://localhost:8081`

### 3. Access the Multi-Destination Panel

Open your browser to `http://localhost:8081/dashboard.html` and scroll to the **Multi-Destination Streaming** section.

## 📋 Adding Streaming Destinations

### YouTube Live

1. Click **"+ Add Destination"**
2. Fill in the form:
   - **Name**: "YouTube Main Channel"
   - **Platform**: "YouTube Live"
   - **Stream Key**: Your YouTube stream key from YouTube Studio
   - **Preset**: "YouTube HD (1080p30)"
3. Click **"Create Destination"**

**Getting YouTube Stream Key:**
1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click "Go Live" → "Stream"
3. Copy the "Stream key"

### X (Twitter) Live

1. Click **"+ Add Destination"**
2. Fill in the form:
   - **Name**: "X Live Stream"
   - **Platform**: "X (Twitter) Live"
   - **Stream Key**: Your X stream key from X Media Studio
   - **Preset**: "X Optimized (720p30)"
3. Click **"Create Destination"**

**Getting X Stream Key:**
1. Go to [X Media Studio](https://studio.twitter.com)
2. Navigate to "Live" → "Producer"
3. Copy the "Stream key"

### LinkedIn Live

1. Click **"+ Add Destination"**
2. Fill in the form:
   - **Name**: "LinkedIn Professional"
   - **Platform**: "LinkedIn Live"
   - **Stream Key**: Your LinkedIn stream key
   - **Preset**: "LinkedIn HD (1080p30)"
3. Click **"Create Destination"**

**Getting LinkedIn Stream Key:**
1. Go to [LinkedIn Live](https://www.linkedin.com/live/)
2. Create a live event
3. Copy the "Stream key" from the broadcast setup

### Custom RTMP Destination

1. Click **"+ Add Destination"**
2. Fill in the form:
   - **Name**: "Custom Server"
   - **Platform**: "Custom RTMP"
   - **RTMP Server URL**: Your custom RTMP server URL
   - **Stream Key**: Your custom stream key
   - **Preset**: "Custom HD (1080p30)"
3. Click **"Create Destination"**

## 🎛️ Streaming Controls

### Starting a Multi-Destination Stream

1. **Enable Destinations**: Make sure your desired destinations are enabled (green status)
2. **Test Connections**: Click the "🧪 Test" button on each destination to verify connectivity
3. **Start Streaming**: Click **"🔴 Start All Selected"** to begin streaming to all enabled destinations

### Individual Destination Control

Each destination card has individual controls:
- **▶️ Start**: Start streaming to this destination only
- **⏹️ Stop**: Stop streaming to this destination
- **🧪 Test**: Test connectivity to this destination
- **⚙️ Edit**: Modify destination settings

### Master Controls

- **🔴 Start All Selected**: Begin streaming to all enabled destinations
- **⏹️ Stop All**: Stop streaming to all destinations
- **⏸️ Pause All**: Temporarily pause all streams (future feature)

## 📊 Monitoring

### Live Status Panel

When streaming is active, the Live Status Panel shows:
- **Session Duration**: How long you've been streaming
- **Active Destinations**: Real-time status of each destination
- **Bandwidth Usage**: Total bandwidth consumption
- **Viewer Counts**: Viewers per platform (when available)

### Destination Status Indicators

- 🟢 **Ready**: Destination is configured and ready to stream
- 🔴 **Streaming**: Currently streaming to this destination
- 🟡 **Error**: Connection or configuration issue
- ⚪ **Disabled**: Destination is disabled

## ⚙️ Platform-Specific Settings

### YouTube Live Presets

- **YouTube HD**: 1080p30, 6Mbps, optimized for YouTube's requirements
- **YouTube 4K**: 2160p30, 15Mbps, for high-quality streams

### X (Twitter) Live Presets

- **X Optimized**: 720p30, 2.5Mbps, optimized for X's bandwidth limits

### LinkedIn Live Presets

- **LinkedIn HD**: 1080p30, 4Mbps, professional quality
- **LinkedIn Mobile**: 720p30, 2Mbps, mobile-optimized

### Custom RTMP Presets

- **Custom HD**: 1080p30, 5Mbps, general high-quality preset
- **Custom SD**: 720p30, 2.5Mbps, standard quality
- **Low Bandwidth**: 480p30, 1Mbps, for limited bandwidth scenarios

## 🔧 Troubleshooting

### Common Issues

**"Failed to load destinations"**
- Ensure the backend server is running (`npm run backend`)
- Check that DynamoDB tables are created (`npm run setup-db`)
- Verify AWS credentials are configured

**"Test failed" for a destination**
- Verify the stream key is correct
- Check that the RTMP URL is accessible
- Ensure your network allows outbound RTMP connections

**"Failed to start destination"**
- Confirm the destination is enabled
- Check that MediaLive channels are configured
- Verify AWS MediaLive service limits

### Backend API Endpoints

The multi-destination system provides these API endpoints:

```
GET    /api/destinations           - List all destinations
POST   /api/destinations           - Create new destination
PUT    /api/destinations/:id       - Update destination
DELETE /api/destinations/:id       - Delete destination
POST   /api/destinations/:id/test  - Test destination connectivity
GET    /api/presets               - List encoding presets
GET    /api/streaming/status       - Get streaming status
```

### Database Tables

**lunora-destinations**
- Stores destination configurations
- Stream keys are encrypted in AWS Parameter Store
- Includes platform, presets, and status information

**lunora-presets**
- Contains encoding presets for each platform
- Video and audio settings optimized per platform
- Customizable for specific requirements

## 🔒 Security

### Stream Key Protection

- Stream keys are never stored in DynamoDB
- All stream keys are encrypted in AWS Systems Manager Parameter Store
- API responses show `***ENCRYPTED***` instead of actual keys
- Parameter Store uses AWS KMS for encryption

### Access Control

- Backend API requires AWS credentials
- DynamoDB tables use IAM permissions
- Parameter Store access is restricted by IAM roles

## 📈 Scaling

### Multiple Channels

The current implementation supports:
- Single MediaLive channel with multiple outputs
- Up to 10 simultaneous RTMP destinations per channel
- Bandwidth scaling based on destination count

### Future Enhancements

- Multiple MediaLive channels for redundancy
- Load balancing across channels
- Geographic distribution of encoding
- Advanced failover mechanisms

## 💰 Cost Considerations

### AWS Service Costs

**MediaLive**: ~$3-8/hour when streaming (varies by output count)
**Data Transfer**: ~$0.09/GB for RTMP egress to external platforms
**DynamoDB**: ~$5-20/month for configuration storage
**Parameter Store**: ~$2-5/month for encrypted parameters

### Cost Optimization

- Stop MediaLive channels when not streaming
- Use appropriate encoding presets for bandwidth efficiency
- Monitor data transfer costs for high-volume streaming
- Consider CloudFront for viewer-facing content

## 🆘 Support

For issues or questions:

1. Check the browser console for JavaScript errors
2. Review backend logs for API errors
3. Verify AWS service status and limits
4. Test individual destinations before multi-streaming

## 🔄 Updates

This multi-destination streaming system is designed to be extensible. Future updates may include:

- Additional platform integrations (Twitch, Facebook Live)
- Advanced scheduling and automation
- Enhanced analytics and reporting
- Mobile app integration
- Advanced user management and permissions
