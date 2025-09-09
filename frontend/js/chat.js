// Chat JavaScript Module - FIXED to handle ALL user input properly
class ChatModule {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiBaseUrl = dashboard.apiBaseUrl;
        this.chatHistory = [];
        this.hasLiveContext = false;
        this.hasUploadedContext = false;
        this.initialized = false;
        this.lastVideoId = null;
        this.currentContextSource = null;
        this.isProcessingMessage = false; // Prevent multiple simultaneous requests
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadChatHistory();
        this.startContextMonitoring();
    }

    initializeElements() {
        this.sendBtn = document.getElementById('sendChatBtn');
        this.chatInput = document.getElementById('chatInput');
        this.clearBtn = document.getElementById('clearChatBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.questionBtns = document.querySelectorAll('.question-btn');
        this.voiceInputBtn = document.getElementById('voiceInputBtn');
        this.contextStatus = document.getElementById('contextStatus');
        
        // Debug log
        console.log('Chat elements initialized:', {
            sendBtn: !!this.sendBtn,
            chatInput: !!this.chatInput,
            chatMessages: !!this.chatMessages,
            questionBtns: this.questionBtns.length
        });
    }

    setupEventListeners() {
        if (this.initialized) return;

        // Send button click handler
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Send button clicked');
                this.sendMessage();
            });
        }

        // Chat input enter key handler
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('Enter key pressed in chat input');
                    this.sendMessage();
                }
            });

            // Auto-resize textarea
            this.chatInput.addEventListener('input', () => {
                this.chatInput.style.height = 'auto';
                this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 150) + 'px';
            });

            // Debug: Log when user types
            this.chatInput.addEventListener('input', (e) => {
                console.log('User typing:', e.target.value);
            });
        }

        // Clear chat button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearChat();
            });
        }

        // Question buttons - properly handle both predefined and custom questions
        this.questionBtns.forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const question = btn.dataset.question;
                console.log(`Question button ${index} clicked:`, question);
                
                if (this.chatInput) {
                    this.chatInput.value = question;
                    this.chatInput.style.height = 'auto';
                    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 150) + 'px';
                }
                
                // Send the message immediately
                this.sendMessage();
            });
        });

        if (this.voiceInputBtn) {
            this.voiceInputBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.dashboard.showToast('Voice input coming soon!', 'info');
            });
        }

        this.initialized = true;
        console.log('Chat event listeners initialized');
    }

    startContextMonitoring() {
        // Monitor context status every 3 seconds
        setInterval(() => {
            this.checkContextStatus();
        }, 3000);
    }

    async checkContextStatus() {
        try {
            const response = await this.dashboard.apiRequest('/chat/context');
            
            if (response) {
                const newContextSource = response.current_context_source;
                
                if (this.currentContextSource !== newContextSource) {
                    this.currentContextSource = newContextSource;
                    this.updateContextDisplay();
                    
                    if (this.currentContextSource && newContextSource !== this.currentContextSource) {
                        this.showContextChangeNotification(newContextSource);
                    }
                }
                
                this.hasLiveContext = response.has_live_context;
                this.hasUploadedContext = response.has_uploaded_context;
            }
            
        } catch (error) {
            console.debug('Context check failed:', error);
        }
    }

    updateContextDisplay() {
        if (this.contextStatus) {
            let statusHtml = '';
            
            if (this.currentContextSource === 'live') {
                statusHtml = `
                    <div class="context-indicator active live">
                        <i class="fas fa-broadcast-tower"></i>
                        <span>Live Video Active</span>
                    </div>
                `;
            } else if (this.currentContextSource === 'live_stopped') {
                statusHtml = `
                    <div class="context-indicator available stopped">
                        <i class="fas fa-video-slash"></i>
                        <span>Last Live Session</span>
                    </div>
                `;
            } else if (this.currentContextSource === 'uploaded') {
                statusHtml = `
                    <div class="context-indicator available uploaded">
                        <i class="fas fa-video"></i>
                        <span>Uploaded Video</span>
                    </div>
                `;
            } else {
                statusHtml = `
                    <div class="context-indicator inactive">
                        <i class="fas fa-question-circle"></i>
                        <span>No Video Context</span>
                    </div>
                `;
            }
            
            this.contextStatus.innerHTML = statusHtml;
        }
    }

    showContextChangeNotification(newSource) {
        let message = '';
        switch (newSource) {
            case 'live':
                message = 'Now using live video context for chat';
                break;
            case 'live_stopped':
                message = 'Now using last live session for chat';
                break;
            case 'uploaded':
                message = 'Now using uploaded video for chat';
                break;
            default:
                message = 'Video context cleared';
        }
        
        if (message) {
            this.dashboard.showToast(message, 'info');
        }
    }

    async sendMessage() {
        // Prevent multiple simultaneous requests
        if (this.isProcessingMessage) {
            console.log('Already processing a message, ignoring');
            return;
        }

        const message = this.chatInput?.value?.trim();
        console.log('Attempting to send message:', message);

        if (!message) {
            this.dashboard.showToast('Please enter a message', 'warning');
            return;
        }

        // Set processing flag
        this.isProcessingMessage = true;

        // Disable input during processing
        if (this.chatInput) this.chatInput.disabled = true;
        if (this.sendBtn) this.sendBtn.disabled = true;

        try {
            // Add user message to UI immediately
            this.addMessageToUI('user', message);
            
            // Clear input
            if (this.chatInput) {
                this.chatInput.value = '';
                this.chatInput.style.height = 'auto';
            }

            // Show typing indicator
            const typingIndicator = this.showTypingIndicator();

            console.log('Sending message to API:', message);

            // Send to API
            const response = await this.dashboard.apiRequest('/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                    timestamp: new Date().toISOString()
                })
            });

            console.log('API response received:', response);

            // Remove typing indicator
            this.removeTypingIndicator(typingIndicator);

            if (response && response.success) {
                // Add assistant response to UI
                this.addMessageToUI('assistant', response.response, response.context_source);
                
                // Update local history
                this.chatHistory.push(
                    { role: 'user', content: message, timestamp: new Date().toISOString() },
                    { role: 'assistant', content: response.response, timestamp: new Date().toISOString(), context_source: response.context_source }
                );

                console.log('Message processed successfully');
            } else {
                throw new Error(response?.error || 'Failed to get response from server');
            }

        } catch (error) {
            console.error('Chat message failed:', error);
            
            // Remove typing indicator if still there
            const indicators = document.querySelectorAll('.typing-indicator');
            indicators.forEach(indicator => indicator.remove());
            
            // Add error message
            this.addMessageToUI('assistant', 'I encountered an error processing your message. Please try again.');
            this.dashboard.showToast('Failed to send message: ' + error.message, 'error');

        } finally {
            // Re-enable input
            if (this.chatInput) this.chatInput.disabled = false;
            if (this.sendBtn) this.sendBtn.disabled = false;
            
            // Clear processing flag
            this.isProcessingMessage = false;
            
            // Focus back on input
            if (this.chatInput) this.chatInput.focus();
        }
    }

    addMessageToUI(role, content, contextSource = null) {
        if (!this.chatMessages) {
            console.error('Chat messages container not found');
            return;
        }

        console.log(`Adding ${role} message to UI:`, content.substring(0, 100));

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Add context indicator for assistant messages
        let contextIndicator = '';
        if (role === 'assistant' && contextSource) {
            let contextIcon, contextText, contextColor;
            
            switch (contextSource) {
                case 'live':
                    contextIcon = '<i class="fas fa-broadcast-tower"></i>';
                    contextText = 'Live Video';
                    contextColor = '#ef4444';
                    break;
                case 'live_stopped':
                    contextIcon = '<i class="fas fa-video-slash"></i>';
                    contextText = 'Last Live Session';
                    contextColor = '#f59e0b';
                    break;
                case 'uploaded':
                    contextIcon = '<i class="fas fa-video"></i>';
                    contextText = 'Uploaded Video';
                    contextColor = '#06b6d4';
                    break;
                default:
                    contextIcon = '<i class="fas fa-question-circle"></i>';
                    contextText = 'General';
                    contextColor = '#64748b';
            }
            
            contextIndicator = `
                <div class="context-indicator" style="font-size: 0.8em; color: #64748b; margin-bottom: 5px; display: flex; align-items: center; gap: 5px;">
                    <span style="color: ${contextColor};">${contextIcon}</span>
                    <span>Based on ${contextText}</span>
                </div>
            `;
        }
        
        messageContent.innerHTML = contextIndicator + this.formatMessage(content);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();

        console.log('Message added to UI successfully');
    }

    formatMessage(content) {
        // Basic text formatting
        let formatted = content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');

        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

        return formatted;
    }

    showTypingIndicator() {
        if (!this.chatMessages) return null;

        console.log('Showing typing indicator');

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
        
        return typingDiv;
    }

    removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            console.log('Removing typing indicator');
            indicator.parentNode.removeChild(indicator);
        }
    }

    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    async loadChatHistory() {
        try {
            console.log('Loading chat history...');
            const response = await this.dashboard.apiRequest('/chat/history');
            
            if (response && response.history && Array.isArray(response.history)) {
                this.chatHistory = response.history;
                this.renderChatHistory();
                console.log(`Loaded ${this.chatHistory.length} chat messages`);
            } else {
                this.showWelcomeMessage();
            }

        } catch (error) {
            console.error('Failed to load chat history:', error);
            this.showWelcomeMessage();
        }
    }

    renderChatHistory() {
        if (!this.chatMessages) return;

        // Clear current messages
        this.chatMessages.innerHTML = '';

        if (this.chatHistory.length === 0) {
            this.showWelcomeMessage();
            return;
        }

        // Render all messages
        this.chatHistory.forEach(entry => {
            this.addMessageToUI(entry.role, entry.content, entry.context_source);
        });
    }

    showWelcomeMessage() {
        if (!this.chatMessages) return;

        const hasContext = this.currentContextSource !== null;
        
        let contextInfo = '';
        let suggestions = '';
        
        if (this.currentContextSource === 'live') {
            contextInfo = `
                <div class="context-status live-active" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; margin: 10px 0;">
                    <i class="fas fa-broadcast-tower" style="color: #ef4444;"></i>
                    <strong>Live Monitoring Active</strong> - I can answer questions about the current live video feed!
                </div>
            `;
            suggestions = `
**Try asking me:**
• What do you see in the current video?
• How many people are visible?
• What activities are happening?
• Are there any safety concerns?
• Describe the current scene
            `;
        } else if (this.currentContextSource === 'live_stopped') {
            contextInfo = `
                <div class="context-status live-stopped" style="background: #fef3c7; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px; margin: 10px 0;">
                    <i class="fas fa-video-slash" style="color: #f59e0b;"></i>
                    <strong>Last Live Session Available</strong> - I can answer questions about the recent live monitoring session!
                </div>
            `;
            suggestions = `
**Ask me about the last live session:**
• What did you observe in the live feed?
• Were there any anomalies detected?
• How many people were seen?
• What was the environment like?
            `;
        } else if (this.currentContextSource === 'uploaded') {
            contextInfo = `
                <div class="context-status video-available" style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px; margin: 10px 0;">
                    <i class="fas fa-video" style="color: #06b6d4;"></i>
                    <strong>Video Available</strong> - I can answer questions about the uploaded video analysis!
                </div>
            `;
            suggestions = `
**Ask me about the video:**
• What happened in the video?
• How many people were in the scene?
• What was the setting like?
• Were there any notable events?
• Can you summarize what you saw?
            `;
        } else {
            suggestions = `
**To get started:**
• Upload and analyze a video in the "Video Analysis" section
• Or start live monitoring in the "Live Monitor" section
• Then come back here to ask questions about it!

**You can ask me questions like:**
• What activities do you observe?
• How many people are in the scene?
• Are there any safety concerns?
• Describe the environment and setting
            `;
        }

        const welcomeMessage = `Hello! I'm your AI assistant for video analysis. I can help you understand and discuss video content.

${contextInfo}

${suggestions}

Feel free to ask me anything about the video content in natural language!`;

        this.chatMessages.innerHTML = `
            <div class="message assistant">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    ${this.formatMessage(welcomeMessage)}
                </div>
            </div>
        `;

        console.log('Welcome message displayed');
    }

    async clearChat() {
        try {
            const response = await this.dashboard.apiRequest('/chat/clear', {
                method: 'POST'
            });

            if (response && response.success) {
                this.chatHistory = [];
                this.showWelcomeMessage();
                this.dashboard.showToast('Chat history cleared', 'success');
            } else {
                throw new Error(response?.error || 'Failed to clear chat');
            }

        } catch (error) {
            console.error('Failed to clear chat:', error);
            this.dashboard.showToast('Failed to clear chat history: ' + error.message, 'error');
        }
    }

    // Video context handling methods
    updateVideoContext(videoContext) {
        const currentVideoId = this.generateVideoId(videoContext);
        
        if (this.lastVideoId !== currentVideoId) {
            this.hasUploadedContext = true;
            this.lastVideoId = currentVideoId;
            this.currentContextSource = 'uploaded';
            
            const contextMessage = videoContext.type === 'anomaly' 
                ? 'New video analyzed for anomalies! Ask me questions about what was detected.'
                : 'New video analyzed! Ask me questions about the video content.';
            
            this.addMessageToUI('assistant', contextMessage);
            this.updateContextDisplay();
            
            console.log('New video analyzed, chat context updated');
        }
        
        if (this.chatHistory.length === 0) {
            this.showWelcomeMessage();
        }
    }

    updateLiveVideoContext(liveContext) {
        this.hasLiveContext = true;
        this.currentContextSource = 'live';
        this.updateContextDisplay();
        
        if (liveContext.type === 'live_video') {
            const contextMessage = 'Live video monitoring is active! Ask me questions about what\'s currently happening.';
            this.addMessageToUI('assistant', contextMessage);
        }
        
        if (this.chatHistory.length === 0) {
            this.showWelcomeMessage();
        }
    }

    updateLiveMonitoringStopped() {
        this.hasLiveContext = false;
        this.currentContextSource = 'live_stopped';
        this.updateContextDisplay();
        
        const contextMessage = 'Live monitoring stopped. I can still answer questions about the last live session or any uploaded videos.';
        this.addMessageToUI('assistant', contextMessage);
        
        setTimeout(() => {
            if (this.chatHistory.length === 0) {
                this.showWelcomeMessage();
            }
        }, 1000);
    }

    generateVideoId(videoContext) {
        if (!videoContext) return null;
        
        const videoProps = [
            videoContext.filename || '',
            videoContext.duration || '',
            videoContext.timestamp || Date.now(),
            videoContext.type || '',
            JSON.stringify(videoContext.analysis || {})
        ].join('|');
        
        let hash = 0;
        for (let i = 0; i < videoProps.length; i++) {
            const char = videoProps.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return hash.toString();
    }

    resetVideoContext() {
        this.lastVideoId = null;
        this.hasUploadedContext = false;
        console.log('Video context reset - next video will trigger notification');
    }

    getMessageCount() {
        return this.chatHistory.length;
    }

    exportChatHistory() {
        const chatData = {
            exported_at: new Date().toISOString(),
            message_count: this.chatHistory.length,
            current_context_source: this.currentContextSource,
            has_live_context: this.hasLiveContext,
            has_uploaded_context: this.hasUploadedContext,
            messages: this.chatHistory
        };

        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_history_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        this.dashboard.showToast('Chat history exported', 'success');
    }

    getContextStatus() {
        return {
            currentSource: this.currentContextSource,
            hasLive: this.hasLiveContext,
            hasUploaded: this.hasUploadedContext,
            canChat: this.currentContextSource !== null,
            lastVideoId: this.lastVideoId
        };
    }
}

// Enhanced CSS for better visual feedback
const enhancedChatCSS = `
.context-indicator {
    font-size: 0.8em;
    color: #64748b;
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
}

.context-indicator.active {
    background: #dcfdf4;
    border-color: #10b981;
    color: #047857;
}

.context-indicator.available {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
}

.context-indicator.inactive {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #475569;
}

.context-status {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 10px;
    margin: 10px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.context-status.live-active {
    background: #fef2f2;
    border-color: #fecaca;
}

.context-status.live-stopped {
    background: #fef3c7;
    border-color: #fed7aa;
}

.context-status i {
    font-size: 1.1em;
}

.typing-indicator .typing-dots {
    display: flex;
    gap: 4px;
    padding: 8px 0;
}

.typing-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--text-muted);
    animation: typingBounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typingBounce {
    0%, 80%, 100% {
        transform: scale(0.8);
        opacity: 0.5;
    }
    40% {
        transform: scale(1);
        opacity: 1;
    }
}

.message-content code {
    background-color: var(--tertiary-bg);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
}

.message-content a {
    color: var(--accent-color);
    text-decoration: underline;
}

.message-content a:hover {
    color: var(--accent-hover);
}

/* Disabled state styling */
.chat-input:disabled, .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.chat-input:disabled::placeholder {
    color: #9ca3af;
}

/* Context status display at top of chat */
#contextStatus {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 12px;
}

/* Message styling improvements */
.message {
    margin-bottom: 16px;
    display: flex;
    gap: 12px;
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.message.user .message-content {
    background: #3b82f6;
    color: white;
    border-radius: 12px 12px 4px 12px;
    padding: 12px 16px;
    max-width: 70%;
    margin-left: auto;
}

.message.assistant .message-content {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px 12px 12px 4px;
    padding: 12px 16px;
    max-width: 85%;
}
`;

// Inject CSS only once
if (typeof document !== 'undefined' && !document.getElementById('chat-enhanced-styles')) {
    const style = document.createElement('style');
    style.id = 'chat-enhanced-styles';
    style.textContent = enhancedChatCSS;
    document.head.appendChild(style);
}

// Initialize chat module with enhanced debugging
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing ChatModule...');
        
        if (window.dashboard && !window.dashboard.chatModule) {
            try {
                window.dashboard.chatModule = new ChatModule(window.dashboard);
                console.log('Enhanced ChatModule initialized successfully');
                
                // Test chat functionality
                setTimeout(() => {
                    const chatInput = document.getElementById('chatInput');
                    const sendBtn = document.getElementById('sendChatBtn');
                    
                    console.log('Chat elements check:', {
                        chatInput: !!chatInput,
                        sendBtn: !!sendBtn,
                        chatInputDisabled: chatInput?.disabled,
                        sendBtnDisabled: sendBtn?.disabled
                    });
                    
                    if (chatInput && sendBtn) {
                        console.log('Chat functionality should be working properly');
                    } else {
                        console.warn('Some chat elements are missing');
                    }
                }, 1000);
                
                // Enhanced integration with video analysis
                const originalDisplayResults = window.dashboard.displayVideoResults;
                if (originalDisplayResults) {
                    window.dashboard.displayVideoResults = function(result) {
                        console.log('Video results being displayed, updating chat context');
                        originalDisplayResults.call(this, result);
                        if (this.chatModule) {
                            this.chatModule.updateVideoContext(result);
                        }
                    };
                }
                
                const originalHandleVideoUpload = window.dashboard.handleVideoUpload;
                if (originalHandleVideoUpload) {
                    window.dashboard.handleVideoUpload = function(event) {
                        if (this.chatModule) {
                            this.chatModule.resetVideoContext();
                        }
                        return originalHandleVideoUpload.call(this, event);
                    };
                }
                
            } catch (error) {
                console.error('Failed to initialize ChatModule:', error);
            }
        } else if (!window.dashboard) {
            console.error('Dashboard not found - ChatModule cannot be initialized');
        } else {
            console.log('ChatModule already exists');
        }
    });
}