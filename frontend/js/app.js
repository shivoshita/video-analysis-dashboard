// Main App JavaScript - Core functionality and navigation
class VideoAnalysisDashboard {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5000/api';
        this.currentPage = 'dashboard';
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
        
        // Initialize page
        this.showPage('dashboard');
    }

    setupEventListeners() {
        // Navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.showPage(page);
                this.setActiveNav(item);
            });
        });

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
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.showPage(page);
                this.setActiveNav(item);
            });
        });
    }

    showPage(pageId) {
        // Hide all pages
        const pages = document.querySelectorAll('.page-content');
        pages.forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            // Update page title
            const pageTitle = document.getElementById('pageTitle');
            const titles = {
                'dashboard': 'Dashboard',
                'live': 'Live Monitor',
                'analysis': 'Video Analysis',
                'chat': 'AI Chat',
                'settings': 'Settings'
            };
            if (pageTitle) {
                pageTitle.textContent = titles[pageId] || 'Dashboard';
            }

            // Page-specific initialization
            this.initializePage(pageId);
        }
    }

    setActiveNav(activeItem) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
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
            case 'analysis':
                this.initializeVideoAnalysis();
                break;
            case 'chat':
                this.initializeChat();
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

        // Show analysis report - this is the key part
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
                .replace(/Ã¢â‚¬Â¢ /g, '&bull; ');
            
            analysisReport.innerHTML = formattedReport;
            
            // CRITICAL: Show the results section
            if (resultsSection) {
                resultsSection.style.display = 'block';
            }
            
            // Scroll to results
            resultsSection?.scrollIntoView({ behavior: 'smooth' });
            
        } else {
            console.error('No report found in result:', result);
            this.showToast('Analysis completed but no report was generated', 'warning');
        }

        // Store context for chat
        this.videoContext = {
            type: result.anomalies_detected !== undefined ? 'anomaly' : 'analysis',
            summary: result.report,
            video_url: result.video_url,
            processing_time: result.processing_time
        };

        // Update chat context if chat module exists
        if (this.chatModule) {
            this.chatModule.updateVideoContext(this.videoContext);
        }

        console.log('Video context stored:', this.videoContext);
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
            // Mock camera data
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
        // Initialize live monitoring components
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

    loadSettings() {
        // Load saved settings from localStorage
        const settings = JSON.parse(localStorage.getItem('dashboardSettings') || '{}');
        
        const frameRate = document.getElementById('frameRate');
        const analysisInterval = document.getElementById('analysisInterval');
        const anomalyNotifications = document.getElementById('anomalyNotifications');
        const soundAlerts = document.getElementById('soundAlerts');

        if (frameRate && settings.frameRate) frameRate.value = settings.frameRate;
        if (analysisInterval && settings.analysisInterval) analysisInterval.value = settings.analysisInterval;
        if (anomalyNotifications) anomalyNotifications.checked = settings.anomalyNotifications !== false;
        if (soundAlerts) soundAlerts.checked = settings.soundAlerts !== false;

        // Setup settings event listeners
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
        // Update dashboard every 30 seconds
        setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.updateDashboardStats();
                this.loadRecentActivity();
            }
        }, 30000);

        // Update live feed every 2 seconds when active
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

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);

        // Manual close
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new VideoAnalysisDashboard();
});