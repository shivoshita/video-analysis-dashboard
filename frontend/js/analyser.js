// API Configuration
        const API_BASE = 'http://127.0.0.1:3000/api';
        
        // Global variables
        let liveTrackingActive = false;
        let liveFrameInterval = null;
        let liveReportsInterval = null;
        let selectedVideoFile = null;
        let processingInterval = 15; // Default 15 seconds

        // Tab switching
        function switchTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Add active class to selected tab
            event.target.classList.add('active');
        }

        // Live tracking functions
        async function startLiveTracking() {
            try {
                showLoading('live-video-container', 'Starting camera...');
                
                // Send current processing interval to backend BEFORE starting
        const currentInterval = parseInt(document.getElementById('processing-interval').value);
        await fetch(`${API_BASE}/set-processing-interval`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ interval: currentInterval })
        });
        
        const response = await fetch(`${API_BASE}/start-live-tracking`, {
            method: 'POST'
        });
        
        const data = await response.json();
                
                if (data.success) {
                    liveTrackingActive = true;
                    updateLiveStatus(true);
                    updateLiveButtons(true);
                    
                    // Start polling for live frame updates
                    liveFrameInterval = setInterval(updateLiveFrame, 100); // 10 FPS display
                    liveReportsInterval = setInterval(updateLiveReports, processingInterval * 1000); // User-defined interval
                    
                    showMessage('Live tracking started successfully!');
                } else {
                    showError(data.error);
                    hideLoading('live-video-container');
                }
                
            } catch (error) {
                showError('Failed to start live tracking: ' + error.message);
                hideLoading('live-video-container');
            }
        }

        async function stopLiveTracking() {
            try {
                const response = await fetch(`${API_BASE}/stop-live-tracking`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    liveTrackingActive = false;
                    updateLiveStatus(false);
                    updateLiveButtons(false);
                    
                    // Stop polling intervals
                    if (liveFrameInterval) {
                        clearInterval(liveFrameInterval);
                        liveFrameInterval = null;
                    }
                    if (liveReportsInterval) {
                        clearInterval(liveReportsInterval);
                        liveReportsInterval = null;
                    }
                    
                    // Clear video container
                    const container = document.getElementById('live-video-container');
                    container.innerHTML = `
                        <div>
                            <i class="fas fa-video-slash" style="font-size: 3rem; color: var(--grey-400);"></i>
                            <p>Camera feed will appear here</p>
                        </div>
                    `;
                    
                    showMessage('Live tracking stopped successfully!');
                } else {
                    showError(data.error);
                }
                
            } catch (error) {
                showError('Failed to stop live tracking: ' + error.message);
            }
        }

        async function updateLiveFrame() {
            if (!liveTrackingActive) return;
            
            try {
                const response = await fetch(`${API_BASE}/live-frame`);
                const data = await response.json();
                
                if (data.success && data.frame) {
                    const container = document.getElementById('live-video-container');
                    container.innerHTML = `<img src="${data.frame}" alt="Live feed">`;
                }
            } catch (error) {
                console.error('Failed to update live frame:', error);
            }
        }

        async function updateLiveReports() {
            try {
                const response = await fetch(`${API_BASE}/live-reports`);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('live-reports').textContent = data.reports;
                }
            } catch (error) {
                console.error('Failed to update live reports:', error);
            }
        }

        async function analyzeLiveVideo() {
            try {
                showLoading('live-reports', 'Analyzing current video...');
                
                const response = await fetch(`${API_BASE}/live-analysis`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                hideLoading('live-reports');
                
                if (data.success) {
                    document.getElementById('live-reports').textContent = data.analysis;
                } else {
                    showError(data.error);
                }
                
            } catch (error) {
                hideLoading('live-reports');
                showError('Failed to analyze live video: ' + error.message);
            }
        }

        async function detectLiveAnomalies() {
            try {
                showLoading('live-reports', 'Checking for anomalies...');
                
                const response = await fetch(`${API_BASE}/live-anomaly`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                hideLoading('live-reports');
                
// In both detectLiveAnomalies() and detectVideoAnomalies() functions
// After getting the data.analysis, add:
                if (data.success) {
                    let displayText = data.analysis;
                    
                    // Highlight custom anomaly sections if present
                    if (displayText.includes('CUSTOM ANOMALIES DETECTED:') && !displayText.includes('None detected')) {
                        console.log('Custom anomalies were detected and reported');
                    }
                    
                    document.getElementById('live-reports' || 'video-results').textContent = displayText;
                }
                
                else {
                    showError(data.error);
                }
                
            } catch (error) {
                hideLoading('live-reports');
                showError('Failed to detect anomalies: ' + error.message);
            }
        }

        // Video upload functions
        function initVideoUpload() {
            const uploadArea = document.getElementById('video-upload-area');
            const fileInput = document.getElementById('video-file');
            
            uploadArea.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', handleVideoFile);
            
            // Drag and drop functionality
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
                if (files.length > 0 && files[0].type.startsWith('video/')) {
                    fileInput.files = files;
                    handleVideoFile();
                }
            });
        }

        function handleVideoFile() {
            const fileInput = document.getElementById('video-file');
            const file = fileInput.files[0];
            
            if (file) {
                selectedVideoFile = file;
                
                // Show video info
                document.getElementById('video-name').textContent = `Name: ${file.name}`;
                document.getElementById('video-size').textContent = `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
                document.getElementById('video-info').style.display = 'block';
                
                // Enable buttons
                document.getElementById('analyze-video-btn').disabled = false;
                document.getElementById('detect-anomalies-btn').disabled = false;
                
                showMessage('Video uploaded successfully! You can now analyze it.');
            }
        }

        async function analyzeVideo() {
            if (!selectedVideoFile) {
                showError('Please select a video file first');
                return;
            }
            
            try {
                showLoading('video-results', 'Analyzing video with VILA AI...');
                
                const formData = new FormData();
                formData.append('file', selectedVideoFile);
                
                const response = await fetch(`${API_BASE}/upload-video-analysis`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                hideLoading('video-results');
                
                if (data.success) {
                    document.getElementById('video-results').textContent = data.analysis;
                } else {
                    showError(data.error);
                }
                
            } catch (error) {
                hideLoading('video-results');
                showError('Failed to analyze video: ' + error.message);
            }
        }

        async function detectVideoAnomalies() {
            if (!selectedVideoFile) {
                showError('Please select a video file first');
                return;
            }
            
            try {
                showLoading('video-results', 'Detecting anomalies with VILA AI...');
                
                const formData = new FormData();
                formData.append('file', selectedVideoFile);
                
                const response = await fetch(`${API_BASE}/upload-video-anomalies`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                hideLoading('video-results');
                
// In both detectLiveAnomalies() and detectVideoAnomalies() functions
// After getting the data.analysis, add:
                if (data.success) {
                    let displayText = data.analysis;
                    
                    // Highlight custom anomaly sections if present
                    if (displayText.includes('CUSTOM ANOMALIES DETECTED:') && !displayText.includes('None detected')) {
                        console.log('Custom anomalies were detected and reported');
                    }
                    
                    document.getElementById('live-reports' || 'video-results').textContent = displayText;
                }
                else {
                    showError(data.error);
                }
                
            } catch (error) {
                hideLoading('video-results');
                showError('Failed to detect anomalies: ' + error.message);
            }
        }

        // Chat functions
        async function sendChatMessage() {
            const input = document.getElementById('chat-input-field');
            const message = input.value.trim();
            
            if (!message) return;
            
            // Add user message to chat
            addChatMessage('user', message);
            input.value = '';
            
            // Show typing indicator
            const typingId = addChatMessage('assistant', 'VILA is thinking...');
            
            try {
                const response = await fetch(`${API_BASE}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                
                // Remove typing indicator
                document.getElementById(typingId).remove();
                
                if (data.success) {
                    addChatMessage('assistant', data.response);
                } else {
                    addChatMessage('assistant', 'Sorry, I encountered an error: ' + data.error);
                }
                
            } catch (error) {
                document.getElementById(typingId).remove();
                addChatMessage('assistant', 'Sorry, I could not connect to the server. Please try again.');
            }
        }

        function addChatMessage(type, content) {
            const messagesContainer = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            const messageId = 'msg-' + Date.now();
            
            messageDiv.id = messageId;
            messageDiv.className = `chat-message ${type}`;
            
            if (type === 'user') {
                messageDiv.innerHTML = `<strong>You:</strong> ${content}`;
            } else {
                messageDiv.innerHTML = `<strong>VILA AI:</strong> ${content}`;
            }
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            return messageId;
        }

        // Custom anomalies function
        async function saveCustomAnomalies(anomalies) {
            try {
                const response = await fetch(`${API_BASE}/save-custom-anomalies`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ anomalies: anomalies })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showMessage(`Successfully saved ${data.count} custom anomalies`);
                    updateCustomAnomaliesStatus();
                } else {
                    showError('Failed to save custom anomalies: ' + data.error);
                }
                
            } catch (error) {
                showError('Failed to save custom anomalies: ' + error.message);
            }
        }

        // Make this function available globally
        window.saveCustomAnomalies = saveCustomAnomalies;

        // Update custom anomalies status
        async function updateCustomAnomaliesStatus() {
            try {
                const response = await fetch(`${API_BASE}/get-custom-anomalies`);
                const data = await response.json();
                
                const statusEl = document.getElementById('custom-anomalies-status');
                if (!statusEl) return;
                
                if (data.success) {
                    const count = data.count || 0;
                    if (count > 0) {
                        statusEl.innerHTML = `<i class="fas fa-cog" style="color: var(--success);"></i><span>Custom Anomalies: ${count} Active</span>`;
                        statusEl.className = 'status-indicator status-active';
                    } else {
                        statusEl.innerHTML = `<i class="fas fa-cog" style="color: var(--warning);"></i><span>Custom Anomalies: None Configured</span>`;
                        statusEl.className = 'status-indicator status-inactive';
                    }
                } else {
                    statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i><span>Custom Anomalies: Error Loading</span>`;
                    statusEl.className = 'status-indicator status-inactive';
                }
                
            } catch (error) {
                console.error('Failed to update custom anomalies status:', error);
                const statusEl = document.getElementById('custom-anomalies-status');
                if (statusEl) {
                    statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i><span>Custom Anomalies: Connection Error</span>`;
                    statusEl.className = 'status-indicator status-inactive';
                }
            }
        }

        // Chatbot functions
        function initChatbot() {
            const trigger = document.getElementById('chatbot-trigger');
            const panel = document.getElementById('chat-panel');
            const closeBtn = document.getElementById('chat-close');
            
            let hoverTimeout;
            
            // Show chat panel on hover
            trigger.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                panel.classList.add('active');
            });
            
            // Hide chat panel when mouse leaves both trigger and panel
            trigger.addEventListener('mouseleave', () => {
                hoverTimeout = setTimeout(() => {
                    if (!panel.matches(':hover')) {
                        panel.classList.remove('active');
                    }
                }, 300);
            });
            
            panel.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
            });
            
            panel.addEventListener('mouseleave', () => {
                hoverTimeout = setTimeout(() => {
                    panel.classList.remove('active');
                }, 300);
            });
            
            // Close button
            closeBtn.addEventListener('click', () => {
                panel.classList.remove('active');
                clearTimeout(hoverTimeout);
            });
        }

        // Utility functions
        function updateLiveStatus(active) {
            const statusEl = document.getElementById('live-status');
            
            if (active) {
                statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--success);"></i><span>Camera Active</span>';
                statusEl.className = 'status-indicator status-active';
            } else {
                statusEl.innerHTML = '<i class="fas fa-circle" style="color: var(--danger);"></i><span>Camera Inactive</span>';
                statusEl.className = 'status-indicator status-inactive';
            }
        }

        function updateLiveButtons(active) {
            document.getElementById('start-live-btn').disabled = active;
            document.getElementById('stop-live-btn').disabled = !active;
            document.getElementById('live-analyze-btn').disabled = !active;
            document.getElementById('live-anomaly-btn').disabled = !active;
        }

        function showLoading(elementId, message = 'Loading...') {
            const element = document.getElementById(elementId);
            element.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner"></i>
                    <p>${message}</p>
                </div>
            `;
        }

        function hideLoading(elementId) {
            // This will be handled by the specific update functions
        }

        function showMessage(message) {
            // Simple alert for now - could be enhanced with toast notifications
            alert(message);
        }

        function showError(message) {
            alert('Error: ' + message);
        }

        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize chatbot
            initChatbot();

            updateCustomAnomaliesStatus();

            setInterval(updateCustomAnomaliesStatus, 30000);
            
            // Initialize video upload
            initVideoUpload();
            
            // Navigation functionality
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', function() {
                    const page = this.getAttribute('data-page');
                    if (page) {
                        // Remove active class from all nav items
                        document.querySelectorAll('.nav-item').forEach(navItem => {
                            navItem.classList.remove('active');
                        });
                        
                        // Add active class to clicked item
                        this.classList.add('active');
                        
                        // Here you could add navigation logic to different pages
                        console.log(`Navigating to ${page} page`);
                    }
                });
            });

            // Processing interval change handler
            document.getElementById('processing-interval').addEventListener('change', async function() {
                const newInterval = parseInt(this.value);
                processingInterval = newInterval;
                
                try {
                    console.log('Updating processing interval to:', newInterval);
                    
                    // Send to backend
                    const response = await fetch(`${API_BASE}/set-processing-interval`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ interval: newInterval })
                    });
                    
                    // Check if response is ok
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    // Check if response is JSON
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        throw new Error('Response is not JSON');
                    }
                    
                    const data = await response.json();
                    console.log('Backend response:', data);
                    
                    if (data.success) {
                        showMessage(`Processing interval updated to ${newInterval} seconds`);
                        
                        // Update live reports if tracking is active
                        if (liveTrackingActive && liveReportsInterval) {
                            clearInterval(liveReportsInterval);
                            liveReportsInterval = setInterval(updateLiveReports, newInterval * 1000);
                        }
                    } else {
                        showError('Failed to update processing interval: ' + (data.error || 'Unknown error'));
                    }
                    
                } catch (error) {
                    console.error('Processing interval update error:', error);
                    showError('Failed to update processing interval: ' + error.message);
                    
                    // Fall back to local update if backend fails
                    console.log('Falling back to local interval update');
                    if (liveTrackingActive && liveReportsInterval) {
                        clearInterval(liveReportsInterval);
                        liveReportsInterval = setInterval(updateLiveReports, newInterval * 1000);
                    }
                }
            });

            // Test function to check if backend is responding
            async function testBackendConnection() {
                try {
                    const response = await fetch(`${API_BASE}/context-status`);
                    const data = await response.json();
                    console.log('Backend connection test:', data);
                    return true;
                } catch (error) {
                    console.error('Backend connection failed:', error);
                    return false;
                }
            }

            // Call this when page loads to verify connection
            window.addEventListener('load', () => {
                setTimeout(testBackendConnection, 1000);
            });

            // Live tracking event listeners
            document.getElementById('start-live-btn').addEventListener('click', startLiveTracking);
            document.getElementById('stop-live-btn').addEventListener('click', stopLiveTracking);
            document.getElementById('live-analyze-btn').addEventListener('click', analyzeLiveVideo);
            document.getElementById('live-anomaly-btn').addEventListener('click', detectLiveAnomalies);
            document.getElementById('refresh-reports-btn').addEventListener('click', updateLiveReports);
            
            // Video analysis event listeners
            document.getElementById('analyze-video-btn').addEventListener('click', analyzeVideo);
            document.getElementById('detect-anomalies-btn').addEventListener('click', detectVideoAnomalies);
            
            // Chat event listeners
            document.getElementById('send-chat-btn').addEventListener('click', sendChatMessage);
            document.getElementById('chat-input-field').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendChatMessage();
                }
            });
            
            // Hamburger menu toggle
            const hamburger = document.getElementById('hamburger');
            const sidebar = document.getElementById('sidebar');
            
            if (hamburger && sidebar) {
                hamburger.addEventListener('click', function() {
                    sidebar.classList.toggle('active');
                });
            }
            
            // Check for saved username
            const savedUsername = localStorage.getItem('username');
            if (savedUsername) {
                const nameElement = document.getElementById('display-name');
                if (nameElement) {
                    nameElement.textContent = savedUsername;
                }
                
                const avatarImg = document.querySelector('.user-profile img');
                if (avatarImg) {
                    avatarImg.src = `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(savedUsername)}`;
                }
            }
            
            // Test button for custom anomalies (temporary for debugging)
            const testBtn = document.createElement('button');
            testBtn.id = 'test-custom-anomalies';
            testBtn.textContent = 'Test Custom Anomalies';
            testBtn.style.position = 'fixed';
            testBtn.style.top = '10px';
            testBtn.style.right = '10px';
            testBtn.style.zIndex = '9999';
            testBtn.style.background = '#007bff';
            testBtn.style.color = 'white';
            testBtn.style.border = 'none';
            testBtn.style.padding = '10px';
            testBtn.style.cursor = 'pointer';
            document.body.appendChild(testBtn);
            
            testBtn.addEventListener('click', async function() {
                // Test saving some anomalies
                const testAnomalies = [
                    {
                        name: "Test Anomaly",
                        description: "A test anomaly for debugging",
                        type: "safety",
                        criticality: "high",
                        enabled: true
                    }
                ];
                
                await saveCustomAnomalies(testAnomalies);
                
                // Test retrieving them
                const response = await fetch(`${API_BASE}/debug-custom-anomalies`);
                const data = await response.json();
                console.log('Debug response:', data);
            });
            
        }); // Single closing bracket for the ONE DOMContentLoaded event listener