// Video Analysis Page JavaScript
class VideoAnalysis {
    constructor() {
        this.currentVideoFile = null;
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // Upload area click
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('videoFileInput');
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files[0]);
            });
        }

        // Analysis buttons
        const analyzeBtn = document.getElementById('analyzeVideoBtn');
        const anomalyBtn = document.getElementById('detectAnomaliesBtn');

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.analyzeVideo();
            });
        }

        if (anomalyBtn) {
            anomalyBtn.addEventListener('click', () => {
                this.detectAnomalies();
            });
        }
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
    }

    handleFileSelect(file) {
        if (!file) return;

        // Validate file type
        const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];
        if (!validTypes.includes(file.type)) {
            this.showToast('Please select a valid video file (MP4, AVI, MOV)', 'error');
            return;
        }

        // Validate file size (500MB max)
        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showToast('File too large. Maximum size is 500MB', 'error');
            return;
        }

        this.currentVideoFile = file;
        this.displayFileInfo(file);
        this.enableAnalysisButtons();
    }

    displayFileInfo(file) {
        const videoInfo = document.getElementById('videoInfo');
        const videoSize = document.getElementById('videoSize');
        const videoFormat = document.getElementById('videoFormat');

        if (videoInfo && videoSize && videoFormat) {
            videoSize.textContent = this.formatFileSize(file.size);
            videoFormat.textContent = file.type;
            videoInfo.style.display = 'block';
        }

        // Update upload area to show selected file
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            const content = uploadArea.querySelector('.upload-content');
            if (content) {
                content.innerHTML = `
                    <i class="fas fa-file-video"></i>
                    <h3>${file.name}</h3>
                    <p>File selected successfully</p>
                    <small>Click to select a different file</small>
                `;
            }
        }
    }

    enableAnalysisButtons() {
        const analyzeBtn = document.getElementById('analyzeVideoBtn');
        const anomalyBtn = document.getElementById('detectAnomaliesBtn');

        if (analyzeBtn) analyzeBtn.disabled = false;
        if (anomalyBtn) anomalyBtn.disabled = false;
    }

    async analyzeVideo() {
        if (!this.currentVideoFile || this.isProcessing) return;

        this.isProcessing = true;
        this.showLoading('Analyzing video...');

        try {
            const formData = new FormData();
            formData.append('video', this.currentVideoFile);

            const response = await fetch('/api/video/analyze', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.displayAnalysisResult(result);
                this.showToast('Video analysis completed successfully', 'success');
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showToast(`Analysis failed: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    async detectAnomalies() {
        if (!this.currentVideoFile || this.isProcessing) return;

        this.isProcessing = true;
        this.showLoading('Detecting anomalies...');

        try {
            const formData = new FormData();
            formData.append('video', this.currentVideoFile);

            const response = await fetch('/api/video/anomaly', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.displayAnalysisResult(result);
                
                if (result.anomalies_detected) {
                    this.showToast('Anomalies detected in video', 'warning');
                } else {
                    this.showToast('No significant anomalies detected', 'success');
                }
            } else {
                throw new Error(result.error || 'Anomaly detection failed');
            }
        } catch (error) {
            console.error('Anomaly detection error:', error);
            this.showToast(`Anomaly detection failed: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    displayAnalysisResult(result) {
        // Show analysis report
        const reportContainer = document.getElementById('analysisReport');
        if (reportContainer) {
            reportContainer.innerHTML = `
                <div class="report-content">
                    <div class="report-summary">
                        <h4>Analysis Summary</h4>
                        <p>${result.report}</p>
                    </div>
                    
                    <div class="report-metadata">
                        <div class="metadata-item">
                            <strong>Processing Time:</strong> ${result.processing_time || 'N/A'}s
                        </div>
                        <div class="metadata-item">
                            <strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}
                        </div>
                        ${result.anomalies_detected !== undefined ? 
                            `<div class="metadata-item">
                                <strong>Anomalies Detected:</strong> ${result.anomalies_detected ? 'Yes' : 'No'}
                            </div>` : ''
                        }
                    </div>
                </div>
            `;
        }

        // Show processed video if available
        if (result.video_url) {
            const videoPlayer = document.getElementById('processedVideo');
            const videoPlaceholder = document.getElementById('videoPlaceholder');
            
            if (videoPlayer && videoPlaceholder) {
                videoPlayer.src = result.video_url;
                videoPlayer.style.display = 'block';
                videoPlaceholder.style.display = 'none';
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading(text = 'Processing...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        if (overlay) overlay.style.display = 'flex';
        if (loadingText) loadingText.textContent = text;
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('analysis')) {
        window.videoAnalysis = new VideoAnalysis();
    }
});

// Make sure to prevent navigation during processing
window.addEventListener('beforeunload', (e) => {
    if (window.videoAnalysis && window.videoAnalysis.isProcessing) {
        e.preventDefault();
        e.returnValue = 'Video processing is in progress. Are you sure you want to leave?';
        return e.returnValue;
    }
});