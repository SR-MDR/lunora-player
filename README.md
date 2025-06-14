# 🎥 Lunora Player - Complete Guide

[![GitHub](https://img.shields.io/github/license/SR-MDR/lunora-player)](https://github.com/SR-MDR/lunora-player/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![AWS](https://img.shields.io/badge/AWS-Media%20Services-orange.svg)](https://aws.amazon.com/media-services/)

A modern, browser-based video player with multi-language support and AWS Media Services integration for HLS streaming and dynamic multi-destination RTMP streaming.

## 🎉 **CURRENT STATUS: PRODUCTION READY**

✅ **Dynamic Multi-Destination Streaming**: WORKING and successfully streaming  
✅ **Clean Deployment System**: Automated, systematic deployment process  
✅ **AWS Service Limits**: 20 MediaLive inputs/channels approved  
✅ **Frontend-Backend Integration**: Complete working system  

## 🚀 **Quick Start**

### Prerequisites
- Node.js 22.x (Active LTS)
- AWS CLI configured with `lunora-media` profile
- AWS account access to Lunora-Media-Services (372241484305)

### 1. Clone and Setup
```bash
git clone https://github.com/SR-MDR/lunora-player.git
cd lunora-player
npm install
```

### 2. Deploy Backend
```bash
cd backend
./deploy.sh
```

### 3. Access Applications
- **Video Player**: `https://d35au6zpsr51nc.cloudfront.net/`
- **Streaming Dashboard**: `https://d35au6zpsr51nc.cloudfront.net/streaming.html`
- **Admin Dashboard**: `https://d35au6zpsr51nc.cloudfront.net/dashboard.html`
- **Backend API**: `https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/`

## 🏗️ **Architecture Overview**

### Core Components
- **MediaConnect Flow**: SRT input from Videon Edge nodes
- **Dynamic MediaLive Channels**: On-demand creation for RTMP destinations
- **MediaPackage**: HLS packaging for video player
- **CloudFront**: Global CDN for content delivery
- **Lambda API**: Multi-destination streaming management
- **DynamoDB**: Destination and session tracking

### Streaming Flow
```
Videon Edge (SRT) → MediaConnect → Dynamic MediaLive Channels → RTMP Destinations
                                ↓
                                MediaPackage → HLS Player
```

## 🎯 **Key Features**

### ✅ **Multi-Destination Streaming**
- Stream to YouTube, Twitch, LinkedIn, and custom RTMP simultaneously
- Platform-optimized encoding presets
- Individual destination control (start/stop specific platforms)
- Multi-instance support (multiple YouTube feeds for same event)
- Real-time monitoring and status updates

### ✅ **Dynamic Resource Management**
- On-demand MediaLive channel creation (cost-efficient)
- Automatic cleanup when destinations removed
- Pay-per-use model (50-60% cost reduction vs always-on)
- Service limit management (20 channels approved)

### ✅ **Video Player**
- HTML5 video player with HLS.js support
- Multi-language audio track selection
- Multi-language subtitle/caption support
- Fullscreen and responsive design
- Keyboard shortcuts for control

## 🔧 **Development**

### Project Structure
```
lunora-player/
├── backend/
│   ├── index.js                    # Main Lambda handler
│   ├── deploy.sh                   # Automated deployment
│   ├── multi-channel-manager-robust.js
│   ├── schema-migration.js
│   └── default-presets.js
├── js/
│   ├── player.js                   # Video player logic
│   ├── multi-destination.js        # Streaming management
│   └── streaming-control.js        # Dashboard controller
├── css/                            # Styling
├── docs/                           # Documentation
└── aws/cloudformation/             # Infrastructure templates
```

### Backend Deployment
The backend uses a **systematic deployment solution** that prevents recurring issues:

```bash
cd backend
./deploy.sh  # Single command deployment
```

**What it does:**
1. 🧹 Cleans up existing deployment artifacts
2. 🔍 Analyzes dependencies automatically
3. 📦 Copies all required files
4. 🚀 Deploys to Lambda with verification
5. 🧪 Tests deployment with health check

### Frontend Development
```bash
# Start development server
npm run dev

# Access applications
open http://localhost:8080        # Video player
open http://localhost:8081        # Dashboard
open http://localhost:8082        # Streaming control
```

## 📊 **API Endpoints**

### Multi-Destination Streaming
```
POST   /api/destinations              # Create new destination
DELETE /api/destinations/{id}         # Remove destination
GET    /api/destinations              # List all destinations
POST   /api/destinations/{id}/start   # Start streaming
POST   /api/destinations/{id}/stop    # Stop streaming
GET    /api/medialive/status          # MediaLive status
GET    /api/mediaconnect/flow/status  # MediaConnect status
```

### Example: Create Destination
```bash
curl -X POST "https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/destinations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "YouTube Main Event",
    "platform": "youtube",
    "rtmp_url": "rtmp://a.rtmp.youtube.com/live2",
    "stream_key": "your-stream-key",
    "preset": "1080p30"
  }'
```

## 🎮 **Usage**

### Multi-Destination Streaming
1. **Access Streaming Dashboard**: `https://d35au6zpsr51nc.cloudfront.net/streaming.html`
2. **Add Destinations**: Click "Add Destination" and configure platforms
3. **Start Streaming**: Use individual start/stop controls
4. **Monitor Status**: Real-time status updates for each destination

### Video Player
1. **Load Stream**: Use HLS URLs from MediaPackage
2. **Language Selection**: Click settings (⚙️) to select audio/subtitle languages
3. **Keyboard Shortcuts**: Space (play/pause), F (fullscreen), M (mute)

### Videon Edge Integration
Configure your Videon Edge node:
- **Protocol**: SRT Caller
- **Host**: MediaConnect flow endpoint
- **Port**: 9998
- **Latency**: 200ms

## 💰 **Cost Optimization**

### Current Architecture Benefits
- **Dynamic Channels**: Only pay for active streaming (vs always-on)
- **Cost Reduction**: 50-60% savings for typical usage (80-100 hours/month)
- **Automatic Cleanup**: Immediate resource deallocation when stopped

### Monthly Cost Estimates
- **MediaConnect Flow**: $115/month (24/7 operation)
- **Primary HLS Channel**: $42/month (24/7 operation)
- **Dynamic Channels**: $42/month per 100 hours (only when active)
- **Total**: $200-300/month (vs $500+ for always-on)

## 🔒 **Security**

### Current Measures
- CloudFront HTTPS enforcement
- S3 bucket access via CloudFront only
- CORS configuration for web player
- Stream key protection in Parameter Store
- IAM least privilege access

### AWS Configuration
- **Account**: 372241484305 (Lunora-Media-Services)
- **Region**: us-west-2 (Oregon)
- **Profile**: lunora-media

## 📋 **Troubleshooting**

### Common Issues
1. **Stream not loading**: Check MediaLive channel status
2. **API errors**: Verify Lambda function logs in CloudWatch
3. **CORS errors**: Check CloudFront CORS configuration
4. **Deployment issues**: Use `./deploy.sh` for systematic deployment

### Debug Resources
- **Lambda Logs**: `/aws/lambda/lunora-player-prod-dynamic-streaming-api`
- **Health Check**: `https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/health`
- **MediaLive Console**: Monitor channel status and metrics

## 🚀 **Deployment Lessons Learned**

### Critical Success Factors
1. **Single Source of Truth**: `backend/index.js` is the only source file
2. **Automated Deployment**: Use `./deploy.sh` for all deployments
3. **Dependency Analysis**: Automatic detection prevents missing files
4. **Clean Deployment**: Removes all temporary files and artifacts
5. **Health Check Verification**: Confirms deployment success

### Best Practices
- ✅ Always backup working code before changes
- ✅ Use systematic deployment process
- ✅ Test each component individually
- ✅ Verify AWS permissions upfront
- ✅ Monitor CloudWatch logs for issues

## 📞 **Support**

### Getting Help
1. Check this guide and troubleshooting section
2. Review AWS Media Services documentation
3. Check CloudWatch logs for specific errors
4. Open GitHub issue for application problems

### Key Resources
- **AWS Media Services**: https://docs.aws.amazon.com/media-services/
- **HLS.js Documentation**: https://github.com/video-dev/hls.js/
- **CloudWatch Logs**: Monitor Lambda and API Gateway logs

## 🎯 **Success Metrics**

### Achieved Goals
- ✅ **Dynamic destination creation**: <30 seconds
- ✅ **Real RTMP streaming**: Verified with live tests
- ✅ **Cost optimization**: 50-60% reduction vs always-on
- ✅ **Scalable architecture**: Ready for 20+ destinations
- ✅ **Systematic deployment**: Zero recurring issues

**The Lunora Player is production-ready with enterprise-grade reliability, security, and scalability!** 🎉
