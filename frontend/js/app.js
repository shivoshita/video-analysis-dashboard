// Main App JavaScript - Multi-page navigation with Surveillance support
class VideoAnalysisDashboard {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5000/api';
        this.currentPage = this.getCurrentPageFromURL();
        this.isLiveActive = false;
        this.videoContext = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.setupFileUpload();
        this.initializeCharts();
        this.startPeriodicUpdates();
        
        // Initialize current page
        this.initializePage(this.currentPage);
        this.setActiveNavFromURL();
    }

    getCurrentPageFromURL() {
        const path = window.location.pathname;
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        
        // Map file names to page IDs
        const pageMap = {
            'index.html': 'dashboard',
            '': 'dashboard',
            'live.html': 'live',
            'surveillance.html': 'surveillance',
            'analyser.html': 'analysis',
            'chat.html': 'chat',
            'reports.html': 'reports',
            'settings.html': 'settings'
        };
        
        return pageMap[fileName] || 'dashboard';
    }

    setupEventListeners() {
        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }

        // Global click handler for mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateToPage(page);
            });
        });
    }

    navigateToPage(pageId) {
        const pageMap = {
            'dashboard': 'index.html',
            'live': 'live.html',
            'surveillance': 'surveillance.html',
            'analysis': 'analyser.html',
            'chat': 'chat.html',
            'reports': 'reports.html',
            'settings': 'settings.html'
        };
        
        const fileName = pageMap[pageId];
        if (fileName) {
            window.location.href = fileName;
        }
    }

    setActiveNavFromURL() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === this.currentPage) {
                item.classList.add('active');
            }
        });
    }

    initializePage(pageId) {
        switch(pageId) {
            case 'dashboard':
                this.updateDashboardStats();
                this.loadRecentActivity();
                this.loadCameraOverview();
                break;
            case 'live':
                this.initializeLiveMonitor();
                break;
            case 'surveillance':
                // Surveillance initialization is handled by surveillance.js module
                break;
            case 'analysis':
                this.initializeVideoAnalysis();
                break;
            case 'chat':
                this.initializeChat();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    setupFileUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('videoFileInput');

        if (uploadArea && fileInput) {
            // Click to upload
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });
        }
    }

    handleFileSelect(file) {
        if (!file.type.startsWith('video/')) {
            this.showToast('Please select a valid video file', 'error');
            return;
        }

        // Show video info
        const videoInfo = document.getElementById('videoInfo');
        const videoDuration = document.getElementById('videoDuration');
        const videoResolution = document.getElementById('videoResolution');
        const videoSize = document.getElementById('videoSize');
        const videoFormat = document.getElementById('videoFormat');

        if (videoInfo) {
            videoInfo.style.display = 'block';
            
            if (videoSize) videoSize.textContent = this.formatFileSize(file.size);
            if (videoFormat) videoFormat.textContent = file.type;

            // Get video duration and resolution
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                if (videoDuration) videoDuration.textContent = this.formatDuration(video.duration);
                if (videoResolution) videoResolution.textContent = `${video.videoWidth}x${video.videoHeight}`;
                window.URL.revokeObjectURL(video.src);
            };
            video.src = URL.createObjectURL(file);
        }

        // Enable analysis buttons
        const analyzeBtn = document.getElementById('analyzeVideoBtn');
        const anomalyBtn = document.getElementById('detectAnomaliesBtn');
        
        if (analyzeBtn) analyzeBtn.disabled = false;
        if (anomalyBtn) anomalyBtn.disabled = false;

        // Store file for processing
        this.selectedFile = file;
        
        this.showToast('Video file loaded successfully', 'success');
    }

    initializeCharts() {
        // Initialize dashboard charts
        const ctx = document.getElementById('incidentsChart');
        if (ctx) {
            this.incidentsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Incidents',
                        data: [12, 19, 3, 5, 2, 3, 8],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#334155'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        },
                        x: {
                            grid: {
                                color: '#334155'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        }
                    }
                }
            });
        }
    }

    // API Methods
    async apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            this.showToast('API request failed', 'error');
            throw error;
        }
    }

    async uploadAndAnalyzeVideo(analysisType = 'analyze') {
        if (!this.selectedFile) {
            this.showToast('Please select a video file first', 'error');
            return;
        }

        this.showLoading(`${analysisType === 'analyze' ? 'Analyzing' : 'Detecting anomalies in'} video...`);

        try {
            const formData = new FormData();
            formData.append('video', this.selectedFile);

            const response = await fetch(`${this.apiBaseUrl}/video/${analysisType}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const result = await response.json();
            
            this.hideLoading();
            
            if (result.success) {
                this.displayVideoResults(result);
                this.showToast('Video analysis completed successfully', 'success');
            } else {
                throw new Error(result.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Video analysis failed:', error);
            this.hideLoading();
            this.showToast(`Video analysis failed: ${error.message}`, 'error');
        }
    }

    displayVideoResults(result) {
        console.log('Displaying video results:', result);
        
        // Show processed video if available
        const processedVideo = document.getElementById('processedVideo');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        
        if (result.video_url && processedVideo) {
            // Handle both relative and full URLs
            const videoUrl = result.video_url.startsWith('http') ? 
                result.video_url : 
                `http://localhost:5000${result.video_url}`;
            
            processedVideo.src = videoUrl;
            processedVideo.style.display = 'block';
            if (videoPlaceholder) {
                videoPlaceholder.style.display = 'none';
            }
        }

        // Show analysis report
        const analysisReport = document.getElementById('analysisReport');
        const resultsSection = document.querySelector('.analysis-results');
        
        if (result.report && analysisReport) {
            // Format the report text for better display
            const formattedReport = result.report
                .replace(/\n/g, '<br>')
                .replace(/={50}/g, '<hr style="border: 1px solid #334155; margin: 15px 0;">')
                .replace(/={30}/g, '<hr style="border: 1px solid #475569; margin: 10px 0;">')
                .replace(/-{30}/g, '<div style="border-bottom: 1px dashed #64748b; margin: 8px 0;"></div>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/ÃƒÆ'Ã†'Ãƒâ€šÃ‚Â¢ÃƒÆ'Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ'Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ /g, '&bull; ');
            
            analysisReport.innerHTML = formattedReport;
            
            if (resultsSection) {
                resultsSection.style.display = 'block';
            }
            
            resultsSection?.scrollIntoView({ behavior: 'smooth' });
        }

        // Store context for chat
        this.videoContext = {
            type: result.anomalies_detected !== undefined ? 'anomaly' : 'analysis',
            summary: result.report,
            video_url: result.video_url,
            processing_time: result.processing_time
        };

        // Store in sessionStorage for cross-page access
        sessionStorage.setItem('videoContext', JSON.stringify(this.videoContext));
    }

    // Dashboard Methods
    async updateDashboardStats() {
        try {
            const stats = await this.apiRequest('/status');
            
            const accidentsCount = document.getElementById('accidentsCount');
            const camerasCount = document.getElementById('camerasCount');
            const learningCount = document.getElementById('learningCount');

            if (accidentsCount) accidentsCount.textContent = stats.accidents || '0';
            if (camerasCount) camerasCount.textContent = stats.active_cameras || '24';
            if (learningCount) learningCount.textContent = stats.ai_scanned || '4,294';

        } catch (error) {
            console.error('Failed to update dashboard stats:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const activity = await this.apiRequest('/activity');
            const activityList = document.getElementById('activityList');
            
            if (activityList && activity.items) {
                activityList.innerHTML = activity.items.map(item => `
                    <div class="activity-item">
                        <div class="activity-icon ${item.type}">
                            <i class="${item.icon}"></i>
                        </div>
                        <div class="activity-content">
                            <p><strong>${item.title}:</strong> ${item.message}</p>
                            <small>${item.timestamp}</small>
                        </div>
                        <div class="activity-status ${item.read ? '' : 'unread'}"></div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    loadCameraOverview() {
        const cameraGrid = document.getElementById('cameraGrid');
        if (cameraGrid) {
            const cameras = [
                { id: 'M2', status: 'online', location: 'Production Floor' },
                { id: 'M25', status: 'offline', location: 'Warehouse' },
                { id: 'M17', status: 'online', location: 'Security Gate' },
                { id: 'A1', status: 'online', location: 'Loading Dock' },
                { id: 'B3', status: 'online', location: 'Office Area' },
                { id: 'C7', status: 'offline', location: 'Parking Lot' }
            ];

            cameraGrid.innerHTML = cameras.map(camera => `
                <div class="camera-thumbnail" data-camera="${camera.id}">
                    <div class="camera-status ${camera.status}"></div>
                    <div class="camera-label">
                        ${camera.id} - ${camera.location}
                    </div>
                </div>
            `).join('');
        }
    }

    initializeLiveMonitor() {
        const startBtn = document.getElementById('startLiveBtn');
        const stopBtn = document.getElementById('stopLiveBtn');
        const analyzeLiveBtn = document.getElementById('analyzeLiveBtn');
        const anomalyLiveBtn = document.getElementById('anomalyLiveBtn');
        const refreshVideoBtn = document.getElementById('refreshVideoBtn');
        const refreshReportsBtn = document.getElementById('refreshReportsBtn');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startLiveMonitoring());
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopLiveMonitoring());
        }
        if (analyzeLiveBtn) {
            analyzeLiveBtn.addEventListener('click', () => this.analyzeLiveFeed());
        }
        if (anomalyLiveBtn) {
            anomalyLiveBtn.addEventListener('click', () => this.checkLiveAnomalies());
        }
        if (refreshVideoBtn) {
            refreshVideoBtn.addEventListener('click', () => this.refreshLiveVideo());
        }
        if (refreshReportsBtn) {
            refreshReportsBtn.addEventListener('click', () => this.refreshLiveReports());
        }
    }

    initializeVideoAnalysis() {
        const analyzeBtn = document.getElementById('analyzeVideoBtn');
        const anomalyBtn = document.getElementById('detectAnomaliesBtn');

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.uploadAndAnalyzeVideo('analyze');
            });
        }

        if (anomalyBtn) {
            anomalyBtn.addEventListener('click', () => {
                this.uploadAndAnalyzeVideo('anomaly');
            });
        }
    }

    initializeChat() {
        const sendBtn = document.getElementById('sendChatBtn');
        const chatInput = document.getElementById('chatInput');
        const clearBtn = document.getElementById('clearChatBtn');
        const questionBtns = document.querySelectorAll('.question-btn');

        // Load video context from sessionStorage
        const storedContext = sessionStorage.getItem('videoContext');
        if (storedContext) {
            this.videoContext = JSON.parse(storedContext);
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendChatMessage());
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearChat());
        }

        questionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.question;
                if (chatInput) chatInput.value = question;
                this.sendChatMessage();
            });
        });
    }

    loadReports() {
        // Load analysis reports from sessionStorage or API
        const storedContext = sessionStorage.getItem('videoContext');
        if (storedContext) {
            const context = JSON.parse(storedContext);
            this.updateReportsDisplay(context);
        }
    }

    updateReportsDisplay(context) {
        // Update the reports page with analysis data
        const summarySection = document.querySelector('.summary-content p');
        if (summarySection && context.summary) {
            summarySection.innerHTML = context.summary.replace(/\n/g, '<br>');
        }
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');
        
        const frameRate = document.getElementById('frameRate');
        const analysisInterval = document.getElementById('analysisInterval');
        const anomalyNotifications = document.getElementById('anomalyNotifications');
        const soundAlerts = document.getElementById('soundAlerts');

        if (frameRate && settings.frameRate) frameRate.value = settings.frameRate;
        if (analysisInterval && settings.analysisInterval) analysisInterval.value = settings.analysisInterval;
        if (anomalyNotifications) anomalyNotifications.checked = settings.anomalyNotifications !== false;
        if (soundAlerts) soundAlerts.checked = settings.soundAlerts !== false;

        const saveBtn = document.getElementById('saveSettingsBtn');
        const resetBtn = document.getElementById('resetSettingsBtn');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }
    }

    saveSettings() {
        const settings = {
            frameRate: document.getElementById('frameRate')?.value || '20',
            analysisInterval: document.getElementById('analysisInterval')?.value || '20',
            anomalyNotifications: document.getElementById('anomalyNotifications')?.checked || true,
            soundAlerts: document.getElementById('soundAlerts')?.checked || true
        };

        localStorage.setItem('dashboardSettings', JSON.stringify(settings));
        this.showToast('Settings saved successfully', 'success');
    }

    resetSettings() {
        localStorage.removeItem('dashboardSettings');
        this.loadSettings();
        this.showToast('Settings reset to defaults', 'info');
    }

    startPeriodicUpdates() {
        setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.updateDashboardStats();
                this.loadRecentActivity();
            }
        }, 30000);

        setInterval(() => {
            if (this.currentPage === 'live' && this.isLiveActive) {
                this.refreshLiveVideo();
                this.refreshLiveReports();
            }
        }, 2000);
    }

    // Utility Methods
    showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        
        if (overlay) overlay.classList.add('active');
        if (text) text.textContent = message;
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <i class="toast-icon ${icons[type] || icons.info}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Live Monitoring Methods
    async startLiveMonitoring() {
        this.isLiveActive = true;
        
        // Update UI
        const startBtn = document.getElementById('startLiveBtn');
        const stopBtn = document.getElementById('stopLiveBtn');
        const analyzeLiveBtn = document.getElementById('analyzeLiveBtn');
        const anomalyLiveBtn = document.getElementById('anomalyLiveBtn');
        const streamStatus = document.getElementById('streamStatus');
        const streamFPS = document.getElementById('streamFPS');
        const streamQuality = document.getElementById('streamQuality');
        const videoDisplay = document.getElementById('liveVideoDisplay');

        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        if (analyzeLiveBtn) analyzeLiveBtn.disabled = false;
        if (anomalyLiveBtn) anomalyLiveBtn.disabled = false;
        if (streamStatus) streamStatus.textContent = 'Online';
        if (streamFPS) streamFPS.textContent = '30';
        if (streamQuality) streamQuality.textContent = '1080p';

        // Show simulated video feed
        if (videoDisplay) {
            videoDisplay.innerHTML = `
                <div class="live-video-simulation">
                    <div class="video-feed">
                        <i class="fas fa-video"></i>
                        <p>Live Camera Feed Active</p>
                        <div class="feed-indicator">
                            <span class="recording-dot"></span>
                            <small>LIVE</small>
                        </div>
                    </div>
                </div>
            `;
        }
        
        this.showToast('Live monitoring started', 'success');
    }

    stopLiveMonitoring() {
        this.isLiveActive = false;
        
        // Update UI
        const startBtn = document.getElementById('startLiveBtn');
        const stopBtn = document.getElementById('stopLiveBtn');
        const analyzeLiveBtn = document.getElementById('analyzeLiveBtn');
        const anomalyLiveBtn = document.getElementById('anomalyLiveBtn');
        const streamStatus = document.getElementById('streamStatus');
        const streamFPS = document.getElementById('streamFPS');
        const streamQuality = document.getElementById('streamQuality');
        const videoDisplay = document.getElementById('liveVideoDisplay');

        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (analyzeLiveBtn) analyzeLiveBtn.disabled = true;
        if (anomalyLiveBtn) anomalyLiveBtn.disabled = true;
        if (streamStatus) streamStatus.textContent = 'Offline';
        if (streamFPS) streamFPS.textContent = '0';
        if (streamQuality) streamQuality.textContent = 'N/A';

        // Show stopped state
        if (videoDisplay) {
            videoDisplay.innerHTML = `
                <div class="video-placeholder">
                    <i class="fas fa-video-slash"></i>
                    <p>No live feed active</p>
                </div>
            `;
        }
        
        this.showToast('Live monitoring stopped', 'info');
    }

    async analyzeLiveFeed() {
        if (!this.isLiveActive) {
            this.showToast('Please start live monitoring first', 'warning');
            return;
        }

        this.showLoading('Analyzing live feed...');

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const mockResult = {
                report: "Live feed analysis completed.\n\n" +
                       "• Current scene: Production floor monitoring\n" +
                       "• People detected: 3 individuals\n" +
                       "• Activity level: Normal operations\n" +
                       "• Safety status: All clear\n" +
                       "• Timestamp: " + new Date().toLocaleString(),
                timestamp: new Date().toISOString()
            };
            
            this.displayLiveResults(mockResult, 'analysis');
            this.showToast('Live analysis completed', 'success');
            
        } catch (error) {
            console.error('Live analysis failed:', error);
            this.showToast(`Live analysis failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async checkLiveAnomalies() {
        if (!this.isLiveActive) {
            this.showToast('Please start live monitoring first', 'warning');
            return;
        }

        this.showLoading('Checking for anomalies...');

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const mockResult = {
                report: "Anomaly detection scan completed.\n\n" +
                       "• Scanning duration: 30 seconds\n" +
                       "• Anomalies detected: 0\n" +
                       "• Risk level: Low\n" +
                       "• Next scan: Automatic in 5 minutes\n" +
                       "• Status: All systems normal",
                anomalies_detected: 0,
                timestamp: new Date().toISOString()
            };
            
            this.displayLiveResults(mockResult, 'anomaly');
            this.showToast('Anomaly check completed', 'success');
            
        } catch (error) {
            console.error('Anomaly detection failed:', error);
            this.showToast(`Anomaly detection failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayLiveResults(result, type) {
        const reportsContent = document.getElementById('liveReports');
        if (!reportsContent) return;

        const timestamp = new Date().toLocaleString();
        const resultHtml = `
            <div class="live-result-item" style="margin-bottom: 1rem; padding: 1rem; background: white; border-radius: 8px; border-left: 4px solid ${type === 'anomaly' ? '#f59e0b' : '#10b981'};">
                <div class="result-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-size: 1rem;">${type === 'anomaly' ? 'Anomaly Detection' : 'Live Analysis'}</h4>
                    <span class="result-type" style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: ${type === 'anomaly' ? '#fef3c7' : '#d1fae5'}; color: ${type === 'anomaly' ? '#d97706' : '#059669'};">${type.toUpperCase()}</span>
                </div>
                <div class="result-content" style="color: #6b7280; line-height: 1.6;">
                    ${result.report ? result.report.replace(/\n/g, '<br>') : 'No detailed report available'}
                </div>
                <small style="color: #9ca3af; font-size: 0.875rem;">${timestamp}</small>
                ${result.anomalies_detected !== undefined ? `<div class="anomaly-count" style="margin-top: 0.5rem; font-weight: 500; color: ${result.anomalies_detected > 0 ? '#dc2626' : '#059669'};">Anomalies: ${result.anomalies_detected}</div>` : ''}
            </div>
        `;

        // Add to top of reports
        if (reportsContent.innerHTML.includes('Live analysis reports will appear here')) {
            reportsContent.innerHTML = resultHtml;
        } else {
            reportsContent.innerHTML = resultHtml + reportsContent.innerHTML;
        }
    }

    refreshLiveVideo() {
        if (this.isLiveActive) {
            this.showToast('Video feed refreshed', 'info');
        } else {
            this.showToast('Start monitoring first to refresh video', 'warning');
        }
    }

    refreshLiveReports() {
        const reportsContent = document.getElementById('liveReports');
        if (reportsContent) {
            // Just show refresh message, don't clear existing reports
            this.showToast('Reports refreshed', 'info');
        }
    }

    // Chat Methods
    async sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const chatMessages = document.getElementById('chatMessages');
        
        if (!chatInput || !chatMessages || !chatInput.value.trim()) return;

        const message = chatInput.value.trim();
        chatInput.value = '';

        // Add user message
        this.addChatMessage(message, 'user');

        // Show typing indicator
        const typingIndicator = this.addTypingIndicator();

        try {
            // Get video context
            const context = this.videoContext || JSON.parse(sessionStorage.getItem('videoContext') || 'null');
            
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    context: context
                })
            });

            if (!response.ok) {
                throw new Error(`Chat request failed: ${response.status}`);
            }

            const result = await response.json();
            
            // Remove typing indicator
            typingIndicator.remove();
            
            // Add assistant response
            this.addChatMessage(result.response || 'Sorry, I could not process your request.', 'assistant');
            
        } catch (error) {
            console.error('Chat request failed:', error);
            typingIndicator.remove();
            this.addChatMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        }
    }

    addChatMessage(message, sender) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${sender === 'user' ? 'fa-user' : 'fa-robot'}"></i>
            </div>
            <div class="message-content">
                <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    addTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return null;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return typingDiv;
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        // Keep the initial assistant message
        chatMessages.innerHTML = `
            <div class="message assistant">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>Hello! I'm your AI assistant. I can help you analyze video content, discuss findings, and answer questions about the footage. Upload and analyze a video first, then ask me anything about it!</p>
                </div>
            </div>
        `;
        
        this.showToast('Chat cleared', 'info');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new VideoAnalysisDashboard();
});