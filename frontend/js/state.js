// ═══════════════════════════════════════════════════════════════
// OMNIBOT - State Management Module
// ═══════════════════════════════════════════════════════════════

// Application state
export const state = {
    messages: [],
    isListening: false,
    isSpeaking: false,
    currentTheme: localStorage.getItem('omnibot-theme') || 'matrix',
    config: {
        routerUrl: localStorage.getItem('omnibot-router') || '',
        sharedSecret: localStorage.getItem('omnibot-secret') || '',
        llmProvider: localStorage.getItem('omnibot-provider') || 'auto',
        voiceEnabled: localStorage.getItem('omnibot-voice') !== 'false'
    }
};

// Save config to localStorage
export function saveConfig() {
    localStorage.setItem('omnibot-router', state.config.routerUrl);
    localStorage.setItem('omnibot-secret', state.config.sharedSecret);
    localStorage.setItem('omnibot-provider', state.config.llmProvider);
}

// Save theme to localStorage
export function saveTheme() {
    localStorage.setItem('omnibot-theme', state.currentTheme);
}

// Add message to state
export function addMessageToState(message) {
    state.messages.push(message);
}

// Clear messages from state
export function clearMessages() {
    state.messages = [];
}

// Get conversation history
export function getConversation() {
    return state.messages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.text
    }));
}
