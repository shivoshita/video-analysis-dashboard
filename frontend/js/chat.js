// Chat JavaScript Module
class ChatModule {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiBaseUrl = dashboard.apiBaseUrl;
        this.chatHistory = [];
        
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
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
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
            this.clearBtn.addEventListener('click', () => this.clearChat());
        }

        // Quick question buttons
        this.questionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
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
            this.voiceInputBtn.addEventListener('click', () => {
                this.dashboard.showToast('Voice input coming soon!', 'info');
            });
        }
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
                // Add assistant response to UI
                this.addMessageToUI('assistant', response.response);
                
                // Update local history
                this.chatHistory.push(
                    { role: 'user', content: message, timestamp: new Date().toISOString() },
                    { role: 'assistant', content: response.response, timestamp: new Date().toISOString() }
                );
            } else {
                throw new Error(response.error || 'Failed to get response');
            }

        } catch (error) {
            // Remove typing indicator
            this.removeTypingIndicator(typingIndicator);
            
            console.error('Chat message failed:', error);
            this.addMessageToUI('assistant', 'Sorry, I encountered an error processing your message. Please try again.');
            this.dashboard.showToast('Failed to send message', 'error');
        }
    }

    addMessageToUI(role, content) {
        if (!this.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = this.formatMessage(content);
        
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

        // Clear current messages except welcome
        this.chatMessages.innerHTML = '';

        if (this.chatHistory.length === 0) {
            this.showWelcomeMessage();
            return;
        }

        // Render all messages
        this.chatHistory.forEach(entry => {
            this.addMessageToUI(entry.role, entry.content);
        });
    }

    showWelcomeMessage() {
        if (!this.chatMessages) return;

        const welcomeMessage = `Hello! I'm your AI assistant. I can help you analyze video content, discuss findings, and answer questions about the footage. 

Upload and analyze a video first, then ask me anything about it!

**Example questions:**
• What activities did you observe?
• How many people were in the scene?
• Were there any safety concerns?
• Describe the environment and setting`;

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
            this.dashboard.showToast('Failed to clear chat history', 'error');
        }
    }

    // Method to update chat when new video is analyzed
    updateVideoContext(videoContext) {
        // Add a system message when new video context is available
        const contextMessage = videoContext.type === 'anomaly' 
            ? 'A new video has been analyzed for anomalies. You can now ask me questions about the anomaly detection results!'
            : 'A new video has been analyzed. You can now ask me questions about the video content!';
        
        this.addMessageToUI('assistant', contextMessage);
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
}

// CSS for typing indicator (add to your CSS file)
const typingCSS = `
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

// Inject CSS
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = typingCSS;
    document.head.appendChild(style);
}

// Extend the main dashboard class to include chat
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize chat when dashboard is ready
        if (window.dashboard) {
            window.dashboard.chatModule = new ChatModule(window.dashboard);
            
            // Override chat methods in main dashboard
            window.dashboard.sendChatMessage = () => window.dashboard.chatModule.sendMessage();
            window.dashboard.clearChat = () => window.dashboard.chatModule.clearChat();
            
            // Override video analysis to update chat context
            const originalDisplayResults = window.dashboard.displayVideoResults;
            window.dashboard.displayVideoResults = function(result) {
                originalDisplayResults.call(this, result);
                if (this.chatModule) {
                    this.chatModule.updateVideoContext(result);
                }
            };
        }
    });
}