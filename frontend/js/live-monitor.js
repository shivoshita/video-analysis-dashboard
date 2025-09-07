// Live Monitor JavaScript Module - Fixed interval clearing and stop functionality
class LiveMonitor {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.isActive = false;
        this.isConnecting = false;
        this.frameRefreshInterval = null;
        this.reportsRefreshInterval = null;
        this.apiBaseUrl = dashboard.apiBaseUrl;
        this.frameCount = 0;
        this.initialized = false;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.startBtn = document.getElementById('startLiveBtn');
        this.stopBtn = document.getElementById('stopLiveBtn');
        this.analyzeLiveBtn = document.getElementById('analyzeLiveBtn');
        this.anomalyLiveBtn = document.getElementById('anomalyLiveBtn');
        this.refreshVideoBtn = document.getElementById('refreshVideoBtn');
        this.refreshReportsBtn = document.getElementById('refreshReportsBtn');
        this.liveVideoDisplay = document.getElementById('liveVideoDisplay');
        this.liveReports = document.getElementById('liveReports');
        this.streamStatus = document.getElementById('streamStatus');
        this.streamFPS = document.getElementById('streamFPS');
        this.streamQuality = document.getElementById('streamQuality');
    }

    setupEventListeners() {
        // Prevent duplicate event listeners
        if (this.initialized) return;

        if (this.startBtn) {
            this.startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.startLiveMonitoring();
            });
        }
        
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.stopLiveMonitoring();
            });
        }
        
        if (this.analyzeLiveBtn) {
            this.analyzeLiveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.analyzeLiveFeed();
            });
        }
        
        if (this.anomalyLiveBtn) {
            this.anomalyLiveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.checkLiveAnomalies();
            });
        }
        
        if (this.refreshVideoBtn) {
            this.refreshVideoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.refreshLiveVideo();
            });
        }
        
        if (this.refreshReportsBtn) {
            this.refreshReportsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.refreshLiveReports();
            });
        }

        this.initialized = true;
    }

    async startLiveMonitoring() {
        if (this.isConnecting || this.isActive) {
            console.log('Already connecting or active, ignoring start request');
            return;
        }

        try {
            this.isConnecting = true;
            this.updateUIState();
            this.dashboard.showLoading('Starting live camera monitoring...');
            
            console.log('Starting live monitoring...');
            
            const response = await this.dashboard.apiRequest('/live/start', {
                method: 'POST'
            });

            if (response.success) {
                this.isActive = true;
                this.isConnecting = false;
                this.frameCount = 0;
                this.updateUIState();
                this.startAutoRefresh();
                this.dashboard.showToast('Live monitoring started successfully', 'success');
                
                console.log('Live monitoring started successfully');
                
                // Update chat context for live
                this.updateChatContextForLive();
            } else {
                throw new Error(response.error || 'Failed to start live monitoring');
            }

        } catch (error) {
            console.error('Failed to start live monitoring:', error);
            this.isActive = false;
            this.isConnecting = false;
            this.updateUIState();
            this.dashboard.showToast('Failed to start live monitoring: ' + error.message, 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async stopLiveMonitoring() {
        console.log('Stop monitoring requested - current state:', { isActive: this.isActive, isConnecting: this.isConnecting });
        
        if (!this.isActive && !this.isConnecting) {
            console.log('Already stopped, ignoring stop request');
            return;
        }

        try {
            this.dashboard.showLoading('Stopping live monitoring...');
            
            // CRITICAL: Stop intervals FIRST before making API call
            this.forceStopIntervals();
            
            // Set flags to false immediately to prevent new requests
            this.isActive = false;
            this.isConnecting = false;
            this.frameCount = 0;
            
            // Update UI immediately
            this.updateUIState();
            this.clearVideoDisplay();
            
            console.log('Local state cleaned up, making API call...');
            
            // Make API call to stop backend
            try {
                const response = await this.dashboard.apiRequest('/live/stop', {
                    method: 'POST'
                });
                
                if (response.success) {
                    console.log('Backend stopped successfully');
                    this.dashboard.showToast('Live monitoring stopped', 'info');
                } else {
                    console.warn('Backend returned error but local state already cleaned:', response.error);
                    this.dashboard.showToast('Live monitoring stopped (local)', 'warning');
                }
                
            } catch (apiError) {
                console.warn('API stop call failed but continuing with local cleanup:', apiError);
                this.dashboard.showToast('Live monitoring stopped (forced local)', 'warning');
            }

        } catch (error) {
            console.error('Error during stop process:', error);
        } finally {
            // Ensure everything is stopped regardless of API response
            this.forceStopIntervals();
            this.isActive = false;
            this.isConnecting = false;
            this.updateUIState();
            this.clearVideoDisplay();
            this.dashboard.hideLoading();
            
            console.log('Stop process complete');
        }
    }

    forceStopIntervals() {
        console.log('Force stopping intervals...');
        
        if (this.frameRefreshInterval) {
            clearInterval(this.frameRefreshInterval);
            this.frameRefreshInterval = null;
            console.log('Frame refresh interval cleared');
        }
        
        if (this.reportsRefreshInterval) {
            clearInterval(this.reportsRefreshInterval);
            this.reportsRefreshInterval = null;
            console.log('Reports refresh interval cleared');
        }
    }

    async analyzeLiveFeed() {
        if (!this.isActive) {
            this.dashboard.showToast('Live monitoring is not active', 'warning');
            return;
        }

        try {
            this.dashboard.showLoading('Analyzing live feed...');
            
            const response = await this.dashboard.apiRequest('/live/analyze', {
                method: 'POST'
            });

            if (response.success) {
                await this.refreshLiveReports();
                this.dashboard.showToast('Live feed analyzed successfully', 'success');
                
                // Update chat context with live analysis
                this.updateChatContextForLive();
            } else {
                throw new Error(response.error || 'Live analysis failed');
            }

        } catch (error) {
            console.error('Live analysis failed:', error);
            this.dashboard.showToast('Live analysis failed: ' + error.message, 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async checkLiveAnomalies() {
        if (!this.isActive) {
            this.dashboard.showToast('Live monitoring is not active', 'warning');
            return;
        }

        try {
            this.dashboard.showLoading('Checking for anomalies...');
            
            const response = await this.dashboard.apiRequest('/live/anomaly', {
                method: 'POST'
            });

            if (response.success) {
                await this.refreshLiveReports();
                
                if (response.anomalies_detected) {
                    this.dashboard.showToast('Anomalies detected in live feed!', 'warning');
                    this.updateNotificationBadge();
                } else {
                    this.dashboard.showToast('No anomalies detected', 'success');
                }
                
                // Update chat context with live anomaly check
                this.updateChatContextForLive();
            } else {
                throw new Error(response.error || 'Anomaly check failed');
            }

        } catch (error) {
            console.error('Anomaly check failed:', error);
            this.dashboard.showToast('Anomaly check failed: ' + error.message, 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async refreshLiveVideo() {
        if (!this.isActive) {
            return;
        }

        try {
            const response = await this.dashboard.apiRequest('/live/frame');
            
            if (response.success && response.frame) {
                this.displayLiveFrame(response.frame);
                this.frameCount++;
                this.updateStreamStatus('Online', '30', 'HD');
            } else {
                this.showVideoPlaceholder();
                this.updateStreamStatus('No Frame', '0', 'N/A');
            }

        } catch (error) {
            // Only log errors occasionally to avoid console spam
            if (this.frameCount % 30 === 0) {
                console.warn('Frame refresh error (periodic):', error.message);
            }
            this.showVideoPlaceholder();
            this.updateStreamStatus('Error', '0', 'N/A');
        }
    }

    async refreshLiveReports() {
        if (!this.isActive) {
            return;
        }

        try {
            const response = await this.dashboard.apiRequest('/live/reports');
            
            if (response.reports && this.liveReports) {
                if (response.reports.length > 0) {
                    const reportsText = response.reports
                        .slice(0, 10) // Show only last 10 reports to reduce clutter
                        .map(report => report.content)
                        .join('\n\n' + '='.repeat(50) + '\n\n');
                    
                    this.liveReports.textContent = reportsText;
                } else {
                    this.liveReports.textContent = 'Live analysis reports will appear here...\n\nAutomatic analysis: Every 20 seconds\nAnomaly checks: Every 10 seconds\nManual analysis: On demand';
                }
                
                // Auto-scroll to top to show latest reports
                this.liveReports.scrollTop = 0;
            }

        } catch (error) {
            // Only log errors occasionally to avoid console spam
            if (this.frameCount % 60 === 0) {
                console.warn('Reports refresh error (periodic):', error.message);
            }
        }
    }

    displayLiveFrame(frameData) {
        if (!this.liveVideoDisplay) return;

        // Clear placeholder content
        this.liveVideoDisplay.innerHTML = '';
        
        // Create and display image
        const img = document.createElement('img');
        img.src = frameData;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = 'Live camera feed';
        img.onload = () => {
            // Image loaded successfully
        };
        img.onerror = () => {
            this.showVideoPlaceholder();
        };
        
        this.liveVideoDisplay.appendChild(img);
    }

    showVideoPlaceholder() {
        if (!this.liveVideoDisplay) return;

        this.liveVideoDisplay.innerHTML = `
            <div class="video-placeholder">
                <i class="fas fa-video-slash"></i>
                <p>${this.isActive ? 'Loading live feed...' : 'No live feed active'}</p>
            </div>
        `;
    }

    clearVideoDisplay() {
        this.showVideoPlaceholder();
        this.updateStreamStatus('Offline', '0', 'N/A');
        
        if (this.liveReports) {
            this.liveReports.textContent = 'Live analysis reports will appear here...\n\nAutomatic analysis: Every 20 seconds\nAnomaly checks: Every 10 seconds\nManual analysis: On demand';
        }
    }

    updateStreamStatus(status, fps, quality) {
        if (this.streamStatus) {
            this.streamStatus.textContent = status;
            this.streamStatus.className = 'status-value';
            
            if (status === 'Online') {
                this.streamStatus.style.color = '#22c55e';
            } else if (status === 'Offline') {
                this.streamStatus.style.color = '#64748b';
            } else {
                this.streamStatus.style.color = '#ef4444';
            }
        }
        
        if (this.streamFPS) {
            this.streamFPS.textContent = fps;
        }
        
        if (this.streamQuality) {
            this.streamQuality.textContent = quality;
        }
    }

    updateUIState() {
        // Update button states
        if (this.startBtn) {
            this.startBtn.disabled = this.isActive || this.isConnecting;
            this.startBtn.innerHTML = this.isActive ? 
                '<i class="fas fa-circle" style="color: #22c55e;"></i> Monitoring Active' : 
                this.isConnecting ? 
                '<i class="fas fa-spinner fa-spin"></i> Connecting...' :
                '<i class="fas fa-play"></i> Start Monitoring';
        }
        
        if (this.stopBtn) {
            this.stopBtn.disabled = !this.isActive && !this.isConnecting;
            this.stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Monitoring';
        }
        
        if (this.analyzeLiveBtn) {
            this.analyzeLiveBtn.disabled = !this.isActive;
        }
        
        if (this.anomalyLiveBtn) {
            this.anomalyLiveBtn.disabled = !this.isActive;
        }
        
        if (this.refreshVideoBtn) {
            this.refreshVideoBtn.disabled = !this.isActive;
        }
        
        if (this.refreshReportsBtn) {
            this.refreshReportsBtn.disabled = !this.isActive;
        }
    }

    startAutoRefresh() {
        // CRITICAL: Clear any existing intervals first
        this.forceStopIntervals();
        
        console.log('Starting auto refresh intervals...');
        
        // Refresh video feed every 1000ms (1 second) - reasonable rate
        this.frameRefreshInterval = setInterval(() => {
            if (this.isActive) {
                this.refreshLiveVideo();
            } else {
                console.log('Stopping frame refresh - not active');
                this.forceStopIntervals();
            }
        }, 1000);

        // Refresh reports every 5 seconds
        this.reportsRefreshInterval = setInterval(() => {
            if (this.isActive) {
                this.refreshLiveReports();
            } else {
                console.log('Stopping reports refresh - not active');
                this.forceStopIntervals();
            }
        }, 5000);
        
        console.log('Auto-refresh started: Video 1s, Reports 5s');
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
        }
    }

    updateChatContextForLive() {
        // Notify chat module that live video context is available
        if (this.dashboard.chatModule) {
            this.dashboard.chatModule.updateVideoContext({
                type: 'live_video',
                source: 'live_feed',
                timestamp: new Date().toISOString()
            });
        }
    }

    // Public method to check if live monitoring is active
    isLiveActive() {
        return this.isActive;
    }

    // Get current status for external components
    getStatus() {
        return {
            active: this.isActive,
            connecting: this.isConnecting,
            frameCount: this.frameCount
        };
    }

    // Cleanup method
    destroy() {
        console.log('Destroying live monitor...');
        this.forceStopIntervals();
        
        if (this.isActive || this.isConnecting) {
            // Force local cleanup without API call during destroy
            this.isActive = false;
            this.isConnecting = false;
            this.updateUIState();
            this.clearVideoDisplay();
        }
    }
}

// Extend the main dashboard class to include live monitor
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Only initialize once
        if (window.dashboard && !window.dashboard.liveMonitor) {
            window.dashboard.liveMonitor = new LiveMonitor(window.dashboard);
            console.log('LiveMonitor initialized');
        }
    });
}