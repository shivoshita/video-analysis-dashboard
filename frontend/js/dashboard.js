// Dashboard JavaScript Module
class DashboardModule {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiBaseUrl = dashboard.apiBaseUrl;
        this.incidentsChart = null;
        this.updateInterval = null;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.accidentsCount = document.getElementById('accidentsCount');
        this.camerasCount = document.getElementById('camerasCount');
        this.learningCount = document.getElementById('learningCount');
        this.activityList = document.getElementById('activityList');
        this.cameraGrid = document.getElementById('cameraGrid');
        this.markAllReadBtn = document.getElementById('markAllRead');
        this.notificationBadge = document.getElementById('notificationBadge');
    }

    setupEventListeners() {
        if (this.markAllReadBtn) {
            this.markAllReadBtn.addEventListener('click', () => this.markAllActivitiesRead());
        }

        // Camera filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => this.filterCameras(btn.dataset.filter));
        });

        // Camera thumbnails click handler
        document.addEventListener('click', (e) => {
            if (e.target.closest('.camera-thumbnail')) {
                const cameraId = e.target.closest('.camera-thumbnail').dataset.camera;
                this.openCameraModal(cameraId);
            }
        });
    }

    async initialize() {
        await this.updateDashboardStats();
        await this.loadRecentActivity();
        this.loadCameraOverview();
        this.initializeChart();
        this.startPeriodicUpdates();
    }

    async updateDashboardStats() {
        try {
            const stats = await this.dashboard.apiRequest('/status');
            
            if (this.accidentsCount) {
                this.animateCounter(this.accidentsCount, parseInt(this.accidentsCount.textContent) || 0, stats.accidents || 0);
            }
            
            if (this.camerasCount) {
                this.animateCounter(this.camerasCount, parseInt(this.camerasCount.textContent) || 24, stats.active_cameras || 24);
            }
            
            if (this.learningCount) {
                this.animateCounter(this.learningCount, parseInt(this.learningCount.textContent.replace(/,/g, '')) || 4294, stats.ai_scanned || 4294);
            }

            // Update notification badge
            const notifications = await this.dashboard.apiRequest('/notifications');
            if (this.notificationBadge && notifications.count !== undefined) {
                this.notificationBadge.textContent = notifications.count;
                this.notificationBadge.style.display = notifications.count > 0 ? 'flex' : 'none';
            }

        } catch (error) {
            console.error('Failed to update dashboard stats:', error);
        }
    }

    animateCounter(element, startValue, endValue) {
        if (!element || startValue === endValue) return;

        const duration = 1000; // 1 second
        const startTime = performance.now();
        const difference = endValue - startValue;

        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.floor(startValue + (difference * this.easeOutQuart(progress)));
            
            if (element.id === 'learningCount') {
                element.textContent = currentValue.toLocaleString();
            } else {
                element.textContent = currentValue;
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        };

        requestAnimationFrame(updateCounter);
    }

    easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    async loadRecentActivity() {
        try {
            const response = await this.dashboard.apiRequest('/activity');
            
            if (this.activityList && response.items) {
                this.activityList.innerHTML = response.items.map(item => `
                    <div class="activity-item ${item.read ? 'read' : 'unread'}" data-id="${item.id}">
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

                // Add click handlers for activity items
                this.activityList.querySelectorAll('.activity-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const itemId = item.dataset.id;
                        this.markActivityRead(itemId, item);
                    });
                });
            }

        } catch (error) {
            console.error('Failed to load recent activity:', error);
            if (this.activityList) {
                this.activityList.innerHTML = `
                    <div class="activity-item">
                        <div class="activity-icon system">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <div class="activity-content">
                            <p><strong>System:</strong> Unable to load recent activity</p>
                            <small>Connection error</small>
                        </div>
                    </div>
                `;
            }
        }
    }

    async markActivityRead(itemId, element) {
        try {
            await this.dashboard.apiRequest(`/notifications/${itemId}/read`, {
                method: 'POST'
            });

            if (element) {
                element.classList.remove('unread');
                element.classList.add('read');
                const statusDot = element.querySelector('.activity-status');
                if (statusDot) {
                    statusDot.classList.remove('unread');
                }
            }

        } catch (error) {
            console.error('Failed to mark activity as read:', error);
        }
    }

    async markAllActivitiesRead() {
        try {
            await this.dashboard.apiRequest('/notifications/clear', {
                method: 'POST'
            });

            // Update UI
            const activityItems = this.activityList?.querySelectorAll('.activity-item.unread');
            activityItems?.forEach(item => {
                item.classList.remove('unread');
                item.classList.add('read');
                const statusDot = item.querySelector('.activity-status');
                if (statusDot) {
                    statusDot.classList.remove('unread');
                }
            });

            if (this.notificationBadge) {
                this.notificationBadge.textContent = '0';
                this.notificationBadge.style.display = 'none';
            }

            this.dashboard.showToast('All notifications marked as read', 'success');

        } catch (error) {
            console.error('Failed to mark all activities as read:', error);
            this.dashboard.showToast('Failed to clear notifications', 'error');
        }
    }

    loadCameraOverview() {
        if (!this.cameraGrid) return;

        // Mock camera data - in production, this would come from API
        const cameras = [
            { id: 'M2', status: 'online', location: 'Production Floor', category: 'production' },
            { id: 'M25', status: 'offline', location: 'Warehouse Entry', category: 'warehouse' },
            { id: 'M17', status: 'online', location: 'Security Gate', category: 'security' },
            { id: 'A1', status: 'online', location: 'Loading Dock', category: 'warehouse' },
            { id: 'B3', status: 'online', location: 'Office Area', category: 'production' },
            { id: 'C7', status: 'offline', location: 'Parking Lot', category: 'security' },
            { id: 'P1', status: 'online', location: 'Assembly Line 1', category: 'production' },
            { id: 'P2', status: 'online', location: 'Assembly Line 2', category: 'production' },
            { id: 'W1', status: 'online', location: 'Storage Area A', category: 'warehouse' },
            { id: 'W2', status: 'maintenance', location: 'Storage Area B', category: 'warehouse' },
            { id: 'S1', status: 'online', location: 'Main Entrance', category: 'security' },
            { id: 'S2', status: 'online', location: 'Emergency Exit', category: 'security' }
        ];

        this.renderCameras(cameras);
    }

    renderCameras(cameras, filter = 'all') {
        if (!this.cameraGrid) return;

        const filteredCameras = filter === 'all' 
            ? cameras 
            : cameras.filter(camera => camera.category === filter);

        this.cameraGrid.innerHTML = filteredCameras.map(camera => `
            <div class="camera-thumbnail" data-camera="${camera.id}" data-category="${camera.category}">
                <div class="camera-preview">
                    <i class="fas fa-video ${camera.status === 'online' ? 'online' : 'offline'}"></i>
                </div>
                <div class="camera-status ${camera.status}"></div>
                <div class="camera-label">
                    <div class="camera-id">${camera.id}</div>
                    <div class="camera-location">${camera.location}</div>
                </div>
            </div>
        `).join('');

        // Update filter button states
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
    }

    filterCameras(filter) {
        // Re-load cameras with filter
        const cameras = [
            { id: 'M2', status: 'online', location: 'Production Floor', category: 'production' },
            { id: 'M25', status: 'offline', location: 'Warehouse Entry', category: 'warehouse' },
            { id: 'M17', status: 'online', location: 'Security Gate', category: 'security' },
            { id: 'A1', status: 'online', location: 'Loading Dock', category: 'warehouse' },
            { id: 'B3', status: 'online', location: 'Office Area', category: 'production' },
            { id: 'C7', status: 'offline', location: 'Parking Lot', category: 'security' },
            { id: 'P1', status: 'online', location: 'Assembly Line 1', category: 'production' },
            { id: 'P2', status: 'online', location: 'Assembly Line 2', category: 'production' },
            { id: 'W1', status: 'online', location: 'Storage Area A', category: 'warehouse' },
            { id: 'W2', status: 'maintenance', location: 'Storage Area B', category: 'warehouse' },
            { id: 'S1', status: 'online', location: 'Main Entrance', category: 'security' },
            { id: 'S2', status: 'online', location: 'Emergency Exit', category: 'security' }
        ];

        this.renderCameras(cameras, filter);
    }

    openCameraModal(cameraId) {
        // Create and show camera modal
        const modal = document.createElement('div');
        modal.className = 'camera-modal-overlay';
        modal.innerHTML = `
            <div class="camera-modal">
                <div class="modal-header">
                    <h3>Camera ${cameraId}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="camera-feed-large">
                        <i class="fas fa-video"></i>
                        <p>Live feed from Camera ${cameraId}</p>
                        <small>Click "Live Monitor" to view actual feed</small>
                    </div>
                    <div class="camera-controls">
                        <button class="btn-primary" onclick="window.dashboard.showPage('live')">
                            <i class="fas fa-play"></i>
                            Go to Live Monitor
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };

        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // ESC key handler
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    initializeChart() {
        const ctx = document.getElementById('incidentsChart');
        if (!ctx) return;

        // Generate sample data for the last 7 days
        const today = new Date();
        const days = [];
        const incidents = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
            incidents.push(Math.floor(Math.random() * 15) + 1); // Random incidents 1-15
        }

        this.incidentsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Incidents',
                    data: incidents,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f1f5f9',
                        bodyColor: '#f1f5f9',
                        borderColor: '#334155',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#334155',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 12
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: '#334155',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 12
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    updateChart() {
        if (!this.incidentsChart) return;

        // Add new data point (simulate real-time update)
        const data = this.incidentsChart.data;
        const newValue = Math.floor(Math.random() * 15) + 1;
        
        // Remove first point, add new one
        data.labels.shift();
        data.labels.push(new Date().toLocaleDateString('en-US', { weekday: 'short' }));
        
        data.datasets[0].data.shift();
        data.datasets[0].data.push(newValue);
        
        this.incidentsChart.update('none');
    }

    startPeriodicUpdates() {
        // Update dashboard every 30 seconds
        this.updateInterval = setInterval(async () => {
            await this.updateDashboardStats();
            await this.loadRecentActivity();
            
            // Occasionally update chart (every 5 minutes)
            if (Math.random() < 0.1) {
                this.updateChart();
            }
        }, 30000);
    }

    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Public method to refresh all dashboard data
    async refresh() {
        await this.updateDashboardStats();
        await this.loadRecentActivity();
        this.loadCameraOverview();
    }

    // Cleanup method
    destroy() {
        this.stopPeriodicUpdates();
        if (this.incidentsChart) {
            this.incidentsChart.destroy();
            this.incidentsChart = null;
        }
    }
}

// Add modal CSS
const modalCSS = `
.camera-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(15, 23, 42, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
}

.camera-modal {
    background-color: var(--secondary-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    animation: slideIn 0.3s ease;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
    color: var(--text-primary);
    font-size: 20px;
    font-weight: 600;
}

.modal-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 24px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.modal-close:hover {
    background-color: var(--tertiary-bg);
    color: var(--text-primary);
}

.modal-body {
    padding: 24px;
}

.camera-feed-large {
    aspect-ratio: 16/9;
    background-color: var(--primary-bg);
    border-radius: var(--border-radius);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    border: 2px dashed var(--border-color);
}

.camera-feed-large i {
    font-size: 48px;
    color: var(--text-muted);
    margin-bottom: 16px;
}

.camera-feed-large p {
    color: var(--text-secondary);
    font-size: 18px;
    margin-bottom: 8px;
}

.camera-feed-large small {
    color: var(--text-muted);
    font-size: 14px;
}

.camera-controls {
    display: flex;
    justify-content: center;
}

@keyframes slideIn {
    from {
        transform: translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.camera-preview {
    width: 100%;
    height: 70%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--primary-bg);
}

.camera-preview i {
    font-size: 24px;
    color: var(--text-muted);
}

.camera-preview i.online {
    color: var(--success-color);
}

.camera-preview i.offline {
    color: var(--error-color);
}

.camera-label {
    padding: 8px;
    text-align: center;
}

.camera-id {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 14px;
}

.camera-location {
    font-size: 12px;
    color: var(--text-muted);
}
`;

// Inject modal CSS
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = modalCSS;
    document.head.appendChild(style);
}

// Extend the main dashboard class to include dashboard module
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize dashboard module when dashboard is ready
        setTimeout(() => {
            if (window.dashboard) {
                window.dashboard.dashboardModule = new DashboardModule(window.dashboard);
                
                // Override dashboard methods
                window.dashboard.updateDashboardStats = () => window.dashboard.dashboardModule.updateDashboardStats();
                window.dashboard.loadRecentActivity = () => window.dashboard.dashboardModule.loadRecentActivity();
                window.dashboard.loadCameraOverview = () => window.dashboard.dashboardModule.loadCameraOverview();
                
                // Initialize when dashboard page is first shown
                const originalInitializePage = window.dashboard.initializePage;
                window.dashboard.initializePage = function(pageId) {
                    originalInitializePage.call(this, pageId);
                    if (pageId === 'dashboard' && this.dashboardModule) {
                        this.dashboardModule.initialize();
                    }
                };
            }
        }, 100);
    });
}