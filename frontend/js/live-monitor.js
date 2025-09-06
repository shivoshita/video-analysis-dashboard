// Live Monitor JavaScript Module
class LiveMonitor {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.isActive = false;
        this.frameRefreshInterval = null;
        this.reportsRefreshInterval = null;
        this.apiBaseUrl = dashboard.apiBaseUrl;
        
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
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startLiveMonitoring());
        }
        
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopLiveMonitoring());
        }
        
        if (this.analyzeLiveBtn) {
            this.analyzeLiveBtn.addEventListener('click', () => this.analyzeLiveFeed());
        }
        
        if (this.anomalyLiveBtn) {
            this.anomalyLiveBtn.addEventListener('click', () => this.checkLiveAnomalies());
        }
        
        if (this.refreshVideoBtn) {
            this.refreshVideoBtn.addEventListener('click', () => this.refreshLiveVideo());
        }
        
        if (this.refreshReportsBtn) {
            this.refreshReportsBtn.addEventListener('click', () => this.refreshLiveReports());
        }
    }

    async startLiveMonitoring() {
        try {
            this.dashboard.showLoading('Starting live camera monitoring...');
            
            const response = await this.dashboard.apiRequest('/live/start', {
                method: 'POST'
            });

            if (response.success) {
                this.isActive = true;
                this.updateUIState();
                this.startAutoRefresh();
                this.dashboard.showToast('Live monitoring started successfully', 'success');
            } else {
                throw new Error(response.error || 'Failed to start live monitoring');
            }

        } catch (error) {
            console.error('Failed to start live monitoring:', error);
            this.dashboard.showToast('Failed to start live monitoring', 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async stopLiveMonitoring() {
        try {
            this.dashboard.showLoading('Stopping live monitoring...');
            
            const response = await this.dashboard.apiRequest('/live/stop', {
                method: 'POST'
            });

            if (response.success) {
                this.isActive = false;
                this.updateUIState();
                this.stopAutoRefresh();
                this.clearVideoDisplay();
                this.dashboard.showToast('Live monitoring stopped', 'info');
            } else {
                throw new Error(response.error || 'Failed to stop live monitoring');
            }

        } catch (error) {
            console.error('Failed to stop live monitoring:', error);
            this.dashboard.showToast('Failed to stop live monitoring', 'error');
        } finally {
            this.dashboard.hideLoading();
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
            } else {
                throw new Error(response.error || 'Live analysis failed');
            }

        } catch (error) {
            console.error('Live analysis failed:', error);
            this.dashboard.showToast('Live analysis failed', 'error');
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
            } else {
                throw new Error(response.error || 'Anomaly check failed');
            }

        } catch (error) {
            console.error('Anomaly check failed:', error);
            this.dashboard.showToast('Anomaly check failed', 'error');
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
                this.updateStreamStatus('Online', '30', 'HD');
            } else {
                this.showVideoPlaceholder();
                this.updateStreamStatus('Offline', '0', 'N/A');
            }

        } catch (error) {
            console.error('Failed to refresh live video:', error);
            this.showVideoPlaceholder();
            this.updateStreamStatus('Error', '0', 'N/A');
        }
    }

    async refreshLiveReports() {
        try {
            const response = await this.dashboard.apiRequest('/live/reports');
            
            if (response.reports && this.liveReports) {
                if (response.reports.length > 0) {
                    const reportsText = response.reports
                        .map(report => report.content)
                        .join('\n\n' + '='.repeat(50) + '\n\n');
                    
                    this.liveReports.textContent = reportsText;
                } else {
                    this.liveReports.textContent = 'Live analysis reports will appear here...\n\nAutomatic reports every 20 seconds\nAnomaly alerts as they happen\nManual analysis reports on demand';
                }
                
                // Auto-scroll to top to show latest reports
                this.liveReports.scrollTop = 0;
            }

        } catch (error) {
            console.error('Failed to refresh live reports:', error);
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
        
        this.liveVideoDisplay.appendChild(img);
    }

    showVideoPlaceholder() {
        if (!this.liveVideoDisplay) return;

        this.liveVideoDisplay.innerHTML = `
            <div class="video-placeholder">
                <i class="fas fa-video-slash"></i>
                <p>No live feed active</p>
            </div>
        `;
    }

    clearVideoDisplay() {
        this.showVideoPlaceholder();
        this.updateStreamStatus('Offline', '0', 'N/A');
        
        if (this.liveReports) {
            this.liveReports.textContent = 'Live analysis reports will appear here...\n\nAutomatic reports every 20 seconds\nAnomaly alerts as they happen\nManual analysis reports on demand';
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
            this.startBtn.disabled = this.isActive;
            this.startBtn.textContent = this.isActive ? 'Monitoring Active' : 'Start Monitoring';
        }
        
        if (this.stopBtn) {
            this.stopBtn.disabled = !this.isActive;
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
        // Refresh video feed every 100ms for smooth display
        this.frameRefreshInterval = setInterval(() => {
            this.refreshLiveVideo();
        }, 100);

        // Refresh reports every 2 seconds
        this.reportsRefreshInterval = setInterval(() => {
            this.refreshLiveReports();
        }, 2000);
    }

    stopAutoRefresh() {
        if (this.frameRefreshInterval) {
            clearInterval(this.frameRefreshInterval);
            this.frameRefreshInterval = null;
        }
        
        if (this.reportsRefreshInterval) {
            clearInterval(this.reportsRefreshInterval);
            this.reportsRefreshInterval = null;
        }
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
        }
    }

    // Public method to check if live monitoring is active
    isLiveActive() {
        return this.isActive;
    }

    // Cleanup method
    destroy() {
        this.stopAutoRefresh();
        if (this.isActive) {
            this.stopLiveMonitoring();
        }
    }
}

// Extend the main dashboard class to include live monitor
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize live monitor when dashboard is ready
        if (window.dashboard) {
            window.dashboard.liveMonitor = new LiveMonitor(window.dashboard);
            
            // Override live monitoring methods in main dashboard
            window.dashboard.startLiveMonitoring = () => window.dashboard.liveMonitor.startLiveMonitoring();
            window.dashboard.stopLiveMonitoring = () => window.dashboard.liveMonitor.stopLiveMonitoring();
            window.dashboard.analyzeLiveFeed = () => window.dashboard.liveMonitor.analyzeLiveFeed();
            window.dashboard.checkLiveAnomalies = () => window.dashboard.liveMonitor.checkLiveAnomalies();
            window.dashboard.refreshLiveVideo = () => window.dashboard.liveMonitor.refreshLiveVideo();
            window.dashboard.refreshLiveReports = () => window.dashboard.liveMonitor.refreshLiveReports();
        }
    });
}