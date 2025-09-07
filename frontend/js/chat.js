// Chat JavaScript Module - Fixed duplicate event listeners
class ChatModule {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiBaseUrl = dashboard.apiBaseUrl;
        this.chatHistory = [];
        this.hasLiveContext = false;
        this.hasUploadedContext = false;
        this.initialized = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadChatHistory();
    }

    initializeElements() {
        this.sendBtn = document.getElementById('sendChatBtn');
        this.chatInput = document.getElementById('chatInput');
        this.clearBtn = document.getElementById('clearChatBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.questionBtns = document.querySelectorAll('.question-btn');
        this.voiceInputBtn = document.getElementById('voiceInputBtn');
    }

    setupEventListeners() {
        // Prevent duplicate event listeners
        if (this.initialized) return;

        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize textarea
            this.chatInput.addEventListener('input', () => {
                this.chatInput.style.height = 'auto';
                this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 150) + 'px';
            });
        }

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearChat();
            });
        }

        // Quick question buttons - enhanced with live context awareness
        this.questionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const question = btn.dataset.question;
                if (this.chatInput) {
                    this.chatInput.value = question;
                    this.chatInput.style.height = 'auto';
                    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 150) + 'px';
                }
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
    }

    async sendMessage() {
        const message = this.chatInput?.value?.trim();
        if (!message) {
            this.dashboard.showToast('Please enter a message', 'warning');
            return;
        }

        // Add user message to UI immediately
        this.addMessageToUI('user', message);
        
        // Clear input
        if (this.chatInput) {
            this.chatInput.value = '';
            this.chatInput.style.height = 'auto';
        }

        // Show typing indicator
        const typingIndicator = this.showTypingIndicator();

        try {
            const response = await this.dashboard.apiRequest('/chat/message', {
                method: 'POST',
                body: JSON.stringify({ message: message })
            });

            // Remove typing indicator
            this.removeTypingIndicator(typingIndicator);

            if (response.success) {
                // Add assistant response to UI with context indicator
                this.addMessageToUI('assistant', response.response, response.context_source);
                
                // Update local history (but don't duplicate)
                this.chatHistory.push(
                    { role: 'user', content: message, timestamp: new Date().toISOString() },
                    { role: 'assistant', content: response.response, timestamp: new Date().toISOString(), context_source: response.context_source }
                );
            } else {
                throw new Error(response.error || 'Failed to get response');
            }

        } catch (error) {
            // Remove typing indicator
            this.removeTypingIndicator(typingIndicator);
            
            console.error('Chat message failed:', error);
            this.addMessageToUI('assistant', 'Sorry, I encountered an error processing your message. Please try again.');
            this.dashboard.showToast('Failed to send message: ' + error.message, 'error');
        }
    }

    addMessageToUI(role, content, contextSource = null) {
        if (!this.chatMessages) return;

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
            const contextIcon = contextSource === 'live' ? 
                '<i class="fas fa-broadcast-tower" style="color: #ef4444;"></i>' : 
                '<i class="fas fa-video" style="color: #06b6d4;"></i>';
            const contextText = contextSource === 'live' ? 'Live Video' : 'Uploaded Video';
            
            contextIndicator = `
                <div class="context-indicator" style="font-size: 0.8em; color: #64748b; margin-bottom: 5px; display: flex; align-items: center; gap: 5px;">
                    ${contextIcon}
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
            const response = await this.dashboard.apiRequest('/chat/history');
            
            if (response.history && Array.isArray(response.history)) {
                this.chatHistory = response.history;
                this.renderChatHistory();
            }

        } catch (error) {
            console.error('Failed to load chat history:', error);
            // Show welcome message if no history
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

        // Check if we have live monitoring or uploaded video
        const liveStatus = this.dashboard.liveMonitor ? this.dashboard.liveMonitor.getStatus() : { active: false };
        const hasVideo = this.dashboard.videoContext !== null;

        let contextInfo = '';
        if (liveStatus.active) {
            contextInfo = `
                <div class="context-status live-active" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; margin: 10px 0;">
                    <i class="fas fa-broadcast-tower" style="color: #ef4444;"></i>
                    <strong>Live Monitoring Active</strong> - Ask questions about the live video feed!
                </div>
            `;
        } else if (hasVideo) {
            contextInfo = `
                <div class="context-status video-available" style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px; margin: 10px 0;">
                    <i class="fas fa-video" style="color: #06b6d4;"></i>
                    <strong>Video Available</strong> - Ask questions about the analyzed video!
                </div>
            `;
        }

        const welcomeMessage = `Hello! I'm your AI assistant for video analysis. I can help you understand and discuss video content.

${contextInfo ? contextInfo + '\n' : ''}**How to get started:**
${liveStatus.active ? '• Ask about the current live video feed' : '• Upload and analyze a video in the "Video Analysis" section'}
${!liveStatus.active ? '• Or start live monitoring in the "Live Monitor" section' : ''}
• Then come back here to ask questions about it!

**Example questions:**
• What activities do you observe?
• How many people are in the scene?
• Are there any safety concerns?
• Describe the environment and setting
• What interactions are happening?`;

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
    }

    async clearChat() {
        try {
            const response = await this.dashboard.apiRequest('/chat/clear', {
                method: 'POST'
            });

            if (response.success) {
                this.chatHistory = [];
                this.showWelcomeMessage();
                this.dashboard.showToast('Chat history cleared', 'success');
            } else {
                throw new Error(response.error || 'Failed to clear chat');
            }

        } catch (error) {
            console.error('Failed to clear chat:', error);
            this.dashboard.showToast('Failed to clear chat history: ' + error.message, 'error');
        }
    }

    // Method to update chat when new video is analyzed (uploaded video)
    updateVideoContext(videoContext) {
        this.hasUploadedContext = true;
        
        // Add a system message when new video context is available
        const contextMessage = videoContext.type === 'anomaly' 
            ? 'A new video has been analyzed for anomalies. You can now ask me questions about the anomaly detection results!'
            : 'A new video has been analyzed. You can now ask me questions about the video content!';
        
        this.addMessageToUI('assistant', contextMessage);
        
        // Refresh welcome message if no chat history
        if (this.chatHistory.length === 0) {
            this.showWelcomeMessage();
        }
    }

    // Method to update chat when live video becomes available
    updateLiveVideoContext(liveContext) {
        this.hasLiveContext = true;
        
        // Only show message if this is the first time live monitoring starts
        if (liveContext.type === 'live_video') {
            const contextMessage = 'Live video monitoring is now active! You can ask me questions about what\'s currently happening in the live video feed.';
            this.addMessageToUI('assistant', contextMessage);
        }
        
        // Refresh welcome message to show live status
        if (this.chatHistory.length === 0) {
            this.showWelcomeMessage();
        }
    }

    // Method to handle when live monitoring stops
    updateLiveMonitoringStopped() {
        this.hasLiveContext = false;
        
        const contextMessage = 'Live video monitoring has stopped. I can still answer questions about previously uploaded videos if available.';
        this.addMessageToUI('assistant', contextMessage);
        
        // Refresh welcome message
        setTimeout(() => {
            if (this.chatHistory.length === 0) {
                this.showWelcomeMessage();
            }
        }, 1000);
    }

    // Method to get current message count
    getMessageCount() {
        return this.chatHistory.length;
    }

    // Method to export chat history
    exportChatHistory() {
        const chatData = {
            exported_at: new Date().toISOString(),
            message_count: this.chatHistory.length,
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

    // Method to check current context availability
    getContextStatus() {
        const liveStatus = this.dashboard.liveMonitor ? this.dashboard.liveMonitor.getStatus() : { active: false };
        
        return {
            hasLive: liveStatus.active,
            hasUploaded: this.hasUploadedContext,
            liveActive: liveStatus.active,
            canChat: liveStatus.active || this.hasUploadedContext
        };
    }
}

// CSS for context indicators and enhanced styling
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
`;

// Inject CSS only once
if (typeof document !== 'undefined' && !document.getElementById('chat-enhanced-styles')) {
    const style = document.createElement('style');
    style.id = 'chat-enhanced-styles';
    style.textContent = enhancedChatCSS;
    document.head.appendChild(style);
}

// Extend the main dashboard class to include chat - prevent duplicate initialization
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Only initialize once
        if (window.dashboard && !window.dashboard.chatModule) {
            window.dashboard.chatModule = new ChatModule(window.dashboard);
            console.log('ChatModule initialized');
            
            // Override video analysis to update chat context
            const originalDisplayResults = window.dashboard.displayVideoResults;
            if (originalDisplayResults) {
                window.dashboard.displayVideoResults = function(result) {
                    originalDisplayResults.call(this, result);
                    if (this.chatModule) {
                        this.chatModule.updateVideoContext(result);
                    }
                };
            }
        }
    });
}