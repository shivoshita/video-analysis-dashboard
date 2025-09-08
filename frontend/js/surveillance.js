// Surveillance Platform JavaScript Module - FIXED with Real Backend Integration
class SurveillanceModule {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiBaseUrl = dashboard.apiBaseUrl;
        this.cameras = {
            1: { url: '', active: false, stream: null, analysisCount: 0, frameRefreshInterval: null, reportsRefreshInterval: null },
            2: { url: '', active: false, stream: null, analysisCount: 0, frameRefreshInterval: null, reportsRefreshInterval: null },
            3: { url: '', active: false, stream: null, analysisCount: 0, frameRefreshInterval: null, reportsRefreshInterval: null }
        };
        this.totalAnomalies = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedConfiguration();
    }

    initializeElements() {
        // Global controls
        this.startAllBtn = document.getElementById('startAllBtn');
        this.stopAllBtn = document.getElementById('stopAllBtn');
        this.analyzeAllBtn = document.getElementById('analyzeAllBtn');
        this.anomalyAllBtn = document.getElementById('anomalyAllBtn');
        
        // Status elements
        this.activeCamerasCount = document.getElementById('activeCamerasCount');
        this.totalAnalysisCount = document.getElementById('totalAnalysisCount');
        this.anomaliesCount = document.getElementById('anomaliesCount');
        
        // Setup modal elements
        this.setupCamerasBtn = document.getElementById('setupCamerasBtn');
        this.cameraSetupModal = document.getElementById('cameraSetupModal');
        this.closeSetupModal = document.getElementById('closeSetupModal');
        this.cancelSetup = document.getElementById('cancelSetup');
        this.saveSetup = document.getElementById('saveSetup');
        
        // Fullscreen modal
        this.fullscreenModal = document.getElementById('fullscreenModal');
        this.closeFullscreen = document.getElementById('closeFullscreen');
        this.fullscreenTitle = document.getElementById('fullscreenTitle');
        this.fullscreenContent = document.getElementById('fullscreenContent');
        
        // Camera inputs
        this.camera1Url = document.getElementById('camera1Url');
        this.camera2Url = document.getElementById('camera2Url');
        this.camera3Url = document.getElementById('camera3Url');
    }

    setupEventListeners() {
        // Global control buttons
        if (this.startAllBtn) {
            this.startAllBtn.addEventListener('click', () => this.startAllCameras());
        }
        if (this.stopAllBtn) {
            this.stopAllBtn.addEventListener('click', () => this.stopAllCameras());
        }
        if (this.analyzeAllBtn) {
            this.analyzeAllBtn.addEventListener('click', () => this.analyzeAllFeeds());
        }
        if (this.anomalyAllBtn) {
            this.anomalyAllBtn.addEventListener('click', () => this.detectAllAnomalies());
        }

        // Setup modal
        if (this.setupCamerasBtn) {
            this.setupCamerasBtn.addEventListener('click', () => this.openSetupModal());
        }
        if (this.closeSetupModal) {
            this.closeSetupModal.addEventListener('click', () => this.closeSetupModalHandler());
        }
        if (this.cancelSetup) {
            this.cancelSetup.addEventListener('click', () => this.closeSetupModalHandler());
        }
        if (this.saveSetup) {
            this.saveSetup.addEventListener('click', () => this.saveConfiguration());
        }

        // Fullscreen modal
        if (this.closeFullscreen) {
            this.closeFullscreen.addEventListener('click', () => this.closeFullscreenModal());
        }

        // Camera control buttons (event delegation)
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const cameraId = button.dataset.camera;

            if (cameraId && this.cameras[cameraId]) {
                this.handleCameraAction(action, cameraId, button);
            }
        });

        // Modal click outside to close
        if (this.cameraSetupModal) {
            this.cameraSetupModal.addEventListener('click', (e) => {
                if (e.target === this.cameraSetupModal) {
                    this.closeSetupModalHandler();
                }
            });
        }

        if (this.fullscreenModal) {
            this.fullscreenModal.addEventListener('click', (e) => {
                if (e.target === this.fullscreenModal) {
                    this.closeFullscreenModal();
                }
            });
        }

        // ESC key handlers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.cameraSetupModal && this.cameraSetupModal.style.display !== 'none') {
                    this.closeSetupModalHandler();
                }
                if (this.fullscreenModal && this.fullscreenModal.style.display !== 'none') {
                    this.closeFullscreenModal();
                }
            }
        });
    }

    loadSavedConfiguration() {
        const savedConfig = localStorage.getItem('surveillanceCameraConfig');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            if (this.camera1Url) this.camera1Url.value = config.camera1 || '';
            if (this.camera2Url) this.camera2Url.value = config.camera2 || '';
            if (this.camera3Url) this.camera3Url.value = config.camera3 || '';
            
            // Update camera objects
            this.cameras[1].url = config.camera1 || '';
            this.cameras[2].url = config.camera2 || '';
            this.cameras[3].url = config.camera3 || '';
            
            // Update UI to show configured cameras
            this.updateCameraPlaceholders();
        }
    }

    updateCameraPlaceholders() {
        for (let i = 1; i <= 3; i++) {
            const feedElement = document.getElementById(`feed-${i}`);
            if (feedElement && this.cameras[i].url) {
                const placeholder = feedElement.querySelector('.feed-placeholder');
                if (placeholder) {
                    placeholder.innerHTML = `
                        <i class="fas fa-video"></i>
                        <p>Camera ${i} Configured</p>
                        <small>${this.cameras[i].url}</small>
                        <br><small>Click "Start" to begin streaming</small>
                    `;
                }
            }
        }
    }

    // Global Actions - FIXED to use real backend
    async startAllCameras() {
        this.dashboard.showLoading('Starting all cameras...');
        
        const promises = [];
        for (let i = 1; i <= 3; i++) {
            if (this.cameras[i].url) {
                promises.push(this.startCamera(i));
            }
        }
        
        try {
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (successful > 0) {
                this.dashboard.showToast(`${successful} cameras started successfully${failed > 0 ? `, ${failed} failed` : ''}`, successful === promises.length ? 'success' : 'warning');
            } else {
                this.dashboard.showToast('All cameras failed to start', 'error');
            }
        } catch (error) {
            this.dashboard.showToast('Error starting cameras', 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async stopAllCameras() {
        this.dashboard.showLoading('Stopping all cameras...');
        
        const promises = [];
        for (let i = 1; i <= 3; i++) {
            if (this.cameras[i].active) {
                promises.push(this.stopCamera(i));
            }
        }
        
        try {
            await Promise.allSettled(promises);
            this.dashboard.showToast('All cameras stopped', 'info');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async analyzeAllFeeds() {
        const activeCameras = Object.keys(this.cameras).filter(id => this.cameras[id].active);
        
        if (activeCameras.length === 0) {
            this.dashboard.showToast('No active cameras to analyze', 'warning');
            return;
        }

        this.dashboard.showLoading(`Analyzing ${activeCameras.length} camera feeds...`);
        
        const promises = activeCameras.map(id => this.analyzeCamera(id));
        
        try {
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            this.dashboard.showToast(`Analysis completed: ${successful}/${activeCameras.length} cameras`, successful > 0 ? 'success' : 'error');
        } catch (error) {
            this.dashboard.showToast('Analysis operation failed', 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async detectAllAnomalies() {
        const activeCameras = Object.keys(this.cameras).filter(id => this.cameras[id].active);
        
        if (activeCameras.length === 0) {
            this.dashboard.showToast('No active cameras for anomaly detection', 'warning');
            return;
        }

        this.dashboard.showLoading(`Detecting anomalies in ${activeCameras.length} feeds...`);
        
        const promises = activeCameras.map(id => this.detectAnomalies(id));
        
        try {
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            this.dashboard.showToast(`Anomaly detection completed: ${successful}/${activeCameras.length} cameras`, successful > 0 ? 'success' : 'error');
        } catch (error) {
            this.dashboard.showToast('Anomaly detection failed', 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    // Camera Actions - FIXED to use real backend
    async handleCameraAction(action, cameraId, button) {
        switch (action) {
            case 'start':
                await this.startCamera(cameraId);
                break;
            case 'stop':
                await this.stopCamera(cameraId);
                break;
            case 'refresh':
                await this.refreshCamera(cameraId);
                break;
            case 'analyze':
                await this.analyzeCamera(cameraId);
                break;
            case 'anomaly':
                await this.detectAnomalies(cameraId);
                break;
            case 'summary':
                this.showCameraSummary(cameraId);
                break;
            case 'fullscreen':
                this.openFullscreen(cameraId);
                break;
            case 'settings':
                this.openCameraSettings(cameraId);
                break;
            case 'clear-report':
                this.clearCameraReport(cameraId);
                break;
        }
    }

    async startCamera(cameraId) {
        if (!this.cameras[cameraId].url) {
            this.dashboard.showToast(`Camera ${cameraId} URL not configured`, 'error');
            return;
        }

        try {
            this.updateCameraStatus(cameraId, 'loading', 'Connecting...');
            
            // FIXED: Call real backend API instead of simulation
            const response = await this.dashboard.apiRequest('/surveillance/start', {
                method: 'POST',
                body: JSON.stringify({
                    camera_id: cameraId,
                    camera_url: this.cameras[cameraId].url
                })
            });
            
            if (response.success) {
                this.cameras[cameraId].active = true;
                this.updateCameraStatus(cameraId, 'online', 'Online');
                this.updateFeedOverlay(cameraId, '1080p', '30');
                this.showRecordingIndicator(cameraId, true);
                
                // Start auto-refresh for this camera
                this.startCameraAutoRefresh(cameraId);
                
                this.updateGlobalStats();
                this.dashboard.showToast(`Camera ${cameraId} started successfully`, 'success');
            } else {
                throw new Error(response.error || 'Failed to start camera');
            }
            
        } catch (error) {
            console.error(`Error starting camera ${cameraId}:`, error);
            this.updateCameraStatus(cameraId, 'offline', 'Failed');
            this.dashboard.showToast(`Failed to start Camera ${cameraId}: ${error.message}`, 'error');
        }
    }

    async stopCamera(cameraId) {
        try {
            this.updateCameraStatus(cameraId, 'loading', 'Stopping...');
            
            // Stop auto-refresh first
            this.stopCameraAutoRefresh(cameraId);
            
            // FIXED: Call real backend API
            const response = await this.dashboard.apiRequest('/surveillance/stop', {
                method: 'POST',
                body: JSON.stringify({
                    camera_id: cameraId
                })
            });
            
            this.cameras[cameraId].active = false;
            this.updateCameraStatus(cameraId, 'offline', 'Offline');
            this.showRecordingIndicator(cameraId, false);
            
            // Reset feed to placeholder
            this.resetCameraFeed(cameraId);
            
            this.updateGlobalStats();
            this.dashboard.showToast(`Camera ${cameraId} stopped`, 'info');
            
        } catch (error) {
            console.error(`Error stopping camera ${cameraId}:`, error);
            // Force stop locally even if backend fails
            this.cameras[cameraId].active = false;
            this.stopCameraAutoRefresh(cameraId);
            this.updateCameraStatus(cameraId, 'offline', 'Offline');
            this.resetCameraFeed(cameraId);
            this.updateGlobalStats();
            this.dashboard.showToast(`Camera ${cameraId} stopped (forced)`, 'warning');
        }
    }

    async refreshCamera(cameraId) {
        if (!this.cameras[cameraId].active) {
            this.dashboard.showToast(`Camera ${cameraId} is not active`, 'warning');
            return;
        }

        try {
            // FIXED: Get real frame from backend
            const response = await this.dashboard.apiRequest(`/surveillance/frame/${cameraId}`);
            
            if (response.success && response.frame) {
                this.displayCameraFrame(cameraId, response.frame);
                this.dashboard.showToast(`Camera ${cameraId} feed refreshed`, 'success');
            } else {
                throw new Error('No frame available');
            }
            
        } catch (error) {
            console.warn(`Error refreshing camera ${cameraId}:`, error);
            this.dashboard.showToast(`Failed to refresh Camera ${cameraId}`, 'error');
        }
    }

    async analyzeCamera(cameraId) {
        if (!this.cameras[cameraId].active) {
            this.dashboard.showToast(`Camera ${cameraId} is not active`, 'warning');
            return;
        }

        try {
            this.dashboard.showLoading(`Analyzing Camera ${cameraId}...`);
            
            // FIXED: Call real backend API
            const response = await this.dashboard.apiRequest(`/surveillance/analyze/${cameraId}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.cameras[cameraId].analysisCount++;
                this.updateCameraReport(cameraId, response.report, 'analysis');
                this.updateGlobalStats();
                this.dashboard.showToast(`Analysis completed for Camera ${cameraId}`, 'success');
            } else {
                throw new Error(response.error || 'Analysis failed');
            }
            
        } catch (error) {
            console.error(`Analysis failed for camera ${cameraId}:`, error);
            this.dashboard.showToast(`Analysis failed for Camera ${cameraId}: ${error.message}`, 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    async detectAnomalies(cameraId) {
        if (!this.cameras[cameraId].active) {
            this.dashboard.showToast(`Camera ${cameraId} is not active`, 'warning');
            return;
        }

        try {
            this.dashboard.showLoading(`Detecting anomalies in Camera ${cameraId}...`);
            
            // FIXED: Call real backend API
            const response = await this.dashboard.apiRequest(`/surveillance/anomaly/${cameraId}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.cameras[cameraId].analysisCount++;
                
                // Update anomaly count if detected
                if (response.anomalies_detected) {
                    this.totalAnomalies += (response.anomaly_count || 1);
                }
                
                this.updateCameraReport(cameraId, response.report, 'anomaly');
                this.updateGlobalStats();
                
                const message = response.anomalies_detected
                    ? `Anomalies detected in Camera ${cameraId}!`
                    : `No anomalies detected in Camera ${cameraId}`;
                
                this.dashboard.showToast(message, response.anomalies_detected ? 'warning' : 'success');
            } else {
                throw new Error(response.error || 'Anomaly detection failed');
            }
            
        } catch (error) {
            console.error(`Anomaly detection failed for camera ${cameraId}:`, error);
            this.dashboard.showToast(`Anomaly detection failed for Camera ${cameraId}: ${error.message}`, 'error');
        } finally {
            this.dashboard.hideLoading();
        }
    }

    // FIXED: Auto-refresh functionality like live-monitor
    startCameraAutoRefresh(cameraId) {
        // Clear any existing intervals
        this.stopCameraAutoRefresh(cameraId);
        
        // Refresh camera frame every 2 seconds
        this.cameras[cameraId].frameRefreshInterval = setInterval(async () => {
            if (this.cameras[cameraId].active) {
                try {
                    const response = await this.dashboard.apiRequest(`/surveillance/frame/${cameraId}`);
                    if (response.success && response.frame) {
                        this.displayCameraFrame(cameraId, response.frame);
                        this.updateFeedOverlay(cameraId, '1080p', '30');
                    }
                } catch (error) {
                    // Only log errors occasionally
                    if (Math.random() < 0.1) {
                        console.warn(`Frame refresh error for camera ${cameraId}:`, error.message);
                    }
                }
            } else {
                this.stopCameraAutoRefresh(cameraId);
            }
        }, 2000);

        // Refresh reports every 10 seconds
        this.cameras[cameraId].reportsRefreshInterval = setInterval(async () => {
            if (this.cameras[cameraId].active) {
                try {
                    const response = await this.dashboard.apiRequest(`/surveillance/reports/${cameraId}`);
                    if (response.success && response.reports) {
                        this.updateCameraReportsDisplay(cameraId, response.reports);
                    }
                } catch (error) {
                    // Silently handle report refresh errors
                }
            } else {
                this.stopCameraAutoRefresh(cameraId);
            }
        }, 10000);
    }

    stopCameraAutoRefresh(cameraId) {
        if (this.cameras[cameraId].frameRefreshInterval) {
            clearInterval(this.cameras[cameraId].frameRefreshInterval);
            this.cameras[cameraId].frameRefreshInterval = null;
        }
        
        if (this.cameras[cameraId].reportsRefreshInterval) {
            clearInterval(this.cameras[cameraId].reportsRefreshInterval);
            this.cameras[cameraId].reportsRefreshInterval = null;
        }
    }

    // FIXED: Display real camera frames
    displayCameraFrame(cameraId, frameData) {
        const feedElement = document.getElementById(`feed-${cameraId}`);
        if (!feedElement) return;

        // Clear placeholder content
        feedElement.innerHTML = '';
        
        // Create and display image
        const img = document.createElement('img');
        img.src = frameData;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = `Camera ${cameraId} feed`;
        img.onload = () => {
            // Frame loaded successfully
        };
        img.onerror = () => {
            this.resetCameraFeed(cameraId);
        };
        
        feedElement.appendChild(img);
    }

    resetCameraFeed(cameraId) {
        const feedElement = document.getElementById(`feed-${cameraId}`);
        if (!feedElement) return;

        const isConfigured = this.cameras[cameraId].url;
        feedElement.innerHTML = `
            <div class="feed-placeholder">
                <i class="fas fa-video-slash"></i>
                <p>${isConfigured ? `Camera ${cameraId} Stopped` : 'Camera Not Connected'}</p>
                <small>${isConfigured ? this.cameras[cameraId].url : 'Add IP webcam URL to start'}</small>
                <br><small>${isConfigured ? 'Click "Start" to resume streaming' : 'Configure in settings'}</small>
            </div>
        `;
    }

    // UI Update Functions
    updateCameraStatus(cameraId, status, text) {
        const statusElement = document.getElementById(`status-${cameraId}`);
        if (statusElement) {
            statusElement.className = `camera-status ${status}`;
            statusElement.textContent = text;
        }
    }

    updateFeedOverlay(cameraId, resolution, fps) {
        const resolutionElement = document.getElementById(`resolution-${cameraId}`);
        const fpsElement = document.getElementById(`fps-${cameraId}`);
        
        if (resolutionElement) resolutionElement.textContent = resolution;
        if (fpsElement) fpsElement.textContent = `${fps} FPS`;
    }

    showRecordingIndicator(cameraId, show) {
        const recordingElement = document.getElementById(`recording-${cameraId}`);
        if (recordingElement) {
            recordingElement.style.display = show ? 'flex' : 'none';
        }
    }

    updateCameraReport(cameraId, content, type) {
        const reportContent = document.querySelector(`#report-${cameraId} .report-content`);
        if (reportContent) {
            const timestamp = new Date().toLocaleString();
            const typeLabel = type === 'analysis' ? 'Analysis' : type === 'anomaly' ? 'Anomaly Detection' : 'Summary';
            
            const reportEntry = `
                <div class="report-entry" style="border-left: 3px solid var(--accent-color); padding-left: 12px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: var(--accent-color);">${typeLabel}</strong>
                        <small style="color: var(--text-muted);">${timestamp}</small>
                    </div>
                    <div style="line-height: 1.5;">${content.replace(/\n/g, '<br>')}</div>
                </div>
            `;
            
            reportContent.innerHTML = reportEntry + reportContent.innerHTML;
            
            // Keep only last 5 reports per camera
            const entries = reportContent.querySelectorAll('.report-entry');
            if (entries.length > 5) {
                for (let i = 5; i < entries.length; i++) {
                    entries[i].remove();
                }
            }
        }
    }

    updateCameraReportsDisplay(cameraId, reports) {
        if (!reports || reports.length === 0) return;
        
        const reportContent = document.querySelector(`#report-${cameraId} .report-content`);
        if (reportContent) {
            // Update with latest reports from backend
            reportContent.innerHTML = reports.map(report => `
                <div class="report-entry" style="border-left: 3px solid var(--accent-color); padding-left: 12px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: var(--accent-color);">${report.type}</strong>
                        <small style="color: var(--text-muted);">${new Date(report.timestamp).toLocaleString()}</small>
                    </div>
                    <div style="line-height: 1.5;">${report.content.replace(/\n/g, '<br>')}</div>
                </div>
            `).join('');
        }
    }

    updateGlobalStats() {
        const activeCameras = Object.values(this.cameras).filter(camera => camera.active).length;
        const totalAnalysis = Object.values(this.cameras).reduce((sum, camera) => sum + camera.analysisCount, 0);
        
        if (this.activeCamerasCount) {
            this.activeCamerasCount.textContent = `${activeCameras}/3`;
        }
        if (this.totalAnalysisCount) {
            this.totalAnalysisCount.textContent = totalAnalysis;
        }
        if (this.anomaliesCount) {
            this.anomaliesCount.textContent = this.totalAnomalies;
        }
    }

    showCameraSummary(cameraId) {
        const camera = this.cameras[cameraId];
        const summary = `
            <div class="camera-summary">
                <h4>Camera ${cameraId} Summary</h4>
                <p><strong>Status:</strong> ${camera.active ? 'Active' : 'Inactive'}</p>
                <p><strong>URL:</strong> ${camera.url || 'Not configured'}</p>
                <p><strong>Analysis Count:</strong> ${camera.analysisCount}</p>
                <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
            </div>
        `;
        
        this.updateCameraReport(cameraId, summary, 'summary');
    }

    clearCameraReport(cameraId) {
        const reportContent = document.querySelector(`#report-${cameraId} .report-content`);
        if (reportContent) {
            reportContent.innerHTML = '<p>No analysis performed yet</p>';
        }
    }

    // Modal Functions
    openSetupModal() {
        if (this.cameraSetupModal) {
            this.cameraSetupModal.style.display = 'flex';
        }
    }

    closeSetupModalHandler() {
        if (this.cameraSetupModal) {
            this.cameraSetupModal.style.display = 'none';
        }
    }

    saveConfiguration() {
        const config = {
            camera1: this.camera1Url?.value || '',
            camera2: this.camera2Url?.value || '',
            camera3: this.camera3Url?.value || ''
        };
        
        // Save to localStorage
        localStorage.setItem('surveillanceCameraConfig', JSON.stringify(config));
        
        // Update camera objects
        this.cameras[1].url = config.camera1;
        this.cameras[2].url = config.camera2;
        this.cameras[3].url = config.camera3;
        
        // Update UI
        this.updateCameraPlaceholders();
        this.closeSetupModalHandler();
        
        this.dashboard.showToast('Camera configuration saved successfully', 'success');
    }

    openFullscreen(cameraId) {
        const feedElement = document.getElementById(`feed-${cameraId}`);
        if (!feedElement || !this.fullscreenModal) return;
        
        const feedClone = feedElement.cloneNode(true);
        feedClone.style.width = '100%';
        feedClone.style.height = '100%';
        feedClone.style.maxWidth = '90vw';
        feedClone.style.maxHeight = '70vh';
        
        this.fullscreenTitle.textContent = `Camera ${cameraId} - Fullscreen View`;
        this.fullscreenContent.innerHTML = '';
        this.fullscreenContent.appendChild(feedClone);
        
        this.fullscreenModal.style.display = 'flex';
    }

    closeFullscreenModal() {
        if (this.fullscreenModal) {
            this.fullscreenModal.style.display = 'none';
        }
    }

    openCameraSettings(cameraId) {
        this.dashboard.showToast(`Camera ${cameraId} settings - Feature coming soon`, 'info');
    }

    // Initialize method
    initialize() {
        this.updateGlobalStats();
        this.updateCameraPlaceholders();
    }

    // Cleanup method - FIXED
    destroy() {
        console.log('Destroying surveillance module...');
        
        // Stop all cameras and their auto-refresh
        for (let i = 1; i <= 3; i++) {
            if (this.cameras[i].active) {
                this.stopCamera(i);
            }
            this.stopCameraAutoRefresh(i);
        }
    }
}

// Extend app.js with surveillance functionality
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize surveillance module when dashboard is ready
        setTimeout(() => {
            if (window.dashboard) {
                window.dashboard.surveillanceModule = new SurveillanceModule(window.dashboard);
                console.log('SurveillanceModule initialized with real backend integration');
            }
        }, 100);
    });
}