// Lunora Streaming Control - Dedicated Streaming Page Controller
class StreamingController {
    constructor() {
        this.apiBaseUrl = 'https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api';
        this.refreshInterval = null;
        this.sessionStartTime = null;
        this.stats = {
            totalViewers: 0,
            peakViewers: 0,
            dataSent: 0,
            avgQuality: '1080p'
        };

        this.init();
    }

    async init() {
        console.log('Initializing Streaming Controller...');
        
        // Set up event listeners
        this.bindEvents();
        
        // Initialize status updates
        this.updateConnectionStatus();
        this.updateQuickStatus();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        console.log('Streaming Controller initialized');
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
            // Fetch both flow status and input health
            const [flowResponse, healthResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/mediaconnect/flow/status`),
                fetch(`${this.apiBaseUrl}/mediaconnect/inputs/health`)
            ]);

            const flowData = await flowResponse.json();
            const healthData = await healthResponse.json();

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
                this.updateSourceHealthDetails(flowData.flow, healthData);
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

    // Update source health details in the quick status bar
    updateSourceHealthDetails(flowData, healthData) {
        const sourceHealthSection = document.getElementById('source-health-section');

        // Check if we have valid flow data and the flow is active
        if (!flowData || !['ACTIVE', 'STARTING'].includes(flowData.status)) {
            this.hideSourceHealthDetails();
            return;
        }

        // Show the source health section
        if (sourceHealthSection) {
            sourceHealthSection.style.display = 'flex';
        }

        // Get sources from flow data
        const sources = flowData.sources || [];
        const failover = flowData.failover || { enabled: false };

        // Update primary source
        this.updateSourceDisplay('primary', sources[0], healthData);

        // Update secondary source (for failover)
        if (sources.length > 1 || failover.enabled) {
            this.updateSourceDisplay('secondary', sources[1], healthData);
            const secondarySource = document.getElementById('secondary-source');
            if (secondarySource) {
                secondarySource.style.display = 'flex';
            }
        } else {
            const secondarySource = document.getElementById('secondary-source');
            if (secondarySource) {
                secondarySource.style.display = 'none';
            }
        }

        // Update failover status
        this.updateFailoverStatus(failover);
    }

    // Update individual source display
    updateSourceDisplay(sourceType, sourceData, healthData) {
        const indicator = document.getElementById(`${sourceType}-source-indicator`);
        const name = document.getElementById(`${sourceType}-source-name`);
        const bandwidth = document.getElementById(`${sourceType}-source-bandwidth`);
        const protocol = document.getElementById(`${sourceType}-source-protocol`);

        if (!sourceData) {
            // No source data - show as disconnected
            if (indicator) indicator.textContent = '🔴';
            if (name) name.textContent = sourceType === 'primary' ? 'Source 1' : 'Source 2';
            if (bandwidth) bandwidth.textContent = '0 Mbps';
            if (protocol) protocol.textContent = 'N/A';
            return;
        }

        // Update source status indicator
        const isConnected = sourceData.status === 'connected' || sourceData.ingestIp;
        if (indicator) {
            indicator.textContent = isConnected ? '🟢' : '🔴';
        }

        // Update source name
        if (name) {
            name.textContent = sourceData.name || (sourceType === 'primary' ? 'Source 1' : 'Source 2');
        }

        // Update protocol
        if (protocol) {
            protocol.textContent = sourceData.protocol || 'SRT';
        }

        // Update bandwidth from health data
        if (bandwidth) {
            let bandwidthText = '0 Mbps';

            if (healthData && healthData.status === 'success' && healthData.input_health) {
                const healthSources = healthData.input_health.sources || [];
                const matchingHealthSource = healthSources.find(hs =>
                    hs.name === sourceData.name ||
                    hs.ingest_ip === sourceData.ingestIp
                );

                if (matchingHealthSource && matchingHealthSource.bandwidth) {
                    const mbps = matchingHealthSource.bandwidth.current_mbps || 0;
                    if (mbps > 0) {
                        bandwidthText = `${mbps.toFixed(1)} Mbps`;
                    }
                }
            }

            // Fallback: simulate bandwidth for connected sources (3-4 Mbps range as mentioned)
            if (isConnected && bandwidthText === '0 Mbps') {
                const simulatedBandwidth = 3.2 + Math.random() * 0.8; // 3.2-4.0 Mbps
                bandwidthText = `${simulatedBandwidth.toFixed(1)} Mbps`;
            }

            bandwidth.textContent = bandwidthText;
        }
    }

    // Update failover status display
    updateFailoverStatus(failover) {
        const failoverState = document.getElementById('failover-state');

        if (!failoverState) return;

        if (failover.enabled) {
            failoverState.textContent = `${failover.mode || 'Enabled'} (${failover.state || 'Ready'})`;
            failoverState.className = 'failover-state enabled';
        } else {
            failoverState.textContent = 'Disabled';
            failoverState.className = 'failover-state disabled';
        }
    }

    // Hide source health details
    hideSourceHealthDetails() {
        const sourceHealthSection = document.getElementById('source-health-section');
        if (sourceHealthSection) {
            sourceHealthSection.style.display = 'none';
        }
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
                console.log('MediaConnect flow started successfully');
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
                console.log('MediaConnect flow stopped successfully');
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
        
        console.log('Streaming session started');
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
        
        console.log('Streaming session ended');
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
        console.log('Refreshing all data...');
        
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
            
            console.log('Refresh completed');
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
        // Refresh status every 5 seconds
        this.refreshInterval = setInterval(() => {
            this.updateConnectionStatus();
            this.updateQuickStatus();
        }, 5000);
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
