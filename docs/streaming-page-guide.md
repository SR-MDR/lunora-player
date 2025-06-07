# Lunora Streaming Control Page

## Overview

The Lunora Streaming Control page is a dedicated, standalone interface for managing multi-destination streaming operations. This page is separate from the AWS monitoring dashboard and focuses exclusively on streaming control and management.

## 🚀 Quick Start

### Access the Streaming Page

**Option 1: Direct Access**
```bash
npm run start-streaming
```
This starts both the backend API and the streaming page at `http://localhost:8082/streaming.html`

**Option 2: From Dashboard**
1. Open the dashboard: `http://localhost:8081/dashboard.html`
2. Click "🚀 Open Streaming Control" in the Multi-Destination Streaming section

**Option 3: Standalone**
```bash
npm run streaming  # Just the streaming page
npm run backend    # Backend API (in separate terminal)
```

## 📋 Page Features

### Header Section
- **Connection Status**: Real-time backend and AWS connectivity
- **Quick Actions**: Refresh, settings, and dashboard link
- **Status Bar**: Live overview of destinations, active streams, bandwidth, and session time

### Main Streaming Control
- **Destination Management**: Add, edit, delete, and test streaming destinations
- **Master Controls**: Start/stop all destinations simultaneously
- **Live Status Panel**: Real-time monitoring when streaming is active

### Quick Actions
- **Manage Presets**: Configure encoding presets for different platforms
- **Streaming History**: View past sessions and analytics
- **Test All Connections**: Verify connectivity to all destinations
- **Preview Player**: Test your stream output

## 🎯 Key Differences from Dashboard

| Feature | Dashboard | Streaming Page |
|---------|-----------|----------------|
| **Purpose** | AWS service monitoring | Streaming operations |
| **Focus** | Infrastructure health | Content broadcasting |
| **User Type** | System administrators | Content creators/operators |
| **Interface** | Technical metrics | Streamlined controls |
| **Updates** | Service status | Real-time streaming data |

## 🎛️ Using the Streaming Controls

### Adding Destinations

1. Click **"+ Add Destination"**
2. Choose platform:
   - **YouTube Live**: Automatic RTMP URL, enter stream key
   - **X (Twitter) Live**: Automatic RTMP URL, enter stream key  
   - **LinkedIn Live**: Automatic RTMP URL, enter stream key
   - **Custom RTMP**: Enter both RTMP URL and stream key
3. Select quality preset
4. Enable the destination
5. Test connectivity

### Starting a Stream

1. **Enable destinations** you want to stream to
2. **Test connections** to verify everything is working
3. Click **"🔴 Start All Selected"** to begin multi-destination streaming
4. Monitor the **Live Status Panel** for real-time updates

### Managing Active Streams

When streaming is active:
- **Session timer** shows how long you've been live
- **Individual destination controls** allow stopping specific streams
- **Bandwidth monitoring** shows total data usage
- **End Session** button stops all streams

## 🔧 Technical Details

### API Integration
The streaming page connects to the same backend API as the dashboard:
- **Base URL**: `http://localhost:3000/api`
- **Endpoints**: `/destinations`, `/presets`, `/streaming/status`
- **Real-time updates**: 5-second refresh interval

### Data Storage
- **Destinations**: Stored in DynamoDB `lunora-destinations` table
- **Stream Keys**: Encrypted in AWS Parameter Store
- **Presets**: Stored in DynamoDB `lunora-presets` table

### Security
- Stream keys are never displayed in plain text
- All sensitive data encrypted with AWS KMS
- API requires AWS credentials (lunora-media profile)

## 📱 Responsive Design

The streaming page is fully responsive and works on:
- **Desktop**: Full feature set with grid layouts
- **Tablet**: Optimized controls and navigation
- **Mobile**: Stacked layout with touch-friendly buttons

## 🔄 Auto-Refresh Features

The page automatically updates:
- **Connection status** every 5 seconds
- **Destination counts** when changes occur
- **Streaming status** during active sessions
- **Session timer** every second when live

## 🎨 Visual Indicators

### Status Colors
- 🟢 **Green**: Connected, ready, streaming
- 🔴 **Red**: Streaming, errors, disconnected
- 🟡 **Yellow**: Warnings, standby states
- ⚪ **Gray**: Disabled, inactive

### Live Streaming
- **Pulsing border** around live status panel
- **Animated indicators** for active streams
- **Real-time counters** for session duration
- **Color-coded metrics** for quick status assessment

## 🚀 Future Enhancements

The streaming page is designed to be extensible:

### Planned Features
- **Scheduling**: Set up automated streaming sessions
- **Recording**: Simultaneous recording while streaming
- **Analytics**: Detailed viewer and performance metrics
- **Alerts**: Notifications for stream issues
- **Mobile App**: Native mobile streaming control

### Advanced Controls
- **Source switching**: Multiple input sources
- **Quality adaptation**: Dynamic bitrate adjustment
- **Failover**: Automatic backup destination switching
- **Load balancing**: Distribute streams across channels

## 🆘 Troubleshooting

### Common Issues

**"🔴 Disconnected" status**
- Check that backend server is running (`npm run backend`)
- Verify AWS credentials are configured
- Ensure network connectivity

**"No destinations configured yet"**
- Click "Add Destination" to create your first destination
- Verify DynamoDB tables exist (`npm run setup-db`)
- Check destination configuration

**Streaming fails to start**
- Test individual destinations first
- Verify stream keys are correct
- Check RTMP URL accessibility
- Ensure MediaLive channels are configured

### Debug Information

Check browser console for:
- API connection errors
- JavaScript errors
- Network request failures
- Authentication issues

## 📞 Support

For streaming-specific issues:
1. Check the streaming page console logs
2. Verify backend API health: `http://localhost:3000/api/health`
3. Test individual destinations before multi-streaming
4. Review AWS service limits and quotas

## 🔗 Related Documentation

- [Multi-Destination Setup Guide](multi-destination-setup-guide.md)
- [Multi-Destination Architecture](multi-destination-streaming-architecture.md)
- [Production Deployment](production-deployment.md)

---

The Lunora Streaming Control page provides a focused, user-friendly interface for content creators and streaming operators, separate from the technical AWS monitoring dashboard. This separation allows for role-based access and optimized workflows for different user types.
