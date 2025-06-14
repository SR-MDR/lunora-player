// Lunora Player - Multi-Destination Streaming Management
class MultiDestinationManager {
    constructor() {
        this.apiBaseUrl = 'https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api';
        this.destinations = [];
        this.presets = [];
        this.streamingStatus = {
            active: false,
            sessionStart: null,
            activeDestinations: []
        };
        this.refreshInterval = null;

        this.init();
    }

    async init() {
        console.log('Initializing Multi-Destination Manager...');
        
        // Load initial data
        await this.loadDestinations();
        await this.loadPresets();
        await this.loadStreamingStatus();
        await this.loadMediaLiveStatus();

        // Set up event listeners
        this.bindEvents();

        // Start auto-refresh for streaming status
        this.startAutoRefresh();
        
        console.log('Multi-Destination Manager initialized');
    }

    // ============================================================================
    // DATA LOADING
    // ============================================================================

    async loadDestinations() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/destinations`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.destinations = data.destinations;
                this.renderDestinations();
            } else {
                console.error('Failed to load destinations:', data.message);
                this.showError('Failed to load destinations');
            }
        } catch (error) {
            console.error('Error loading destinations:', error);
            this.showError('Connection error while loading destinations');
        }
    }

    async loadPresets() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/presets`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.presets = data.presets;
            } else {
                console.error('Failed to load presets:', data.message);
            }
        } catch (error) {
            console.error('Error loading presets:', error);
        }
    }

    async loadStreamingStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/streaming/status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.streamingStatus = {
                    active: data.streaming.active,
                    channels: data.streaming.channels,
                    destinations: data.streaming.destinations
                };
                this.updateStreamingUI();
            }
        } catch (error) {
            console.error('Error loading streaming status:', error);
        }
    }

    async loadMediaLiveStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/medialive/status`);
            const data = await response.json();

            if (data.status === 'success') {
                this.mediaLiveStatus = data.channel;
                this.updateMediaLiveUI();
            } else {
                console.error('Failed to load MediaLive status:', data.message);
                this.updateMediaLiveUI({ state: 'ERROR', error: data.message });
            }
        } catch (error) {
            console.error('Error loading MediaLive status:', error);
            this.updateMediaLiveUI({ state: 'ERROR', error: 'Connection failed' });
        }
    }

    // ============================================================================
    // UI RENDERING
    // ============================================================================

    renderDestinations() {
        const container = document.getElementById('destinations-list');
        if (!container) return;

        if (this.destinations.length === 0) {
            container.innerHTML = `
                <div class="no-destinations">
                    <p>No destinations configured yet.</p>
                    <button class="btn-primary" onclick="multiDestination.showAddDestinationModal()">
                        + Add Your First Destination
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.destinations.map(dest => this.createDestinationCard(dest)).join('');
    }

    createDestinationCard(destination) {
        // Determine status based on streaming_status field from database
        const streamingStatus = destination.streaming_status || 'ready';
        const isStreaming = streamingStatus === 'streaming';
        const hasError = streamingStatus === 'error';

        const statusClass = !destination.enabled ? 'disabled' :
                           isStreaming ? 'streaming' :
                           hasError ? 'error' : 'enabled';
        const platformClass = `platform-${destination.platform}`;

        // Determine status indicator and text
        let statusIndicatorClass, statusText;
        if (!destination.enabled) {
            statusIndicatorClass = 'status-disabled';
            statusText = 'Disabled';
        } else if (isStreaming) {
            statusIndicatorClass = 'status-streaming';
            statusText = 'Streaming';
        } else if (hasError) {
            statusIndicatorClass = 'status-error';
            statusText = 'Error';
        } else {
            statusIndicatorClass = 'status-ready';
            statusText = 'Ready';
        }

        return `
            <div class="destination-card ${statusClass}" data-id="${destination.destination_id}">
                <div class="destination-header">
                    <div class="destination-info">
                        <h4>${destination.name}</h4>
                        <span class="destination-platform ${platformClass}">${destination.platform}</span>
                    </div>
                    <div class="destination-actions">
                        <button class="btn-small btn-secondary" onclick="multiDestination.editDestination('${destination.destination_id}')">
                            ⚙️ Edit
                        </button>
                        <button class="btn-small btn-danger" onclick="multiDestination.deleteDestination('${destination.destination_id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>

                <div class="destination-status">
                    <span class="status-indicator ${statusIndicatorClass}"></span>
                    <span>${statusText}</span>
                    ${isStreaming && destination.streaming_started_at ? `
                        <small class="streaming-duration" data-start="${destination.streaming_started_at}">
                            ${this.getStreamingDuration(destination.streaming_started_at)}
                        </small>
                    ` : ''}
                </div>

                <div class="destination-details">
                    <div class="detail-row">
                        <span class="detail-label">Preset:</span>
                        <span class="detail-value">${this.getPresetName(destination.preset_id)}</span>
                    </div>
                    ${destination.rtmp_url ? `
                        <div class="detail-row">
                            <span class="detail-label">URL:</span>
                            <span class="detail-value">${this.truncateUrl(destination.rtmp_url)}</span>
                        </div>
                    ` : ''}
                    ${destination.streaming_status === 'streaming' && destination.streaming_started_at ? `
                        <div class="detail-row">
                            <span class="detail-label">Started:</span>
                            <span class="detail-value">${new Date(destination.streaming_started_at).toLocaleTimeString()}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="destination-controls">
                    ${destination.enabled ? `
                        ${!isStreaming ? `
                            <button class="btn-small btn-success" onclick="multiDestination.startDestination('${destination.destination_id}')">
                                ▶️ Start
                            </button>
                        ` : `
                            <button class="btn-small btn-danger" onclick="multiDestination.stopDestination('${destination.destination_id}')">
                                ⏹️ Stop
                            </button>
                        `}
                    ` : `
                        <button class="btn-small btn-secondary" onclick="multiDestination.enableDestination('${destination.destination_id}')">
                            Enable
                        </button>
                    `}
                    <button class="btn-small btn-secondary" onclick="multiDestination.testDestination('${destination.destination_id}')">
                        🧪 Test
                    </button>
                </div>
            </div>
        `;
    }

    updateStreamingUI() {
        const livePanel = document.getElementById('live-status-panel');
        const startAllBtn = document.getElementById('start-all-btn');
        const stopAllBtn = document.getElementById('stop-all-btn');
        
        if (this.streamingStatus.active) {
            livePanel?.classList.remove('hidden');
            startAllBtn?.setAttribute('disabled', 'true');
            stopAllBtn?.removeAttribute('disabled');
            
            // Update session duration if streaming
            this.updateSessionDuration();
        } else {
            livePanel?.classList.add('hidden');
            startAllBtn?.removeAttribute('disabled');
            stopAllBtn?.setAttribute('disabled', 'true');
        }
    }

    updateSessionDuration() {
        const durationElement = document.getElementById('session-duration');
        if (!durationElement || !this.streamingStatus.sessionStart) return;

        const now = new Date();
        const start = new Date(this.streamingStatus.sessionStart);
        const diff = now - start;

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        durationElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateMediaLiveUI(channelData = null) {
        const statusElement = document.getElementById('medialive-status');
        const indicatorElement = statusElement?.querySelector('.channel-indicator');
        const textElement = statusElement?.querySelector('.channel-text');

        if (!statusElement || !indicatorElement || !textElement) return;

        const channel = channelData || this.mediaLiveStatus;
        if (!channel) return;

        const state = channel.state || 'unknown';
        const stateText = this.getChannelStateText(state);

        // Update the data attribute for CSS styling
        statusElement.setAttribute('data-state', state);

        // Update the text content
        textElement.textContent = stateText;

        // Add additional info for some states
        if (channel.active_destinations_count !== undefined) {
            const activeCount = channel.active_destinations_count;
            if (state === 'RUNNING' && activeCount > 0) {
                textElement.textContent = `${stateText} (${activeCount} active)`;
            } else if (state === 'IDLE' && activeCount === 0) {
                textElement.textContent = `${stateText} (ready)`;
            }
        }

        // Update tooltip with additional information
        const tooltipInfo = [
            `Channel: ${channel.name || channel.id}`,
            `State: ${state}`,
            `Class: ${channel.channel_class || 'Unknown'}`,
            `Active Destinations: ${channel.active_destinations_count || 0}`
        ];

        if (channel.last_updated) {
            const lastUpdate = new Date(channel.last_updated);
            tooltipInfo.push(`Updated: ${lastUpdate.toLocaleTimeString()}`);
        }

        statusElement.title = tooltipInfo.join('\n');

        console.log(`MediaLive channel status updated: ${state} (${channel.active_destinations_count || 0} active destinations)`);
    }

    getChannelStateText(state) {
        const stateMap = {
            'IDLE': 'Idle',
            'STARTING': 'Starting...',
            'RUNNING': 'Running',
            'STOPPING': 'Stopping...',
            'ERROR': 'Error',
            'unknown': 'Unknown'
        };

        return stateMap[state] || state;
    }

    // ============================================================================
    // DESTINATION MANAGEMENT
    // ============================================================================

    showAddDestinationModal() {
        const modal = this.createDestinationModal();
        document.body.appendChild(modal);
    }

    createDestinationModal(destination = null) {
        const isEdit = !!destination;
        const modalId = 'destination-modal';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = modalId;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit' : 'Add'} Destination</h3>
                    <button class="close-btn" onclick="multiDestination.closeModal('${modalId}')">&times;</button>
                </div>
                
                <form id="destination-form">
                    <div class="form-group">
                        <label for="dest-name">Destination Name *</label>
                        <input type="text" id="dest-name" name="name" required 
                               value="${destination?.name || ''}" 
                               placeholder="e.g., YouTube Main Channel">
                    </div>
                    
                    <div class="form-group">
                        <label for="dest-platform">Platform *</label>
                        <select id="dest-platform" name="platform" required>
                            <option value="">Select Platform</option>
                            <option value="hls" ${destination?.platform === 'hls' ? 'selected' : ''}>HLS Player</option>
                            <option value="youtube" ${destination?.platform === 'youtube' ? 'selected' : ''}>YouTube Live</option>
                            <option value="x" ${destination?.platform === 'x' ? 'selected' : ''}>X (Twitter) Live</option>
                            <option value="linkedin" ${destination?.platform === 'linkedin' ? 'selected' : ''}>LinkedIn Live</option>
                            <option value="custom" ${destination?.platform === 'custom' ? 'selected' : ''}>Custom RTMP</option>
                        </select>
                    </div>
                    
                    <div class="form-group" id="rtmp-url-group" style="display: none;">
                        <label for="dest-rtmp-url">RTMP Server URL</label>
                        <input type="url" id="dest-rtmp-url" name="rtmp_url" 
                               value="${destination?.rtmp_url || ''}"
                               placeholder="rtmp://live.example.com/live">
                    </div>
                    
                    <div class="form-group">
                        <label for="dest-stream-key">Stream Key *</label>
                        <input type="password" id="dest-stream-key" name="stream_key" required
                               value="${destination?.stream_key || ''}"
                               placeholder="Enter your stream key">
                        <small>Stream keys are encrypted and stored securely</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="dest-preset">Quality Preset</label>
                        <select id="dest-preset" name="preset_id">
                            <option value="">Select Preset</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="dest-enabled" name="enabled" 
                                   ${destination?.enabled !== false ? 'checked' : ''}>
                            Enable this destination
                        </label>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="multiDestination.closeModal('${modalId}')">
                            Cancel
                        </button>
                        <button type="submit" class="btn-primary">
                            ${isEdit ? 'Update' : 'Create'} Destination
                        </button>
                    </div>
                    
                    ${isEdit ? `<input type="hidden" name="destination_id" value="${destination.destination_id}">` : ''}
                </form>
            </div>
        `;
        
        // Set up event handlers after modal is added to DOM
        setTimeout(() => {
            this.setupModalEventHandlers(isEdit);
            this.onPlatformChange();
            this.loadPresetsIntoSelect(destination);
        }, 100);

        return modal;
    }

    setupModalEventHandlers(isEdit) {
        const form = document.getElementById('destination-form');
        const platformSelect = document.getElementById('dest-platform');

        if (form) {
            form.addEventListener('submit', (event) => {
                this.saveDestination(event, isEdit);
            });
        }

        if (platformSelect) {
            platformSelect.addEventListener('change', () => {
                this.onPlatformChange();
            });
        }
    }

    onPlatformChange() {
        const platformSelect = document.getElementById('dest-platform');
        const rtmpUrlGroup = document.getElementById('rtmp-url-group');
        const rtmpUrlInput = document.getElementById('dest-rtmp-url');
        const streamKeyGroup = document.getElementById('dest-stream-key')?.closest('.form-group');
        const streamKeyInput = document.getElementById('dest-stream-key');

        if (platformSelect.value === 'custom') {
            rtmpUrlGroup.style.display = 'block';
            rtmpUrlInput.required = true;
            if (streamKeyGroup) streamKeyGroup.style.display = 'block';
            if (streamKeyInput) streamKeyInput.required = true;
        } else if (platformSelect.value === 'hls') {
            // HLS Player doesn't need RTMP URL or stream key
            rtmpUrlGroup.style.display = 'none';
            rtmpUrlInput.required = false;
            if (streamKeyGroup) streamKeyGroup.style.display = 'none';
            if (streamKeyInput) streamKeyInput.required = false;
            rtmpUrlInput.value = '';
        } else {
            rtmpUrlGroup.style.display = 'none';
            rtmpUrlInput.required = false;
            if (streamKeyGroup) streamKeyGroup.style.display = 'block';
            if (streamKeyInput) streamKeyInput.required = true;

            // Set default RTMP URLs for platforms
            const defaultUrls = {
                youtube: 'rtmp://a.rtmp.youtube.com/live2',
                x: 'rtmp://live-api-s.twitter.com/live',
                linkedin: 'rtmp://1-publish.linkedin.com/live'
            };

            rtmpUrlInput.value = defaultUrls[platformSelect.value] || '';
        }

        this.loadPresetsIntoSelect();
    }

    loadPresetsIntoSelect(destination = null) {
        const platformSelect = document.getElementById('dest-platform');
        const presetSelect = document.getElementById('dest-preset');

        if (!platformSelect || !presetSelect) return;

        const platform = platformSelect.value;
        presetSelect.innerHTML = '<option value="">Select Preset</option>';

        if (platform) {
            const platformPresets = this.presets.filter(p => p.platform === platform);
            platformPresets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.preset_id;
                option.textContent = preset.name;
                option.selected = destination && destination.preset_id === preset.preset_id;
                presetSelect.appendChild(option);
            });
        }
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    getPresetName(presetId) {
        const preset = this.presets.find(p => p.preset_id === presetId);
        return preset ? preset.name : 'Default';
    }

    truncateUrl(url) {
        if (!url) return '';
        return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }

    getStreamingDuration(startTime) {
        if (!startTime) return '';

        const now = new Date();
        const start = new Date(startTime);
        const diff = now - start;

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        // Simple success display - could be enhanced with a proper notification system
        console.log(`Success: ${message}`);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }

    // ============================================================================
    // EVENT BINDING
    // ============================================================================

    bindEvents() {
        // Master control buttons
        const startAllBtn = document.getElementById('start-all-btn');
        const stopAllBtn = document.getElementById('stop-all-btn');
        
        if (startAllBtn) {
            startAllBtn.addEventListener('click', () => this.startAllDestinations());
        }
        
        if (stopAllBtn) {
            stopAllBtn.addEventListener('click', () => this.stopAllDestinations());
        }
    }

    startAutoRefresh() {
        // Refresh streaming status every 5 seconds when active
        this.refreshInterval = setInterval(() => {
            if (this.streamingStatus.active) {
                this.loadStreamingStatus();
                this.updateSessionDuration();
            }
            // Always refresh MediaLive status to track channel state changes
            this.loadMediaLiveStatus();
        }, 5000);
    }

    // ============================================================================
    // DESTINATION ACTIONS
    // ============================================================================

    async saveDestination(event, isEdit) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = {
            name: formData.get('name'),
            platform: formData.get('platform'),
            rtmp_url: formData.get('rtmp_url'),
            stream_key: formData.get('stream_key'),
            preset_id: formData.get('preset_id'),
            enabled: formData.get('enabled') === 'on'
        };

        try {
            let response;
            if (isEdit) {
                const destinationId = formData.get('destination_id');
                response = await fetch(`${this.apiBaseUrl}/destinations/${destinationId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                response = await fetch(`${this.apiBaseUrl}/destinations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess(result.message);
                this.closeModal('destination-modal');
                await this.loadDestinations();
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error saving destination:', error);
            this.showError('Failed to save destination');
        }
    }

    async editDestination(destinationId) {
        const destination = this.destinations.find(d => d.destination_id === destinationId);
        if (!destination) {
            this.showError('Destination not found');
            return;
        }

        const modal = this.createDestinationModal(destination);
        document.body.appendChild(modal);
    }

    async deleteDestination(destinationId) {
        if (!confirm('Are you sure you want to delete this destination? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/destinations/${destinationId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Destination deleted successfully');
                await this.loadDestinations();
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error deleting destination:', error);
            this.showError('Failed to delete destination');
        }
    }

    async startDestination(destinationId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/destinations/${destinationId}/start`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Destination started successfully');
                await this.loadStreamingStatus();
                this.updateDestinationStatus(destinationId, 'streaming');

                // If this is an HLS destination, open the HLS player
                const destination = this.destinations.find(d => d.destination_id === destinationId);
                if (destination && destination.platform === 'hls') {
                    this.openHLSPlayer();
                }
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error starting destination:', error);
            this.showError('Failed to start destination');
        }
    }

    openHLSPlayer() {
        // Open HLS player in a new window/tab
        const playerUrl = 'hls-player.html';
        const playerWindow = window.open(
            playerUrl,
            'hlsPlayer',
            'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
        );

        if (playerWindow) {
            playerWindow.focus();
            this.showSuccess('HLS Player opened in new window');
        } else {
            // Fallback if popup blocked
            window.open(playerUrl, '_blank');
        }
    }

    async stopDestination(destinationId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/destinations/${destinationId}/stop`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Destination stopped successfully');
                await this.loadStreamingStatus();
                this.updateDestinationStatus(destinationId, 'ready');
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error stopping destination:', error);
            this.showError('Failed to stop destination');
        }
    }

    async testDestination(destinationId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/destinations/${destinationId}/test`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.status === 'success') {
                const message = `Test successful!\nLatency: ${result.latency}ms\nStatus: ${result.connectivity}`;
                alert(message);
            } else {
                this.showError(`Test failed: ${result.message}`);
            }
        } catch (error) {
            console.error('Error testing destination:', error);
            this.showError('Failed to test destination');
        }
    }

    async enableDestination(destinationId) {
        const destination = this.destinations.find(d => d.destination_id === destinationId);
        if (!destination) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/destinations/${destinationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true })
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccess('Destination enabled');
                await this.loadDestinations();
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error enabling destination:', error);
            this.showError('Failed to enable destination');
        }
    }

    async startAllDestinations() {
        const enabledDestinations = this.destinations.filter(d => d.enabled);

        if (enabledDestinations.length === 0) {
            this.showError('No enabled destinations to start');
            return;
        }

        if (!confirm(`Start streaming to ${enabledDestinations.length} destination(s)?`)) {
            return;
        }

        // Start all enabled destinations
        const promises = enabledDestinations.map(dest => this.startDestination(dest.destination_id));

        try {
            await Promise.all(promises);
            this.streamingStatus.active = true;
            this.streamingStatus.sessionStart = new Date().toISOString();
            this.updateStreamingUI();
        } catch (error) {
            console.error('Error starting all destinations:', error);
            this.showError('Some destinations failed to start');
        }
    }

    async stopAllDestinations() {
        if (!confirm('Stop all streaming destinations?')) {
            return;
        }

        const activeDestinations = this.streamingStatus.activeDestinations || [];
        const promises = activeDestinations.map(dest => this.stopDestination(dest.id));

        try {
            await Promise.all(promises);
            this.streamingStatus.active = false;
            this.streamingStatus.sessionStart = null;
            this.updateStreamingUI();
        } catch (error) {
            console.error('Error stopping all destinations:', error);
            this.showError('Some destinations failed to stop');
        }
    }

    updateDestinationStatus(destinationId, status) {
        const card = document.querySelector(`[data-id="${destinationId}"]`);
        if (!card) return;

        // Update visual status
        const statusIndicator = card.querySelector('.status-indicator');
        const statusText = card.querySelector('.destination-status span:last-child');

        if (statusIndicator && statusText) {
            statusIndicator.className = `status-indicator status-${status}`;
            statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }

        // Update card class
        card.className = `destination-card ${status === 'streaming' ? 'streaming' : 'enabled'}`;
    }
}

// Initialize when DOM is ready
let multiDestination;
document.addEventListener('DOMContentLoaded', () => {
    multiDestination = new MultiDestinationManager();
});
