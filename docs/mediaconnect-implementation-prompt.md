# MediaConnect Granular Control Implementation Prompt - December 2024

## 🎯 **Implementation Objective**

Implement AWS MediaConnect for granular RTMP destination control while preserving existing HLS streaming infrastructure. This provides true granular control over RTMP destinations without affecting HLS viewers, enabling add/edit/remove destinations in real-time without MediaLive channel restarts.

## 📚 **Required Reading - Review These Documents First**

### **Primary Architecture Documents**
1. **`docs/mediaconnect-granular-control-architecture.md`** - Complete implementation guide with cost analysis
2. **`docs/multi-destination-streaming-architecture.md`** - Overall system architecture with MediaConnect integration
3. **`docs/production-deployment-guide.md`** - Production deployment procedures

### **Current System Context**
4. **`backend/index.js`** - Current working Lambda function (DO NOT REPLACE - MODIFY EXISTING)
5. **`js/dashboard.js`** - Admin Dashboard frontend (recently fixed API connection)
6. **`js/multi-destination.js`** - Producer streaming interface
7. **`aws/cloudformation/mediaconnect-rtmp-router.yaml`** - MediaConnect infrastructure template (created)

## 🏗️ **Current System Status (December 2024)**

### ✅ **Working Components**
- **Frontend**: Dashboard and streaming interfaces deployed to production
- **Backend**: Lambda API with DynamoDB fully functional
- **MediaLive**: Channel 3714710 running with HLS + direct RTMP outputs
- **Database**: Status synchronization working correctly
- **Production URLs**: 
  - Admin Dashboard: `https://d35au6zpsr51nc.cloudfront.net/dashboard.html`
  - Streaming Interface: `https://d35au6zpsr51nc.cloudfront.net/streaming.html`
  - API: `https://hi2pfpdbrlcry5w73wt27xrniu0vhykl.lambda-url.us-west-2.on.aws/api`

### 🚧 **Implementation Required**
- **MediaConnect Infrastructure**: Deploy flow for RTMP routing
- **Source Management**: Admin Dashboard source configuration
- **Granular Control**: Real-time destination add/edit/remove
- **Database Schema**: Add sources table and backup URL support
- **API Enhancements**: MediaConnect integration endpoints

## 🎯 **Implementation Architecture**

### **Current State:**
```
OBS → MediaLive → MediaPackage → HLS Player (CloudFront)
                ↓
                RTMP Destinations (Limited Control - Channel Restart Required)
```

### **Target State:**
```
OBS → MediaLive ──┬─→ MediaPackage → HLS Player (CloudFront) [UNCHANGED]
                  └─→ MediaConnect → Multiple RTMP Destinations [NEW - GRANULAR CONTROL]
```

## 💰 **Cost Justification**
- **Additional Cost**: $391/month for MediaConnect flow + data transfer
- **Break-even Point**: 4+ RTMP destinations
- **Value**: Unlimited RTMP destinations with granular control
- **ROI**: Eliminates need for external streaming services

## 🔧 **Implementation Phases**

### **Phase 1: MediaConnect Infrastructure (Week 1)**

#### **1.1 Deploy MediaConnect Flow**
```bash
# Deploy CloudFormation template
aws cloudformation deploy \
    --template-file aws/cloudformation/mediaconnect-rtmp-router.yaml \
    --stack-name lunora-player-prod-mediaconnect \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-west-2 \
    --profile lunora-media
```

#### **1.2 Update MediaLive Channel Configuration**
- **Current Output Groups**: MediaPackage + RTMP (rtmp-grp-y0qhm74u)
- **New Output Groups**: MediaPackage + MediaConnect
- **Preserve HLS**: Ensure no changes to MediaPackage output
- **Test MediaConnect**: Verify flow receives stream from MediaLive

### **Phase 2: Database Schema Updates (Week 1-2)**

#### **2.1 Create Sources Table**
```sql
CREATE TABLE lunora-sources (
    source_id VARCHAR PRIMARY KEY,
    name VARCHAR,
    protocol VARCHAR, -- SRT, RTMP, RTP, NDI
    connection_url VARCHAR,
    priority INTEGER, -- 1=Primary, 2=Backup, 3=Emergency
    enabled BOOLEAN,
    host_ip VARCHAR,
    port INTEGER,
    stream_id VARCHAR,
    encryption_type VARCHAR,
    health_check_enabled BOOLEAN,
    health_check_interval INTEGER,
    medialive_input_id VARCHAR,
    input_security_group_id VARCHAR,
    input_class VARCHAR,
    health_status VARCHAR,
    last_health_check TIMESTAMP,
    connection_attempts INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### **2.2 Update Destinations Table**
```sql
-- Add new fields to existing lunora-destinations table
ALTER TABLE lunora-destinations ADD COLUMN backup_rtmp_url VARCHAR;
ALTER TABLE lunora-destinations ADD COLUMN backup_stream_key_param VARCHAR;
ALTER TABLE lunora-destinations ADD COLUMN failover_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE lunora-destinations ADD COLUMN current_active_url VARCHAR DEFAULT 'primary';
ALTER TABLE lunora-destinations ADD COLUMN mediaconnect_output_arn VARCHAR;
ALTER TABLE lunora-destinations ADD COLUMN mediaconnect_backup_output_arn VARCHAR;
ALTER TABLE lunora-destinations ADD COLUMN output_type VARCHAR DEFAULT 'medialive';
ALTER TABLE lunora-destinations ADD COLUMN last_mediaconnect_sync TIMESTAMP;
```

### **Phase 3: Backend API Development (Week 2-3)**

#### **3.1 Source Management API Endpoints**
Add to existing `backend/index.js` (DO NOT REPLACE FILE):

```javascript
// New endpoints to add:
GET /api/sources - List all configured sources
POST /api/sources - Create new source configuration
PUT /api/sources/{sourceId} - Update source configuration
DELETE /api/sources/{sourceId} - Remove source configuration
POST /api/sources/{sourceId}/test - Test source connectivity
PUT /api/sources/{sourceId}/activate - Set as active source
GET /api/sources/health - Get all source health status
```

#### **3.2 MediaConnect Integration Functions**
```javascript
// New functions to add to backend/index.js:
const addMediaConnectOutput = async (destination) => { /* Implementation */ };
const removeMediaConnectOutput = async (outputArn) => { /* Implementation */ };
const updateMediaConnectOutput = async (destination) => { /* Implementation */ };
const listMediaConnectOutputs = async () => { /* Implementation */ };
const syncMediaConnectStatus = async () => { /* Implementation */ };
```

#### **3.3 Enhanced Destination Management**
```javascript
// Update existing functions in backend/index.js:
startDestination() - Add MediaConnect flow management
stopDestination() - Remove from MediaConnect flow
createDestination() - Support backup URLs
updateDestination() - Real-time MediaConnect updates
```

### **Phase 4: Admin Dashboard Frontend (Week 3-4)**

#### **4.1 Source Management Interface**
Create new components for `js/dashboard.js`:

```javascript
// New components to add:
class SourceManager {
    // Source configuration interface
    // Multi-protocol support (SRT/RTMP/RTP/NDI)
    // Health monitoring dashboard
    // Connection testing functionality
}

class SourceConfigDialog {
    // Source configuration form
    // Protocol-specific settings
    // MediaLive integration options
    // Connection validation
}
```

#### **4.2 Enhanced Dashboard Navigation**
Update `dashboard.html` to include:
- **Source Management** section in main navigation
- **Real-time source status** indicators
- **MediaConnect flow status** monitoring
- **Source health alerts** integration

### **Phase 5: Producer Interface Enhancements (Week 4-5)**

#### **5.1 Granular Destination Control**
Update `js/multi-destination.js`:

```javascript
// Enhanced destination management:
- Real-time add/edit/remove destinations
- Backup URL configuration per destination
- Individual destination failover controls
- Live status updates without page refresh
- Source selection from admin-configured options
```

#### **5.2 Backup URL Configuration**
Add to `streaming.html`:
- **Primary/Backup URL** input fields
- **Failover enable/disable** toggles
- **Current active URL** indicators
- **Manual failover** trigger buttons

## 📋 **Technical Requirements**

### **AWS Services Integration**
```javascript
// Required AWS SDK operations:
MediaConnect:
  - describeFlow() - Get flow configuration
  - addFlowOutputs() - Add RTMP destinations
  - removeFlowOutput() - Remove destinations
  - updateFlowOutput() - Update destination settings

MediaLive: [EXISTING - PRESERVE]
  - describeChannel() - Get channel status
  - updateChannel() - Add MediaConnect output (one-time)
  - startChannel() / stopChannel() - Channel control

DynamoDB: [EXISTING - ENHANCE]
  - scan() / query() - Read sources/destinations
  - put() / update() - Create/update records
  - delete() - Remove configurations
```

### **Environment Variables**
Add to Lambda function:
```bash
MEDIACONNECT_FLOW_ARN=arn:aws:mediaconnect:us-west-2:372241484305:flow:...
MEDIACONNECT_MANAGER_FUNCTION=lunora-player-prod-mediaconnect-manager
SOURCES_TABLE=lunora-sources
# Existing variables remain unchanged
```

### **IAM Permissions**
Add to Lambda execution role:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "mediaconnect:DescribeFlow",
                "mediaconnect:AddFlowOutputs",
                "mediaconnect:RemoveFlowOutput",
                "mediaconnect:UpdateFlowOutput"
            ],
            "Resource": "arn:aws:mediaconnect:us-west-2:372241484305:flow/*"
        }
    ]
}
```

## 🧪 **Testing Strategy**

### **Phase 1 Testing: Infrastructure**
1. **MediaConnect Flow**: Verify flow receives stream from MediaLive
2. **HLS Preservation**: Confirm no impact on existing HLS streaming
3. **Cost Monitoring**: Validate $391/month cost projection

### **Phase 2 Testing: Database**
1. **Schema Migration**: Test sources table creation
2. **Data Integrity**: Verify existing destinations unchanged
3. **Backup URL Support**: Test optional backup configuration

### **Phase 3 Testing: Backend API**
1. **Source Management**: Test CRUD operations for sources
2. **MediaConnect Integration**: Verify output add/remove/update
3. **Status Synchronization**: Test real-time status updates
4. **Error Handling**: Validate robust error scenarios

### **Phase 4 Testing: Admin Dashboard**
1. **Source Configuration**: Test multi-protocol source setup
2. **Health Monitoring**: Verify real-time source status
3. **MediaLive Integration**: Test input security group creation
4. **User Experience**: Validate admin workflow efficiency

### **Phase 5 Testing: Producer Interface**
1. **Granular Control**: Test individual destination management
2. **Real-time Updates**: Verify no page refresh required
3. **Backup URLs**: Test failover functionality
4. **Source Selection**: Test admin-configured source usage

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ **HLS Streaming**: No impact on existing HLS infrastructure
- ✅ **Granular Control**: Add/edit/remove RTMP destinations independently
- ✅ **Real-time Updates**: No MediaLive channel restarts required
- ✅ **Source Management**: Admin configuration of multiple input sources
- ✅ **Backup Support**: Optional backup URLs for destinations
- ✅ **Cost Efficiency**: Predictable $391/month for unlimited destinations

### **Technical Requirements**
- ✅ **API Compatibility**: Existing endpoints continue working
- ✅ **Database Integrity**: No data loss during schema updates
- ✅ **Error Handling**: Robust error handling for all scenarios
- ✅ **Performance**: No degradation in streaming quality
- ✅ **Security**: Proper IAM permissions and access control

## 🚨 **Critical Implementation Notes**

### **DO NOT MODIFY THESE WORKING COMPONENTS**
- ❌ **`backend/index.js`**: ADD to existing file, do not replace
- ❌ **HLS streaming path**: MediaLive → MediaPackage must remain unchanged
- ❌ **Existing API endpoints**: Must continue working for backward compatibility
- ❌ **Production URLs**: Keep existing CloudFront distributions

### **PRESERVE EXISTING FUNCTIONALITY**
- ✅ **Dashboard API connection**: Recently fixed, must remain working
- ✅ **Status synchronization**: Current implementation working correctly
- ✅ **DynamoDB tables**: Existing data must be preserved
- ✅ **Parameter Store**: Stream keys and configuration intact

## 📊 **AWS Account Information**
- **Account ID**: 372241484305 (Lunora-Media-Services)
- **Region**: us-west-2 (Oregon)
- **Profile**: lunora-media
- **MediaLive Channel**: 3714710 (lunora-player-prod-obs-rtmp-channel)
- **Current Tables**: lunora-destinations, lunora-presets, lunora-streaming-sessions

## 🔄 **Migration Strategy**

### **Parallel Deployment Approach**
1. **Deploy MediaConnect** alongside existing direct RTMP outputs
2. **Test MediaConnect** with subset of destinations
3. **Gradual Migration** one destination at a time
4. **Verify Quality** and performance at each step
5. **Complete Transition** remove direct MediaLive RTMP outputs

### **Rollback Plan**
- **Keep existing MediaLive RTMP outputs** during transition
- **Database schema** designed for backward compatibility
- **Feature flags** to enable/disable MediaConnect per destination
- **Quick rollback** to direct MediaLive outputs if needed

## 🎯 **Expected Outcome**

After successful implementation:
- **Admins** can configure multiple input sources (SRT/RTMP/etc.) via Admin Dashboard
- **Producers** can add/edit/remove RTMP destinations in real-time without stopping other streams
- **HLS viewers** experience no changes or interruptions
- **Cost** is predictable at $391/month for unlimited RTMP destinations
- **System** provides enterprise-grade reliability with multiple backup layers

This implementation enables the core business requirement for granular streaming control while maintaining all existing functionality and providing clear operational benefits.

## 📁 **Codebase Structure and Key Files**

### **Current Working Files (DO NOT REPLACE)**
```
lunora-player/
├── backend/
│   ├── index.js                    # Main Lambda function - ADD TO, DON'T REPLACE
│   ├── package.json               # Dependencies - may need MediaConnect SDK
│   └── node_modules/              # AWS SDK v2 included
├── js/
│   ├── dashboard.js               # Admin Dashboard - recently fixed API connection
│   ├── multi-destination.js       # Producer interface - working
│   └── config.js                  # Configuration - may need MediaConnect URLs
├── html/
│   ├── dashboard.html             # Admin Dashboard UI
│   ├── streaming.html             # Producer streaming interface
│   └── hls-player.html           # HLS player - unchanged
├── aws/cloudformation/
│   ├── mediaconnect-rtmp-router.yaml  # MediaConnect infrastructure [CREATED]
│   └── [existing stacks]         # Preserve existing infrastructure
└── docs/
    ├── mediaconnect-granular-control-architecture.md
    ├── multi-destination-streaming-architecture.md
    └── production-deployment-guide.md
```

### **Files Requiring Updates**

#### **Backend Updates (ADD TO EXISTING)**
```javascript
// backend/index.js - ADD these functions:
const AWS = require('aws-sdk');
const mediaconnect = new AWS.MediaConnect(); // ADD this client

// ADD new source management functions:
const createSource = async (sourceConfig) => { /* Implementation */ };
const updateSource = async (sourceId, updates) => { /* Implementation */ };
const deleteSource = async (sourceId) => { /* Implementation */ };
const testSourceConnection = async (sourceId) => { /* Implementation */ };
const getSourceHealth = async (sourceId) => { /* Implementation */ };

// ADD MediaConnect integration functions:
const addMediaConnectOutput = async (destination) => { /* Implementation */ };
const removeMediaConnectOutput = async (outputArn) => { /* Implementation */ };
const updateMediaConnectOutput = async (destination) => { /* Implementation */ };

// UPDATE existing functions to support MediaConnect:
// - startDestination() - add MediaConnect flow management
// - stopDestination() - remove from MediaConnect flow
// - getDestinations() - include MediaConnect status
// - synchronizeDestinationStatus() - sync with MediaConnect
```

#### **Frontend Updates**
```javascript
// js/dashboard.js - ADD source management:
class SourceManager {
    constructor() {
        this.apiUrl = 'https://hi2pfpdbrlcry5w73wt27xrniu0vhykl.lambda-url.us-west-2.on.aws/api';
    }

    async loadSources() { /* Implementation */ }
    async createSource(sourceConfig) { /* Implementation */ }
    async updateSource(sourceId, updates) { /* Implementation */ }
    async deleteSource(sourceId) { /* Implementation */ }
    async testConnection(sourceId) { /* Implementation */ }
}

// js/multi-destination.js - ADD backup URL support:
class DestinationManager {
    // ADD backup URL configuration
    // ADD real-time destination updates
    // ADD source selection from admin-configured options
}
```

## 🔧 **Detailed Implementation Steps**

### **Step 1: MediaConnect Infrastructure Deployment**
```bash
# 1. Deploy MediaConnect CloudFormation stack
cd /path/to/lunora-player
aws cloudformation deploy \
    --template-file aws/cloudformation/mediaconnect-rtmp-router.yaml \
    --stack-name lunora-player-prod-mediaconnect \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-west-2 \
    --profile lunora-media \
    --parameter-overrides \
        ProjectName=lunora-player \
        Environment=prod \
        MediaLiveChannelId=3714710

# 2. Get MediaConnect Flow ARN from stack outputs
aws cloudformation describe-stacks \
    --stack-name lunora-player-prod-mediaconnect \
    --region us-west-2 \
    --profile lunora-media \
    --query 'Stacks[0].Outputs[?OutputKey==`MediaConnectFlowArn`].OutputValue' \
    --output text

# 3. Update Lambda environment variables
aws lambda update-function-configuration \
    --function-name lunora-player-prod-multi-destination-api \
    --environment Variables='{
        "DESTINATIONS_TABLE":"lunora-destinations",
        "PRESETS_TABLE":"lunora-presets",
        "SESSIONS_TABLE":"lunora-streaming-sessions",
        "SOURCES_TABLE":"lunora-sources",
        "MEDIACONNECT_FLOW_ARN":"arn:aws:mediaconnect:us-west-2:372241484305:flow:...",
        "MEDIALIVE_CHANNEL_ID":"3714710",
        "AWS_ACCOUNT_ID":"372241484305"
    }' \
    --region us-west-2 \
    --profile lunora-media
```

### **Step 2: Database Schema Migration**
```bash
# Create sources table using AWS CLI
aws dynamodb create-table \
    --table-name lunora-sources \
    --attribute-definitions \
        AttributeName=source_id,AttributeType=S \
    --key-schema \
        AttributeName=source_id,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-west-2 \
    --profile lunora-media

# Note: DynamoDB doesn't support ALTER TABLE
# New fields in destinations table will be added via application code
```

### **Step 3: MediaLive Channel Update**
```bash
# Get current MediaLive channel configuration
aws medialive describe-channel \
    --channel-id 3714710 \
    --region us-west-2 \
    --profile lunora-media > current-channel-config.json

# Update channel to add MediaConnect output group
# This requires careful modification of the channel configuration
# Preserve existing MediaPackage output group
# Replace RTMP output group with MediaConnect output group
```

### **Step 4: Backend Code Updates**
```javascript
// Add to backend/index.js - Source Management Endpoints
exports.handler = async (event) => {
    // ADD new routes:
    if (event.path === '/api/sources' && event.httpMethod === 'GET') {
        return await getSources();
    }
    if (event.path === '/api/sources' && event.httpMethod === 'POST') {
        return await createSource(JSON.parse(event.body));
    }
    if (event.path.startsWith('/api/sources/') && event.httpMethod === 'PUT') {
        const sourceId = event.path.split('/')[3];
        return await updateSource(sourceId, JSON.parse(event.body));
    }
    if (event.path.startsWith('/api/sources/') && event.httpMethod === 'DELETE') {
        const sourceId = event.path.split('/')[3];
        return await deleteSource(sourceId);
    }
    if (event.path.endsWith('/test') && event.httpMethod === 'POST') {
        const sourceId = event.path.split('/')[3];
        return await testSourceConnection(sourceId);
    }

    // Existing routes remain unchanged...
};
```

### **Step 5: Frontend Integration**
```html
<!-- dashboard.html - ADD source management section -->
<div id="source-management" class="admin-section">
    <h2>📡 Source Management</h2>
    <div id="source-list"></div>
    <button onclick="showAddSourceDialog()">+ Add New Source</button>
</div>

<!-- streaming.html - ADD backup URL fields -->
<div class="destination-config">
    <label>Primary RTMP URL:</label>
    <input type="text" id="primary-rtmp-url" />

    <label>Backup RTMP URL (Optional):</label>
    <input type="text" id="backup-rtmp-url" />

    <label>Enable Failover:</label>
    <input type="checkbox" id="failover-enabled" />
</div>
```

## 🚨 **Critical Success Factors**

### **1. Preserve Existing Functionality**
- **HLS streaming** must continue working without interruption
- **Current API endpoints** must remain functional
- **Database data** must be preserved during schema updates
- **Production URLs** must continue serving content

### **2. Gradual Implementation**
- **Deploy infrastructure** first, test thoroughly
- **Update backend** incrementally, test each endpoint
- **Update frontend** progressively, maintain backward compatibility
- **Migrate destinations** one at a time to MediaConnect

### **3. Monitoring and Validation**
- **Cost tracking** to validate $391/month projection
- **Performance monitoring** to ensure no degradation
- **Error logging** for robust troubleshooting
- **User acceptance testing** for both admin and producer workflows

### **4. Documentation and Training**
- **Update user guides** for new source management workflow
- **Create admin training** for source configuration
- **Document troubleshooting** procedures for MediaConnect
- **Maintain rollback procedures** for emergency situations

## 🎯 **Final Implementation Checklist**

### **Infrastructure (Week 1)**
- [ ] Deploy MediaConnect CloudFormation stack
- [ ] Update MediaLive channel configuration
- [ ] Test MediaConnect flow receives stream
- [ ] Verify HLS streaming unchanged
- [ ] Update Lambda environment variables

### **Database (Week 1-2)**
- [ ] Create sources table in DynamoDB
- [ ] Test source CRUD operations
- [ ] Add backup URL fields to destinations
- [ ] Migrate existing destination data
- [ ] Validate data integrity

### **Backend (Week 2-3)**
- [ ] Add source management API endpoints
- [ ] Implement MediaConnect integration functions
- [ ] Update existing destination management
- [ ] Add comprehensive error handling
- [ ] Test all API endpoints thoroughly

### **Frontend (Week 3-4)**
- [ ] Add source management to Admin Dashboard
- [ ] Implement source configuration dialogs
- [ ] Add backup URL support to producer interface
- [ ] Implement real-time status updates
- [ ] Test complete user workflows

### **Testing & Deployment (Week 4-5)**
- [ ] End-to-end testing of complete system
- [ ] Performance and cost validation
- [ ] User acceptance testing
- [ ] Production deployment
- [ ] Post-deployment monitoring

This comprehensive implementation plan provides the foundation for successfully implementing MediaConnect granular control while preserving all existing functionality and providing clear operational benefits.
