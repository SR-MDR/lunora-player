// Lunora Streaming Control - Dedicated Streaming Page Controller
class StreamingController {
    constructor() {
        this.apiBaseUrl = 'https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api';
        this.refreshInterval = null;
        this.sessionStartTime = null;

        // Simple consistent polling - high-resolution CloudWatch provides real-time data
        this.pollingInterval = 5000; // 5 seconds - optimal for high-resolution CloudWatch
        this.lastSourceStates = new Map();
        this.stats = {
            totalViewers: 0,
            peakViewers: 0,
            dataSent: 0,
            avgQuality: '1080p'
        };

        this.init();
    }

    async init() {
        // Set up event listeners
        this.bindEvents();

        // Initialize status updates
        this.updateConnectionStatus();
        this.updateQuickStatus();

        // Start auto-refresh
        this.startAutoRefresh();
    }

    // ============================================================================
    // EVENT BINDING
    // ============================================================================

    bindEvents() {
        // Header buttons
        const refreshBtn = document.getElementById('refresh-btn');
        const settingsBtn = document.getElementById('settings-btn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshAll());
        }
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // Master control buttons (these are handled by multi-destination.js)
        // but we can add additional functionality here
        
        // End session button
        const endSessionBtn = document.getElementById('end-session-btn');
        if (endSessionBtn) {
            endSessionBtn.addEventListener('click', () => this.endSession());
        }

        // MediaConnect Flow controls
        const mediaConnectStartBtn = document.getElementById('mediaconnect-start-btn');
        const mediaConnectStopBtn = document.getElementById('mediaconnect-stop-btn');

        if (mediaConnectStartBtn) {
            mediaConnectStartBtn.addEventListener('click', () => this.startMediaConnectFlow());
        }

        if (mediaConnectStopBtn) {
            mediaConnectStopBtn.addEventListener('click', () => this.stopMediaConnectFlow());
        }

        // Simple source health monitoring - no complex failover controls needed
    }

    // ============================================================================
    // STATUS UPDATES
    // ============================================================================

    async updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        const backendStatusElement = document.getElementById('backend-status');
        const awsStatusElement = document.getElementById('aws-status');

        try {
            // Use the correct health endpoint (with /api prefix)
            const response = await fetch(`${this.apiBaseUrl}/health`);
            const data = await response.json();
            
            if (data.status === 'healthy') {
                if (statusElement) {
                    statusElement.textContent = '🟢 Connected';
                    statusElement.className = 'status-indicator connected';
                }
                if (backendStatusElement) {
                    backendStatusElement.textContent = 'Connected';
                    backendStatusElement.style.color = '#28a745';
                }
                if (awsStatusElement) {
                    awsStatusElement.textContent = 'Active';
                    awsStatusElement.style.color = '#28a745';
                }
            }
        } catch (error) {
            console.error('Connection check failed:', error);
            if (statusElement) {
                statusElement.textContent = '🔴 Disconnected';
                statusElement.className = 'status-indicator disconnected';
            }
            if (backendStatusElement) {
                backendStatusElement.textContent = 'Disconnected';
                backendStatusElement.style.color = '#dc3545';
            }
            if (awsStatusElement) {
                awsStatusElement.textContent = 'Error';
                awsStatusElement.style.color = '#dc3545';
            }
        }
    }

    async updateQuickStatus() {
        try {
            // Update destinations count
            const destinationsResponse = await fetch(`${this.apiBaseUrl}/destinations`);
            const destinationsData = await destinationsResponse.json();
            
            if (destinationsData.status === 'success') {
                const enabledCount = destinationsData.destinations.filter(d => d.enabled).length;
                this.updateStatusValue('destinations-count', `${enabledCount}/${destinationsData.count}`);
            }

            // Update streaming status (use the correct endpoint)
            const streamingResponse = await fetch(`${this.apiBaseUrl}/streaming/status`);
            const streamingData = await streamingResponse.json();
            
            if (streamingData.status === 'success') {
                const activeStreams = streamingData.streaming.channels?.length || 0;
                this.updateStatusValue('active-streams-count', activeStreams);
                
                // Calculate total bandwidth (simulated for now)
                const totalBandwidth = activeStreams * 5.5; // Average 5.5 Mbps per stream
                this.updateStatusValue('total-bandwidth', `${totalBandwidth.toFixed(1)} Mbps`);
            }

            // Update session time
            this.updateSessionTime();

            // Update MediaConnect Flow status
            await this.updateMediaConnectStatus();

        } catch (error) {
            console.error('Error updating quick status:', error);
        }
    }

    updateStatusValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updateSessionTime() {
        const sessionTimeElement = document.getElementById('session-time');
        const sessionDurationElement = document.getElementById('session-duration');
        
        if (this.sessionStartTime) {
            const now = new Date();
            const diff = now - this.sessionStartTime;
            const timeString = this.formatDuration(diff);
            
            if (sessionTimeElement) sessionTimeElement.textContent = timeString;
            if (sessionDurationElement) sessionDurationElement.textContent = timeString;
        } else {
            if (sessionTimeElement) sessionTimeElement.textContent = '00:00:00';
            if (sessionDurationElement) sessionDurationElement.textContent = '00:00:00';
        }
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // ============================================================================
    // MEDIACONNECT FLOW MANAGEMENT
    // ============================================================================

    async updateMediaConnectStatus() {
        try {
            // Get flow status, source health data, and failover status
            const [flowResponse, healthResponse, failoverResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/mediaconnect/flow/status`),
                fetch(`${this.apiBaseUrl}/mediaconnect/sources/health`),
                fetch(`${this.apiBaseUrl}/mediaconnect/failover/status`)
            ]);

            const flowData = await flowResponse.json();
            const healthData = healthResponse.ok ? await healthResponse.json() : null;
            const failoverData = failoverResponse.ok ? await failoverResponse.json() : null;

            const statusElement = document.getElementById('mediaconnect-status');
            const flowIndicator = statusElement?.querySelector('.flow-indicator');
            const flowText = statusElement?.querySelector('.flow-text');
            const startBtn = document.getElementById('mediaconnect-start-btn');
            const stopBtn = document.getElementById('mediaconnect-stop-btn');

            if (flowData.status === 'success' && flowData.flow) {
                const flowState = flowData.flow.status || 'error';
                const stateText = this.getFlowStateText(flowState);

                // Update status display
                if (statusElement) {
                    statusElement.setAttribute('data-state', flowState.toLowerCase());
                }
                if (flowText) {
                    flowText.textContent = stateText;
                }

                // Update button states
                if (startBtn && stopBtn) {
                    if (flowState === 'ACTIVE') {
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                    } else if (flowState === 'STANDBY') {
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                    } else {
                        startBtn.disabled = false;
                        stopBtn.disabled = false;
                    }
                }

                // Update source health details
                this.updateSimpleSourceHealthDetails(flowData.flow, healthData);

                // Update failover status
                if (failoverData && failoverData.status === 'success') {
                    this.updateFailoverStatus({
                        enabled: failoverData.failover_enabled,
                        mode: failoverData.failover_mode,
                        primary_source: failoverData.primary_source
                    });
                }

                // Detect source changes
                const sources = healthData?.sources_health?.sources || [];
                this.detectSourceChanges(sources);
            } else {
                // Error state
                if (statusElement) {
                    statusElement.setAttribute('data-state', 'error');
                }
                if (flowText) {
                    flowText.textContent = 'Error';
                }
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) stopBtn.disabled = true;

                // Hide source health on error
                this.hideSourceHealthDetails();

                // Set failover status to error state
                this.updateFailoverStatusError();
            }
        } catch (error) {
            console.error('Error updating MediaConnect status:', error);
            // Set error state
            const statusElement = document.getElementById('mediaconnect-status');
            const flowText = statusElement?.querySelector('.flow-text');
            if (statusElement) {
                statusElement.setAttribute('data-state', 'error');
            }
            if (flowText) {
                flowText.textContent = 'Error';
            }
            this.hideSourceHealthDetails();

            // Set failover status to error state
            this.updateFailoverStatusError();
        }
    }

    getFlowStateText(state) {
        const stateMap = {
            'ACTIVE': 'Active',
            'STANDBY': 'Standby',
            'STARTING': 'Starting...',
            'STOPPING': 'Stopping...',
            'ERROR': 'Error',
            'UNKNOWN': 'Unknown',
            'not_configured': 'Not Configured'
        };
        return stateMap[state] || state;
    }



    // Update failover status display
    updateFailoverStatus(failover) {
        const failoverState = document.getElementById('failover-state');

        if (!failoverState) return;

        if (failover.enabled) {
            // Show "Enabled (FAILOVER)" or just "Enabled" if mode is not available
            const modeText = failover.mode && failover.mode !== 'DISABLED' ? ` (${failover.mode})` : '';
            failoverState.textContent = `Enabled${modeText}`;
            failoverState.className = 'failover-state enabled';
            failoverState.style.color = '#28a745'; // Green for enabled
        } else {
            failoverState.textContent = 'Disabled';
            failoverState.className = 'failover-state disabled';
            failoverState.style.color = '#6c757d'; // Gray for disabled
        }
    }

    // Update failover status to error state
    updateFailoverStatusError() {
        const failoverState = document.getElementById('failover-state');
        if (failoverState) {
            failoverState.textContent = 'Error';
            failoverState.className = 'failover-state error';
            failoverState.style.color = '#dc3545'; // Red for error
        }
    }

    // Hide source health details
    hideSourceHealthDetails() {
        const sourceHealthSection = document.getElementById('source-health-section');
        if (sourceHealthSection) {
            sourceHealthSection.style.display = 'none';
        }
    }

    // ============================================================================
    // DUAL SOURCE MANAGEMENT METHODS
    // ============================================================================

    // Simple source health display - only shows if sources have data flowing
    updateSimpleSourceHealthDetails(flowData, healthData) {
        const sourceHealthSection = document.getElementById('source-health-section');

        // Always show the section if we have source data
        if (sourceHealthSection) {
            sourceHealthSection.style.display = 'flex';
        }

        // Get sources from health data
        const sources = healthData?.sources_health?.sources || [];

        // Update each source display
        sources.forEach((source, index) => {
            const sourceType = index === 0 ? 'primary' : 'secondary';
            this.updateSimpleSourceDisplay(sourceType, source);
        });

        // Hide secondary source if we only have one source
        const secondaryElement = document.getElementById('secondary-source');
        if (secondaryElement) {
            secondaryElement.style.display = sources.length > 1 ? 'block' : 'none';
        }
    }

    // Simple source display - just shows connection status and basic info
    updateSimpleSourceDisplay(sourceType, sourceData) {
        if (!sourceData) return;

        const indicator = document.getElementById(`${sourceType}-source-indicator`);
        const name = document.getElementById(`${sourceType}-source-name`);
        const bandwidth = document.getElementById(`${sourceType}-source-bandwidth`);
        const bitrate = document.getElementById(`${sourceType}-source-bitrate`);
        const protocol = document.getElementById(`${sourceType}-source-protocol`);
        const statusText = document.getElementById(`${sourceType}-source-status`);
        const sourceItem = document.getElementById(`${sourceType}-source`);

        const isConnected = sourceData.status === 'connected';

        // Update connection indicator
        if (indicator) {
            indicator.textContent = isConnected ? '🟢' : '🔴';
        }

        // Update status text
        if (statusText) {
            statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
        }

        // Update source item CSS class for border styling
        if (sourceItem) {
            if (isConnected) {
                sourceItem.classList.add('connected');
            } else {
                sourceItem.classList.remove('connected');
            }
        }

        // Update source name
        if (name) {
            name.textContent = sourceData.name || `Source ${sourceType === 'primary' ? '1' : '2'}`;
        }

        // Update connection info (IP:Port)
        if (bandwidth) {
            const ipInfo = sourceData.ingest_ip ? `${sourceData.ingest_ip}:${sourceData.ingest_port || ''}` : '---';
            bandwidth.textContent = ipInfo;
        }

        // Update bitrate display
        if (bitrate) {
            const bitrateValue = sourceData.bitrate_mbps || 0;
            bitrate.textContent = `${bitrateValue.toFixed(1)} Mbps`;

            // Color coding based on bitrate
            if (bitrateValue > 0) {
                bitrate.style.color = '#007bff'; // Blue for active bitrate
            } else {
                bitrate.style.color = '#6c757d'; // Gray for no bitrate
            }
        }

        // Update protocol
        if (protocol) {
            protocol.textContent = sourceData.protocol || 'SRT';
        }
    }



    // Simple source health monitoring - complex failover methods removed for clarity

    showNotification(message, type = 'info') {
        // Simple notification system - could be enhanced with a proper notification component
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            max-width: 300px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        `;

        document.body.appendChild(notification);

        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    async startMediaConnectFlow() {
        try {
            const startBtn = document.getElementById('mediaconnect-start-btn');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = '⏳ Starting...';
            }

            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/flow/start`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.status === 'success') {
                await this.updateMediaConnectStatus();
            } else {
                throw new Error(data.message || 'Failed to start MediaConnect flow');
            }
        } catch (error) {
            console.error('Error starting MediaConnect flow:', error);
            alert('Failed to start MediaConnect flow: ' + error.message);
        } finally {
            const startBtn = document.getElementById('mediaconnect-start-btn');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = '▶ Start';
            }
        }
    }

    async stopMediaConnectFlow() {
        try {
            const stopBtn = document.getElementById('mediaconnect-stop-btn');
            if (stopBtn) {
                stopBtn.disabled = true;
                stopBtn.textContent = '⏳ Stopping...';
            }

            const response = await fetch(`${this.apiBaseUrl}/mediaconnect/flow/stop`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.status === 'success') {
                await this.updateMediaConnectStatus();
            } else {
                throw new Error(data.message || 'Failed to stop MediaConnect flow');
            }
        } catch (error) {
            console.error('Error stopping MediaConnect flow:', error);
            alert('Failed to stop MediaConnect flow: ' + error.message);
        } finally {
            const stopBtn = document.getElementById('mediaconnect-stop-btn');
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.textContent = '⏹ Stop';
            }
        }
    }

    // ============================================================================
    // STREAMING SESSION MANAGEMENT
    // ============================================================================

    startSession() {
        this.sessionStartTime = new Date();
        const livePanel = document.getElementById('live-status-panel');
        if (livePanel) {
            livePanel.classList.remove('hidden');
        }
        
        // Update stats display
        this.updateSessionStats();
    }

    endSession() {
        if (!confirm('Are you sure you want to end the streaming session? This will stop all active streams.')) {
            return;
        }

        // Stop all destinations (this will be handled by multi-destination.js)
        if (window.multiDestination) {
            window.multiDestination.stopAllDestinations();
        }

        this.sessionStartTime = null;
        const livePanel = document.getElementById('live-status-panel');
        if (livePanel) {
            livePanel.classList.add('hidden');
        }
    }

    updateSessionStats() {
        // Update session statistics (simulated data for now)
        this.updateStatusValue('total-viewers', this.stats.totalViewers);
        this.updateStatusValue('peak-viewers', this.stats.peakViewers);
        this.updateStatusValue('data-sent', `${this.stats.dataSent.toFixed(2)} GB`);
        this.updateStatusValue('avg-quality', this.stats.avgQuality);
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    async refreshAll() {
        // Show loading state
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.textContent = '⏳';
            refreshBtn.disabled = true;
        }

        try {
            await Promise.all([
                this.updateConnectionStatus(),
                this.updateQuickStatus(),
                window.multiDestination?.loadDestinations(),
                window.multiDestination?.loadStreamingStatus()
            ]);
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            // Restore refresh button
            if (refreshBtn) {
                refreshBtn.textContent = '🔄';
                refreshBtn.disabled = false;
            }
        }
    }

    showSettings() {
        // Placeholder for settings modal
        alert('Settings panel coming soon!\n\nThis will include:\n- Stream quality settings\n- Notification preferences\n- Auto-start configurations\n- Recording options');
    }

    startAutoRefresh() {
        // Simple consistent polling with high-resolution CloudWatch backend
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            this.updateConnectionStatus();
            this.updateQuickStatus();
        }, this.pollingInterval);

        console.log(`🔄 Started auto-refresh with ${this.pollingInterval/1000}s interval`);
    }

    detectSourceChanges(sources) {
        let hasChanges = false;

        if (!sources || !Array.isArray(sources)) {
            return hasChanges;
        }

        sources.forEach(source => {
            const sourceId = source.source_arn || source.name;
            const currentStatus = source.status;
            const previousStatus = this.lastSourceStates.get(sourceId);

            if (previousStatus !== undefined && previousStatus !== currentStatus) {
                hasChanges = true;

                // Show notification for source changes
                this.showNotification(
                    `Source ${source.name}: ${previousStatus} → ${currentStatus}`,
                    currentStatus === 'connected' ? 'success' : 'warning'
                );
            }

            this.lastSourceStates.set(sourceId, currentStatus);
        });

        // Update last change time
        if (hasChanges) {
            this.lastChangeTime = Date.now();
        }

        // Log source changes - no need to change polling with high-resolution CloudWatch
        if (hasChanges) {
            console.log('🚀 Source change detected - high-resolution CloudWatch provides real-time updates');
        }

        return hasChanges;
    }



    forceRefresh() {
        // Show visual feedback
        const refreshBtn = document.getElementById('manual-refresh-btn');
        if (refreshBtn) {
            refreshBtn.style.transform = 'rotate(360deg)';
            refreshBtn.style.transition = 'transform 0.5s';
            setTimeout(() => {
                refreshBtn.style.transform = '';
                refreshBtn.style.transition = 'transform 0.2s';
            }, 500);
        }

        // High-resolution CloudWatch provides consistent real-time detection

        // Immediately trigger an update
        this.updateConnectionStatus();
        this.updateQuickStatus();

        // Show notification
        this.showNotification('🔄 Forcing refresh - checking for source changes...', 'info');
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// ============================================================================
// QUICK ACTION FUNCTIONS
// ============================================================================

function showPresetsManager() {
    alert('Presets Manager coming soon!\n\nThis will allow you to:\n- Create custom encoding presets\n- Modify existing platform presets\n- Import/export preset configurations\n- Test preset performance');
}

function showStreamingHistory() {
    alert('Streaming History coming soon!\n\nThis will show:\n- Past streaming sessions\n- Performance analytics\n- Viewer statistics\n- Revenue tracking');
}

async function testAllConnections() {
    if (!window.multiDestination) {
        alert('Multi-destination manager not available');
        return;
    }

    const destinations = window.multiDestination.destinations.filter(d => d.enabled);
    
    if (destinations.length === 0) {
        alert('No enabled destinations to test');
        return;
    }

    const results = [];
    
    for (const dest of destinations) {
        try {
            const response = await fetch(`https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api/destinations/${dest.destination_id}/test`, {
                method: 'POST'
            });
            const result = await response.json();
            results.push(`${dest.name}: ${result.status === 'success' ? '✅ OK' : '❌ Failed'}`);
        } catch (error) {
            results.push(`${dest.name}: ❌ Error`);
        }
    }
    
    alert(`Connection Test Results:\n\n${results.join('\n')}`);
}

function openPlayer() {
    window.open('index.html', '_blank');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let streamingController;

document.addEventListener('DOMContentLoaded', () => {
    streamingController = new StreamingController();
    
    // Override multi-destination callbacks to integrate with streaming controller
    if (window.multiDestination) {
        const originalStartAll = window.multiDestination.startAllDestinations;
        window.multiDestination.startAllDestinations = function() {
            const result = originalStartAll.call(this);
            if (result) {
                streamingController.startSession();
            }
            return result;
        };
        
        const originalStopAll = window.multiDestination.stopAllDestinations;
        window.multiDestination.stopAllDestinations = function() {
            const result = originalStopAll.call(this);
            streamingController.sessionStartTime = null;
            const livePanel = document.getElementById('live-status-panel');
            if (livePanel) {
                livePanel.classList.add('hidden');
            }
            return result;
        };
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (streamingController) {
        streamingController.stopAutoRefresh();
    }
});
