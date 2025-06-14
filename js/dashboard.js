// Lunora Media Services Dashboard
class MediaServicesDashboard {
    constructor() {
        this.awsConfig = window.AWSConfig || {};
        this.refreshInterval = null;
        this.costChart = null;
        this.apiBaseUrl = 'https://rdmgtdz2eu4pj43igkvh6fvaly0xovke.lambda-url.us-west-2.on.aws/api';

        this.init();
    }

    init() {
        console.log('Initializing Media Services Dashboard...');
        console.log('API Base URL:', this.apiBaseUrl);

        this.bindEvents();
        this.initializeCostChart();

        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            this.loadDashboardData();
        }, 100);

        this.startAutoRefresh();

        console.log('Media Services Dashboard initialized');
    }

    bindEvents() {
        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.refreshDashboard();
        });

        // Auto-refresh every 5 minutes
        this.startAutoRefresh();
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }

    async loadDashboardData() {
        console.log('Loading dashboard data from AWS...');

        // First check if backend is available
        try {
            const healthResponse = await fetch(`${this.apiBaseUrl}/health`);
            if (!healthResponse.ok) {
                throw new Error('Backend not available');
            }
            console.log('Backend health check passed');

            // Update connection status
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                statusElement.textContent = '✅ Connected';
                statusElement.style.color = 'green';
            }
        } catch (error) {
            console.error('Backend health check failed:', error);

            // Update connection status
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                statusElement.textContent = '❌ Disconnected';
                statusElement.style.color = 'red';
            }

            this.showErrorAlert('Backend API not available. Please start the backend server.');
            return;
        }

        try {
            // Load streaming destinations data (available)
            await this.loadStreamingStatus();

            // Set default values for AWS services (monitoring not implemented yet)
            this.setDefaultAWSStatus();

            // Check for alerts based on available data
            this.checkAlerts();

            console.log('Dashboard data loaded successfully');
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showErrorAlert('Failed to load dashboard data. Check backend connection.');
        }
    }

    async loadStreamingStatus() {
        console.log('Loading streaming destinations status...');
        try {
            const response = await fetch(`${this.apiBaseUrl}/destinations`);
            const data = await response.json();

            if (response.ok) {
                const destinations = data.destinations || [];
                const activeCount = destinations.filter(d => d.streaming_status === 'streaming').length;

                // Update streaming status in the dashboard
                const streamingElement = document.getElementById('streaming-destinations-count');
                if (streamingElement) {
                    streamingElement.textContent = `${destinations.length} configured, ${activeCount} active`;
                }

                // Update quick stats in the streaming control link section
                const quickDestinationsElement = document.getElementById('quick-destinations-count');
                const quickStatusElement = document.getElementById('quick-streaming-status');

                if (quickDestinationsElement) {
                    quickDestinationsElement.textContent = destinations.length;
                }

                if (quickStatusElement) {
                    if (activeCount > 0) {
                        quickStatusElement.textContent = `${activeCount} Active`;
                        quickStatusElement.style.color = '#28a745'; // Green for active
                    } else {
                        quickStatusElement.textContent = 'Idle';
                        quickStatusElement.style.color = '#6c757d'; // Gray for idle
                    }
                }

                console.log(`Streaming status: ${destinations.length} destinations, ${activeCount} active`);
            } else {
                console.warn('Failed to load streaming destinations:', data.error);
            }
        } catch (error) {
            console.error('Error loading streaming status:', error);
        }
    }

    setDefaultAWSStatus() {
        console.log('Setting default AWS service status...');

        // Set default S3 status
        this.updateStatusCard('s3-status', {
            status: 'Active',
            statusClass: 'active',
            detail: 'lunora-player-streaming-prod (Monitoring not implemented)'
        });

        // Set default MediaPackage status
        this.updateStatusCard('mediapackage-status', {
            status: 'Not Configured',
            statusClass: 'warning',
            detail: 'AWS monitoring not implemented yet'
        });

        // Set default MediaLive status
        this.updateStatusCard('medialive-status', {
            status: 'Not Configured',
            statusClass: 'warning',
            detail: 'AWS monitoring not implemented yet'
        });

        // Set default CloudFront status
        this.updateStatusCard('cloudfront-status', {
            status: 'Not Configured',
            statusClass: 'warning',
            detail: 'AWS monitoring not implemented yet'
        });

        // Set default metrics
        const metricsElements = {
            'mp-requests': '0',
            'mp-data': '0 GB',
            'error-rate': '0%',
            'avg-latency': 'N/A',
            'current-cost': '$0.00',
            'mediapackage-cost': '$0.00',
            's3-cost': '$0.00',
            'transfer-cost': '$0.00'
        };

        Object.entries(metricsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Update cost chart with zero cost
        this.updateCostChartWithRealCosts(0);

        console.log('Default AWS status set');
    }

    async loadS3Status() {
        console.log('Loading S3 status...');
        try {
            const response = await fetch(`${this.apiBaseUrl}/s3/status`);
            const data = await response.json();

            console.log('S3 API response:', data);

            if (response.ok) {
                this.updateStatusCard('s3-status', {
                    status: 'Active',
                    statusClass: 'active',
                    detail: `${data.bucket} (${data.storage.gb} GB, ${data.objects} objects)`
                });

                // Update S3 details in resource card
                const bucketNameElement = document.getElementById('s3-bucket-name');
                const regionElement = document.getElementById('s3-region');
                const storageElement = document.getElementById('s3-storage');
                const objectsElement = document.getElementById('s3-objects');

                if (bucketNameElement) {
                    bucketNameElement.textContent = data.bucket;
                }
                if (regionElement) {
                    regionElement.textContent = data.region;
                }
                if (storageElement) {
                    storageElement.textContent = `${data.storage.gb} GB`;
                }
                if (objectsElement) {
                    objectsElement.textContent = data.objects.toLocaleString();
                }

                console.log('S3 status updated successfully');
            } else {
                throw new Error(data.error || 'Failed to load S3 status');
            }
        } catch (error) {
            console.error('S3 status error:', error);
            this.updateStatusCard('s3-status', {
                status: 'Error',
                statusClass: 'error',
                detail: 'Failed to load S3 status'
            });

            // Update with error state
            const storageElement = document.getElementById('s3-storage');
            const objectsElement = document.getElementById('s3-objects');

            if (storageElement) {
                storageElement.textContent = 'Error';
            }
            if (objectsElement) {
                objectsElement.textContent = 'Error';
            }
        }
    }

    async loadMediaPackageStatus() {
        console.log('Loading MediaPackage status...');
        try {
            const response = await fetch(`${this.apiBaseUrl}/mediapackage/status`);
            const data = await response.json();

            console.log('MediaPackage API response:', data);

            if (response.ok) {
                this.updateStatusCard('mediapackage-status', {
                    status: 'Active',
                    statusClass: 'active',
                    detail: `${data.channel.id} (${data.endpoints.length} endpoints)`
                });

                // Update MediaPackage details
                document.getElementById('mp-channel-id').textContent = data.channel.id;
                document.getElementById('mp-status').textContent = 'Active';
                document.getElementById('mp-created').textContent = new Date(data.channel.createdAt).toLocaleString();

                if (data.endpoints.length > 0) {
                    const hlsEndpoint = data.endpoints.find(ep => ep.id.includes('hls'));
                    if (hlsEndpoint) {
                        document.getElementById('mp-hls-endpoint').textContent = hlsEndpoint.url;
                    }
                }

                console.log('MediaPackage status updated successfully');
            } else {
                throw new Error(data.error || 'Failed to load MediaPackage status');
            }
        } catch (error) {
            console.error('MediaPackage status error:', error);
            this.updateStatusCard('mediapackage-status', {
                status: 'Error',
                statusClass: 'error',
                detail: 'Failed to load MediaPackage status'
            });

            // Update with error state
            document.getElementById('mp-channel-id').textContent = 'Error';
            document.getElementById('mp-status').textContent = 'Error';
            document.getElementById('mp-created').textContent = 'Error';
            document.getElementById('mp-hls-endpoint').textContent = 'Error';
        }
    }

    async loadMediaLiveStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/medialive/status`);
            const data = await response.json();

            if (response.ok) {
                if (data.channelCount > 0) {
                    this.updateStatusCard('medialive-status', {
                        status: 'Active',
                        statusClass: 'active',
                        detail: `${data.channelCount} channel(s) configured`
                    });
                } else {
                    this.updateStatusCard('medialive-status', {
                        status: 'Not Created',
                        statusClass: 'warning',
                        detail: 'Click "Create MediaLive Channel" to set up'
                    });
                }
            } else {
                throw new Error(data.error || 'Failed to load MediaLive status');
            }
        } catch (error) {
            console.error('MediaLive status error:', error);
            this.updateStatusCard('medialive-status', {
                status: 'Error',
                statusClass: 'error',
                detail: 'Failed to load MediaLive status'
            });
        }
    }

    async loadCloudFrontStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/cloudfront/status`);
            const data = await response.json();

            if (response.ok) {
                if (data.distributionCount > 0) {
                    this.updateStatusCard('cloudfront-status', {
                        status: 'Active',
                        statusClass: 'active',
                        detail: `${data.distributionCount} distribution(s) configured`
                    });
                } else {
                    this.updateStatusCard('cloudfront-status', {
                        status: 'Not Created',
                        statusClass: 'warning',
                        detail: 'Click "Create CloudFront Distribution" to set up'
                    });
                }
            } else {
                throw new Error(data.error || 'Failed to load CloudFront status');
            }
        } catch (error) {
            console.error('CloudFront status error:', error);
            this.updateStatusCard('cloudfront-status', {
                status: 'Error',
                statusClass: 'error',
                detail: 'Failed to load CloudFront status'
            });
        }
    }

    updateStatusCard(cardId, data) {
        const card = document.getElementById(cardId);
        if (!card) return;

        const statusText = card.querySelector('.status-text');
        const statusDetail = card.querySelector('.status-detail');

        if (statusText) {
            statusText.textContent = data.status;
            statusText.className = `status-text ${data.statusClass}`;
        }

        if (statusDetail) {
            statusDetail.textContent = data.detail;
        }

        // Update card border color
        card.className = `status-card ${data.statusClass}`;
    }

    async loadMetrics() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/metrics/mediapackage`);
            const data = await response.json();

            if (response.ok) {
                document.getElementById('mp-requests').textContent = data.requests.total.toLocaleString();
                document.getElementById('mp-data').textContent = `${data.egress.totalGB} GB`;

                // Calculate error rate (simplified)
                const errorRate = data.requests.total > 0 ? 0 : 0; // Would need actual error metrics
                document.getElementById('error-rate').textContent = `${errorRate}%`;

                // Average latency (would need actual latency metrics)
                document.getElementById('avg-latency').textContent = 'N/A';

                // Note: Cost chart is updated separately in loadCostInformation()
            } else {
                throw new Error(data.error || 'Failed to load metrics');
            }
        } catch (error) {
            console.error('Metrics loading error:', error);
            // Fall back to showing zeros
            document.getElementById('mp-requests').textContent = '0';
            document.getElementById('mp-data').textContent = '0 GB';
            document.getElementById('error-rate').textContent = '0%';
            document.getElementById('avg-latency').textContent = 'N/A';
        }
    }

    async loadCostInformation() {
        console.log('Loading cost information...');
        try {
            const response = await fetch(`${this.apiBaseUrl}/costs`);
            const data = await response.json();

            console.log('Cost API response:', data);

            if (response.ok) {
                const totalCost = data.total || 0;
                const s3Cost = (data.breakdown.s3.storage + data.breakdown.s3.requests) || 0;
                const mpCost = data.breakdown.mediaPackage.estimated || 0;
                const cfCost = data.breakdown.cloudFront.estimated || 0;

                document.getElementById('current-cost').textContent = `$${totalCost.toFixed(2)}`;
                document.getElementById('mediapackage-cost').textContent = `$${mpCost.toFixed(2)}`;
                document.getElementById('s3-cost').textContent = `$${s3Cost.toFixed(2)}`;
                document.getElementById('transfer-cost').textContent = `$${cfCost.toFixed(2)}`;

                // Update cost chart with real data
                this.updateCostChartWithRealCosts(totalCost);

                console.log('Cost information updated successfully');
            } else {
                throw new Error(data.error || 'Failed to load cost information');
            }
        } catch (error) {
            console.error('Cost loading error:', error);
            // Fall back to showing zeros
            document.getElementById('current-cost').textContent = '$0.00';
            document.getElementById('mediapackage-cost').textContent = '$0.00';
            document.getElementById('s3-cost').textContent = '$0.00';
            document.getElementById('transfer-cost').textContent = '$0.00';

            // Update chart with zero cost
            this.updateCostChartWithRealCosts(0);
        }
    }

    initializeCostChart() {
        // Create a simple, stable custom chart instead of Chart.js
        // This eliminates the scaling issues completely
        this.createSimpleCostChart();
    }

    createSimpleCostChart() {
        const container = document.getElementById('costChart');
        if (!container) return;

        // Replace canvas with a simple HTML chart
        container.outerHTML = `
            <div id="costChart" class="simple-cost-chart">
                <div class="chart-header">
                    <h4>Current Day Cost</h4>
                </div>
                <div class="chart-content">
                    <div class="cost-bar-container">
                        <div class="cost-scale">
                            <div class="scale-line" data-value="2.00">$2.00</div>
                            <div class="scale-line" data-value="1.50">$1.50</div>
                            <div class="scale-line" data-value="1.00">$1.00</div>
                            <div class="scale-line" data-value="0.50">$0.50</div>
                            <div class="scale-line" data-value="0.00">$0.00</div>
                        </div>
                        <div class="cost-bar-area">
                            <div id="cost-bar" class="cost-bar" style="height: 0%;">
                                <span class="cost-value">$0.00</span>
                            </div>
                        </div>
                    </div>
                    <div class="chart-label">Today</div>
                </div>
            </div>
        `;

        // Add CSS for the custom chart
        this.addCostChartStyles();
    }

    addCostChartStyles() {
        // Check if styles already added
        if (document.getElementById('cost-chart-styles')) return;

        const style = document.createElement('style');
        style.id = 'cost-chart-styles';
        style.textContent = `
            .simple-cost-chart {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                border: 1px solid #dee2e6;
                height: 300px;
                display: flex;
                flex-direction: column;
            }

            .chart-header h4 {
                text-align: center;
                margin-bottom: 20px;
                color: #2c3e50;
                font-size: 14px;
            }

            .chart-content {
                flex: 1;
                display: flex;
                flex-direction: column;
            }

            .cost-bar-container {
                flex: 1;
                display: flex;
                align-items: stretch;
                margin-bottom: 10px;
            }

            .cost-scale {
                width: 60px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding-right: 10px;
            }

            .scale-line {
                font-size: 12px;
                color: #6c757d;
                text-align: right;
                position: relative;
            }

            .scale-line::after {
                content: '';
                position: absolute;
                right: -10px;
                top: 50%;
                width: 5px;
                height: 1px;
                background: #dee2e6;
            }

            .cost-bar-area {
                flex: 1;
                background: linear-gradient(to right, #e9ecef 0%, #e9ecef 100%);
                border: 1px solid #dee2e6;
                border-radius: 4px;
                position: relative;
                display: flex;
                align-items: flex-end;
                padding: 5px;
            }

            .cost-bar {
                width: 100%;
                background: linear-gradient(to top, #007bff, #0056b3);
                border-radius: 2px;
                transition: height 0.3s ease;
                position: relative;
                min-height: 2px;
                display: flex;
                align-items: flex-end;
                justify-content: center;
            }

            .cost-value {
                color: white;
                font-size: 12px;
                font-weight: bold;
                padding: 2px 4px;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 2px;
                margin-bottom: 2px;
            }

            .chart-label {
                text-align: center;
                font-size: 14px;
                color: #495057;
                margin-top: 10px;
            }
        `;
        document.head.appendChild(style);
    }

    updateCostChartWithRealCosts(currentCost) {
        const costBar = document.getElementById('cost-bar');
        const costValue = costBar?.querySelector('.cost-value');

        if (!costBar || !costValue) {
            console.log('Cost chart elements not found, skipping update');
            return;
        }

        // Calculate percentage of the fixed $2.00 scale
        const maxScale = 2.00;
        const percentage = Math.min((currentCost / maxScale) * 100, 100);

        // Update the bar height and value
        costBar.style.height = `${Math.max(percentage, 1)}%`; // Minimum 1% for visibility
        costValue.textContent = `$${currentCost.toFixed(2)}`;

        // Hide value text if cost is very small
        if (currentCost < 0.01) {
            costValue.style.display = 'none';
        } else {
            costValue.style.display = 'block';
        }

        console.log(`Cost chart updated: $${currentCost} (${percentage.toFixed(1)}% of $2.00 scale)`);
    }

    checkAlerts() {
        const alertsContainer = document.getElementById('alerts-container');
        if (!alertsContainer) return;

        // Clear existing alerts except the default one
        const existingAlerts = alertsContainer.querySelectorAll('.alert:not(:first-child)');
        existingAlerts.forEach(alert => alert.remove());

        // Add sample alerts based on current status
        const alerts = [];

        // Check if MediaLive is not created
        alerts.push({
            type: 'warning',
            icon: '⚠️',
            title: 'MediaLive Channel Not Created',
            message: 'Create a MediaLive channel to enable live streaming from your Videon Edge nodes.',
            time: '5 minutes ago'
        });

        // Check if CloudFront is not created
        alerts.push({
            type: 'info',
            icon: 'ℹ️',
            title: 'CloudFront Distribution Recommended',
            message: 'Add CloudFront for better global performance and reduced costs.',
            time: '10 minutes ago'
        });

        // Add alerts to container
        alerts.forEach(alert => {
            const alertElement = this.createAlertElement(alert);
            alertsContainer.appendChild(alertElement);
        });
    }

    createAlertElement(alert) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${alert.type}`;
        
        alertDiv.innerHTML = `
            <span class="alert-icon">${alert.icon}</span>
            <div class="alert-content">
                <h4>${alert.title}</h4>
                <p>${alert.message}</p>
                <small>${alert.time}</small>
            </div>
        `;
        
        return alertDiv;
    }

    showErrorAlert(message) {
        const alertsContainer = document.getElementById('alerts-container');
        if (!alertsContainer) return;

        const errorAlert = this.createAlertElement({
            type: 'error',
            icon: '❌',
            title: 'Connection Error',
            message: message,
            time: 'Just now'
        });

        alertsContainer.insertBefore(errorAlert, alertsContainer.firstChild);
    }



    refreshDashboard() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.textContent = '🔄 Refreshing...';
            refreshBtn.disabled = true;
        }

        this.loadDashboardData();

        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.textContent = '🔄 Refresh';
                refreshBtn.disabled = false;
            }
        }, 2000);
    }
}

// Utility Functions
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const text = element.textContent;
    navigator.clipboard.writeText(text).then(() => {
        // Show feedback
        const originalText = element.textContent;
        element.textContent = 'Copied!';
        element.style.color = '#28a745';
        
        setTimeout(() => {
            element.textContent = originalText;
            element.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function testEndpoint(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const url = element.textContent.trim();
    
    // Open endpoint test in new tab
    window.open(url, '_blank');
}

function openInPlayer(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const url = element.textContent.trim();
    
    // Open player with this URL
    const playerUrl = `${window.location.origin}/index.html?stream=${encodeURIComponent(url)}`;
    window.open(playerUrl, '_blank');
}

function openS3Console() {
    const bucketName = document.getElementById('s3-bucket-name')?.textContent;
    if (bucketName) {
        const consoleUrl = `https://s3.console.aws.amazon.com/s3/buckets/${bucketName}?region=us-west-2`;
        window.open(consoleUrl, '_blank');
    }
}

function refreshS3Stats() {
    // In a real implementation, this would fetch actual S3 statistics
    document.getElementById('s3-storage').textContent = 'Calculating...';
    document.getElementById('s3-objects').textContent = 'Calculating...';
    
    setTimeout(() => {
        const storage = (Math.random() * 100).toFixed(2);
        const objects = Math.floor(Math.random() * 50);
        
        document.getElementById('s3-storage').textContent = `${storage} GB`;
        document.getElementById('s3-objects').textContent = objects.toLocaleString();
    }, 2000);
}

function createMediaLiveChannel() {
    if (confirm('This will create a MediaLive channel with SRT input. This will incur AWS charges (~$2.50/hour when running). Continue?')) {
        alert('MediaLive channel creation would be implemented here. This requires AWS API integration.');
    }
}

function createCloudFront() {
    if (confirm('This will create a CloudFront distribution for global content delivery. Continue?')) {
        alert('CloudFront distribution creation would be implemented here. This requires AWS API integration.');
    }
}

function openPlayer() {
    window.open('/index.html', '_blank');
}

function openCloudWatch() {
    const cloudWatchUrl = 'https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#metricsV2:';
    window.open(cloudWatchUrl, '_blank');
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaServicesDashboard = new MediaServicesDashboard();
});
