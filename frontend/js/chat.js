// ═══════════════════════════════════════════════════════════════
// OMNIBOT - Chat Module
// ═══════════════════════════════════════════════════════════════

import { state, addMessageToState, clearMessages, getConversation } from './state.js';

// Send message to router
export async function sendMessage(text) {
    const { routerUrl, sharedSecret } = state.config;
    
    if (!routerUrl) {
        // Demo mode - return simulated response
        return getDemoResponse(text);
    }

    try {
        // Get challenge
        const challengeRes = await fetch(`${routerUrl}/challenge`);
        if (!challengeRes.ok) throw new Error('Failed to get challenge');
        const { challenge, timestamp } = await challengeRes.json();

        // Compute HMAC
        const body = JSON.stringify({ 
            message: text, 
            conversation: getConversation() 
        });
        const signature = await computeHMAC(sharedSecret, challenge + body);

        // Send request
        const response = await fetch(`${routerUrl}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Challenge': challenge,
                'X-Signature': signature,
                'X-Timestamp': timestamp.toString()
            },
            body
        });

        if (!response.ok) throw new Error('Chat request failed');
        const data = await response.json();
        return data.response || data.message || 'No response';
    } catch (error) {
        console.error('Chat error:', error);
        throw error;
    }
}

// Compute HMAC-SHA256
async function computeHMAC(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const key = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Add message to UI
export function addMessage(text, type, elements) {
    const message = {
        id: Date.now(),
        text,
        type,
        timestamp: new Date()
    };
    
    if (type !== 'system') {
        addMessageToState(message);
    }

    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    
    if (type === 'system') {
        messageEl.innerHTML = `
            <div class="message-avatar">⚡</div>
            <div class="message-content">
                <div class="message-bubble" style="background: var(--accent-subtle); border-color: var(--accent-primary);">
                    <p>${text}</p>
                </div>
            </div>
        `;
        // Auto-remove system messages after 3 seconds
        setTimeout(() => messageEl.remove(), 3000);
    } else {
        messageEl.innerHTML = `
            <div class="message-avatar">${type === 'ai' ? 'Ω' : 'U'}</div>
            <div class="message-content">
                <div class="message-bubble">
                    <p>${formatMessage(text)}</p>
                </div>
                <div class="message-meta">
                    <span>${formatTime(message.timestamp)}</span>
                    <div class="message-actions">
                        <button class="message-action-btn" title="Copy">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add copy functionality
        messageEl.querySelector('.message-action-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(text);
            addMessage('Copied to clipboard!', 'system', elements);
        });
    }

    elements.messagesContainer.appendChild(messageEl);
    scrollToBottom(elements);
}

// Add typing indicator
export function addTypingIndicator(elements) {
    const id = 'typing-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.className = 'message ai';
    typingEl.id = id;
    typingEl.innerHTML = `
        <div class="message-avatar">Ω</div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        </div>
    `;
    elements.messagesContainer.appendChild(typingEl);
    scrollToBottom(elements);
    return id;
}

// Remove typing indicator
export function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
}

// Clear chat
export function clearChat(elements) {
    clearMessages();
    elements.messagesContainer.innerHTML = `
        <div class="empty-state" id="emptyState">
            <div class="empty-logo">Ω</div>
            <h1 class="empty-title">Welcome to OmniBot</h1>
            <p class="empty-subtitle">Your cyberpunk AI companion. Ask me anything, or try one of these suggestions:</p>
            <div class="suggestions">
                <button class="suggestion-chip">Explain quantum computing</button>
                <button class="suggestion-chip">Write a haiku about code</button>
                <button class="suggestion-chip">Help me debug my script</button>
                <button class="suggestion-chip">What's new in tech?</button>
            </div>
        </div>
    `;
    
    // Rebind suggestions
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const input = document.getElementById('messageInput');
            if (input) {
                input.value = chip.textContent;
                input.dispatchEvent(new Event('input'));
                document.getElementById('sendBtn')?.click();
            }
        });
    });
}

// Format message (basic markdown)
function formatMessage(text) {
    return text
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

// Format time
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll to bottom
function scrollToBottom(elements) {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// Demo responses
function getDemoResponse(text) {
    const responses = [
        "Initializing neural pathways... I'm OmniBot, your cyberpunk AI assistant. I can help with coding, research, creative writing, and more. Configure my router URL in settings to connect to a real LLM backend.",
        "Processing your query through multiple cognitive matrices... That's an interesting question! In demo mode, I can show you how the interface works. Set up your router URL to get real AI responses.",
        "Accessing the global knowledge network... This is a preview of OmniBot's interface. The cyberpunk themes look great, right? Connect me to your backend to unlock full capabilities.",
        "Running quantum probability calculations... I'm currently in demo mode. Once you configure the router URL and shared secret in settings, I'll connect to your LLM infrastructure.",
        "Establishing secure neural link... Welcome to OmniBot! Try switching between themes using the sidebar. Each one is inspired by a different sci-fi classic."
    ];
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(responses[Math.floor(Math.random() * responses.length)]);
        }, 800 + Math.random() * 1200);
    });
}
