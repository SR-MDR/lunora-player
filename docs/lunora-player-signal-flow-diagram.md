# Lunora Player - Signal Flow Diagram & Technical Specifications

**Document Version:** 1.0  
**Date:** June 2025  
**Project:** Lunora Player - Multi-Language Video Streaming Platform  
**AWS Account:** 372241484305 (Lunora-Media-Services)  
**Region:** us-west-2 (Oregon)

---

## 📋 Executive Summary

The Lunora Player is a professional-grade live streaming platform that ingests video from Videon LiveEdge nodes via SRT or RTMP protocols, processes the content through AWS Media Services, and delivers HLS streams globally via CloudFront CDN. The system supports multi-language audio tracks and provides real-time monitoring capabilities.

## 🎯 System Architecture Overview

### Signal Flow Path
```
Videon LiveEdge Node → SRT/RTMP → AWS MediaLive → MediaPackage → CloudFront → HLS Player
```

### Key Components
- **Input**: Videon LiveEdge Node (1080i59.94 SDI/HDMI)
- **Transport**: SRT (preferred) or RTMP protocols
- **Processing**: AWS MediaLive (720p30 H.264 encoding)
- **Packaging**: AWS MediaPackage (HLS segmentation)
- **Delivery**: CloudFront CDN (global distribution)
- **Playback**: HLS.js-based web player

---

## 📹 Input Sources & Processing

### Videon LiveEdge Node Configuration
| Parameter | Value | Notes |
|-----------|-------|-------|
| **Input Format** | 1080i59.94 | SDI/HDMI input |
| **Video Processing** | Deinterlace → 720p30 | Frame rate conversion |
| **Video Encoding** | H.264 CBR, 3 Mbps | Main Profile |
| **Audio Encoding** | AAC, 96 kbps | 48kHz Stereo |
| **GOP Structure** | 90 frames (3 seconds) | Keyframe interval |

### Supported Input Sources
1. **Primary**: Videon LiveEdge Node
2. **Secondary**: IP Cameras (various formats)
3. **Tertiary**: Other H.264/AAC encoders

---

## 🔗 Streaming Protocols

### SRT Configuration (Preferred)
| Parameter | Value | Description |
|-----------|-------|-------------|
| **Mode** | Listener | Videon acts as SRT listener |
| **Port** | 9998 | AWS MediaLive SRT caller port |
| **Stream ID** | lunora-srt-stream | Unique stream identifier |
| **Latency** | 3000ms | Buffer for network stability |
| **Bandwidth** | 4 Mbps | Accommodates 3Mbps video + overhead |
| **Encryption** | OFF | For initial testing (can be enabled) |
| **Expected Latency** | 2-5 seconds | End-to-end latency |

### RTMP Configuration (Backup)
| Parameter | Value | Description |
|-----------|-------|-------------|
| **URL** | rtmp://52.35.66.17:1935/live/lunora-stream | AWS MediaLive RTMP endpoint |
| **Protocol** | RTMP Push | Standard RTMP streaming |
| **Expected Latency** | 5-10 seconds | Higher latency than SRT |

---

## ☁️ AWS Media Services Configuration

### MediaLive Channels
| Channel | ID | Type | Status | Purpose |
|---------|----|----- |--------|---------|
| **SRT Channel** | 6802366 | lunora-prod-srt-channel | IDLE | Primary SRT ingest |
| **RTMP Channel** | 6890857 | lunora-prod-channel | IDLE | Backup RTMP ingest |

### MediaLive Processing Settings
| Parameter | Value | Description |
|-----------|-------|-------------|
| **Input Resolution** | 720p | From Videon processing |
| **Output Resolution** | 720p30 | Maintained resolution |
| **Video Bitrate** | 2 Mbps | Optimized for streaming |
| **Audio Bitrate** | 96 kbps | AAC encoding |
| **GOP Size** | 90 frames | 3-second keyframe interval |
| **Encoding Mode** | CBR | Constant bitrate |

### MediaPackage Configuration
| Parameter | Value | Description |
|-----------|-------|-------------|
| **Channel ID** | lunora-player-dev-channel | Package channel |
| **Segment Duration** | 6 seconds | HLS segment length |
| **Playlist Type** | Live | Real-time streaming |
| **CORS** | Enabled | Cross-origin access |

---

## 🌐 Content Delivery & Storage

### CloudFront CDN
| Feature | Configuration | Benefit |
|---------|---------------|---------|
| **Edge Locations** | Global | Reduced latency worldwide |
| **HTTPS** | Enforced | Secure content delivery |
| **Caching** | Optimized for HLS | Improved performance |
| **Origin** | MediaPackage + S3 | Dual content sources |

### S3 Storage
| Bucket | Purpose | Access Method |
|--------|---------|---------------|
| **lunora-player-frontend-372241484305** | Player & dashboard assets | Static website hosting |
| **VOD Content** | Video on demand files | CloudFront distribution |

---

## 💻 Client Applications

### Video Player
| Feature | Technology | Capability |
|---------|------------|------------|
| **Streaming** | HLS.js | Adaptive bitrate streaming |
| **Languages** | Multi-track support | Audio & subtitle selection |
| **UI** | Responsive design | Desktop, tablet, mobile |
| **Controls** | HTML5 video | Standard playback controls |

### Dashboard
| Feature | Technology | Purpose |
|---------|------------|---------|
| **Backend** | Express.js + AWS SDK | Real-time AWS monitoring |
| **Frontend** | HTML/CSS/JavaScript | Service status visualization |
| **Monitoring** | CloudWatch integration | Metrics and alerts |
| **Cost Tracking** | AWS billing APIs | Usage and cost monitoring |

---

## 📊 Key URLs & Endpoints

### Production URLs
| Service | URL |
|---------|-----|
| **HLS Stream** | `https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/456a13256d454682b4bd708236618057/index.m3u8` |
| **Video Player** | `http://lunora-player-frontend-372241484305.s3-website-us-west-2.amazonaws.com/player/index.html` |
| **Dashboard** | `http://lunora-player-frontend-372241484305.s3-website-us-west-2.amazonaws.com/dashboard/dashboard.html` |

### Development URLs
| Service | URL |
|---------|-----|
| **Local Player** | `http://localhost:8080` |
| **Local Dashboard** | `http://localhost:8081/dashboard.html` |
| **Backend API** | `http://localhost:3000/api/health` |

### Streaming Endpoints (When Active)
| Protocol | Endpoint |
|----------|----------|
| **SRT Input** | `srt://34.208.36.232:9998` |
| **RTMP Input** | `rtmp://52.35.66.17:1935/live/lunora-stream` |

---

## 🔧 Management & Operations

### Quick Start Commands
```bash
# Start SRT channel
aws medialive start-channel --channel-id 6802366 --profile lunora-media --region us-west-2

# Start RTMP channel  
aws medialive start-channel --channel-id 6890857 --profile lunora-media --region us-west-2

# Stop all channels
aws medialive stop-channel --channel-id 6802366 --profile lunora-media --region us-west-2
aws medialive stop-channel --channel-id 6890857 --profile lunora-media --region us-west-2
```

### Development Commands
```bash
# Start local development
npm install
npm run dev                    # Player on port 8080
npm run dashboard             # Dashboard on port 8081
npm run backend              # API on port 3000

# Start all services
npm start                    # Concurrent backend + dashboard
./scripts/start-dashboard.sh # Alternative startup script
```

### Testing & Monitoring
```bash
# Test Videon connectivity
./scripts/test-videon-connectivity.sh all

# Test production SRT pipeline
./scripts/test-production-srt.sh --domain yourdomain.com

# Monitor AWS services
./scripts/monitor-aws.sh status
```

---

## 💰 Cost Optimization

### Service Costs (Approximate)
| Service | Running | Idle | Notes |
|---------|---------|------|-------|
| **MediaLive** | $50-100/month | $0/month | Charges per hour when active |
| **MediaPackage** | $10-20/month | $7-10/month | Minimal cost when idle |
| **CloudFront** | Variable | $0/month | Pay per GB transferred |
| **S3** | $2-5/month | $2-5/month | Storage and requests |
| **Total** | $62-125/month | $9-15/month | Significant savings when idle |

### Cost Management
- Stop MediaLive channels when not streaming
- Use appropriate CloudFront price class
- Implement S3 lifecycle policies
- Monitor usage with AWS Cost Explorer

---

## 🔒 Security & Compliance

### Current Security Measures
- HTTPS enforcement via CloudFront
- S3 bucket access restricted to CloudFront
- CORS configuration for web player
- Input security groups for MediaLive
- IAM roles with least privilege access

### Future Enhancements
- User authentication and authorization
- Content encryption at rest and in transit
- Access logging and monitoring
- Rate limiting and DDoS protection

---

## 📈 Performance Characteristics

### Latency Comparison
| Protocol | End-to-End Latency | Reliability | Use Case |
|----------|-------------------|-------------|----------|
| **SRT** | 2-5 seconds | Excellent | Primary streaming |
| **RTMP** | 5-10 seconds | Good | Backup/compatibility |

### Scalability
- **Concurrent Viewers**: Unlimited (CloudFront CDN)
- **Input Streams**: Multiple via different channels
- **Geographic Reach**: Global via CloudFront edge locations
- **Bandwidth**: Auto-scaling based on demand

---

## 🛠️ Troubleshooting Guide

### Common Issues
1. **Stream not loading**: Check MediaLive channel status
2. **High latency**: Verify SRT configuration and network
3. **No audio tracks**: Confirm multi-track audio in source
4. **CORS errors**: Check CloudFront CORS settings
5. **Connection failures**: Verify Videon SRT listener configuration

### Debug Commands
```bash
# Check channel status
aws medialive describe-channel --channel-id 6802366 --profile lunora-media --region us-west-2

# Test HLS endpoint
curl -I "https://dce3793146fef017.mediapackage.us-west-2.amazonaws.com/out/v1/456a13256d454682b4bd708236618057/index.m3u8"

# Monitor CloudWatch metrics
aws cloudwatch get-metric-statistics --namespace AWS/MediaLive --metric-name ActiveInputs --profile lunora-media --region us-west-2
```

---

## 📞 Support & Documentation

### Repository
- **GitHub**: https://github.com/SR-MDR/lunora-player
- **Documentation**: `/docs` directory
- **Scripts**: `/scripts` directory

### AWS Resources
- **Account**: 372241484305 (Lunora-Media-Services)
- **Region**: us-west-2 (Oregon)
- **Profile**: lunora-media

---

**Document End**

*This document provides a comprehensive overview of the Lunora Player signal flow and technical specifications. For the latest updates and detailed implementation guides, refer to the project repository and AWS console.*
